import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';

export async function PATCH(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Autentificare necesară' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body invalid' }, { status: 400 });
  }

  const { materialId, testConfig } = body;

  if (!materialId || !testConfig) {
    return NextResponse.json({ error: 'Parametri incompleți' }, { status: 400 });
  }

  // Verificăm dacă materialul aparține utilizatorului curent (profesorului)
  // Folosim clientul supabase normal cu RLS
  const { data: material, error: fetchError } = await supabase
    .from('materials')
    .select('id, teacher_id')
    .eq('id', materialId)
    .single();

  if (fetchError || !material || material.teacher_id !== user.id) {
    return NextResponse.json({ error: 'Material inexistent sau nu ai permisiunea de editare' }, { status: 403 });
  }

  // Update config
  const { error: updateError } = await supabase
    .from('materials')
    .update({ test_config: testConfig })
    .eq('id', materialId);

  if (updateError) {
    console.error('Error updating test config:', updateError);
    return NextResponse.json({ error: 'Eroare la salvarea configurației' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
