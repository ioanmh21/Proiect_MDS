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
          embedding: string | null
          created_at: string
        }
        Insert: {
          id?: string
          material_id: string
          content: string
          page_number?: number | null
          embedding?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          material_id?: string
          content?: string
          page_number?: number | null
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
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
