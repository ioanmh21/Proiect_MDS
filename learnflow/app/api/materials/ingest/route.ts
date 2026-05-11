/**
 * POST /api/materials/ingest
 * ===========================
 * Pornește pipeline-ul de ingestie PDF în background și returnează imediat.
 *
 * Request body:
 *  { materialId: string }
 *
 * Response (202 Accepted):
 *  { jobId: string; status: 'processing' }
 *
 * Erori posibile:
 *  400 — materialId lipsă / invalid
 *  401 — utilizator neautentificat
 *  404 — materialul nu există sau nu aparține profesorului curent
 *  409 — materialul e deja în procesare / finalizat
 *  500 — eroare internă la crearea job-ului
 *
 * ──────────────────────────────────────────────────────────────────
 * Arhitectura background processing:
 *
 *  1. Route handler creează înregistrarea în `ingestion_jobs` (status: pending)
 *  2. `after()` din Next.js 15 programează taskul după trimiterea răspunsului
 *  3. Taskul background apelează `processExistingMaterial` cu un callback
 *     care actualizează `ingestion_jobs` la fiecare pas
 *  4. Clientul ascultă Supabase Realtime Postgres Changes pe `ingestion_jobs`
 *     pentru updates în timp real
 *
 * ──────────────────────────────────────────────────────────────────
 * SQL pentru tabela ingestion_jobs (rulează în Supabase SQL Editor):
 *
 *  CREATE TABLE ingestion_jobs (
 *    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *    material_id      uuid NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
 *    status           text NOT NULL DEFAULT 'pending'
 *                       CHECK (status IN ('pending','processing','completed','error')),
 *    progress_pct     integer NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
 *    current_step     text,
 *    error_message    text,
 *    chunks_total     integer,
 *    chunks_processed integer,
 *    created_at       timestamptz NOT NULL DEFAULT now(),
 *    updated_at       timestamptz NOT NULL DEFAULT now()
 *  );
 *
 *  -- Index pentru query-uri pe material_id
 *  CREATE INDEX idx_ingestion_jobs_material ON ingestion_jobs(material_id);
 *
 *  -- RLS: profesorul vede doar job-urile sale
 *  ALTER TABLE ingestion_jobs ENABLE ROW LEVEL SECURITY;
 *
 *  CREATE POLICY "Teachers see own jobs"
 *    ON ingestion_jobs FOR SELECT
 *    USING (
 *      material_id IN (
 *        SELECT id FROM materials WHERE teacher_id = auth.uid()
 *      )
 *    );
 *
 *  -- Realtime: activează pentru această tabelă
 *  ALTER PUBLICATION supabase_realtime ADD TABLE ingestion_jobs;
 */

/**
 * Returnează un client Supabase admin (service role) fără generics stricte.
 * Folosit în background tasks unde tiparea strictă cauzează erori de inferență.
 */
function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) {
    throw new Error(
      '[IngestRoute] NEXT_PUBLIC_SUPABASE_URL sau SUPABASE_SERVICE_ROLE_KEY lipsesc'
    );
  }
  // Import direct fără Database generic — evităm tipul `never` la .update()
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require('@supabase/supabase-js');
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

import { after } from 'next/server';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient as createServerClient } from '@/utils/supabase/server';
import {
  processExistingMaterial,
  type ProgressUpdate,
} from '@/lib/agents/ingestion-agent';

// ─────────────────────────────────────────────────────────────────
// Tipuri API
// ─────────────────────────────────────────────────────────────────

interface IngestRequestBody {
  materialId: string;
}

interface IngestSuccessResponse {
  jobId: string;
  status: 'processing';
  /** Mesaj informativ pentru UI */
  message: string;
}

interface IngestErrorResponse {
  error: string;
  code: string;
}

// ─────────────────────────────────────────────────────────────────
// Helper: actualizează progresul job-ului în Supabase
// ─────────────────────────────────────────────────────────────────

/**
 * Construiește callback-ul `onProgress` care scrie în `ingestion_jobs`.
 * Folosește clientul admin (service role) pentru a evita restricțiile RLS
 * din contextul background.
 *
 * Actualizează și coloana `updated_at` pentru a declanșa Realtime broadcast.
 */
function buildProgressCallback(jobId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = getAdminSupabase();

  return async (update: ProgressUpdate): Promise<void> => {
    const { error } = await db
      .from('ingestion_jobs')
      .update({
        status: 'processing',
        progress_pct: update.progressPct,
        current_step: update.currentStep,
        updated_at: new Date().toISOString(),
        ...(update.chunksTotal !== undefined && { chunks_total: update.chunksTotal }),
        ...(update.chunksProcessed !== undefined && {
          chunks_processed: update.chunksProcessed,
        }),
      })
      .eq('id', jobId);

    if (error) {
      console.error(`[IngestRoute] Eroare update progres job ${jobId}:`, error.message);
    }
  };
}

// ─────────────────────────────────────────────────────────────────
// Background task — rulează DUPĂ trimiterea răspunsului HTTP
// ─────────────────────────────────────────────────────────────────

/**
 * Pipeline-ul complet de ingestie, rulat cu `after()`.
 * Folosește clientul admin Supabase (nu depinde de cookies sau sesiune).
 */
