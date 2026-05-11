import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export interface TestResult {
  concept: string;
  isCorrect: boolean;
}

export interface WeakConcept {
  concept: string;
  errorRate: number; // Scor 0-100 bazat pe rata de greșeli
}

/**
 * Updates a student's weak concepts in their profile based on recent test results.
 * Calculates an error rate per concept, updates the profile without duplicates,
 * and emits an event for the Analyst Agent.
 */
export async function updateWeakConcepts(userId: string, testResults: TestResult[]): Promise<void> {
  if (!testResults || testResults.length === 0) return;

  // 1. Fetch current weak concepts from profile
  const { data: profile, error: profileError } = await supabase
    .from('student_profiles')
    .select('weak_concepts')
    .eq('id', userId)
    .single();

  if (profileError && profileError.code !== 'PGRST116') {
    console.error("Eroare la preluarea profilului pentru conceptele slabe:", profileError);
    // În funcție de schemă, e posibil ca tabela să folosească `user_id` în loc de `id`. 
    // Dacă acest query pică, verifică schema student_profiles.
  }

  // Asigură-te că existingConcepts e un array
  let existingConcepts: WeakConcept[] = [];
  if (profile && Array.isArray(profile.weak_concepts)) {
    existingConcepts = profile.weak_concepts;
  }
  
  // 2. Extrage conceptele din testResults și calculează rata de greșeli
  const conceptStats = new Map<string, { total: number; wrong: number }>();

  for (const res of testResults) {
    if (!res.concept) continue;
    
    if (!conceptStats.has(res.concept)) {
      conceptStats.set(res.concept, { total: 0, wrong: 0 });
    }
    const stats = conceptStats.get(res.concept)!;
    stats.total++;
    
    if (!res.isCorrect) {
      stats.wrong++;
    }
  }

  const updatedConcepts = [...existingConcepts];

  for (const [concept, stats] of conceptStats.entries()) {
    // Luăm în considerare conceptul ca punct slab dacă are greșeli
    if (stats.wrong > 0) { 
      const errorRate = Math.round((stats.wrong / stats.total) * 100);

      const existingIndex = updatedConcepts.findIndex(c => c.concept === concept);
      if (existingIndex >= 0) {
        // Actualizăm scorul pentru conceptul deja existent
        // Se poate folosi o medie cumulativă, dar aici actualizăm cu ultima rată de greșeală
        updatedConcepts[existingIndex].errorRate = errorRate;
      } else {
        // Adăugăm conceptul nou, evitând duplicatele (deja verificate mai sus)
        updatedConcepts.push({ concept, errorRate });
      }
    }
  }

  // Sortăm opțional după rata de greșeală (descrescător) ca să primeze cele mai slabe concepte
  updatedConcepts.sort((a, b) => b.errorRate - a.errorRate);

  // 3. Salvează conceptele actualizate în Supabase (student_profiles)
  const { error: updateError } = await supabase
    .from('student_profiles')
    .upsert({ 
      id: userId, 
      weak_concepts: updatedConcepts 
    });

  if (updateError) {
    console.error("Eroare la actualizarea conceptelor slabe:", updateError);
    return;
  }

  // 4. Trimite event-ul 'weak_concepts_updated' către Agentul Analist
  const { error: eventError } = await supabase
    .from('agent_events')
    .insert([{
      type: 'weak_concepts_updated',
      user_id: userId,
      payload: { 
        updatedConcepts,
        source: 'evaluator_agent_test_grading'
      },
      created_at: new Date().toISOString()
    }]);

  if (eventError) {
    console.error("Eroare la trimiterea evenimentului agent_events:", eventError);
  } else {
    console.log("Evenimentul 'weak_concepts_updated' a fost trimis cu succes!");
  }
}
