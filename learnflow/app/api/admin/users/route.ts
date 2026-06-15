import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import { createClient as createBaseClient } from '@supabase/supabase-js';

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('id');

  if (!userId) {
    return NextResponse.json({ error: 'User ID lipsă' }, { status: 400 });
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
    return NextResponse.json({ error: 'Acces interzis. Doar administratorii pot șterge utilizatori.' }, { status: 403 });
  }

  // Nu ne ștergem pe noi înșine
  if (user.id === userId) {
    return NextResponse.json({ error: 'Nu te poți șterge pe tine însuți!' }, { status: 400 });
  }

  // 2. Client Admin (Bypass RLS)
  const adminSupabase = createBaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.SUPABASE_KEY!
  );

  try {
    // 3. Ștergem utilizatorul din Supabase Auth (dacă este setat CASCADE, se șterge și din profiles)
    // Dacă funcția admin.deleteUser dă eroare, încercăm să ștergem măcar din profiles
    const { error: deleteAuthError } = await adminSupabase.auth.admin.deleteUser(userId);
    
    if (deleteAuthError) {
      console.error('[AdminAPI] Eroare la ștergerea Auth User:', deleteAuthError);
      
      // Fallback: Ștergem manual din tabelele vizibile dacă nu e permis pe Auth
      await adminSupabase.from('student_classes').delete().eq('student_id', userId);
      await adminSupabase.from('profiles').delete().eq('id', userId);
      // Notă: La profesori, clasele lor rămân "orfane", s-ar putea să fie nevoie de o curățare mai amplă
    }

    return NextResponse.json({ success: true, message: 'Utilizator șters cu succes!' });

  } catch (error) {
    console.error('[AdminAPI] Eroare neașteptată:', error);
    return NextResponse.json({ error: 'Eroare internă de server' }, { status: 500 });
  }
}