async function runIngestionJob(
  materialId: string,
  jobId: string
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = getAdminSupabase();
  const onProgress = buildProgressCallback(jobId);

  console.log(`[IngestJob] START — jobId=${jobId}, materialId=${materialId}`);

  try {
    await db.from('ingestion_jobs').update({
      status: 'processing',
      current_step: 'Se inițializează pipeline-ul',
      updated_at: new Date().toISOString(),
    }).eq('id', jobId);

    const { chunkCount } = await processExistingMaterial(
      materialId,
      db,
      onProgress
    );

    await db.from('ingestion_jobs').update({
      status: 'completed',
      progress_pct: 100,
      current_step: `Finalizat — ${chunkCount} fragmente indexate`,
      chunks_processed: chunkCount,
      updated_at: new Date().toISOString(),
    }).eq('id', jobId);

    console.log(`[IngestJob] DONE — jobId=${jobId}, chunks=${chunkCount}`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Eroare necunoscută';
    console.error(`[IngestJob] FAILED — jobId=${jobId}:`, errorMessage);

    await db.from('ingestion_jobs').update({
      status: 'error',
      error_message: errorMessage,
      current_step: 'Procesare eșuată',
      updated_at: new Date().toISOString(),
    }).eq('id', jobId);
  }
}

// ─────────────────────────────────────────────────────────────────
// POST /api/materials/ingest
// ─────────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest
): Promise<NextResponse<IngestSuccessResponse | IngestErrorResponse>> {

  // ── 1. Parsare body ──────────────────────────────────────────────
  let body: IngestRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json<IngestErrorResponse>(
      { error: 'Request body invalid — trebuie să fie JSON', code: 'INVALID_BODY' },
      { status: 400 }
    );
  }

  const { materialId } = body;

  if (!materialId || typeof materialId !== 'string' || materialId.trim() === '') {
    return NextResponse.json<IngestErrorResponse>(
      { error: 'materialId este obligatoriu și trebuie să fie un string UUID', code: 'MISSING_MATERIAL_ID' },
      { status: 400 }
    );
  }

  // ── 2. Autentificare utilizator ──────────────────────────────────
  const cookieStore = await cookies();
  const supabase = createServerClient(cookieStore);

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json<IngestErrorResponse>(
      { error: 'Autentificare necesară', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  // ── 3. Verifică că materialul există și aparține userului curent ──
  const { data: material, error: materialError } = await supabase
    .from('materials')
    .select('id, status, teacher_id, title')
    .eq('id', materialId.trim())
    .eq('teacher_id', user.id)  // RLS extra: verificare explicită owner
    .single();

  if (materialError || !material) {
    return NextResponse.json<IngestErrorResponse>(
      {
        error: 'Materialul nu a fost găsit sau nu ai permisiunea de a-l procesa',
        code: 'MATERIAL_NOT_FOUND',
      },
      { status: 404 }
    );
  }

  // ── 4. Verifică starea curentă (idempotency guard) ───────────────
  if (material.status === 'processing') {
    return NextResponse.json<IngestErrorResponse>(
      { error: 'Materialul este deja în procesare', code: 'ALREADY_PROCESSING' },
      { status: 409 }
    );
  }

  if (material.status === 'completed') {
    return NextResponse.json<IngestErrorResponse>(
      { error: 'Materialul a fost deja procesat. Șterge chunks-urile existente înainte de re-procesare.', code: 'ALREADY_COMPLETED' },
      { status: 409 }
    );
  }

  // ── 5. Creează înregistrarea în ingestion_jobs ───────────────────
  const { data: job, error: jobError } = await supabase
    .from('ingestion_jobs')
    .insert({
      material_id: materialId,
      status: 'pending',
      progress_pct: 0,
      current_step: 'Job creat — se așteaptă procesarea',
    })
    .select('id')
    .single();

  if (jobError || !job) {
    console.error('[IngestRoute] Nu s-a putut crea job-ul:', jobError?.message);
    return NextResponse.json<IngestErrorResponse>(
      { error: 'Nu s-a putut inițializa job-ul de procesare', code: 'JOB_CREATE_FAILED' },
      { status: 500 }
    );
  }

  const jobId = job.id;

  // Actualizăm și statusul materialului la 'processing'
  await supabase
    .from('materials')
    .update({ status: 'processing' })
    .eq('id', materialId);

  // ── 6. Programează pipeline-ul în background cu after() ──────────
  // `after()` garantează că taskul rulează DUPĂ ce răspunsul HTTP a fost trimis.
  // Funcționează în Node.js runtime (nu Edge). Disponibil stabil din Next.js 15.
  after(async () => {
    await runIngestionJob(materialId, jobId);
  });

  // ── 7. Răspuns imediat (202 Accepted) ────────────────────────────
  return NextResponse.json<IngestSuccessResponse>(
    {
      jobId,
      status: 'processing',
      message: `Procesarea materialului "${material.title}" a început. Urmărește progresul prin jobId.`,
    },
    { status: 202 }
  );
}

// ─────────────────────────────────────────────────────────────────
// GET /api/materials/ingest?jobId=<uuid>
// ─────────────────────────────────────────────────────────────────
// Endpoint auxiliar pentru polling (alternativă la Realtime)

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');

  if (!jobId) {
    return NextResponse.json(
      { error: 'jobId este obligatoriu ca query param', code: 'MISSING_JOB_ID' },
      { status: 400 }
    );
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(cookieStore);

  // Verifică autentificare
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Autentificare necesară', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  // Fetch job cu verificare implicită de ownership prin RLS
  const { data: job, error } = await supabase
    .from('ingestion_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error || !job) {
    return NextResponse.json(
      { error: 'Job-ul nu a fost găsit', code: 'JOB_NOT_FOUND' },
      { status: 404 }
    );
  }

  return NextResponse.json(job);
}
