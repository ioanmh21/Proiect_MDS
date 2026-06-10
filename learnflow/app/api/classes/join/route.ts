import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';

// POST /api/classes/join -> Elevul se înrolează pe baza codului
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

  let body: { code: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body invalid' }, { status: 400 });
  }

  if (!body.code || body.code.trim().length === 0) {
    return NextResponse.json({ error: 'Te rog să introduci un cod valid' }, { status: 400 });
  }

  const joinCode = body.code.trim().toUpperCase();

  // 100% fail-safe auth
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

  // Căutăm clasa după cod
  const { data: targetClass, error: searchError } = await supabaseActionClient
    .from('classes')
    .select('id, name')
    .eq('code', joinCode)
    .single();

  if (searchError || !targetClass) {
    return NextResponse.json({ error: 'Codul este invalid sau clasa nu există' }, { status: 404 });
  }

  // Inserăm relația elev-clasă
  const { error: joinError } = await supabaseActionClient
    .from('student_classes')
    .insert({
      student_id: user.id,
      class_id: targetClass.id
    });

  if (joinError) {
    if (joinError.code === '23505') { // Postgres unique violation (already joined)
      return NextResponse.json({ error: 'Ești deja înscris în această clasă' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Eroare la înrolare', details: joinError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, class: targetClass }, { status: 200 });
}

// DELETE /api/classes/join?classId=xxx -> Elevul iese dintr-o clasă (unenroll)
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const classId = searchParams.get('classId');

  if (!classId) {
    return NextResponse.json({ error: 'Class ID lipsă' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Autentificare necesară' }, { status: 401 });
  }

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

  const { error } = await supabaseActionClient
    .from('student_classes')
    .delete()
    .eq('student_id', user.id)
    .eq('class_id', classId);

  if (error) {
    return NextResponse.json({ error: 'Eroare la părăsirea clasei' }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
