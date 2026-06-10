import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';

// GET /api/classes -> Listează clasele profesorului curent
export async function GET() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Autentificare necesară' }, { status: 401 });
  }

  const { data: classes, error } = await supabase
    .from('classes')
    .select('id, name, code, created_at')
    .eq('teacher_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Eroare la obținerea claselor', details: error.message }, { status: 500 });
  }

  return NextResponse.json({ classes });
}

// POST /api/classes -> Profesorul creează o clasă nouă
export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Autentificare necesară' }, { status: 401 });
  }

  let body: { name: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body invalid' }, { status: 400 });
  }

  if (!body.name || body.name.trim().length < 3) {
    return NextResponse.json({ error: 'Numele clasei trebuie să aibă minim 3 caractere' }, { status: 400 });
  }

  // Generăm un cod scurt de 6 caractere
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();

  // 100% fail-safe auth
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  let supabaseForInsert = supabase;
  if (token) {
    const { createClient: createBaseClient } = require('@supabase/supabase-js');
    supabaseForInsert = createBaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
  }

  const { data: newClass, error } = await supabaseForInsert
    .from('classes')
    .insert({
      name: body.name.trim(),
      code: code,
      teacher_id: user.id
    })
    .select('id, name, code, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: 'Eroare la crearea clasei', details: error.message }, { status: 500 });
  }

  return NextResponse.json({ class: newClass }, { status: 201 });
}
