import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: classId } = await params;
  
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Autentificare necesară' }, { status: 401 });
  }

  // Verifica proprietar clasa
  const { data: classData, error: classError } = await supabase
    .from('classes')
    .select('teacher_id')
    .eq('id', classId)
    .single();

  if (classError || !classData || classData.teacher_id !== user.id) {
    return NextResponse.json({ error: 'Acces interzis. Doar profesorul clasei poate accesa rapoartele.' }, { status: 403 });
  }

  // Admin client for bypassing RLS
  const { createClient: createBaseClient } = require('@supabase/supabase-js');
  const adminSupabase = createBaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 1. Fetch students in the class
  const { data: studentsData, error: studentsError } = await adminSupabase
    .from('student_classes')
    .select('student_id, joined_at')
    .eq('class_id', classId);

  if (studentsError) {
    return NextResponse.json({ error: 'Eroare la preluarea elevilor' }, { status: 500 });
  }

  if (!studentsData || studentsData.length === 0) {
    return NextResponse.json({ students: [], alerts: [] }, { status: 200 });
  }

  const studentIds = studentsData.map((s: any) => s.student_id);

  // 2. Fetch profiles
  const { data: profiles } = await adminSupabase
    .from('profiles')
    .select('id, first_name, last_name')
    .in('id', studentIds);

  // 3. Fetch test results
  const { data: testResults } = await adminSupabase
    .from('test_results')
    .select('student_id, score, created_at')
    .in('student_id', studentIds)
    .eq('status', 'completed')
    .order('created_at', { ascending: true });

  // 4. Fetch study sessions
  const { data: studySessions } = await adminSupabase
    .from('study_sessions')
    .select('student_id, started_at, ended_at, duration_minutes')
    .in('student_id', studentIds);

  // 5. Fetch student_profiles (for weak concepts)
  const { data: studentProfiles } = await adminSupabase
    .from('student_profiles')
    .select('id, weak_concepts')
    .in('id', studentIds);

  // PROCESARE DATE
  const reportStudents: any[] = [];
  const alerts: any[] = [];
  
  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;
  
  for (const s of studentsData) {
    const sId = s.student_id;
    const profile = profiles?.find((p: any) => p.id === sId);
    const fullName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'Elev Necunoscut';
    
    // Teste
    const sTests = testResults?.filter(t => t.student_id === sId) || [];
    const testsCompleted = sTests.length;
    let averageScore = 0;
    if (testsCompleted > 0) {
      const sum = sTests.reduce((acc, t) => acc + (t.score || 0), 0);
      averageScore = Math.round(sum / testsCompleted);
    }
    
    // Trend
    let trend = 'neutral';
    if (testsCompleted >= 2) {
      const recentScore = sTests[sTests.length - 1].score || 0;
      const previousScore = sTests[sTests.length - 2].score || 0;
      if (recentScore > previousScore + 10) trend = 'up';
      else if (recentScore < previousScore - 10) trend = 'down';
    }

    // Studiu
    const sSessions = studySessions?.filter(ss => ss.student_id === sId) || [];
    let studyTimeMinutes = 0;
    sSessions.forEach(ss => {
      if (ss.duration_minutes) {
        studyTimeMinutes += ss.duration_minutes;
      } else if (ss.started_at && ss.ended_at) {
        const start = new Date(ss.started_at).getTime();
        const end = new Date(ss.ended_at).getTime();
        studyTimeMinutes += Math.round((end - start) / 60000);
      } else {
        studyTimeMinutes += 15;
      }
    });
    
    const hours = Math.floor(studyTimeMinutes / 60);
    const mins = studyTimeMinutes % 60;
    const studyTimeFormatted = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

    // Last Login (Activity)
    let lastActivityTime = new Date(s.joined_at).getTime();
    if (sTests.length > 0) lastActivityTime = Math.max(lastActivityTime, new Date(sTests[sTests.length - 1].created_at).getTime());
    if (sSessions.length > 0) {
       const latestSession = [...sSessions].sort((a,b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())[0];
       lastActivityTime = Math.max(lastActivityTime, new Date(latestSession.started_at).getTime());
    }
    
    const daysSinceLastActivity = Math.floor((now - lastActivityTime) / ONE_DAY);
    let lastLogin = '';
    if (daysSinceLastActivity === 0) lastLogin = 'Astăzi';
    else if (daysSinceLastActivity === 1) lastLogin = 'Ieri';
    else lastLogin = `Acum ${daysSinceLastActivity} zile`;

    // Risk calculation
    const isInactiv = daysSinceLastActivity > 7;
    const hasLowScore = testsCompleted > 0 && averageScore < 50;
    const isAtRisk = isInactiv || hasLowScore;

    reportStudents.push({
      id: sId,
      name: fullName,
      averageScore,
      studyTimeMinutes,
      studyTimeFormatted,
      testsCompleted,
      lastLogin,
      trend,
      isAtRisk
    });

    // Generate alerts for this student
    if (isInactiv) {
      alerts.push({
        id: `alert-inactiv-${sId}`,
        studentName: fullName,
        type: 'inactiv',
        severity: 'low',
        reason: `Nu a mai avut nicio activitate de ${daysSinceLastActivity} zile.`,
        createdAt: 'Astăzi'
      });
    }

    if (hasLowScore) {
      alerts.push({
        id: `alert-scor-${sId}`,
        studentName: fullName,
        type: 'scor_scazut',
        severity: 'high',
        reason: `Are o medie generală foarte mică de ${averageScore}%. Necesită intervenție.`,
        createdAt: 'Astăzi'
      });
    }

    // Concept repetat alerts
    const sProfile = studentProfiles?.find(p => p.id === sId);
    if (sProfile && sProfile.weak_concepts) {
      const weakConcepts = sProfile.weak_concepts;
      weakConcepts.forEach((wc: any, index: number) => {
        if (wc.errorRate > 60) {
          alerts.push({
            id: `alert-concept-${sId}-${index}`,
            studentName: fullName,
            type: 'concept_repetat',
            severity: 'medium',
            reason: `Greșește frecvent (Rată eroare: ${wc.errorRate}%) la conceptul: ${wc.concept}.`,
            createdAt: 'Astăzi'
          });
        }
      });
    }
  }

  return NextResponse.json({
    students: reportStudents,
    alerts: alerts
  });
}
