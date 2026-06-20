/**
 * lib/agents/evaluator-agent.ts
 * ==============================
 * Agent Evaluator (TypeScript / Next.js side)
 *
 * Responsabilități:
 *  1. generateTest()  — Generează un test educațional via Gemini cu retry logic.
 *  2. gradeTest()     — Corectează răspunsurile elevului, calculează scorul (0-100)
 *                       și extrage conceptele slabe din greșeli.
 *
 * Retry logic: dacă Gemini returnează JSON invalid, reapelează de max MAX_RETRIES ori.
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

// ─────────────────────────────────────────────
// Tipuri publice
// ─────────────────────────────────────────────

export interface TestConfig {
  nrQuestions: number;
  types: ('grila' | 'open' | 'adevarat_fals')[];
  difficulty: 'usor' | 'mediu' | 'greu';
  weakConcepts: string[];
  materialId: string;
}

export interface Question {
  id: string;
  text: string;
  type: 'grila' | 'open' | 'adevarat_fals';
  options?: string[];
  correctAnswer: string | string[];
  explanation: string;
  difficulty: 'usor' | 'mediu' | 'greu';
  concept: string;
}

export interface GeneratedTest {
  questions: Question[];
  materialId: string;
  config: TestConfig;
}

export interface StudentAnswer {
  questionId: string;
  answer: string | string[];
}

export interface QuestionFeedback {
  questionId: string;
  isCorrect: boolean;
  correctAnswer: string | string[];
  studentAnswer: string | string[];
  explanation: string;
  concept: string;
}

export interface GradeResult {
  /** Scorul procentual, de la 0 la 100 */
  score: number;
  /** Numărul de răspunsuri corecte */
  correctCount: number;
  /** Feedback detaliat per întrebare */
  feedback: QuestionFeedback[];
  /** Conceptele la care studentul a greșit */
  weakConcepts: string[];
}

// ─────────────────────────────────────────────
// Helper: curăță blocuri markdown din răspunsul Gemini
// ─────────────────────────────────────────────

export function cleanJsonMarkdown(raw: string): string {
  let text = raw.trim();
  if (text.startsWith('```json')) text = text.slice(7);
  else if (text.startsWith('```')) text = text.slice(3);
  if (text.endsWith('```')) text = text.slice(0, -3);
  return text.trim();
}

// ─────────────────────────────────────────────
// Helper: construiește prompt-ul de generare test
// ─────────────────────────────────────────────

export function buildTestPrompt(config: TestConfig): string {
  return `Ești un evaluator educațional expert. Generează un test pentru materialul cu ID: ${config.materialId}.

Cerințe:
- Număr de întrebări: ${config.nrQuestions}
- Tipuri permise: ${config.types.join(', ')}
- Dificultate: ${config.difficulty}
- Focalizare pe conceptele: ${config.weakConcepts.join(', ')}
- Limba: română

Returnează DOAR JSON valid (fără bloc markdown), cu structura exactă:
{
  "questions": [
    {
      "id": "q1",
      "text": "textul întrebării",
      "type": "grila",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": "A",
      "explanation": "explicație detaliată",
      "difficulty": "${config.difficulty}",
      "concept": "conceptul cheie"
    }
  ]
}`.trim();
}

// ─────────────────────────────────────────────
// Helper: compară două răspunsuri (case-insensitive)
// ─────────────────────────────────────────────

export function answersMatch(
  correct: string | string[],
  student: string | string[]
): boolean {
  const normalize = (v: string) => v.toLowerCase().trim();

  if (Array.isArray(correct) && Array.isArray(student)) {
    const sortedCorrect = [...correct].map(normalize).sort();
    const sortedStudent = [...student].map(normalize).sort();
    return JSON.stringify(sortedCorrect) === JSON.stringify(sortedStudent);
  }

  const a = Array.isArray(correct) ? correct.join(',') : correct;
  const b = Array.isArray(student) ? student.join(',') : student;
  return normalize(a) === normalize(b);
}

// ─────────────────────────────────────────────
// Clasa principală EvaluatorAgent
// ─────────────────────────────────────────────

const MAX_RETRIES = 2;

export class EvaluatorAgent {
  private model: GenerativeModel;

  constructor(apiKey?: string) {
    const key = apiKey ?? process.env.GEMINI_API_KEY ?? '';
    const genAI = new GoogleGenerativeAI(key);
    this.model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }

  /**
   * Generează un test educațional.
   * Retry de MAX_RETRIES ori dacă Gemini returnează JSON invalid.
   * Aruncă eroare dacă toate încercările eșuează.
   */
  async generateTest(config: TestConfig): Promise<GeneratedTest> {
    const prompt = buildTestPrompt(config);
    let lastError: Error = new Error('Unknown error');

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const retryNote =
          attempt > 0
            ? '\n\nATENȚIE: Răspunsul anterior nu era JSON valid. Returnează DOAR JSON curat, fără text suplimentar.'
            : '';

        const result = await this.model.generateContent(prompt + retryNote);
        const raw = result.response.text();
        const cleaned = cleanJsonMarkdown(raw);
        const parsed = JSON.parse(cleaned);

        if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
          throw new Error('JSON invalid: câmpul "questions" lipsește sau este gol.');
        }

        return {
          questions: parsed.questions as Question[],
          materialId: config.materialId,
          config,
        };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        // Continuăm cu retry-ul
      }
    }

    throw new Error(
      `[EvaluatorAgent] generateTest a eșuat după ${MAX_RETRIES + 1} încercări. Ultima eroare: ${lastError.message}`
    );
  }

  /**
   * Corectează răspunsurile unui elev față de un test generat.
   * Returnează scorul procentual și conceptele slabe.
   */
  gradeTest(test: GeneratedTest, studentAnswers: StudentAnswer[]): GradeResult {
    const feedback: QuestionFeedback[] = [];
    const weakConceptsSet = new Set<string>();
    let correctCount = 0;

    for (const question of test.questions) {
      const studentAnswer = studentAnswers.find(
        (a) => a.questionId === question.id
      );
      const studentAns = studentAnswer?.answer ?? '';

      const isCorrect = answersMatch(question.correctAnswer, studentAns);

      feedback.push({
        questionId: question.id,
        isCorrect,
        correctAnswer: question.correctAnswer,
        studentAnswer: studentAns,
        explanation: question.explanation,
        concept: question.concept,
      });

      if (isCorrect) {
        correctCount++;
      } else {
        if (question.concept) {
          weakConceptsSet.add(question.concept);
        }
      }
    }

    const totalQuestions = test.questions.length;
    const score =
      totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

    return {
      score,
      correctCount,
      feedback,
      weakConcepts: Array.from(weakConceptsSet),
    };
  }
}
