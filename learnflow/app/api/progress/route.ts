import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Call Python backend
    try {
      const response = await fetch(`http://127.0.0.1:8000/analist/progress/${user.id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store'
      });

      if (!response.ok) {
        console.warn(`Backend error: ${response.status}`);
        return NextResponse.json({ progres: [] });
      }

      const data = await response.json();
      return NextResponse.json(data);
    } catch (error: any) {
      console.warn("Python backend is offline. Returning empty progress.");
      return NextResponse.json({ progres: [] });
    }
  } catch (error: any) {
    console.error('Progress API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
