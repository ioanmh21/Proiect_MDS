export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          first_name: string | null
          last_name: string | null
          role: 'student' | 'teacher'
          class_name: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          first_name?: string | null
          last_name?: string | null
          role?: 'student' | 'teacher'
          class_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          first_name?: string | null
          last_name?: string | null
          role?: 'student' | 'teacher'
          class_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      student_profiles: {
        Row: {
          id: string
          student_id: string
          learning_style: string | null
          weak_concepts: Json | null
          strong_concepts: Json | null
          ai_notes: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          student_id: string
          learning_style?: string | null
          weak_concepts?: Json | null
          strong_concepts?: Json | null
          ai_notes?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          learning_style?: string | null
          weak_concepts?: Json | null
          strong_concepts?: Json | null
          ai_notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      materials: {
        Row: {
          id: string
          teacher_id: string
          title: string
          description: string | null
          type: 'pdf' | 'video' | 'text'
          file_url: string
          status: 'pending' | 'processing' | 'completed' | 'error'
          class_name: string | null
          subject: string | null
          grade: number | null
          chapter: string | null
          /** Rezumat generat AI: { introducere, capitole[] } */
          summary: Json | null
          /** Notițe generate AI: array de bullet-point strings */
          notes: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          teacher_id: string
          title: string
          description?: string | null
          type: 'pdf' | 'video' | 'text'
          file_url: string
          status?: 'pending' | 'processing' | 'completed' | 'error'
          class_name?: string | null
          subject?: string | null
          grade?: number | null
          chapter?: string | null
          summary?: Json | null
          notes?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          teacher_id?: string
          title?: string
          description?: string | null
          type?: 'pdf' | 'video' | 'text'
          file_url?: string
          status?: 'pending' | 'processing' | 'completed' | 'error'
          class_name?: string | null
          subject?: string | null
          grade?: number | null
          chapter?: string | null
          summary?: Json | null
          notes?: Json | null
          created_at?: string
        }
        Relationships: []
      }
      chunks: {
        Row: {
          id: string
          material_id: string
          content: string
          page_number: number | null
          /** Secunda de start din video (null pentru chunks din PDF) */
          video_start_seconds: number | null
          /** Secunda de end din video (null pentru chunks din PDF) */
          video_end_seconds: number | null
          embedding: string | null
          created_at: string
        }
        Insert: {
          id?: string
          material_id: string
          content: string
          page_number?: number | null
          video_start_seconds?: number | null
          video_end_seconds?: number | null
          embedding?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          material_id?: string
          content?: string
          page_number?: number | null
          video_start_seconds?: number | null
          video_end_seconds?: number | null
          embedding?: string | null
          created_at?: string
        }
        Relationships: []
      }
      study_sessions: {
        Row: {
          id: string
          student_id: string
          topic: string
          started_at: string
          ended_at: string | null
          material_id: string | null
        }
        Insert: {
          id?: string
          student_id: string
          topic: string
          started_at?: string
          ended_at?: string | null
          material_id?: string | null
        }
        Update: {
          id?: string
          student_id?: string
          topic?: string
          started_at?: string
          ended_at?: string | null
          material_id?: string | null
        }
        Relationships: []
      }
      test_results: {
        Row: {
          id: string
          student_id: string
          session_id: string | null
          topic: string
          score: number | null
          answers: Json
          feedback: Json | null
          material_id: string | null
          status: string | null
          questions: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          student_id: string
          session_id?: string | null
          topic: string
          score?: number | null
          answers: Json
          feedback?: Json | null
          material_id?: string | null
          status?: string | null
          questions?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          session_id?: string | null
          topic?: string
          score?: number | null
          answers?: Json
          feedback?: Json | null
          material_id?: string | null
          status?: string | null
          questions?: Json | null
          created_at?: string
        }
        Relationships: []
      }
      ingestion_jobs: {
        Row: {
          id: string
          material_id: string
          status: 'pending' | 'processing' | 'completed' | 'error'
          progress_pct: number
          current_step: string | null
          error_message: string | null
          chunks_total: number | null
          chunks_processed: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          material_id: string
          status?: 'pending' | 'processing' | 'completed' | 'error'
          progress_pct?: number
          current_step?: string | null
          error_message?: string | null
          chunks_total?: number | null
          chunks_processed?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          material_id?: string
          status?: 'pending' | 'processing' | 'completed' | 'error'
          progress_pct?: number
          current_step?: string | null
          error_message?: string | null
          chunks_total?: number | null
          chunks_processed?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      flashcards: {
        Row: {
          id: string
          material_id: string
          termen: string
          definitie: string
          created_at: string
        }
        Insert: {
          id?: string
          material_id: string
          termen: string
          definitie: string
          created_at?: string
        }
        Update: {
          id?: string
          material_id?: string
          termen?: string
          definitie?: string
          created_at?: string
        }
        Relationships: []
      }
      quiz_questions: {
        Row: {
          id: string
          material_id: string
          text: string
          raspuns: string
          dificultate: 'usor' | 'mediu' | 'greu'
          tip: 'grila' | 'scris'
          optiuni: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          material_id: string
          text: string
          raspuns: string
          dificultate: 'usor' | 'mediu' | 'greu'
          tip?: 'grila' | 'scris'
          optiuni?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          material_id?: string
          text?: string
          raspuns?: string
          dificultate?: 'usor' | 'mediu' | 'greu'
          tip?: 'grila' | 'scris'
          optiuni?: Json | null
          created_at?: string
        }
        Relationships: []
      }
      lesson_plans: {
        Row: {
          id: string
          material_id: string
          durata_min: number
          /** Array de { titlu, descriere, durata_min } */
          etape: Json
          created_at: string
        }
        Insert: {
          id?: string
          material_id: string
          durata_min: number
          etape: Json
          created_at?: string
        }
        Update: {
          id?: string
          material_id?: string
          durata_min?: number
          etape?: Json
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      save_generated_materials: {
        Args: {
          p_material_id: string
          p_summary: Json
          p_notes: Json
          p_flashcards: Json
          p_quiz: Json
          p_lesson_plan: Json
        }
        Returns: Json
      }
    }
    Enums: {
      user_role: 'student' | 'teacher'
      material_type: 'pdf' | 'video' | 'text'
      processing_status: 'pending' | 'processing' | 'completed' | 'error'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
