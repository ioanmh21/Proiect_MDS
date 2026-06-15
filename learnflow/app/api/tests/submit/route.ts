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

    const { testId, answers } = await req.json();

    if (!testId || !answers) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const supabaseAdmin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Fetch existing test
    const { data: test, error: errTest } = await supabaseAdmin
      .from('test_results')
      .select('id, questions, status')
      .eq('id', testId)
      .eq('student_id', user.id)
      .single();

    if (errTest || !test) {
      return NextResponse.json({ error: 'Test not found' }, { status: 404 });
    }

    if (test.status === 'completed') {
      return NextResponse.json({ error: 'Test already submitted' }, { status: 400 });
    }

    const questions = test.questions as any[];

    // 2. Pregătim structura pentru Agentul Evaluator
    const evaluationData = questions.map((q, idx) => ({
      intrebare: q.text,
      barem_corect: q.raspuns,
      raspuns_elev: answers[idx] || "Nu a răspuns"
    }));

    // 3. Apelăm Agentul Evaluator (Vertex AI)
    const model = vertex_ai.getGenerativeModel({ model: 'gemini-2.5-pro' });
    
    console.log(`[Evaluator] Analizăm răspunsurile elevului pentru testul ${testId}...`);

    const prompt = `
Ești un profesor examinator sever dar corect. 
Sarcina ta este să corectezi un test pe baza răspunsurilor elevului și a baremului corect.

Pentru fiecare întrebare, evaluează răspunsul elevului comparându-l cu baremul corect. 
- Pentru grile, dacă răspunsul elevului coincide cu varianta corectă, primește punctaj maxim.
- Pentru răspunsuri scrise/libere, judecă dacă a atins ideile principale din barem.
Apoi acordă un scor total pe test, de la 0 la 100.

Date de intrare (JSON):
${JSON.stringify(evaluationData, null, 2)}

Returnează DOAR un JSON valid, fără markdown (\`\`\`json). Structura exactă a JSON-ului cerut:
{
  "scor_total": 85,
  "feedback_general": "Te-ai descurcat foarte bine la partea practică, dar mai trebuie să repeți...",
  "feedback_intrebari": [
    {
      "este_corect": true,
      "explicatie_scurta": "Răspuns corect!"
    },
    {
      "este_corect": false,
      "explicatie_scurta": "Ai selectat varianta A, dar baremul indica varianta C."
    }
  ]
}
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let rawText = '';
    
    if (response.candidates && response.candidates[0].content.parts[0].text) {
      rawText = response.candidates[0].content.parts[0].text.trim();
    }
    
    console.log(`[Evaluator] Evaluare completă!`);

    // Curățăm markdown
    if (rawText.startsWith('```json')) rawText = rawText.slice(7);
    if (rawText.startsWith('```')) rawText = rawText.slice(3);
    if (rawText.endsWith('```')) rawText = rawText.slice(0, -3);

    const evaluare = JSON.parse(rawText.trim());

    // 4. Salvare rezultate în baza de date
    const { error: updateError } = await supabaseAdmin
      .from('test_results')
      .update({
        status: 'completed',
        answers: answers,
        score: evaluare.scor_total,
        feedback: evaluare
      })
      .eq('id', testId);

    if (updateError) {
      console.error(updateError);
      return NextResponse.json({ error: 'Failed to save evaluation' }, { status: 500 });
    }

    // 5. Update study_sessions (Estimăm 15 minute per test finalizat)
    await supabaseAdmin
      .from('study_sessions')
      .insert({
        student_id: user.id,
        topic: 'Test la cerere',
        material_id: test.material_id,
        started_at: new Date(Date.now() - 15 * 60000).toISOString(),
        ended_at: new Date().toISOString()
      });

    // 6. Update weak_concepts based on this evaluation
    try {
      const materialData = await supabaseAdmin.from('materials').select('title').eq('id', test.material_id).single();
      const materialTitle = materialData.data?.title || 'Concept Necunoscut';
      
      let gresite = 0;
      evaluare.feedback_intrebari.forEach((f: any) => {
        if (!f.este_corect) gresite++;
      });
      
      if (gresite > 0) {
        const errorRate = Math.round((gresite / evaluare.feedback_intrebari.length) * 100);
        
        const profileData = await supabaseAdmin.from('student_profiles').select('weak_concepts').eq('id', user.id).single();
        let weakConcepts = profileData.data?.weak_concepts || [];
        if (!Array.isArray(weakConcepts)) weakConcepts = [];
        
        const existingIdx = weakConcepts.findIndex((c: any) => c.concept === materialTitle);
        if (existingIdx >= 0) {
          weakConcepts[existingIdx].errorRate = Math.round((weakConcepts[existingIdx].errorRate + errorRate) / 2);
        } else {
          weakConcepts.push({ concept: materialTitle, errorRate });
        }
        
        await supabaseAdmin.from('student_profiles').upsert({ id: user.id, student_id: user.id, weak_concepts: weakConcepts });
      }
    } catch (e) {
      console.error("Non-critical error updating profile stats:", e);
    }

    return NextResponse.json({
      success: true,
      evaluare: evaluare
    });

  } catch (error: any) {
    console.error('API /tests/submit error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
