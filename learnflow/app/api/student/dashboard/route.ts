import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Neautorizat.' }, { status: 401 });
    }

    // 1. Fetch test results
    const { data: testResults } = await supabase
      .from('test_results')
      .select('score')
      .eq('student_id', user.id);

    let averageScore = 0;
    let testsCompleted = 0;
    
    if (testResults && testResults.length > 0) {
      testsCompleted = testResults.length;
      const totalScore = testResults.reduce((sum, tr) => sum + (tr.score || 0), 0);
      averageScore = Number((totalScore / testsCompleted).toFixed(1));
    }

    // 2. Fetch study sessions (calculate time in minutes)
    const { data: studySessions } = await supabase
      .from('study_sessions')
      .select('started_at, ended_at')
      .eq('student_id', user.id)
      .not('ended_at', 'is', null);

    let totalStudyMinutes = 0;
    if (studySessions) {
      studySessions.forEach(session => {
        if (session.ended_at && session.started_at) {
          const start = new Date(session.started_at).getTime();
          const end = new Date(session.ended_at).getTime();
          const diffMinutes = (end - start) / (1000 * 60);
          totalStudyMinutes += diffMinutes;
        }
      });
    }

    const hours = Math.floor(totalStudyMinutes / 60);
    const minutes = Math.round(totalStudyMinutes % 60);
    const studyTimeStr = `${hours}h ${minutes}m`;

    // 3. Fetch weak concepts
    const { data: studentProfile } = await supabase
      .from('student_profiles')
      .select('weak_concepts')
      .eq('student_id', user.id)
      .single();

    let weakConcepts = '';
    if (studentProfile?.weak_concepts && Array.isArray(studentProfile.weak_concepts)) {
      weakConcepts = studentProfile.weak_concepts
        .slice(0, 3)
        // @ts-ignore
        .map((wc: any) => wc.concept || wc)
        .join(', ');
    }

    // 4. Generate AI Recommendation
    let aiRecommendation = {
      title: "Test de Evaluare Generală",
      description: "Continuă să studiezi materialele încărcate pentru clasa ta.",
      estimatedTime: "15m",
      difficulty: "Mediu"
    };

    const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
    
    if (apiKey && weakConcepts) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', generationConfig: { responseMimeType: 'application/json' } });

        const prompt = `Ești un Tutor AI pentru elevii platformei LearnFlow.
Elevul are următoarele puncte slabe (concepte pe care nu le stăpânește bine): ${weakConcepts}.

Generează o recomandare scurtă și încurajatoare pentru următoarea activitate a elevului.
Trebuie să returnezi un JSON cu următoarele chei:
- "title": un titlu atrăgător pentru recomandare (ex: "Să aprofundăm Fracțiile")
- "description": un scurt mesaj de 1-2 propoziții personalizat pe conceptele slabe, explicând ce va exersa.
- "estimatedTime": timpul estimat (ex: "10m", "20m")
- "difficulty": "Ușor", "Mediu" sau "Greu"
`;
        
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const parsed = JSON.parse(text);
        
        if (parsed.title && parsed.description) {
          aiRecommendation = parsed;
        }
      } catch (aiError) {
        console.error('Error generating AI recommendation:', aiError);
        // Fallback to default if AI fails
      }
    }

    // Return the combined dashboard data
    return NextResponse.json({
      progressData: {
        averageScore,
        testsCompleted,
        studyTime: studyTimeStr
      },
      aiRecommendation
    });

  } catch (error) {
    console.error('Eroare în /api/student/dashboard:', error);
    return NextResponse.json({ error: 'Eroare internă a serverului.' }, { status: 500 });
  }
}
