/**
 * Embeddings Utility — lib/agents/embeddings.ts
 * ===============================================
 * Generează embeddings cu Gemini text-embedding-004 pentru array-uri de texte.
 *
 * Caracteristici:
 *  • Rate limiting: max 100 texte/minut (sliding window)
 *  • Batch-uri de maxim 20 texte per apel API (batchEmbedContents)
 *  • Retry exponențial cu jitter la erori 429 / 5xx
 *  • Returnează Float32Array[] — format compact pentru pgvector
 *
 * Utilizare:
 *  ```ts
 *  import { generateEmbeddingsBatch } from '@/lib/agents/embeddings';
 *
 *  const embeddings = await generateEmbeddingsBatch(['text 1', 'text 2']);
 *  // embeddings[0] → Float32Array(768)
 *  ```
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// ─────────────────────────────────────────────────────────────────
// Tipuri publice
// ─────────────────────────────────────────────────────────────────

/** Configurare opțională pentru generateEmbeddingsBatch */
export interface EmbeddingsBatchOptions {
  /**
   * Numărul maxim de texte procesate per minut.
   * @default 100
   */
  maxRequestsPerMinute?: number;

  /**
   * Numărul maxim de texte trimise într-un singur apel batchEmbedContents.
   * Limita Gemini API este 100; recomandăm 20 pentru latență mai mică.
   * @default 20
   */
  batchSize?: number;

  /**
   * Numărul maxim de retry-uri pentru erori tranzitorii (429, 5xx).
   * @default 5
   */
  maxRetries?: number;

  /**
   * Delay de bază (ms) pentru retry exponențial.
   * Formula: baseDelayMs * 2^attempt + jitter(0..200ms)
   * @default 1000
   */
  baseDelayMs?: number;

  /**
   * Modelul Gemini Embedding de utilizat.
   * @default 'text-embedding-004'
   */
  model?: string;
}

/** Rezultatul intern al unui batch API call */
interface BatchApiResult {
  embeddings: Float32Array[];
}

// ─────────────────────────────────────────────────────────────────
// Constante implicite
// ─────────────────────────────────────────────────────────────────

const DEFAULT_MAX_RPM = 100;
const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_BASE_DELAY_MS = 1000;
const DEFAULT_MODEL = 'text-embedding-004';

/** Coduri HTTP considerate tranzitorii (merită retry) */
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

// ─────────────────────────────────────────────────────────────────
// Rate Limiter — Sliding Window
// ─────────────────────────────────────────────────────────────────

/**
 * Rate limiter cu sliding window de 60 de secunde.
 * Permite maxim `maxCount` achiziții pe fereastră.
 *
 * Spre deosebire de token bucket, sliding window garantează
 * că niciun interval de 60s nu depășește limita, nu doar cel
 * calculat de la ultima resetare.
 */
class SlidingWindowRateLimiter {
  /** Timestamp-urile (ms) ale ultimelor achiziții din fereastră */
  private readonly timestamps: number[] = [];
  private readonly maxCount: number;
  private readonly windowMs: number;

  constructor(maxCount: number, windowMs = 60_000) {
    this.maxCount = maxCount;
    this.windowMs = windowMs;
  }

  /**
   * Achizitionează `count` sloturi din rata disponibilă.
   * Dacă nu există suficiente sloturi libere, **așteaptă** până devin disponibile.
   *
   * @param count  Numărul de sloturi solicitate (default: 1)
   */
  async acquire(count = 1): Promise<void> {
    for (let i = 0; i < count; i++) {
      await this._acquireOne();
    }
  }

  private async _acquireOne(): Promise<void> {
    // Elimină timestamp-urile expirate
    const now = Date.now();
    this._prune(now);

    if (this.timestamps.length < this.maxCount) {
      // Slot disponibil imediat
      this.timestamps.push(now);
      return;
    }

    // Nu există slot liber — calculăm cât trebuie să așteptăm
    // până cel mai vechi timestamp iese din fereastră
    const oldestTs = this.timestamps[0];
    const waitMs = this.windowMs - (now - oldestTs) + 10; // +10ms buffer

    await sleep(waitMs);

    // Recursiv după așteptare
    return this._acquireOne();
  }

  private _prune(now: number): void {
    const cutoff = now - this.windowMs;
    while (this.timestamps.length > 0 && this.timestamps[0] <= cutoff) {
      this.timestamps.shift();
    }
  }
}

// ─────────────────────────────────────────────────────────────────
// Utilitare
// ─────────────────────────────────────────────────────────────────

/** Promisă care se rezolvă după `ms` milisecunde */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Verifică dacă o eroare provine dintr-un răspuns HTTP cu cod retryable.
 * Funcționează cu GoogleGenerativeAIError și erori generice cu `.status`.
 */
function isRetryableError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message;
    // Gemini SDK aruncă mesaje de forma "429 Too Many Requests"
    const statusMatch = msg.match(/^(\d{3})/);
    if (statusMatch) {
      return RETRYABLE_STATUS_CODES.has(Number(statusMatch[1]));
    }
    // Unele SDK-uri expun `.status` sau `.statusCode` pe obiectul de eroare
    const errWithStatus = err as Error & { status?: number; statusCode?: number };
    const code = errWithStatus.status ?? errWithStatus.statusCode;
    if (code !== undefined) {
      return RETRYABLE_STATUS_CODES.has(code);
    }
  }
  return false;
}

/**
 * Împarte un array în sub-array-uri de cel mult `size` elemente.
 *
 * @example chunk(['a','b','c','d'], 2) → [['a','b'], ['c','d']]
 */
function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────
// Core: apel API cu retry exponențial
// ─────────────────────────────────────────────────────────────────

