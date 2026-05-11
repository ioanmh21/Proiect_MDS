import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, subject, grade, chapter, description, fileUrl } = body;

    if (!title || !subject || !grade || !chapter) {
      return NextResponse.json({ error: 'Toate câmpurile obligatorii trebuie completate.' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 });
    }

    // Determine type based on fileUrl extension or default to document
    let type = 'document';
    if (fileUrl) {
      if (fileUrl.includes('youtube.com') || fileUrl.includes('youtu.be') || fileUrl.endsWith('.mp4')) {
        type = 'video';
      } else if (fileUrl.endsWith('.pdf')) {
        type = 'pdf';
      }
    }

    const materialInsert = {
      teacher_id: user.id,
      title: `${title} - ${subject} (${chapter})`,
      description: description || null,
      type: type,
      file_url: fileUrl || '',
      status: 'pending',
      class_name: grade.toString(),
    };

    const { data: material, error } = await supabase
      .from('materials')
      .insert(materialInsert)
      .select('id')
      .single();

    if (error || !material) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Eroare la salvarea materialului în baza de date.' }, { status: 500 });
    }

    return NextResponse.json({ materialId: material.id }, { status: 201 });
  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json({ error: 'Eroare internă de server.' }, { status: 500 });
  }
}
