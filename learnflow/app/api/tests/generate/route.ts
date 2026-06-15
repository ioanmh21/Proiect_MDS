import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { VertexAI } from '@google-cloud/vertexai';

const vertex_ai = new VertexAI({ project: 'proiectmds-495617', location: 'us-central1' });

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { materialId } = await req.json();

    if (!materialId) {
      return NextResponse.json({ error: 'Missing materialId' }, { status: 400 });
    }

    const supabaseAdmin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Verificăm dacă elevul are deja un test in_progress pentru acest material
    const { data: existingTest, error: errTest } = await supabaseAdmin
      .from('test_results')
      .select('id, questions')
      .eq('material_id', materialId)
      .eq('student_id', user.id)
      .eq('status', 'in_progress')
      .maybeSingle();

    if (existingTest) {
      return NextResponse.json({ 
        success: true, 
        message: 'Returning existing in_progress test',
        testId: existingTest.id,
        questions: existingTest.questions 
      });
    }

    // 2. Fetch chunks and config using admin client
    const { data: materialData, error: materialError } = await supabaseAdmin
      .from('materials')
      .select('test_config')
      .eq('id', materialId)
      .single();

    const testConfig = materialData?.test_config || { easy: 3, medium: 2, hard: 1 };

    const { data: chunks, error: chunksError } = await supabaseAdmin
      .from('chunks')
      .select('content')
      .eq('material_id', materialId)
      .order('created_at', { ascending: true });

    if (chunksError || !chunks || chunks.length === 0) {
      return NextResponse.json({ error: 'Material chunks not found' }, { status: 404 });
    }

    // Preluăm transcriptul limitat la 300k caractere
    const transcript = chunks.map(c => c.content).join('\n\n').substring(0, 300000);

    // 3. Prompt Gemini (Vertex AI - gemini-2.5-pro)
    const model = vertex_ai.getGenerativeModel({ model: 'gemini-2.5-pro' });

    const prompt = `
Ești un asistent educațional expert. Un elev vrea să se testeze din următorul material.
Sarcina ta este să generezi un test provocator (Quiz), conținând:
- ${testConfig.easy} întrebări Ușoare (grilă)
- ${testConfig.medium} întrebări Medii (grilă)
- ${testConfig.hard} întrebări Grele (scrisă)

Pentru "grilă", adaugă un array "optiuni" cu fix 4 variante (A, B, C, D) și pune răspunsul corect în "raspuns".
Pentru "scris", lasă "optiuni" null și pune un răspuns complet/așteptat în "raspuns", ca barem de corectare.
Dacă un anumit tip de întrebare are numărul 0, te rog nu genera nicio întrebare din acel tip.

Transcript material:
${transcript}

Returnează DOAR JSON valid, fără markdown (\`\`\`json). Structura exactă:
{
  "questions": [
    {
       "text": "...",
       "raspuns": "...",
       "dificultate": "usor|mediu|greu",
       "tip": "grila|scris",
       "optiuni": ["A) ...", "B) ...", "C) ...", "D) ..."]
    }
  ]
}
`;

    console.log(`[Vertex AI] Trimit cerere către gemini-2.5-pro pentru generare test (Material ID: ${materialId})...`);
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let rawText = '';
    
    if (response.candidates && response.candidates[0].content.parts[0].text) {
      rawText = response.candidates[0].content.parts[0].text.trim();
    }
    
    console.log(`[Vertex AI] Răspuns primit cu succes!`);
    
    // Curățăm markdown
    if (rawText.startsWith('```json')) rawText = rawText.slice(7);
    if (rawText.startsWith('```')) rawText = rawText.slice(3);
    if (rawText.endsWith('```')) rawText = rawText.slice(0, -3);

    const generated = JSON.parse(rawText.trim());

    // 4. Salvare în baza de date ca in_progress
    const { data: newTest, error: insertError } = await supabaseAdmin
      .from('test_results')
      .insert({
        student_id: user.id,
        material_id: materialId,
        topic: 'Test la cerere',
        answers: {}, // răspunsurile goale momentan
        questions: generated.questions,
        status: 'in_progress'
      })
      .select('id')
      .single();

    if (insertError || !newTest) {
      console.error(insertError);
      return NextResponse.json({ error: 'Failed to save test' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      testId: newTest.id,
      questions: generated.questions
    });

  } catch (error: any) {
    console.error('API /tests/generate error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
