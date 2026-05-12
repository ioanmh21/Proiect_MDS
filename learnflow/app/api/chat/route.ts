import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { messages, className, materialId } = await request.json();

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'Mesajul este obligatoriu.' }, { status: 400 });
    }

    const lastUserMessage = messages[messages.length - 1].content;

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 });
    }

    // Facem apelul către microserviciul Python (TutorAgent)
    const pythonPayload = {
      student_question: lastUserMessage,
      material_id: materialId || "", // Preluam id-ul din frontend

      student_level: `Elev din clasa ${className || 'nespecificată'}`
    };

    const response = await fetch('http://127.0.0.1:8000/tutor/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pythonPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Eroare de la FastAPI:', errorText);
      return NextResponse.json({ error: 'Eroare de la serverul AI.' }, { status: response.status });
    }

    const data = await response.json();
    // data arată așa (din TutorAgent / FastAPI): 
    // { "response": "Răspunsul...", "sources": [{"id": "...", "content": "..."}] }

    return NextResponse.json({ 
      role: 'assistant', 
      content: data.response,
      sources: data.sources?.map((s: any) => s.id) || []
    });

  } catch (error) {
    console.error('Eroare în /api/chat:', error);
    return NextResponse.json({ error: 'Eroare internă a serverului.' }, { status: 500 });
  }
}
