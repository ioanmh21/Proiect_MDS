import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import { createClient as createBaseClient } from '@supabase/supabase-js';

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const classId = searchParams.get('id');

  if (!classId) {
    return NextResponse.json({ error: 'Class ID lipsă' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // 1. Verificare autentificare și rol admin
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Autentificare necesară' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Acces interzis. Doar administratorii pot șterge clase.' }, { status: 403 });
  }

  // 2. Client Admin (Bypass RLS)
  const adminSupabase = createBaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.SUPABASE_KEY!
  );

  try {
    // 3. Ștergem clasa. Legăturile din student_classes ar trebui să se șteargă automat dacă există ON DELETE CASCADE.
    // Pentru siguranță ștergem întâi legăturile.
    await adminSupabase.from('student_classes').delete().eq('class_id', classId);
    
    // De asemenea materialele. Ar trebui să fie legate de class_id.
    const { error: deleteClassError } = await adminSupabase.from('classes').delete().eq('id', classId);
    
    if (deleteClassError) {
      console.error('[AdminAPI] Eroare la ștergerea Clasei:', deleteClassError);
      return NextResponse.json({ error: 'Nu s-a putut șterge clasa.', details: deleteClassError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Clasă ștearsă cu succes!' });

  } catch (error) {
    console.error('[AdminAPI] Eroare neașteptată:', error);
    return NextResponse.json({ error: 'Eroare internă de server' }, { status: 500 });
  }
}
