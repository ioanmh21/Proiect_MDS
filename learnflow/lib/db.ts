import { SupabaseClient } from '@supabase/supabase-js';

// Asigură-te că generezi acest fișier folosind Supabase CLI:
// npx supabase gen types typescript --project-id <project-id> > types/supabase.ts
import { Database } from '@/types/supabase';

// Tipuri derivate pentru a fi mai ușor de utilizat
type StudentProfile = Database['public']['Tables']['student_profiles']['Row'];
type TestResultInsert = Database['public']['Tables']['test_results']['Insert'];
type Profile = Database['public']['Tables']['profiles']['Row'];

/**
 * Extrage profilul unui student (inclusiv detaliile din tabela de bază `profiles`)
 */
export async function getStudentProfile(
  supabase: SupabaseClient<Database>,
  userId: string
) {
  const { data, error } = await supabase
    .from('student_profiles')
    .select(`
      *,
      profiles (*)
    `)
    .eq('student_id', userId)
    .single();

  if (error) {
    console.error('Error fetching student profile:', error);
    throw error;
  }

  return data;
}

/**
 * Actualizează array-ul de "weak_concepts" pentru un student
 */
export async function updateWeakConcepts(
  supabase: SupabaseClient<Database>,
  userId: string,
  concepts: string[]
) {
  const { data, error } = await supabase
    .from('student_profiles')
    // @ts-expect-error — Supabase typed client infers 'never' for .update() on some tables
    .update({ weak_concepts: concepts })
    .eq('student_id', userId)
    .select()
    .single();

  if (error) {
    console.error('Error updating weak concepts:', error);
    throw error;
  }

  return data;
}

/**
 * Salvează rezultatul unui test generat de AI
 */
export async function saveTestResult(
  supabase: SupabaseClient<Database>,
  result: TestResultInsert
) {
  const { data, error } = await supabase
    .from('test_results')
    // @ts-expect-error — Supabase typed client infers 'never[]' for .insert() on some tables
    .insert(result)
    .select()
    .single();

  if (error) {
    console.error('Error saving test result:', error);
    throw error;
  }

  return data;
}

/**
 * Extrage progresul testelor pentru toți studenții dintr-o anumită clasă (ex: "10A")
 * Folosim join (!inner) pentru a asigura că aducem doar studenții din acea clasă
 */
export async function getClassProgress(
  supabase: SupabaseClient<Database>,
  className: string
) {
  const { data, error } = await supabase
    .from('test_results')
    .select(`
      id,
      topic,
      score,
      created_at,
      student_id,
      profiles!inner (
        first_name,
        last_name,
        class_name
      )
    `)
    .eq('profiles.class_name', className)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching class progress:', error);
    throw error;
  }

  return data;
}
