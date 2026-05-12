import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';

// ─────────────────────────────────────────────────────────────────
// GET /api/materials — Listează materialele profesorului curent
// ─────────────────────────────────────────────────────────────────

export async function GET() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Autentificare necesară' },
      { status: 401 }
    );
  }

  const { data: materials, error } = await supabase
    .from('materials')
    .select('id, title, description, type, file_url, status, class_name, subject, grade, chapter, created_at')
    .eq('teacher_id', user.id)
    .eq('is_archived', false)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Materials API] Eroare la listare:', error.message, error.code, error.details);
    return NextResponse.json(
      { error: 'Nu s-au putut încărca materialele', details: error.message, code: error.code },
      { status: 500 }
    );
  }

  return NextResponse.json({ materials });
}

// ─────────────────────────────────────────────────────────────────
// POST /api/materials — Creează un material nou
// ─────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Autentificare necesară' },
      { status: 401 }
    );
  }

  let body: {
    title: string;
    subject?: string;
    grade?: number;
    chapter?: string;
    description?: string;
    fileUrl?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Request body invalid' },
      { status: 400 }
    );
  }

  if (!body.title || body.title.trim().length < 3) {
    return NextResponse.json(
      { error: 'Titlul trebuie să aibă cel puțin 3 caractere' },
      { status: 400 }
    );
  }

  const insertPayload = {
    teacher_id: user.id,
    title: body.title.trim(),
    description: body.description?.trim() || null,
    subject: body.subject || null,
    grade: body.grade || null,
    chapter: body.chapter?.trim() || null,
    file_url: body.fileUrl || '',
    type: 'pdf' as const,
    status: 'pending' as const,
    class_name: body.grade ? body.grade.toString() : null,
  };

  console.log('[Materials API] Încercăm să inserăm:', insertPayload);

  // 100% fail-safe approach: get the exact session token and force it in the headers
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  let supabaseForInsert = supabase;

  if (token) {
    console.log('[Materials API] Access token găsit. Forțăm antetul de autorizare!');
    const { createClient: createBaseClient } = require('@supabase/supabase-js');
    supabaseForInsert = createBaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );
  } else {
    console.warn('[Materials API] ATENȚIE: Nu s-a putut obține access_token din sesiune!');
  }

  const { data: material, error } = await supabaseForInsert
    .from('materials')
    .insert(insertPayload)
    .select('id, title, description, type, file_url, status, class_name, subject, grade, chapter, created_at')
    .single();

  if (error) {
    console.error('[Materials API] Eroare la creare:', error.message, error.code, error.details);
    return NextResponse.json(
      { error: 'Nu s-a putut crea materialul', details: error.message, code: error.code },
      { status: 500 }
    );
  }

  return NextResponse.json({ material, materialId: material.id }, { status: 201 });
}

// ─────────────────────────────────────────────────────────────────
// PATCH /api/materials — Actualizează un material existent
// ─────────────────────────────────────────────────────────────────

export async function PATCH(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Autentificare necesară' },
      { status: 401 }
    );
  }

  let body: {
    id: string;
    title?: string;
    subject?: string;
    grade?: number;
    chapter?: string;
    description?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Request body invalid' },
      { status: 400 }
    );
  }

  if (!body.id) {
    return NextResponse.json(
      { error: 'ID-ul materialului este obligatoriu' },
      { status: 400 }
    );
  }

  // Construim obiectul de update doar cu câmpurile furnizate
  const updateData: Record<string, unknown> = {};
  if (body.title !== undefined) updateData.title = body.title.trim();
  if (body.subject !== undefined) updateData.subject = body.subject || null;
  if (body.grade !== undefined) {
    updateData.grade = body.grade || null;
    updateData.class_name = body.grade ? body.grade.toString() : null;
  }
  if (body.chapter !== undefined) updateData.chapter = body.chapter?.trim() || null;
  if (body.description !== undefined) updateData.description = body.description?.trim() || null;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { error: 'Niciun câmp de actualizat' },
      { status: 400 }
    );
  }

  // 100% fail-safe approach pentru PATCH
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  let supabaseForUpdate = supabase;

  if (token) {
    const { createClient: createBaseClient } = require('@supabase/supabase-js');
    supabaseForUpdate = createBaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );
  }

  const { data: material, error } = await supabaseForUpdate
    .from('materials')
    .update(updateData)
    .eq('id', body.id)
    .eq('teacher_id', user.id) // verificare ownership
    .select('id, title, description, type, file_url, status, class_name, subject, grade, chapter, created_at')
    .single();

  if (error) {
    console.error('[Materials API] Eroare la actualizare:', error.message);
    return NextResponse.json(
      { error: 'Nu s-a putut actualiza materialul' },
      { status: 500 }
    );
  }

  return NextResponse.json({ material });
}

