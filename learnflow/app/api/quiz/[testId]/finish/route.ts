import { NextRequest, NextResponse } from 'next/server';
import type { SubmittedAnswer } from '@/types/quiz';

// Răspunsuri corecte (se vor extrage din DB în producție)
const CORRECT_ANSWERS: Record<string, { correctAnswer: string; explanation: string; points: number }> = {
  q1: { correctAnswer: 'array', explanation: 'Array este un obiect în JavaScript, nu un tip primitiv.', points: 10 },
  q2: { correctAnswer: 'Adevărat', explanation: 'Operatorul == face type coercion — null și undefined sunt egale cu ==.', points: 10 },
  q3: { correctAnswer: 'var are function scope și este hoisted, let și const au block scope.', explanation: 'var: function-scoped, hoisted. let/const: block-scoped, TDZ. const nu permite reasignare.', points: 20 },
  q4: { correctAnswer: '"number"', explanation: 'NaN este de tipul "number" conform IEEE 754.', points: 10 },
  q5: { correctAnswer: 'Fals', explanation: 'Funcțiile arrow moștenesc this-ul din scope-ul lexical.', points: 10 },
  q6: { correctAnswer: 'map()', explanation: 'map() returnează un array nou, nu modifică originalul.', points: 10 },
  q7: { correctAnswer: 'Un closure este o funcție care își amintește variabilele din scope-ul în care a fost creată.', explanation: 'Closure = funcție internă + referințe la variabilele scope-ului extern.', points: 20 },
  q8: { correctAnswer: 'Adevărat', explanation: 'Promise.all() fail-fast: se respinge la primul reject.', points: 10 },
  q9: { correctAnswer: 'Flux/Redux Pattern', explanation: 'useReducer: state + action → reducer → new state.', points: 10 },
  q10: { correctAnswer: 'Server Components: server-side, no JS. Client Components: client-side, hooks.', explanation: 'Server = data fetching, Client = interactivitate.', points: 20 },
};

const OPEN_ENDED_IDS = new Set(['q3', 'q7', 'q10']);

/**
 * POST /api/quiz/[testId]/finish
 * Body: { answers: Record<string, string> }
 * Calculează scorul final și returnează TestResult
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ testId: string }> }
) {
  const { testId } = await params;
  const body = await request.json();
  const { answers } = body as { answers: Record<string, string> };

  if (!answers) {
    return NextResponse.json({ error: 'answers este obligatoriu' }, { status: 400 });
  }

  // Simulare delay
  await new Promise((resolve) => setTimeout(resolve, 800));

  let score = 0;
  let totalPoints = 0;
  const submittedAnswers: Record<string, SubmittedAnswer> = {};

  for (const [questionId, questionData] of Object.entries(CORRECT_ANSWERS)) {
    totalPoints += questionData.points;
    const userAnswer = answers[questionId] || '';

    let isCorrect: boolean;
    if (OPEN_ENDED_IDS.has(questionId)) {
      isCorrect = userAnswer.trim().length >= 20;
    } else {
      isCorrect = userAnswer === questionData.correctAnswer;
    }

    if (isCorrect) {
      score += questionData.points;
    }

    submittedAnswers[questionId] = {
      answer: userAnswer,
      isCorrect,
      correctAnswer: questionData.correctAnswer,
      explanation: questionData.explanation,
    };
  }

  const percentage = Math.round((score / totalPoints) * 100);

  return NextResponse.json({
    testId,
    score,
    totalPoints,
    percentage,
    submittedAnswers,
    completedAt: new Date().toISOString(),
  });
}
