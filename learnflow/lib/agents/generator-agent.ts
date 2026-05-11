/**
 * Generator Agent — lib/agents/generator-agent.ts
 * ================================================
 * Generează toate materialele de studiu dintr-un singur apel Gemini Flash:
 *   • rezumat       — introducere + capitole (→ materials.summary)
 *   • notite        — bullet points max 20 (→ materials.notes)
 *   • flashcards    — 15 obiecte { termen, definitie } (→ tabela flashcards)
 *   • quiz_questions — 10 obiecte { text, raspuns, dificultate } (→ tabela quiz_questions)
 *   • plan_lectie   — { durata_min, etape[] } (→ tabela lesson_plans)
 *
 * Pipeline:
 *  1. Preia toate chunks-urile materialului din Supabase (ordonat)
 *  2. Asamblează transcriptul complet
 *  3. Trimite UN singur apel Gemini 2.0 Flash cu prompt structurat
 *  4. Parsează și validează JSON-ul returnat
 *  5. Salvează atomic prin RPC `save_generated_materials` (tranzacție PostgreSQL)
 *
 * Rulează exclusiv pe server (Server Actions / Route Handlers).
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// ─────────────────────────────────────────────────────────────────
// Tipuri pentru output-ul Gemini
// ─────────────────────────────────────────────────────────────────

/** Capitol din rezumat */
export interface RezumatCapitol {
  titlu: string;
  continut: string;
}

/** Structura completă a rezumatului */
export interface Rezumat {
  introducere: string;
  capitole: RezumatCapitol[];
}

/** Un flashcard cu termen și definiție */
export interface Flashcard {
  termen: string;
  definitie: string;
}

/** O întrebare de quiz */
export interface QuizQuestion {
  text: string;
  raspuns: string;
  dificultate: 'usor' | 'mediu' | 'greu';
}

/** O etapă din planul de lecție */
export interface EtapaPlanLectie {
  titlu: string;
  descriere: string;
  durata_min: number;
}

/** Planul de lecție complet */
export interface PlanLectie {
  durata_min: number;
  etape: EtapaPlanLectie[];
}

/** Structura completă returnată de Gemini */
export interface GeneratedMaterials {
  rezumat: Rezumat;
  notite: string[];
  flashcards: Flashcard[];
  quiz_questions: QuizQuestion[];
  plan_lectie: PlanLectie;
}

/** Rezultatul salvării în DB */
export interface GenerateResult {
  materialId: string;
  /** Numărul de flashcards inserate */
  flashcardsCount: number;
  /** Numărul de quiz questions inserate */
  quizCount: number;
  /** ID-ul planului de lecție creat */
  lessonPlanId: string;
}

// ─────────────────────────────────────────────────────────────────
// Tipul clientului Supabase (flexibil — acceptă orice client)
// ─────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = {
  from: (table: string) => any;
  rpc: (fn: string, params: Record<string, unknown>) => any;
};

// ─────────────────────────────────────────────────────────────────
// Constante
// ─────────────────────────────────────────────────────────────────

/** Modelul Gemini folosit pentru generare */
const GEMINI_MODEL = 'gemini-2.0-flash';

/** Limita maximă de caractere din transcript trimisă către Gemini */
const MAX_TRANSCRIPT_CHARS = 500_000;

// ─────────────────────────────────────────────────────────────────
// Prompt-ul structurat pentru Gemini
// ─────────────────────────────────────────────────────────────────

