import { Database } from './supabase';

// ============================================================================
// Tipuri pentru Tabela: profiles
// ============================================================================
export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

// ============================================================================
// Tipuri pentru Tabela: student_profiles
// ============================================================================
export type StudentProfileRow = Database['public']['Tables']['student_profiles']['Row'];
export type StudentProfileInsert = Database['public']['Tables']['student_profiles']['Insert'];
export type StudentProfileUpdate = Database['public']['Tables']['student_profiles']['Update'];

// ============================================================================
// Tipuri pentru Tabela: materials
// ============================================================================
export type MaterialRow = Database['public']['Tables']['materials']['Row'];
export type MaterialInsert = Database['public']['Tables']['materials']['Insert'];
export type MaterialUpdate = Database['public']['Tables']['materials']['Update'];

// ============================================================================
// Tipuri pentru Tabela: chunks
// ============================================================================
export type ChunkRow = Database['public']['Tables']['chunks']['Row'];
export type ChunkInsert = Database['public']['Tables']['chunks']['Insert'];
export type ChunkUpdate = Database['public']['Tables']['chunks']['Update'];

// ============================================================================
// Tipuri pentru Tabela: study_sessions
// ============================================================================
export type StudySessionRow = Database['public']['Tables']['study_sessions']['Row'];
export type StudySessionInsert = Database['public']['Tables']['study_sessions']['Insert'];
export type StudySessionUpdate = Database['public']['Tables']['study_sessions']['Update'];

// ============================================================================
// Tipuri pentru Tabela: test_results
// ============================================================================
export type TestResultRow = Database['public']['Tables']['test_results']['Row'];
export type TestResultInsert = Database['public']['Tables']['test_results']['Insert'];
export type TestResultUpdate = Database['public']['Tables']['test_results']['Update'];

// ============================================================================
// Tipuri pentru Tabela: ingestion_jobs
// ============================================================================
export type IngestionJobRow = Database['public']['Tables']['ingestion_jobs']['Row'];
export type IngestionJobInsert = Database['public']['Tables']['ingestion_jobs']['Insert'];
export type IngestionJobUpdate = Database['public']['Tables']['ingestion_jobs']['Update'];

/** Status-urile posibile ale unui job de ingestie */
export type IngestionJobStatus = IngestionJobRow['status'];

// ============================================================================
// Tipuri pentru Tabela: flashcards
// ============================================================================
export type FlashcardRow = Database['public']['Tables']['flashcards']['Row'];
export type FlashcardInsert = Database['public']['Tables']['flashcards']['Insert'];
export type FlashcardUpdate = Database['public']['Tables']['flashcards']['Update'];

// ============================================================================
// Tipuri pentru Tabela: quiz_questions
// ============================================================================
export type QuizQuestionRow = Database['public']['Tables']['quiz_questions']['Row'];
export type QuizQuestionInsert = Database['public']['Tables']['quiz_questions']['Insert'];
export type QuizQuestionUpdate = Database['public']['Tables']['quiz_questions']['Update'];

/** Nivelurile de dificultate ale unei întrebări de quiz */
export type QuizDifficulty = QuizQuestionRow['dificultate'];

// ============================================================================
// Tipuri pentru Tabela: lesson_plans
// ============================================================================
export type LessonPlanRow = Database['public']['Tables']['lesson_plans']['Row'];
export type LessonPlanInsert = Database['public']['Tables']['lesson_plans']['Insert'];
export type LessonPlanUpdate = Database['public']['Tables']['lesson_plans']['Update'];


// ============================================================================
// Tipuri Utilitare pentru Răspunsurile API (API Responses)
// ============================================================================

/**
 * Tip utilitar pentru a standardiza răspunsurile de la Next.js API Routes (Server Actions)
 */
export type ApiResponse<T> = 
  | { data: T; error: null; status: number }
  | { data: null; error: string; status: number };

/**
 * Tip utilitar pentru Extragerea unui Profil de Student Complet 
 * (StudentProfile + datele de bază din tabela Profiles)
 */
export type StudentProfileWithUser = StudentProfileRow & {
  profiles: ProfileRow;
};

/**
 * Tip utilitar pentru răspunsul de la getClassProgress
 * Reprezintă un rezultat de test împreună cu detaliile de nume și clasă ale studentului
 */
export type ClassProgressItem = {
  id: string;
  topic: string;
  score: number | null;
  created_at: string;
  student_id: string;
  profiles: {
    first_name: string | null;
    last_name: string | null;
    class_name: string | null;
  };
};
