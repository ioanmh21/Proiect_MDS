import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';

// GET /api/classes/[id]/students -> Returnează elevii dintr-o clasă (pentru profesor sau colegi)
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: classId } = await params;
  
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Autentificare necesară' }, { status: 401 });
  }

  // Căutăm elevii din clasa respectivă
  // Funcționează bazat pe relația `student_classes` și inner join cu `student_profiles` (sau profil generic)
  // Întrucât e posibil să nu putem citi e-mailul direct, citim display_name sau email dacă e permis
  
  const { data: students, error } = await supabase
    .from('student_classes')
    .select('student_id, joined_at')
    .eq('class_id', classId);

  if (error) {
    console.error('[Students API] GET Error:', error);
    return NextResponse.json({ error: 'Eroare la preluarea elevilor' }, { status: 500 });
  }

  if (!students || students.length === 0) {
    return NextResponse.json({ students: [] }, { status: 200 });
  }

  const studentIds = students.map((s: any) => s.student_id);

  // Folosim service_role pentru a ocoli RLS-ul de pe 'profiles' (care e vizibil doar pentru owner)
  const { createClient: createBaseClient } = require('@supabase/supabase-js');
  const adminSupabase = createBaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profiles, error: profilesError } = await adminSupabase
    .from('profiles')
    .select('id, first_name, last_name')
    .in('id', studentIds);

  if (profilesError) {
    console.error('[Students API] GET Profiles Error:', profilesError);
    return NextResponse.json({ error: 'Eroare la preluarea profilelor' }, { status: 500 });
  }

  const formattedStudents = students.map((s: any) => {
    const profile = profiles?.find((p: any) => p.id === s.student_id);
    const fn = profile?.first_name || '';
    const ln = profile?.last_name || '';
    const fullName = `${fn} ${ln}`.trim() || 'Elev Necunoscut';
    
    return {
      id: s.student_id,
      name: fullName,
      joined_at: s.joined_at
    };
  });

  return NextResponse.json({ students: formattedStudents }, { status: 200 });
}

// DELETE /api/classes/[id]/students?studentId=xxx -> Profesorul elimină un elev
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: classId } = await params;
  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get('studentId');

  if (!studentId) {
    return NextResponse.json({ error: 'Student ID lipsă' }, { status: 400 });
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

  // 1. Verificăm dacă profesorul care face request-ul este proprietarul clasei
  const { data: targetClass, error: classError } = await supabaseActionClient
    .from('classes')
    .select('teacher_id')
    .eq('id', classId)
    .single();

  if (classError || !targetClass || targetClass.teacher_id !== user.id) {
    return NextResponse.json({ error: 'Nu ai permisiunea de a elimina elevi din această clasă' }, { status: 403 });
  }

  // Folosim service_role pentru a ocoli RLS-ul (deoarece doar elevii au voie nativ să șteargă înregistrarea din student_classes)
  const adminSupabase = require('@supabase/supabase-js').createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 2. Ștergem elevul
  const { error: deleteError } = await adminSupabase
    .from('student_classes')
    .delete()
    .eq('student_id', studentId)
    .eq('class_id', classId);

  if (deleteError) {
    return NextResponse.json({ error: 'Eroare la eliminarea elevului' }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
