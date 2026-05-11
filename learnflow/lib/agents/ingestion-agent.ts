/**
 * Ingestion Agent — lib/agents/ingestion-agent.ts
 * ================================================
 * Procesează un fișier PDF încărcat de un profesor:
 *  1) Upload în Supabase Storage (bucket: "materials")
 *  2) Extrage textul cu pdf-parse
 *  3) Împarte în chunks de ~500 tokeni (overlap 50) cu RecursiveCharacterTextSplitter
 *  4) Generează embedding pentru fiecare chunk cu Gemini text-embedding-004
 *  5) Inserează batch în tabela `chunks`
 *  6) Marchează materialul ca processed (status → "completed")
 *
 * Rulează exclusiv pe server (Next.js Server Action / Route Handler).
 */

import { createClient } from '@/utils/supabase/client';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { generateEmbeddingsBatch } from '@/lib/agents/embeddings';
// pdf-parse este un modul CommonJS — importăm dinamic pentru compatibilitate cu Next.js
import type { MaterialInsert } from '@/types/database';

// ─────────────────────────────────────────────────────────────────
// Tipuri
// ─────────────────────────────────────────────────────────────────

/**
 * Metadatele unui material educațional furnizate de profesor
 * prin MetadataForm înainte de upload.
 */
export interface MaterialMetadata {
  /** ID-ul profesorului autentificat (din Supabase Auth) */
  teacherId: string;
  /** Titlul materialului (ex: "Curs 5 – Algebră liniară") */
  title: string;
  /** Descriere opțională a materialului */
  description?: string;
  /** Clasa căreia îi este destinat materialul (ex: "10A") */
  className?: string;
}

/**
 * Rezultatul returnat de ingestPdf după procesarea completă.
 */
export interface IngestionResult {
  /** ID-ul rândului creat în tabela `materials` */
  materialId: string;
  /** URL-ul public al fișierului în Supabase Storage */
  fileUrl: string;
  /** Numărul de chunks generate și stocate */
  chunkCount: number;
}

// ─────────────────────────────────────────────────────────────────
// Constante
// ─────────────────────────────────────────────────────────────────

const STORAGE_BUCKET = 'materials';

/** ~500 tokeni ≈ 2000 caractere (1 token ≈ 4 chars în engleză/română) */
const CHUNK_SIZE = 2000;
const CHUNK_OVERLAP = 200; // ~50 tokeni

/** Dimensiunea batch-ului pentru insert în Supabase (evităm timeout) */
const INSERT_BATCH_SIZE = 50;

// Clientul Gemini este gestionat de modulul embeddings.ts (singleton + rate limiter)

// ─────────────────────────────────────────────────────────────────
// Funcții helper private
// ─────────────────────────────────────────────────────────────────

/**
 * Extrage textul brut dintr-un Buffer PDF folosind pdf-parse.
 * Importăm dinamic pentru a evita problemele cu ESM/CJS în Next.js.
 */
async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  // pdf-parse are atât build CJS cât și ESM. Importăm dinamic și gestionăm
  // ambele forme de export (modul direct sau .default)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParseModule = await import('pdf-parse');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfParse: (buf: Buffer) => Promise<{ text: string }> =
    (pdfParseModule as any).default ?? (pdfParseModule as any);
  const result = await pdfParse(buffer);
  return result.text;
}

/**
 * Împarte un text lung în chunks folosind RecursiveCharacterTextSplitter.
 * Separatorii impliciti asigură că nu tăiem propoziții la mijloc.
 */
async function splitTextIntoChunks(text: string): Promise<string[]> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
    // Separatori în ordine descrescătoare a priorității
    separators: ['\n\n', '\n', '. ', '! ', '? ', ' ', ''],
  });

  const docs = await splitter.createDocuments([text]);
  return docs.map((doc) => doc.pageContent);
}

// generateEmbedding este re-exportat din @/lib/agents/embeddings

