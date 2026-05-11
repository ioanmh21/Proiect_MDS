import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import { generateEmbedding } from '@/lib/agents/embeddings';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(request: NextRequest) {
  try {
    const { messages, className } = await request.json();

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

    // 1. Generează embedding pentru întrebarea utilizatorului
    const queryEmbedding = await generateEmbedding(lastUserMessage);

    // 2. Caută chunks relevante în baza de date
    // Ne folosim de `match_chunks` din Supabase
    const { data: chunks, error: matchError } = await supabase.rpc('match_chunks', {
      query_embedding: Array.from(queryEmbedding),
      match_count: 5,
      similarity_threshold: 0.3 // Poate fi ajustat
    });

    if (matchError) {
      console.error('Error matching chunks:', matchError);
      return NextResponse.json({ error: 'Eroare la căutarea contextului.' }, { status: 500 });
    }

    // Filtrează materialele după clasa elevului dacă e necesar
    // În match_chunks poți transmite filter_material_id, dar acum doar aducem contextul cel mai relevant general
    const contextText = chunks?.map((chunk: any) => chunk.content).join('\n\n---\n\n') || 'Nu s-a găsit context relevant.';

    // 3. Trimite la Gemini pentru a genera răspunsul final
    const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('API Key pentru Google Generative AI lipsește.');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

    const prompt = `
Ești un Tutor AI pentru elevii platformei LearnFlow.
Vei primi o întrebare de la elev și un context extras din materialele educaționale (PDF-uri / videoclipuri urcate de profesori).
Trebuie să răspunzi la întrebare folosind EXCLUSIV informațiile din contextul furnizat.
Dacă răspunsul nu se află în context, spune politicos că nu poți răspunde pe baza materialelor disponibile.

CONTEXT EXTRAS:
${contextText}

ÎNTREBARE ELEV:
${lastUserMessage}

RĂSPUNSUL TĂU EDUCAȚIONAL:
`;

    const result = await model.generateContent(prompt);
    const aiResponse = result.response.text();

    return NextResponse.json({ 
      role: 'assistant', 
      content: aiResponse,
      sources: chunks?.map((c: any) => c.id) 
    });

  } catch (error) {
    console.error('Eroare în /api/chat:', error);
    return NextResponse.json({ error: 'Eroare internă a serverului.' }, { status: 500 });
  }
}