// ─────────────────────────────────────────────────────────────────
// DELETE /api/materials?id=... — Șterge (Soft Delete) un material
// ─────────────────────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const materialId = searchParams.get('id');

  if (!materialId) {
    return NextResponse.json(
      { error: 'ID material lipsă', code: 'MISSING_ID' },
      { status: 400 }
    );
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // 1. Verificare autentificare
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Autentificare necesară', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  // 100% fail-safe approach (injectăm Bearer Token-ul direct)
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  let supabaseActionClient = supabase;
  if (token) {
    const { createClient: createBaseClient } = require('@supabase/supabase-js');
    supabaseActionClient = createBaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
  }

  try {
    // 2. Verificăm dacă materialul există și aparține profesorului
    const { data: material, error: fetchError } = await supabaseActionClient
      .from('materials')
      .select('teacher_id, file_url')
      .eq('id', materialId)
      .single();

    if (fetchError || !material) return NextResponse.json({ error: 'Materialul nu a fost găsit' }, { status: 404 });
    if (material.teacher_id !== user.id) return NextResponse.json({ error: 'Nu ai permisiunea de a șterge' }, { status: 403 });

    // --- ADMIN CLIENT PENTRU ȘTERGERI DE SISTEM ---
    // Folosim Service Role Key (sau un fallback) pentru a trece de orice regulă RLS care ar bloca ștergerea
    const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
    const supabaseAdmin = require('@supabase/supabase-js').createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      adminKey
    );

    // 3. Ștergem chunk-urile folosind Admin Client
    const { error: chunkError } = await supabaseAdmin.from('chunks').delete().eq('material_id', materialId);
    if (chunkError) {
      console.error('[DeleteRoute] Eroare ștergere chunks:', chunkError.message);
    } else {
      console.log(`[DeleteRoute] Chunk-urile materialului au fost șterse definitiv din pgvector.`);
    }

    // 4. Ștergem fișierul fizic din Storage
    if (material.file_url && material.file_url.includes('/storage/v1/object/public/')) {
      const urlParts = material.file_url.split('/storage/v1/object/public/')[1].split('/');
      const bucketName = urlParts[0];
      const filePath = urlParts.slice(1).join('/');

      const { error: storageError } = await supabaseAdmin.storage.from(bucketName).remove([filePath]);
      if (storageError) {
        console.warn(`[DeleteRoute] Eroare ștergere Storage: ${storageError.message}`);
      } else {
        console.log(`[DeleteRoute] Fișierul fizic a fost șters din bucket-ul ${bucketName}.`);
      }
    }

    // 5. Arhivăm (Soft Delete)
    const { error: updateError } = await supabaseActionClient.from('materials').update({ is_archived: true }).eq('id', materialId);
    if (updateError) return NextResponse.json({ error: 'Eroare la arhivare în DB' }, { status: 500 });

    return NextResponse.json({ success: true, message: 'Material șters cu succes!' });

  } catch (error) {
    console.error('[DeleteRoute] Eroare neașteptată:', error);
    return NextResponse.json({ error: 'Eroare internă de server' }, { status: 500 });
  }
}