function buildPrompt(transcript: string): string {
  return `Ești un asistent educațional expert, specializat în crearea de materiale de studiu structurate pentru elevi și studenți.

Ai primit transcriptul complet al unui material educațional (curs, lecție sau prezentare). Sarcina ta este să analizezi conținutul în profunzime și să generezi CINCI tipuri de materiale de studiu, toate în limba română.

═══════════════════════════════════════════
TRANSCRIPTUL MATERIALULUI EDUCAȚIONAL:
═══════════════════════════════════════════
${transcript}
═══════════════════════════════════════════

Generează un obiect JSON cu EXACT structura de mai jos. Urmează fiecare specificație cu precizie.

──────────────────────────────────────────
1. REZUMAT  (cheie: "rezumat")
──────────────────────────────────────────
Un rezumat structurat al materialului, cu o introducere generală urmată de capitole tematice.

Structura:
• "introducere" — un paragraf de 3-5 propoziții care prezintă subiectul principal, contextul și relevanța materialului.
• "capitole" — un array cu 3-7 obiecte, fiecare capitol acoperind o secțiune tematică distinctă din transcript.
  Fiecare obiect capitol are:
  - "titlu": numele capitolului (scurt, descriptiv)
  - "continut": rezumatul capitolului în 2-4 propoziții, menționând conceptele cheie

Exemplu:
{
  "rezumat": {
    "introducere": "Acest material abordează principiile fundamentale ale termodinamicii, o ramură a fizicii care studiază transferul de energie termică. Sunt prezentate cele trei legi ale termodinamicii, cu aplicații practice în inginerie și viața de zi cu zi. Cursul pune accent pe înțelegerea intuitivă a conceptelor, completată de formalizarea matematică.",
    "capitole": [
      {
        "titlu": "Legea zero a termodinamicii",
        "continut": "Legea zero stabilește conceptul de echilibru termic: dacă două sisteme sunt în echilibru termic cu un al treilea, atunci sunt în echilibru termic între ele. Acest principiu stă la baza definiției temperaturii și a funcționării termometrelor."
      },
      {
        "titlu": "Primul principiu al termodinamicii",
        "continut": "Primul principiu afirmă conservarea energiei: energia internă a unui sistem se modifică prin lucru mecanic și transfer de căldură. Formula ΔU = Q - W descrie această relație. Sunt prezentate exemple cu motoare termice și procese izobare."
      }
    ]
  }
}

──────────────────────────────────────────
2. NOTIȚE  (cheie: "notite")
──────────────────────────────────────────
Un array de bullet points care surprind cele mai importante idei din material.

Reguli:
• Minimum 10, MAXIMUM 20 de bullet points
• Fiecare bullet point este o propoziție concisă (1-2 propoziții maximum)
• Acoperă concepte cheie, definiții importante, formule, relații cauză-efect
• Ordinea trebuie să urmeze fluxul logic al materialului

Exemplu:
[
  "Termodinamica studiază transformările energiei termice în alte forme de energie și invers.",
  "Echilibrul termic se atinge când două corpuri aflate în contact ajung la aceeași temperatură.",
  "Entropia unui sistem izolat nu poate scădea niciodată — al doilea principiu al termodinamicii.",
  "Procesele reversibile sunt idealizări; în realitate, toate procesele sunt ireversibile."
]

──────────────────────────────────────────
3. FLASHCARDS  (cheie: "flashcards")
──────────────────────────────────────────
Un array de EXACT 15 flashcards pentru memorare activă.

Reguli STRICTE pentru fiecare flashcard:
• "termen" — MAXIMUM 5 cuvinte. Trebuie să fie un concept, termen tehnic, formulă sau nume propriu din material. Scurt și memorabil.
• "definitie" — MAXIMUM 2 propoziții. Definiția trebuie să fie clară, precisă și auto-suficientă (înțeleasă fără context suplimentar).
• Alege termenii cei mai importanți și mai frecvent întâlniți în transcript.
• Evită duplicarea — fiecare flashcard trebuie să acopere un concept diferit.

Exemplu:
[
  {
    "termen": "Entropie",
    "definitie": "Măsură a dezordinii unui sistem termodinamic. Conform celui de-al doilea principiu, entropia universului crește constant."
  },
  {
    "termen": "Proces adiabatic",
    "definitie": "Transformare termodinamică fără schimb de căldură cu mediul exterior. Se întâlnește în compresii și expansiuni rapide ale gazelor."
  },
  {
    "termen": "Capacitate termică masică",
    "definitie": "Cantitatea de căldură necesară pentru a ridica temperatura unui kilogram de substanță cu un grad Celsius."
  }
]

──────────────────────────────────────────
4. ÎNTREBĂRI QUIZ  (cheie: "quiz_questions")
──────────────────────────────────────────
Un array de EXACT 10 întrebări cu răspunsuri, distribuite pe 3 niveluri de dificultate.

Nivelurile de dificultate:
• "usor" (3 întrebări) — Verifică recunoașterea și reamintirea faptelor. Întrebări directe de tip „Ce este...?", „Care este...?", „Cine a...?". Răspunsul se găsește explicit în transcript.
• "mediu" (4 întrebări) — Verifică înțelegerea și aplicarea. Întrebări de tip „Explică de ce...", „Care este diferența între...", „Ce se întâmplă dacă...". Necesită conectarea a două sau mai multe concepte.
• "greu" (3 întrebări) — Verifică analiza, sinteza și evaluarea. Întrebări de tip „Compară și contrastează...", „Argumentează...", „Proiectează un experiment care...". Necesită gândire critică și transfer de cunoștințe.

Reguli:
• Câmpul "text" conține întrebarea completă, formulată clar.
• Câmpul "raspuns" conține răspunsul corect, complet (1-3 propoziții).
• Câmpul "dificultate" este STRICT unul din: "usor", "mediu", "greu".
• Ordinea: primele 3 ușoare, următoarele 4 medii, ultimele 3 grele.

Exemplu:
[
  {
    "text": "Ce studiază termodinamica?",
    "raspuns": "Termodinamica studiază transformările energiei termice în alte forme de energie, relațiile dintre căldură, lucru mecanic și proprietățile macroscopice ale materiei.",
    "dificultate": "usor"
  },
  {
    "text": "Explică de ce un motor termic nu poate avea randament de 100%.",
    "raspuns": "Conform celui de-al doilea principiu al termodinamicii, o parte din energia termică este întotdeauna cedată sursei reci. Randamentul maxim teoretic este cel al ciclului Carnot, care depinde de temperaturile surselor.",
    "dificultate": "mediu"
  },
  {
    "text": "Proiectează un argument prin care să demonstrezi că al doilea principiu al termodinamicii nu este încălcat de organismele vii care creează ordine din dezordine.",
    "raspuns": "Organismele vii sunt sisteme deschise care consumă energie din mediu. Deși scad entropia locală prin organizarea moleculelor, cresc entropia totală a universului prin disiparea căldurii metabolice. Al doilea principiu se aplică doar sistemelor izolate.",
    "dificultate": "greu"
  }
]

──────────────────────────────────────────
5. PLAN DE LECȚIE  (cheie: "plan_lectie")
──────────────────────────────────────────
Un plan structurat pentru predarea materialului într-o lecție.

Structura:
• "durata_min" — durata totală a lecției în minute (45, 50, 60 sau 90, alege ce se potrivește volumului de conținut)
• "etape" — array de 4-8 etape, fiecare cu:
  - "titlu": numele etapei (ex: "Introducere și captarea atenției")
  - "descriere": ce face profesorul și ce fac elevii în această etapă (1-2 propoziții)
  - "durata_min": durata etapei în minute (număr întreg)
• IMPORTANT: Suma câmpurilor "durata_min" din toate etapele TREBUIE să fie egală cu "durata_min" de la nivelul planului.

Exemplu:
{
  "plan_lectie": {
    "durata_min": 50,
    "etape": [
      {
        "titlu": "Captarea atenției",
        "descriere": "Profesorul prezintă un experiment demonstrativ sau un videoclip scurt legat de subiect. Elevii observă și formulează întrebări.",
        "durata_min": 5
      },
      {
        "titlu": "Reactualizarea cunoștințelor",
        "descriere": "Discuție frontală despre noțiunile din lecția anterioară. Elevii răspund la 2-3 întrebări de verificare.",
        "durata_min": 7
      },
      {
        "titlu": "Predarea noului conținut",
        "descriere": "Prezentare interactivă a conceptelor noi cu exemple concrete. Se folosesc diagrame și scheme la tablă.",
        "durata_min": 18
      },
      {
        "titlu": "Activitate practică",
        "descriere": "Elevii rezolvă în perechi 2-3 exerciții aplicative. Profesorul monitorizează și oferă feedback individual.",
        "durata_min": 12
      },
      {
        "titlu": "Recapitulare și evaluare formativă",
        "descriere": "Quiz rapid oral sau scris (3-5 întrebări). Se clarifică eventualele neînțelegeri.",
        "durata_min": 5
      },
      {
        "titlu": "Tema pentru acasă",
        "descriere": "Se prezintă tema și se explică cerințele. Elevii notează în caiete.",
        "durata_min": 3
      }
    ]
  }
}

══════════════════════════════════════════
SPECIFICAȚII FINALE OBLIGATORII:
══════════════════════════════════════════
• Toate textele TREBUIE să fie în limba ROMÂNĂ.
• Conținutul trebuie să fie fidel transcriptului — nu inventa informații care nu apar în material.
• Respectă EXACT numerele cerute: 15 flashcards, 10 quiz_questions (3 ușoare + 4 medii + 3 grele), max 20 notițe.
• Flashcards: "termen" — max 5 cuvinte; "definitie" — max 2 propoziții.
• Structura JSON trebuie să conțină EXACT cheile: "rezumat", "notite", "flashcards", "quiz_questions", "plan_lectie".

Returnează DOAR JSON valid, fără text înainte sau după.`;
}

