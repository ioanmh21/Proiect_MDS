import { NextRequest, NextResponse } from 'next/server';

// ============================================================================
// Răspunsuri corecte + explicații (mirrored from quiz route)
// ============================================================================
const CORRECT_ANSWERS: Record<string, { correctAnswer: string; explanation: string }> = {
  q1: {
    correctAnswer: 'array',
    explanation: 'Array este un obiect în JavaScript, nu un tip primitiv. Tipurile primitive sunt: string, number, bigint, boolean, undefined, symbol și null.',
  },
  q2: {
    correctAnswer: 'Adevărat',
    explanation: 'Operatorul == (loose equality) face type coercion. null și undefined sunt considerate egale cu ==, dar nu și cu === (strict equality).',
  },
  q3: {
    correctAnswer: 'var are function scope și este hoisted, let și const au block scope. const nu permite reasignarea.',
    explanation: 'var: function-scoped, hoisted (inițializat cu undefined). let: block-scoped, hoisted dar în Temporal Dead Zone. const: block-scoped, hoisted dar în TDZ, nu permite reasignare (dar obiectele pot fi mutate).',
  },
  q4: {
    correctAnswer: '"number"',
    explanation: 'NaN (Not a Number) este, paradoxal, de tipul "number" în JavaScript. Acest lucru se datorează standardului IEEE 754 pentru floating-point arithmetic.',
  },
  q5: {
    correctAnswer: 'Fals',
    explanation: 'Funcțiile arrow NU au propriul context this. Ele moștenesc this-ul din scope-ul lexical (enclosing scope) în care au fost definite.',
  },
  q6: {
    correctAnswer: 'map()',
    explanation: 'map() returnează un array nou cu rezultatele apelării funcției pe fiecare element. push() și splice() modifică array-ul original, iar sort() sortează in-place.',
  },
  q7: {
    correctAnswer: 'Un closure este o funcție care își amintește variabilele din scope-ul în care a fost creată, chiar și după ce acel scope s-a închis.',
    explanation: 'Un closure apare când o funcție internă accesează variabilele funcției externe, chiar și după ce funcția externă s-a terminat. Exemplu: factory functions, data privacy, funcții curry.',
  },
  q8: {
    correctAnswer: 'Adevărat',
    explanation: 'Promise.all() returnează un promise care se rezolvă când toate promise-urile primite se rezolvă, sau se respinge dacă oricare este respins (fail-fast).',
  },
  q9: {
    correctAnswer: 'Flux/Redux Pattern',
    explanation: 'useReducer implementează pattern-ul Flux/Redux: state + action → reducer → new state. Reducer-ul este o funcție pură.',
  },
  q10: {
    correctAnswer: 'Server Components se renderizează pe server, nu trimit JS la client. Client Components se renderizează pe client, au acces la hooks și browser APIs.',
    explanation: 'Server Components (default): se renderizează pe server, acces direct la DB, NU pot folosi hooks. Client Components ("use client"): pot folosi useState/useEffect, event handlers, browser APIs.',
  },
};

/**
 * POST /api/quiz/[testId]/answer
 * Body: { questionId: string, answer: string }
 * Returnează feedback instant: isCorrect + explanation
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ testId: string }> }
) {
  await params; // consume params

  const body = await request.json();
  const { questionId, answer } = body as { questionId: string; answer: string };

  if (!questionId || answer === undefined) {
    return NextResponse.json(
      { error: 'questionId și answer sunt obligatorii' },
      { status: 400 }
    );
  }

  // Simulare delay
  await new Promise((resolve) => setTimeout(resolve, 300));

  const questionData = CORRECT_ANSWERS[questionId];
  if (!questionData) {
    return NextResponse.json(
      { error: 'Întrebare negăsită' },
      { status: 404 }
    );
  }

  // Pentru open_ended, comparăm cu keyword matching simplificat
  const isOpenEnded = ['q3', 'q7', 'q10'].includes(questionId);
  let isCorrect: boolean;

  if (isOpenEnded) {
    // Verificare simplificată: cel puțin 20 de caractere scrise
    // Într-un sistem real, AI ar evalua răspunsul
    isCorrect = answer.trim().length >= 20;
  } else {
    isCorrect = answer === questionData.correctAnswer;
  }

  return NextResponse.json({
    isCorrect,
    correctAnswer: questionData.correctAnswer,
    explanation: questionData.explanation,
  });
}