/**
 * Apelează batchEmbedContents pentru un array de texte (max 20).
 * Implementează retry exponențial cu jitter la erori tranzitorii.
 *
 * @internal
 */
async function callBatchEmbedApi(
  genAI: GoogleGenerativeAI,
  modelName: string,
  texts: string[],
  maxRetries: number,
  baseDelayMs: number
): Promise<BatchApiResult> {
  const model = genAI.getGenerativeModel({ model: modelName });

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await model.batchEmbedContents({
        requests: texts.map((text) => ({
          content: { parts: [{ text }], role: 'user' },
          model: `models/${modelName}`,
        })),
      });

      // Convertim number[] → Float32Array pentru fiecare embedding
      const embeddings = response.embeddings.map(
        (e) => new Float32Array(e.values)
      );

      return { embeddings };
    } catch (err) {
      const isLast = attempt === maxRetries;

      if (isLast || !isRetryableError(err)) {
        // Nu mai reîncercăm — aruncăm eroarea originală
        throw err;
      }

      // Delay exponențial: baseDelayMs * 2^attempt + jitter uniform [0, 200ms]
      const jitter = Math.random() * 200;
      const delay = baseDelayMs * Math.pow(2, attempt) + jitter;

      console.warn(
        `[Embeddings] Retry ${attempt + 1}/${maxRetries} după ${Math.round(delay)}ms` +
          ` (eroare: ${err instanceof Error ? err.message : String(err)})`
      );

      await sleep(delay);
    }
  }

  // Cod inaccesibil — TypeScript nu știe că bucla aruncă întotdeauna
  throw new Error('[Embeddings] Retry logic a eșuat inexplicabil.');
}

// ─────────────────────────────────────────────────────────────────
// Funcția principală exportată
// ─────────────────────────────────────────────────────────────────

/**
 * Generează embeddings cu Gemini text-embedding-004 pentru un array de texte.
 *
 * Pipeline intern:
 *  1. Împarte `texts` în batch-uri de `batchSize` (implicit 20)
 *  2. Pentru fiecare batch, achizitionează sloturi din rate limiter
 *     (sliding window, 100 texte/minut implicit)
 *  3. Apelează batchEmbedContents cu retry exponențial la 429/5xx
 *  4. Asamblează rezultatele în ordinea originală
 *
 * @param texts    Array de texte pentru care se generează embeddings
 * @param options  Configurare opțională (rate limit, batch size, retry)
 * @returns        Array de Float32Array, unul per text, în aceeași ordine
 *
 * @throws Error  Dacă GOOGLE_AI_API_KEY lipsește sau API-ul returnează eroare
 *                non-retryable
 *
 * @example
 * ```ts
 * const [emb1, emb2] = await generateEmbeddingsBatch(['Salut', 'Bună ziua']);
 * console.log(emb1.length); // 768
 * ```
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  options: EmbeddingsBatchOptions = {}
): Promise<Float32Array[]> {
  if (texts.length === 0) return [];

  // ── Rezolvă configurația ────────────────────────────────────────
  const maxRpm = options.maxRequestsPerMinute ?? DEFAULT_MAX_RPM;
  const batchSize = Math.min(options.batchSize ?? DEFAULT_BATCH_SIZE, 20); // hard cap la 20
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const modelName = options.model ?? DEFAULT_MODEL;

  // ── Inițializează clienți ───────────────────────────────────────
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error(
      '[Embeddings] GOOGLE_AI_API_KEY lipsește din variabilele de mediu. ' +
        'Adaugă-l în .env.local ca: GOOGLE_AI_API_KEY=<cheia_ta>'
    );
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  // Rate limiter partajat pentru toate batch-urile din acest apel
  const rateLimiter = new SlidingWindowRateLimiter(maxRpm);

  // ── Împarte textele în batch-uri ────────────────────────────────
  const batches = chunk(texts, batchSize);

  // Rezervăm spațiu pentru rezultate în ordinea originală
  const results = new Array<Float32Array>(texts.length);

  // ── Procesăm batch-urile secvențial (rate limiter garantează ordinea) ──
  let globalIndex = 0;

  for (const batch of batches) {
    // Achizitionăm `batch.length` sloturi din rata disponibilă
    // (un slot per text, nu per apel API)
    await rateLimiter.acquire(batch.length);

    // Apelăm API-ul cu retry
    const { embeddings } = await callBatchEmbedApi(
      genAI,
      modelName,
      batch,
      maxRetries,
      baseDelayMs
    );

    // Validare: API-ul trebuie să returneze exact atâtea embeddings câte texte
    if (embeddings.length !== batch.length) {
      throw new Error(
        `[Embeddings] Neconcordanță răspuns API: trimis ${batch.length} texte, ` +
          `primit ${embeddings.length} embeddings.`
      );
    }

    // Plasăm rezultatele la pozițiile corecte
    for (let i = 0; i < embeddings.length; i++) {
      results[globalIndex + i] = embeddings[i];
    }

    globalIndex += batch.length;
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────
// Re-export helper: un singur text (wrapper convenabil)
// ─────────────────────────────────────────────────────────────────

/**
 * Generează embedding-ul pentru un singur text.
 * Wrapper convenabil peste generateEmbeddingsBatch.
 *
 * @param text    Textul de embeddat
 * @param options Aceleași opțiuni ca generateEmbeddingsBatch
 * @returns       Float32Array(768)
 */
export async function generateEmbedding(
  text: string,
  options: EmbeddingsBatchOptions = {}
): Promise<Float32Array> {
  const [embedding] = await generateEmbeddingsBatch([text], options);
  return embedding;
}