// ─────────────────────────────────────────────────────────────────
// Validare output Gemini
// ─────────────────────────────────────────────────────────────────

/**
 * Validează structura completă a materialelor generate.
 * Aruncă eroare descriptivă dacă ceva lipsește sau este invalid.
 */
function validateGeneratedMaterials(data: unknown): GeneratedMaterials {
  if (!data || typeof data !== 'object') {
    throw new Error('[GeneratorAgent] Răspunsul Gemini nu este un obiect valid.');
  }

  const obj = data as Record<string, unknown>;

  // ── Validare rezumat ────────────────────────────────────────────
  if (!obj.rezumat || typeof obj.rezumat !== 'object') {
    throw new Error('[GeneratorAgent] Câmpul "rezumat" lipsește sau nu este un obiect.');
  }

  const rezumat = obj.rezumat as Record<string, unknown>;
  if (typeof rezumat.introducere !== 'string' || rezumat.introducere.length < 10) {
    throw new Error('[GeneratorAgent] "rezumat.introducere" lipsește sau este prea scurt.');
  }
  if (!Array.isArray(rezumat.capitole) || rezumat.capitole.length === 0) {
    throw new Error('[GeneratorAgent] "rezumat.capitole" trebuie să fie un array non-vid.');
  }
  for (const cap of rezumat.capitole) {
    if (typeof cap.titlu !== 'string' || typeof cap.continut !== 'string') {
      throw new Error('[GeneratorAgent] Fiecare capitol trebuie să aibă "titlu" și "continut".');
    }
  }

  // ── Validare notite ─────────────────────────────────────────────
  if (!Array.isArray(obj.notite) || obj.notite.length === 0) {
    throw new Error('[GeneratorAgent] "notite" trebuie să fie un array non-vid.');
  }
  if (obj.notite.length > 20) {
    // Trunchiăm la 20 în loc să aruncăm eroare
    (obj as Record<string, unknown>).notite = (obj.notite as string[]).slice(0, 20);
  }
  for (const nota of obj.notite as unknown[]) {
    if (typeof nota !== 'string') {
      throw new Error('[GeneratorAgent] Fiecare element din "notite" trebuie să fie un string.');
    }
  }

  // ── Validare flashcards ─────────────────────────────────────────
  if (!Array.isArray(obj.flashcards) || obj.flashcards.length === 0) {
    throw new Error('[GeneratorAgent] "flashcards" trebuie să fie un array non-vid.');
  }
  for (const fc of obj.flashcards as Record<string, unknown>[]) {
    if (typeof fc.termen !== 'string' || typeof fc.definitie !== 'string') {
      throw new Error('[GeneratorAgent] Fiecare flashcard trebuie să aibă "termen" și "definitie".');
    }
  }

  // ── Validare quiz_questions ─────────────────────────────────────
  if (!Array.isArray(obj.quiz_questions) || obj.quiz_questions.length === 0) {
    throw new Error('[GeneratorAgent] "quiz_questions" trebuie să fie un array non-vid.');
  }
  const validDifficulties = new Set(['usor', 'mediu', 'greu']);
  for (const q of obj.quiz_questions as Record<string, unknown>[]) {
    if (typeof q.text !== 'string' || typeof q.raspuns !== 'string') {
      throw new Error('[GeneratorAgent] Fiecare quiz_question trebuie să aibă "text" și "raspuns".');
    }
    if (!validDifficulties.has(q.dificultate as string)) {
      // Corectăm automat dificultatea invalidă
      q.dificultate = 'mediu';
    }
  }

  // ── Validare plan_lectie ────────────────────────────────────────
  if (!obj.plan_lectie || typeof obj.plan_lectie !== 'object') {
    throw new Error('[GeneratorAgent] "plan_lectie" lipsește sau nu este un obiect.');
  }

  const plan = obj.plan_lectie as Record<string, unknown>;
  if (typeof plan.durata_min !== 'number' || plan.durata_min <= 0) {
    throw new Error('[GeneratorAgent] "plan_lectie.durata_min" trebuie să fie un număr pozitiv.');
  }
  if (!Array.isArray(plan.etape) || plan.etape.length === 0) {
    throw new Error('[GeneratorAgent] "plan_lectie.etape" trebuie să fie un array non-vid.');
  }
  for (const etapa of plan.etape as Record<string, unknown>[]) {
    if (typeof etapa.titlu !== 'string' || typeof etapa.descriere !== 'string') {
      throw new Error('[GeneratorAgent] Fiecare etapă trebuie să aibă "titlu" și "descriere".');
    }
    if (typeof etapa.durata_min !== 'number') {
      throw new Error('[GeneratorAgent] Fiecare etapă trebuie să aibă "durata_min" numeric.');
    }
  }

  return obj as unknown as GeneratedMaterials;
}

