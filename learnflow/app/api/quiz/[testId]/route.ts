import { NextRequest, NextResponse } from 'next/server';
import type { QuizQuestion } from '@/types/quiz';

// ============================================================================
// Date mock — 10 întrebări de demo cu cele 3 tipuri
// ============================================================================
const MOCK_QUESTIONS: QuizQuestion[] = [
  {
    id: 'q1',
    type: 'multiple_choice',
    text: 'Care dintre următoarele NU este un tip de date primitiv în JavaScript?',
    options: ['string', 'boolean', 'array', 'symbol'],
    correctAnswer: 'array',
    explanation: 'Array este un obiect în JavaScript, nu un tip primitiv. Tipurile primitive sunt: string, number, bigint, boolean, undefined, symbol și null.',
    points: 10,
  },
  {
    id: 'q2',
    type: 'true_false',
    text: 'În JavaScript, `null == undefined` returnează `true`.',
    correctAnswer: 'Adevărat',
    explanation: 'Operatorul == (loose equality) face type coercion. null și undefined sunt considerate egale cu ==, dar nu și cu === (strict equality).',
    points: 10,
  },
  {
    id: 'q3',
    type: 'open_ended',
    text: 'Explică diferența dintre `let`, `const` și `var` în JavaScript. Menționează scope-ul și hoisting-ul.',
    correctAnswer: 'var are function scope și este hoisted, let și const au block scope. const nu permite reasignarea.',
    explanation: 'var: function-scoped, hoisted (inițializat cu undefined). let: block-scoped, hoisted dar în Temporal Dead Zone. const: block-scoped, hoisted dar în TDZ, nu permite reasignare (dar obiectele pot fi mutate).',
    points: 20,
  },
  {
    id: 'q4',
    type: 'multiple_choice',
    text: 'Ce returnează `typeof NaN` în JavaScript?',
    options: ['\"NaN\"', '\"undefined\"', '\"number\"', '\"object\"'],
    correctAnswer: '"number"',
    explanation: 'NaN (Not a Number) este, paradoxal, de tipul "number" în JavaScript. Acest lucru se datorează standardului IEEE 754 pentru floating-point arithmetic.',
    points: 10,
  },
  {
    id: 'q5',
    type: 'true_false',
    text: 'Funcțiile arrow în JavaScript au propriul lor context `this`.',
    correctAnswer: 'Fals',
    explanation: 'Funcțiile arrow NU au propriul context this. Ele moștenesc this-ul din scope-ul lexical (enclosing scope) în care au fost definite. Aceasta este o diferență majoră față de funcțiile clasice.',
    points: 10,
  },
  {
    id: 'q6',
    type: 'multiple_choice',
    text: 'Care metodă de array creează un array nou fără a modifica originalul?',
    options: ['push()', 'splice()', 'map()', 'sort()'],
    correctAnswer: 'map()',
    explanation: 'map() returnează un array nou cu rezultatele apelării funcției pe fiecare element. push() și splice() modifică array-ul original, iar sort() sortează in-place (modifică originalul).',
    points: 10,
  },
  {
    id: 'q7',
    type: 'open_ended',
    text: 'Ce este un closure în JavaScript? Dă un exemplu practic de utilizare.',
    correctAnswer: 'Un closure este o funcție care își amintește variabilele din scope-ul în care a fost creată, chiar și după ce acel scope s-a închis.',
    explanation: 'Un closure apare când o funcție internă accesează variabilele funcției externe, chiar și după ce funcția externă s-a terminat. Exemplu practic: factory functions, data privacy (module pattern), funcții curry, event handlers cu state.',
    points: 20,
  },
  {
    id: 'q8',
    type: 'true_false',
    text: 'Promise.all() se rezolvă cu succes doar dacă TOATE promise-urile din array se rezolvă cu succes.',
    correctAnswer: 'Adevărat',
    explanation: 'Corect! Promise.all() returnează un promise care se rezolvă când toate promise-urile primite se rezolvă, sau se respinge dacă oricare dintre ele este respins (fail-fast). Pentru a continua chiar dacă unele eșuează, se poate folosi Promise.allSettled().',
    points: 10,
  },
  {
    id: 'q9',
    type: 'multiple_choice',
    text: 'Ce design pattern este folosit de React pentru managementul stării cu useReducer?',
    options: ['Observer Pattern', 'Factory Pattern', 'Flux/Redux Pattern', 'Singleton Pattern'],
    correctAnswer: 'Flux/Redux Pattern',
    explanation: 'useReducer implementează pattern-ul Flux/Redux: state + action → reducer → new state. Reducer-ul este o funcție pură care primește starea curentă și o acțiune, și returnează noua stare.',
    points: 10,
  },
  {
    id: 'q10',
    type: 'open_ended',
    text: 'Descrie diferența dintre Server Components și Client Components în Next.js. Când ai folosi fiecare tip?',
    correctAnswer: 'Server Components se renderizează pe server, nu trimit JS la client. Client Components se renderizează pe client, au acces la hooks și browser APIs.',
    explanation: 'Server Components (default în App Router): se renderizează pe server, acces direct la DB/filesystem, nu trimit JS la client, NU pot folosi hooks/browser APIs. Client Components ("use client"): se renderizează pe client, pot folosi useState/useEffect, event handlers, browser APIs. Folosește Server Components pentru data fetching și UI static, și Client Components pentru interactivitate.',
    points: 20,
  },
];

const TOTAL_TIME_SECONDS = 15 * 60; // 15 minute

/**
 * GET /api/quiz/[testId]
 * Returnează întrebările unui test (mock data)
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ testId: string }> }
) {
  const { testId } = await params;

  // Simulare delay de rețea
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Returnăm întrebările fără correctAnswer (pentru client)
  const questionsForClient = MOCK_QUESTIONS.map(({ correctAnswer, explanation, ...q }) => q);

  return NextResponse.json({
    testId,
    questions: questionsForClient,
    totalTime: TOTAL_TIME_SECONDS,
    title: 'Test JavaScript Fundamentals',
  });
}