/**
 * Inserează un batch de chunks în tabela `chunks` din Supabase.
 * Aruncă eroare dacă Supabase returnează o eroare.
 */
async function insertChunksBatch(
  supabase: ReturnType<typeof createClient>,
  materialId: string,
  chunks: Array<{ content: string; embedding: number[] }>
): Promise<void> {
  const rows = chunks.map((chunk) => ({
    material_id: materialId,
    content: chunk.content,
    // Supabase pgvector acceptă arrays JSON sau string vector
    embedding: JSON.stringify(chunk.embedding),
  }));

  const { error } = await supabase.from('chunks').insert(rows);
  if (error) {
    throw new Error(`Eroare la inserarea chunks: ${error.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────
// Funcția principală exportată
// ─────────────────────────────────────────────────────────────────

/**
 * Procesează complet un fișier PDF:
 *  upload → extragere text → chunking → embeddings → stocare DB → marcare completed
 *
 * @param file     Obiectul File primit din FormData (browser)
 * @param metadata Metadatele completate de profesor în MetadataForm
 * @returns        IngestionResult cu materialId, fileUrl și chunkCount
 *
 * @throws Error dacă orice pas din pipeline eșuează
 */
export async function ingestPdf(
  file: File,
  metadata: MaterialMetadata
): Promise<IngestionResult> {
  const supabase = createClient();

  // ── Pas 1: Creare rând `material` cu status pending ────────────────────────
  // Construim calea de stocare: materials/<teacherId>/<timestamp>-<filename>
  const timestamp = Date.now();
  const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${metadata.teacherId}/${timestamp}-${safeFileName}`;

  // Inserăm materialul în DB înainte de upload pentru a obține ID-ul
  const materialInsert: MaterialInsert = {
    teacher_id: metadata.teacherId,
    title: metadata.title,
    description: metadata.description ?? null,
    type: 'pdf',
    // Placeholder URL — îl actualizăm după upload
    file_url: '',
    status: 'processing',
    class_name: metadata.className ?? null,
  };

  const { data: materialData, error: materialError } = await supabase
    .from('materials')
    .insert(materialInsert)
    .select('id')
    .single();

  if (materialError || !materialData) {
    throw new Error(
      `Nu s-a putut crea materialul în DB: ${materialError?.message}`
    );
  }

  const materialId = materialData.id;

  try {
    // ── Pas 1b: Upload fișier în Supabase Storage ──────────────────────────
    const fileBuffer = await file.arrayBuffer();
    const fileBytes = new Uint8Array(fileBuffer);

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, fileBytes, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Upload eșuat: ${uploadError.message}`);
    }

    // Obținem URL-ul public al fișierului
    const { data: publicUrlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(storagePath);

    const fileUrl = publicUrlData.publicUrl;

    // Actualizăm file_url în DB acum că avem URL-ul real
    await supabase
      .from('materials')
      .update({ file_url: fileUrl })
      .eq('id', materialId);

    // ── Pas 2: Extragere text din PDF ───────────────────────────────────────
    const pdfBuffer = Buffer.from(fileBuffer);
    const rawText = await extractTextFromPdf(pdfBuffer);

    if (!rawText || rawText.trim().length === 0) {
      throw new Error('PDF-ul nu conține text care poate fi extras (poate fi scanat/imagine).');
    }

    // ── Pas 3: Chunking cu RecursiveCharacterTextSplitter ─────────────────
    const textChunks = await splitTextIntoChunks(rawText);

    if (textChunks.length === 0) {
      throw new Error('Nu s-au putut genera chunks din textul PDF-ului.');
    }

    // ── Pas 4 + 5: Generare embeddings + Insert batch în chunks ───────────
    // generateEmbeddingsBatch se ocupă de rate limiting (100/min) și batching (20/apel)
    const embeddings = await generateEmbeddingsBatch(textChunks);

    // Asamblăm chunks cu embeddings-urile corespunzătoare
    const embeddedChunks = textChunks.map((content, i) => ({
      content,
      // Convertim Float32Array → number[] pentru JSON serialization în Supabase
      embedding: Array.from(embeddings[i]),
    }));

    // Inserăm în DB în sub-batch-uri pentru a evita timeout-ul Supabase
    let totalChunksInserted = 0;
    for (let start = 0; start < embeddedChunks.length; start += INSERT_BATCH_SIZE) {
      const dbBatch = embeddedChunks.slice(start, start + INSERT_BATCH_SIZE);
      await insertChunksBatch(supabase, materialId, dbBatch);
      totalChunksInserted += dbBatch.length;
    }

    // ── Pas 6: Marchează materialul ca "completed" ─────────────────────────
    const { error: updateError } = await supabase
      .from('materials')
      .update({ status: 'completed' })
      .eq('id', materialId);

    if (updateError) {
      // Non-fatal: logăm eroarea dar returnăm rezultatul
      console.error(
        `[IngestionAgent] Nu s-a putut marca materialul ${materialId} ca completed:`,
        updateError.message
      );
    }

    return {
      materialId,
      fileUrl,
      chunkCount: totalChunksInserted,
    };
  } catch (err) {
    // Dacă pipeline-ul eșuează, marcăm materialul cu status "error"
    await supabase
      .from('materials')
      .update({ status: 'error' })
      .eq('id', materialId);

    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────
// Pipeline pentru materiale deja uploadate (folosit de API route)
// ─────────────────────────────────────────────────────────────────

/**
 * Raport de progres trimis de pipeline la fiecare pas important.
 * Acesta este serializat direct în tabela `ingestion_jobs`.
 */
export interface ProgressUpdate {
  /** Progres procentual 0–100 */
  progressPct: number;
  /** Descriere scurtă a pasului curent (afișată în UI) */
  currentStep: string;
  /** Numărul total de chunks (disponibil după chunking) */
  chunksTotal?: number;
  /** Numărul de chunks procesate până acum */
  chunksProcessed?: number;
}

/** Callback apelat de pipeline la fiecare actualizare de progres */
export type ProgressCallback = (update: ProgressUpdate) => Promise<void>;

/**
 * Procesează un material PDF care există deja în Supabase Storage.
 *
 * Spre deosebire de `ingestPdf` (care și uploadează fișierul), această
 * funcție presupune că materialul are deja `file_url` setat în DB și că
 * fișierul PDF este accesibil la acel URL.
 *
 * Pașii:
 *  1) Fetch metadata material din DB
 *  2) Descarcă PDF-ul de la `file_url`
 *  3) Extrage text cu pdf-parse
 *  4) Chunks cu RecursiveCharacterTextSplitter
 *  5) Generează embeddings (rate limited, batched) cu generateEmbeddingsBatch
 *  6) Insert batch în tabela `chunks`
 *  7) Marchează materialul `status = 'completed'`
 *
 * @param materialId  ID-ul materialului din tabela `materials`
 * @param supabase    Client Supabase (de preferință admin/service role)
 * @param onProgress  Callback apelat la fiecare pas pentru tracking progres
 * @returns           Numărul de chunks generate și stocate
 *
 * @throws Error dacă materialul nu există, PDF-ul nu e accesibil sau
 *               orice pas din pipeline eșuează
 */
export async function processExistingMaterial(
  materialId: string,
  supabase: ReturnType<typeof createClient>,
  onProgress: ProgressCallback
): Promise<{ chunkCount: number }> {
  // ── Pas 1: Fetch metadata material ────────────────────────────────────────
  await onProgress({ progressPct: 5, currentStep: 'Se verifică materialul' });

  const { data: material, error: materialFetchError } = await supabase
    .from('materials')
    .select('id, file_url, title, status')
    .eq('id', materialId)
    .single();

  if (materialFetchError || !material) {
    throw new Error(
      `Material ${materialId} nu a fost găsit: ${materialFetchError?.message}`
    );
  }

  if (!material.file_url) {
    throw new Error(
      `Materialul ${materialId} nu are un file_url setat — a fost uploadat?`
    );
  }

  // ── Pas 2: Descărcăm PDF-ul de la URL-ul public ───────────────────────────
  await onProgress({ progressPct: 10, currentStep: 'Se descarcă fișierul PDF' });

  const fetchResponse = await fetch(material.file_url);
  if (!fetchResponse.ok) {
    throw new Error(
      `Nu s-a putut descărca PDF-ul: ${fetchResponse.status} ${fetchResponse.statusText}`
    );
  }

  const arrayBuffer = await fetchResponse.arrayBuffer();
  const pdfBuffer = Buffer.from(arrayBuffer);

  // ── Pas 3: Extrage text din PDF ────────────────────────────────────────────
  await onProgress({ progressPct: 20, currentStep: 'Se extrage textul din PDF' });

  const rawText = await extractTextFromPdf(pdfBuffer);

  if (!rawText || rawText.trim().length === 0) {
    throw new Error(
      'PDF-ul nu conține text extractibil (poate fi un scan/imagine).'
    );
  }

  // ── Pas 4: Chunking ────────────────────────────────────────────────────────
  await onProgress({ progressPct: 30, currentStep: 'Se împarte textul în fragmente' });

  const textChunks = await splitTextIntoChunks(rawText);

  if (textChunks.length === 0) {
    throw new Error('Nu s-au putut genera fragmente din textul PDF-ului.');
  }

  await onProgress({
    progressPct: 35,
    currentStep: `${textChunks.length} fragmente create — se generează embeddings`,
    chunksTotal: textChunks.length,
    chunksProcessed: 0,
  });

  // ── Pas 5: Generare embeddings cu progres granular ────────────────────────
  // Procesăm în sub-batch-uri de INSERT_BATCH_SIZE pentru a raporta progres
  const allEmbeddings: Float32Array[] = [];
  const EMBEDDING_CHUNK = 20; // aliniat cu limita generateEmbeddingsBatch

  for (
    let start = 0;
    start < textChunks.length;
    start += EMBEDDING_CHUNK
  ) {
    const slice = textChunks.slice(start, start + EMBEDDING_CHUNK);
    const batchEmbeds = await generateEmbeddingsBatch(slice);
    allEmbeddings.push(...batchEmbeds);

    const processed = Math.min(start + EMBEDDING_CHUNK, textChunks.length);
    const pct = 35 + Math.round((processed / textChunks.length) * 50); // 35%→85%

    await onProgress({
      progressPct: pct,
      currentStep: `Embeddings: ${processed}/${textChunks.length} fragmente`,
      chunksTotal: textChunks.length,
      chunksProcessed: processed,
    });
  }

  // ── Pas 6: Insert batch în tabela chunks ──────────────────────────────────
  await onProgress({
    progressPct: 88,
    currentStep: 'Se salvează fragmentele în baza de date',
    chunksTotal: textChunks.length,
    chunksProcessed: textChunks.length,
  });

  const embeddedChunks = textChunks.map((content, i) => ({
    content,
    embedding: Array.from(allEmbeddings[i]),
  }));

  for (let start = 0; start < embeddedChunks.length; start += INSERT_BATCH_SIZE) {
    const dbBatch = embeddedChunks.slice(start, start + INSERT_BATCH_SIZE);
    await insertChunksBatch(supabase, materialId, dbBatch);
  }

  // ── Pas 7: Marchează materialul ca completed ──────────────────────────────
  await onProgress({
    progressPct: 98,
    currentStep: 'Se finalizează procesarea',
    chunksTotal: textChunks.length,
    chunksProcessed: textChunks.length,
  });

  await supabase
    .from('materials')
    .update({ status: 'completed' })
    .eq('id', materialId);

  return { chunkCount: textChunks.length };
}

// ═════════════════════════════════════════════════════════════════
// VIDEO TRANSCRIPTION PIPELINE
// Apelează microserviciul Python FastAPI și indexează transcriptul
// în pgvector păstrând timestamp-urile segmentelor.
// ═════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────
// Tipuri pentru răspunsul microserviciului /transcribe
// ─────────────────────────────────────────────────────────────────

/** Un segment Whisper cu timestamps exacte */
export interface WhisperSegment {
  /** Secunda de start din video */
  start: number;
  /** Secunda de end din video */
  end: number;
  /** Textul transcris al segmentului */
  text: string;
}

/** Răspunsul complet de la POST /transcribe */
export interface TranscribeServiceResponse {
  source: string;
  model: string;
  language: string;
  duration_seconds: number | null;
  transcript: string;
  segments: WhisperSegment[];
  processing_time_seconds: number;
}

/** Un chunk video cu timestamp-urile segmentelor incluse */
export interface VideoChunk {
  /** Textul asamblat din mai multe segmente Whisper */
  content: string;
  /** Secunda de start a primului segment din chunk */
  startSeconds: number;
  /** Secunda de end a ultimului segment din chunk */
  endSeconds: number;
  /** Numărul de segmente Whisper din care e format chunk-ul */
  segmentCount: number;
}

/** Rezultatul returnat de transcribeVideo */
export interface TranscribeVideoResult {
  /** ID-ul materialului din tabela `materials` */
  materialId: string;
  /** URL-ul video procesat */
  videoUrl: string;
  /** Textul complet al transcriptului */
  transcript: string;
  /** Limba detectată de Whisper */
  language: string;
  /** Durata video în secunde */
  durationSeconds: number | null;
  /** Numărul de chunks indexate în pgvector */
  chunkCount: number;
}

// ─────────────────────────────────────────────────────────────────
// Constante pentru video chunking
// ─────────────────────────────────────────────────────────────────

/**
 * URL-ul microserviciului de transcriere Python.
 * Configurat din env, fallback la localhost pentru dev.
 */
const TRANSCRIPTION_SERVICE_URL =
  process.env.TRANSCRIPTION_SERVICE_URL ?? 'http://localhost:8000';

/**
 * Timeout pentru request-ul HTTP către /transcribe (ms).
 * Videouri lungi (1h) pot lua 5-10 minute pentru transcriere.
 */
const TRANSCRIBE_HTTP_TIMEOUT_MS =
  parseInt(process.env.TRANSCRIBE_TIMEOUT_MS ?? '600000', 10); // 10 minute default

/**
 * Numărul maxim de segmente Whisper grupate într-un singur chunk.
 * ~5 segmente × ~7 secunde/segment ≈ 35 secunde per chunk.
 * Reglează pentru a balansa granularitate vs. context semantic.
 */
const VIDEO_SEGMENTS_PER_CHUNK = 5;

/**
 * Overlap în segmente între chunk-uri consecutive (similar cu text overlap).
 * Asigură că întrebările nu cad exact pe granița dintre chunk-uri.
 */
const VIDEO_SEGMENT_OVERLAP = 1;

// ─────────────────────────────────────────────────────────────────
// Helper: apel HTTP cu timeout și retry
// ─────────────────────────────────────────────────────────────────

/**
 * Apelează POST /transcribe pe microserviciul Python cu AbortController timeout.
 *
 * @param url             URL-ul YouTube de transcris
 * @param timeoutMs       Timeout în ms (default: TRANSCRIBE_HTTP_TIMEOUT_MS)
 * @returns               Răspunsul parsesat din microserviciu
 * @throws Error          La timeout, serviciu indisponibil sau URL invalid
 */
async function callTranscribeService(
  url: string,
  timeoutMs = TRANSCRIBE_HTTP_TIMEOUT_MS
): Promise<TranscribeServiceResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${TRANSCRIPTION_SERVICE_URL}/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try {
        const errorBody = await response.json();
        detail = errorBody.detail ?? detail;
      } catch {
        // ignore parse error
      }

      if (response.status === 413) {
        throw new Error(
          `Videoclipul este prea lung pentru transcriere: ${detail}`
        );
      }
      if (response.status === 400) {
        throw new Error(`URL video invalid sau indisponibil: ${detail}`);
      }
      if (response.status === 503) {
        throw new Error(
          `Microserviciul de transcriere nu este disponibil: ${detail}`
        );
      }
      throw new Error(
        `Eroare microserviciu /transcribe (${response.status}): ${detail}`
      );
    }

    return (await response.json()) as TranscribeServiceResponse;
  } catch (err) {
    clearTimeout(timeoutId);

    if (err instanceof Error && err.name === 'AbortError') {
      const minutes = Math.round(timeoutMs / 60_000);
      throw new Error(
        `Timeout după ${minutes} minute la transcriere. ` +
          'Videoclipul poate fi prea lung. ' +
          'Mărește TRANSCRIBE_TIMEOUT_MS sau scurtează videoul.'
      );
    }
    // Re-aruncăm erorile noastre custom + erorile de rețea
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────
// Helper: grupare segmente Whisper în chunks cu timestamp-uri
// ─────────────────────────────────────────────────────────────────

/**
 * Grupează segmentele Whisper în chunks de dimensiune fixă cu overlap.
 *
 * Strategia de grupare:
 *  - Luăm câte VIDEO_SEGMENTS_PER_CHUNK segmente consecutive
 *  - Avansăm cu (VIDEO_SEGMENTS_PER_CHUNK - VIDEO_SEGMENT_OVERLAP) la fiecare pas
 *  - Fiecare chunk păstrează timestamps exacte (start/end în secunde)
 *
 * Exemplu cu 3 segmente/chunk, overlap 1:
 *  Segmente: [0,1,2,3,4,5,6,7]
 *  Chunk 0: segs [0,1,2] → 00:00-00:21
 *  Chunk 1: segs [2,3,4] → 00:14-00:35  (overlap cu chunk 0)
 *  Chunk 2: segs [4,5,6] → 00:28-00:49
 *  Chunk 3: segs [6,7]   → 00:42-00:56  (ultimul, poate fi mai scurt)
 *
 * @param segments  Array de segmente Whisper în ordine cronologică
 * @returns         Array de VideoChunk cu text și timestamps
 */
function groupSegmentsIntoChunks(segments: WhisperSegment[]): VideoChunk[] {
  if (segments.length === 0) return [];

  const chunks: VideoChunk[] = [];
  const step = Math.max(1, VIDEO_SEGMENTS_PER_CHUNK - VIDEO_SEGMENT_OVERLAP);

  for (let i = 0; i < segments.length; i += step) {
    const slice = segments.slice(i, i + VIDEO_SEGMENTS_PER_CHUNK);
    if (slice.length === 0) break;

    // Concatăm textele cu spațiu — păstrăm punctuația originală Whisper
    const content = slice
      .map((s) => s.text.trim())
      .filter(Boolean)
      .join(' ');

    // Ignorăm chunk-urile cu text gol (pot apărea din muzică/zgomot)
    if (!content) continue;

    chunks.push({
      content,
      startSeconds: slice[0].start,
      endSeconds: slice[slice.length - 1].end,
      segmentCount: slice.length,
    });
  }

  return chunks;
}

// ─────────────────────────────────────────────────────────────────
// Helper: insert video chunks în pgvector
// ─────────────────────────────────────────────────────────────────

/**
 * Inserează un batch de VideoChunk-uri cu embeddings în tabela `chunks`.
 * Câmpurile `video_start_seconds` și `video_end_seconds` permit
 * seek-ul direct în video la redarea unui rezultat de căutare.
 */
async function insertVideoChunksBatch(
  supabase: ReturnType<typeof createClient>,
  materialId: string,
  chunks: Array<VideoChunk & { embedding: number[] }>
): Promise<void> {
  const rows = chunks.map((chunk) => ({
    material_id: materialId,
    content: chunk.content,
    video_start_seconds: chunk.startSeconds,
    video_end_seconds: chunk.endSeconds,
    // pgvector acceptă stringul JSON al vectorului
    embedding: JSON.stringify(chunk.embedding),
  }));

  const { error } = await supabase.from('chunks').insert(rows);
  if (error) {
    throw new Error(`Eroare inserare video chunks: ${error.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────
// Funcția principală exportată
// ─────────────────────────────────────────────────────────────────

/**
 * Transcrie un video YouTube și indexează transcriptul în pgvector.
 *
 * Pipeline:
 *  1. Apelează POST /transcribe pe microserviciul Python FastAPI
 *     (Whisper rulează în background în microserviciu)
 *  2. Primește segmentele cu timestamps [start, end, text]
 *  3. Grupează segmentele în chunks (VIDEO_SEGMENTS_PER_CHUNK cu overlap)
 *     → fiecare chunk știe la ce secundă din video corespunde
 *  4. Generează embeddings cu Gemini text-embedding-004
 *     (rate limited: 100 texte/min, batches de 20)
 *  5. Inserează în tabela `chunks` cu video_start_seconds, video_end_seconds
 *  6. Marchează materialul `status = 'completed'`
 *
 * @param videoUrl    URL YouTube valid
 * @param materialId  ID-ul rândului din tabela `materials` (creat anterior)
 * @param supabase    Client Supabase (preferabil admin/service role)
 * @param onProgress  Callback opțional pentru tracking progres
 *
 * @returns TranscribeVideoResult cu metadata și numărul de chunks
 *
 * @throws Error  La timeout, URL invalid, microserviciu indisponibil,
 *                erori de embedding sau de DB
 *
 * @example
 * ```ts
 * const result = await transcribeVideo(
 *   'https://youtube.com/watch?v=VIDEO_ID',
 *   materialId,
 *   supabase,
 *   async (u) => console.log(u.currentStep, u.progressPct + '%')
 * );
 * console.log(`Indexate ${result.chunkCount} chunks`);
 * ```
 */
export async function transcribeVideo(
  videoUrl: string,
  materialId: string,
  supabase: ReturnType<typeof createClient>,
  onProgress?: ProgressCallback
): Promise<TranscribeVideoResult> {

  const report = async (update: ProgressUpdate) => {
    if (onProgress) await onProgress(update);
  };

  // ── Pas 1: Apel microserviciu /transcribe ──────────────────────
  await report({
    progressPct: 5,
    currentStep: 'Se trimite videoclipul la microserviciul de transcriere',
  });

  console.log(`[TranscribeVideo] START — url=${videoUrl}, materialId=${materialId}`);
  console.log(
    `[TranscribeVideo] Timeout: ${TRANSCRIBE_HTTP_TIMEOUT_MS / 60_000} minute`
  );

  let transcribeResponse: TranscribeServiceResponse;
  try {
    transcribeResponse = await callTranscribeService(videoUrl);
  } catch (err) {
    // Marcăm materialul ca eroare înainte să re-aruncăm
    await supabase
      .from('materials')
      .update({ status: 'error' })
      .eq('id', materialId);
    throw err;
  }

  console.log(
    `[TranscribeVideo] Transcript primit — limbă: ${transcribeResponse.language}, ` +
      `segmente: ${transcribeResponse.segments.length}, ` +
      `procesare: ${transcribeResponse.processing_time_seconds}s`
  );

  await report({
    progressPct: 30,
    currentStep: `Transcriere completă (${transcribeResponse.segments.length} segmente, ` +
      `limbă: ${transcribeResponse.language})`,
  });

  // ── Pas 2: Validare transcript ─────────────────────────────────
  if (!transcribeResponse.transcript || transcribeResponse.segments.length === 0) {
    await supabase
      .from('materials')
      .update({ status: 'error' })
      .eq('id', materialId);
    throw new Error(
      'Transcriptul este gol. Videoclipul poate fi mut sau fără conținut verbal.'
    );
  }

  // ── Pas 3: Grupare segmente în chunks cu timestamps ───────────
  await report({
    progressPct: 35,
    currentStep: 'Se grupează segmentele în fragmente indexabile',
  });

  const videoChunks = groupSegmentsIntoChunks(transcribeResponse.segments);

  console.log(
    `[TranscribeVideo] ${transcribeResponse.segments.length} segmente → ` +
      `${videoChunks.length} chunks ` +
      `(${VIDEO_SEGMENTS_PER_CHUNK} segmente/chunk, overlap ${VIDEO_SEGMENT_OVERLAP})`
  );

  if (videoChunks.length === 0) {
    throw new Error('Nu s-au putut genera chunks din segmentele video.');
  }

  await report({
    progressPct: 38,
    currentStep: `${videoChunks.length} fragmente create — se generează embeddings`,
    chunksTotal: videoChunks.length,
    chunksProcessed: 0,
  });

  // ── Pas 4: Generare embeddings cu progres granular ─────────────
  const chunkTexts = videoChunks.map((c) => c.content);
  const allEmbeddings: Float32Array[] = [];
  const EMBEDDING_BATCH = 20; // aliniat cu rate limiter din embeddings.ts

  for (let start = 0; start < chunkTexts.length; start += EMBEDDING_BATCH) {
    const slice = chunkTexts.slice(start, start + EMBEDDING_BATCH);
    const batchEmbeds = await generateEmbeddingsBatch(slice);
    allEmbeddings.push(...batchEmbeds);

    const processed = Math.min(start + EMBEDDING_BATCH, chunkTexts.length);
    const pct = 38 + Math.round((processed / chunkTexts.length) * 47); // 38%→85%

    await report({
      progressPct: pct,
      currentStep: `Embeddings: ${processed}/${chunkTexts.length} fragmente`,
      chunksTotal: videoChunks.length,
      chunksProcessed: processed,
    });
  }

  // ── Pas 5: Insert în pgvector cu timestamp-uri ─────────────────
  await report({
    progressPct: 88,
    currentStep: 'Se salvează fragmentele în baza de date (pgvector)',
    chunksTotal: videoChunks.length,
    chunksProcessed: videoChunks.length,
  });

  // Asamblăm chunks cu embeddings
  const enrichedChunks = videoChunks.map((chunk, i) => ({
    ...chunk,
    embedding: Array.from(allEmbeddings[i]),
  }));

  // Insert în sub-batches pentru a evita timeout-ul Supabase
  for (let start = 0; start < enrichedChunks.length; start += INSERT_BATCH_SIZE) {
    const dbBatch = enrichedChunks.slice(start, start + INSERT_BATCH_SIZE);
    await insertVideoChunksBatch(supabase, materialId, dbBatch);
  }

  console.log(`[TranscribeVideo] ${videoChunks.length} chunks inserați în pgvector`);

  // ── Pas 6: Marchează materialul completed ──────────────────────
  await report({
    progressPct: 98,
    currentStep: 'Se finalizează indexarea',
    chunksTotal: videoChunks.length,
    chunksProcessed: videoChunks.length,
  });

  await supabase
    .from('materials')
    .update({ status: 'completed' })
    .eq('id', materialId);

  console.log(`[TranscribeVideo] DONE — ${videoChunks.length} chunks, materialId=${materialId}`);

  return {
    materialId,
    videoUrl,
    transcript: transcribeResponse.transcript,
    language: transcribeResponse.language,
    durationSeconds: transcribeResponse.duration_seconds,
    chunkCount: videoChunks.length,
  };
}