// ─────────────────────────────────────────────────────────────────
// Funcția principală exportată
// ─────────────────────────────────────────────────────────────────

/**
 * Generează toate materialele de studiu pentru un material dat.
 *
 * Pipeline:
 *  1. Preia chunks-urile materialului din Supabase → asamblează transcript
 *  2. Trimite UN singur apel Gemini 2.0 Flash cu prompt structurat
 *  3. Parsează și validează JSON-ul
 *  4. Salvează atomic via RPC: rezumat/notițe → materials, flashcards → flashcards,
 *     quiz → quiz_questions, plan → lesson_plans
 *
 * @param materialId  ID-ul materialului din tabela `materials`
 * @param supabase    Client Supabase (admin/service role recomandat)
 * @returns           GenerateResult cu contoarele materialelor salvate
 *
 * @throws Error dacă materialul nu există, transcriptul e gol,
 *                Gemini returnează răspuns invalid sau salvarea eșuează
 */
export async function generateAllMaterials(
  materialId: string,
  supabase: AnySupabaseClient
): Promise<GenerateResult> {
  // ── Pas 1: Preia transcriptul complet din chunks ────────────────
  console.log(`[GeneratorAgent] START — materialId=${materialId}`);

  const { data: chunks, error: chunksError } = await supabase
    .from('chunks')
    .select('content, page_number, video_start_seconds')
    .eq('material_id', materialId)
    .order('created_at', { ascending: true });

  if (chunksError) {
    throw new Error(
      `[GeneratorAgent] Eroare la preluarea chunks: ${chunksError.message}`
    );
  }

  if (!chunks || chunks.length === 0) {
    throw new Error(
      `[GeneratorAgent] Materialul ${materialId} nu are chunks indexate. ` +
        'Rulează mai întâi pipeline-ul de ingestie.'
    );
  }

  // Asamblează transcriptul complet din chunks (ordonat)
  const fullTranscript = chunks
    .map((c: { content: string }) => c.content)
    .join('\n\n');

  if (fullTranscript.trim().length < 50) {
    throw new Error(
      '[GeneratorAgent] Transcriptul este prea scurt pentru a genera materiale utile.'
    );
  }

  // Trunchiază dacă depășește limita (evită timeout Gemini)
  const transcript =
    fullTranscript.length > MAX_TRANSCRIPT_CHARS
      ? fullTranscript.slice(0, MAX_TRANSCRIPT_CHARS) +
        '\n\n[... transcript trunchiat din cauza lungimii]'
      : fullTranscript;

  console.log(
    `[GeneratorAgent] Transcript asamblat: ${chunks.length} chunks, ` +
      `${transcript.length} caractere`
  );

  // ── Pas 2: Apel Gemini Flash ────────────────────────────────────
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error(
      '[GeneratorAgent] GOOGLE_AI_API_KEY lipsește din variabilele de mediu.'
    );
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
    },
  });

  console.log(`[GeneratorAgent] Se trimite apelul Gemini (${GEMINI_MODEL})...`);

  const geminiResult = await model.generateContent(buildPrompt(transcript));
  const response = geminiResult.response;
  const rawText = response.text();

  if (!rawText || rawText.trim().length === 0) {
    throw new Error(
      '[GeneratorAgent] Gemini a returnat un răspuns gol.'
    );
  }

  console.log(
    `[GeneratorAgent] Răspuns primit de la Gemini: ${rawText.length} caractere`
  );

  // ── Pas 3: Parsare și validare JSON ─────────────────────────────
  let parsed: unknown;
  try {
    // Curăță eventualele backticks sau prefixe JSON
    let cleanJson = rawText.trim();
    if (cleanJson.startsWith('```json')) {
      cleanJson = cleanJson.slice(7);
    }
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.slice(3);
    }
    if (cleanJson.endsWith('```')) {
      cleanJson = cleanJson.slice(0, -3);
    }
    cleanJson = cleanJson.trim();

    parsed = JSON.parse(cleanJson);
  } catch (parseErr) {
    throw new Error(
      `[GeneratorAgent] Nu s-a putut parsa JSON-ul de la Gemini: ` +
        `${parseErr instanceof Error ? parseErr.message : String(parseErr)}. ` +
        `Primele 500 caractere: ${rawText.slice(0, 500)}`
    );
  }

  const materials = validateGeneratedMaterials(parsed);

  console.log(
    `[GeneratorAgent] Validare OK — ` +
      `${materials.rezumat.capitole.length} capitole, ` +
      `${materials.notite.length} notițe, ` +
      `${materials.flashcards.length} flashcards, ` +
      `${materials.quiz_questions.length} quiz questions, ` +
      `${materials.plan_lectie.etape.length} etape lecție`
  );

  // ── Pas 4: Salvare atomică în DB via RPC ─────────────────────────
  const result = await saveGeneratedMaterials(supabase, materialId, materials);

  console.log(`[GeneratorAgent] DONE — materialId=${materialId}`);

  return result;
}

