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
