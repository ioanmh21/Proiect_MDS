// ============================================================================
// Tipuri pentru Quiz System
// ============================================================================

/** Cele 3 tipuri de întrebare suportate */
export type QuestionType = 'multiple_choice' | 'true_false' | 'open_ended';

/** Structura unei întrebări de quiz */
export interface QuizQuestion {
  id: string;
  type: QuestionType;
  text: string;
  /** Opțiunile de răspuns (doar pentru multiple_choice) */
  options?: string[];
  /** Răspunsul corect */
  correctAnswer: string;
  /** Explicație AI generată după submit */
  explanation?: string;
  /** Punctajul întrebării */
  points: number;
}

/** Statusul unui quiz în derulare */
export type QuizStatus = 'loading' | 'in_progress' | 'submitted' | 'error';

/** Feedback pentru un răspuns submittat */
export interface SubmittedAnswer {
  answer: string;
  isCorrect: boolean;
  correctAnswer: string;
  explanation: string;
}

/** Starea completă a unui quiz (returnată de useQuizState) */
export interface QuizState {
  testId: string;
  questions: QuizQuestion[];
  answers: Record<string, string>;
  currentIndex: number;
  timeRemaining: number;
  totalTime: number;
  status: QuizStatus;
  submittedAnswers: Record<string, SubmittedAnswer>;
}

/** Rezultatele finale ale unui test */
export interface TestResult {
  testId: string;
  score: number;
  totalPoints: number;
  percentage: number;
  questions: QuizQuestion[];
  answers: Record<string, string>;
  submittedAnswers: Record<string, SubmittedAnswer>;
  completedAt: string;
}

/** Payload-ul pentru auto-save */
export interface AutoSavePayload {
  answers: Record<string, string>;
  timeRemaining: number;
  currentIndex: number;
}

/** Răspunsul de la API pentru submit answer */
export interface AnswerResponse {
  isCorrect: boolean;
  correctAnswer: string;
  explanation: string;
}

/** Răspunsul de la API pentru finish test */
export interface FinishResponse {
  score: number;
  totalPoints: number;
  percentage: number;
  submittedAnswers: Record<string, SubmittedAnswer>;
  completedAt: string;
}