// ─────────────────────────────────────────────────────────────────
// Funcția de salvare — tranzacție atomică via RPC PostgreSQL
// ─────────────────────────────────────────────────────────────────

/**
 * Salvează TOATE materialele generate într-o singură tranzacție PostgreSQL.
 *
 * Folosește funcția RPC `save_generated_materials` care:
 *  1. Actualizează `materials.summary` și `materials.notes` (rezumat + notițe)
 *  2. Șterge flashcards/quiz_questions/lesson_plans vechi (permite regenerare)
 *  3. Inserează noile flashcards în tabela `flashcards`
 *  4. Inserează noile quiz_questions în tabela `quiz_questions`
 *  5. Inserează planul de lecție în tabela `lesson_plans`
 *
 * Dacă ORICE pas eșuează, toată tranzacția face rollback automat —
 * nicio dată parțială nu rămâne în DB.
 *
 * @param supabase    Client Supabase (admin/service role recomandat)
 * @param materialId  ID-ul materialului din tabela `materials`
 * @param materials   Materialele generate validate
 * @returns           GenerateResult cu contoarele materialelor salvate
 *
 * @throws Error dacă RPC-ul eșuează (tranzacția face rollback complet)
 */
export async function saveGeneratedMaterials(
  supabase: AnySupabaseClient,
  materialId: string,
  materials: GeneratedMaterials
): Promise<GenerateResult> {
  console.log(`[GeneratorAgent] Salvare atomică via RPC — materialId=${materialId}`);

  const { data, error } = await supabase.rpc('save_generated_materials', {
    p_material_id: materialId,
    p_summary: materials.rezumat,
    p_notes: materials.notite,
    p_flashcards: materials.flashcards,
    p_quiz: materials.quiz_questions,
    p_lesson_plan: materials.plan_lectie,
  });

  if (error) {
    throw new Error(
      `[GeneratorAgent] Tranzacția de salvare a eșuat (rollback complet): ${error.message}`
    );
  }

  // Răspunsul de la RPC: { success, flashcards_count, quiz_count, lesson_plan_id }
  const rpcResult = data as {
    success: boolean;
    flashcards_count: number;
    quiz_count: number;
    lesson_plan_id: string;
  };

  console.log(
    `[GeneratorAgent] Salvare OK — ` +
      `${rpcResult.flashcards_count} flashcards, ` +
      `${rpcResult.quiz_count} quiz questions, ` +
      `lesson_plan=${rpcResult.lesson_plan_id}`
  );

  return {
    materialId,
    flashcardsCount: rpcResult.flashcards_count,
    quizCount: rpcResult.quiz_count,
    lessonPlanId: rpcResult.lesson_plan_id,
  };
}
