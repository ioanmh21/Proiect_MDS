/**
 * __tests__/lib/agents/evaluator-agent.test.ts
 * ==============================================
 * Teste Jest complete pentru EvaluatorAgent.
 *
 * Acoperire:
 *  1. generateTest() returnează JSON valid cu numărul corect de întrebări
 *  2. gradeTest() calculează 100% când toate răspunsurile sunt corecte
 *  3. gradeTest() calculează 0% când toate sunt greșite
 *  4. Retry logic: reapelează Gemini când JSON e invalid
 *  5. Conceptele slabe sunt extrase corect din răspunsurile greșite
 *
 * + teste pentru helpere: cleanJsonMarkdown, buildTestPrompt, answersMatch
 */

import {
  EvaluatorAgent,
  GeneratedTest,
  TestConfig,
  StudentAnswer,
  Question,
  cleanJsonMarkdown,
  buildTestPrompt,
  answersMatch,
} from '@/lib/agents/evaluator-agent';

// ─────────────────────────────────────────────
// Mock @google/generative-ai
// ─────────────────────────────────────────────

const mockGenerateContent = jest.fn();
const mockGetGenerativeModel = jest.fn(() => ({
  generateContent: mockGenerateContent,
}));

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
}));

// ─────────────────────────────────────────────
// Helper: construiește un răspuns Gemini mockat
// ─────────────────────────────────────────────

function mockGeminiResponse(jsonContent: object | string): void {
  const text = typeof jsonContent === 'string' ? jsonContent : JSON.stringify(jsonContent);
  mockGenerateContent.mockResolvedValue({
    response: { text: () => text },
  });
}

// ─────────────────────────────────────────────
// Fixture-uri
// ─────────────────────────────────────────────

let agent: EvaluatorAgent;
let defaultConfig: TestConfig;
let twoQuestionTest: GeneratedTest;
let threeQuestionTest: GeneratedTest;

// Întrebări refolosite în fixture-uri
const qRecursivitate: Question = {
  id: 'q1',
  text: 'Ce este recursivitatea?',
  type: 'grila',
  options: ['O funcție care se apelează pe ea însăși', 'O buclă', 'O variabilă', 'O clasă'],
  correctAnswer: 'O funcție care se apelează pe ea însăși',
  explanation: 'Recursivitatea = funcție care se autoapelează cu un caz de bază.',
  difficulty: 'usor',
  concept: 'recursivitate',
};

const qOOP: Question = {
  id: 'q2',
  text: 'Ce înseamnă moștenirea în OOP?',
  type: 'grila',
  options: ['O clasă preia atributele alteia', 'O funcție', 'Un tip de date', 'Un loop'],
  correctAnswer: 'O clasă preia atributele alteia',
  explanation: 'Moștenirea permite reutilizarea codului.',
  difficulty: 'mediu',
  concept: 'OOP',
};

const qPointeri: Question = {
  id: 'q3',
  text: 'Ce este un pointer?',
  type: 'grila',
  options: ['O adresă de memorie', 'O valoare', 'Un tip', 'O funcție'],
  correctAnswer: 'O adresă de memorie',
  explanation: 'Un pointer stochează adresa de memorie a unei variabile.',
  difficulty: 'greu',
  concept: 'pointeri',
};

beforeEach(() => {
  jest.clearAllMocks();

  agent = new EvaluatorAgent('fake-api-key-test');

  defaultConfig = {
    nrQuestions: 2,
    types: ['grila'],
    difficulty: 'mediu',
    weakConcepts: ['recursivitate', 'OOP'],
    materialId: 'mat-uuid-123',
  };

  twoQuestionTest = {
    questions: [qRecursivitate, qOOP],
    materialId: 'mat-uuid-123',
    config: defaultConfig,
  };

  threeQuestionTest = {
    questions: [qRecursivitate, qOOP, qPointeri],
    materialId: 'mat-uuid-123',
    config: { ...defaultConfig, nrQuestions: 3 },
  };
});

// ─────────────────────────────────────────────
// 1. generateTest() — JSON valid, număr corect de întrebări
// ─────────────────────────────────────────────

describe('EvaluatorAgent.generateTest() — răspuns valid', () => {
  it('returnează GeneratedTest cu numărul exact de întrebări cerute', async () => {
    mockGeminiResponse({
      questions: [
        {
          id: 'q1',
          text: 'Ce este recursivitatea?',
          type: 'grila',
          options: ['A', 'B'],
          correctAnswer: 'A',
          explanation: 'Expl',
          difficulty: 'usor',
          concept: 'recursivitate',
        },
        {
          id: 'q2',
          text: 'Ce este OOP?',
          type: 'grila',
          options: ['C', 'D'],
          correctAnswer: 'C',
          explanation: 'Expl OOP',
          difficulty: 'mediu',
          concept: 'OOP',
        },
      ],
    });

    const result = await agent.generateTest(defaultConfig);

    expect(result).toBeDefined();
    expect(result.questions).toHaveLength(2);
    expect(result.materialId).toBe('mat-uuid-123');
  });

  it('fiecare întrebare are câmpurile obligatorii (id, text, correctAnswer, concept)', async () => {
    mockGeminiResponse({
      questions: [
        {
          id: 'q1',
          text: 'Întrebare test',
          type: 'grila',
          options: ['A', 'B'],
          correctAnswer: 'A',
          explanation: 'Explicație',
          difficulty: 'usor',
          concept: 'testConcept',
        },
      ],
    });

    const result = await agent.generateTest({ ...defaultConfig, nrQuestions: 1 });
    const q = result.questions[0];

    expect(q.id).toBe('q1');
    expect(q.text).toBeTruthy();
    expect(q.correctAnswer).toBeTruthy();
    expect(q.concept).toBeTruthy();
  });

  it('funcționează cu răspuns JSON învelit în bloc markdown ```json```', async () => {
    const jsonPayload = JSON.stringify({
      questions: [
        {
          id: 'q1',
          text: 'Test?',
          type: 'grila',
          options: ['Da', 'Nu'],
          correctAnswer: 'Da',
          explanation: 'Expl',
          difficulty: 'usor',
          concept: 'testConcept',
        },
      ],
    });
    mockGenerateContent.mockResolvedValue({
      response: { text: () => `\`\`\`json\n${jsonPayload}\n\`\`\`` },
    });

    const result = await agent.generateTest({ ...defaultConfig, nrQuestions: 1 });
    expect(result.questions).toHaveLength(1);
  });

  it('propagă materialId și config în obiectul returnat', async () => {
    mockGeminiResponse({ questions: [{ id: 'q1', text: 'T?', type: 'grila', correctAnswer: 'A', explanation: 'E', difficulty: 'usor', concept: 'c' }] });

    const result = await agent.generateTest(defaultConfig);

    expect(result.materialId).toBe(defaultConfig.materialId);
    expect(result.config).toEqual(defaultConfig);
  });
});

// ─────────────────────────────────────────────
// 2. gradeTest() — 100% când toate răspunsurile sunt corecte
// ─────────────────────────────────────────────

describe('EvaluatorAgent.gradeTest() — toate corecte → 100%', () => {
  it('returnează score=100 când toate răspunsurile sunt corecte', () => {
    const answers: StudentAnswer[] = [
      { questionId: 'q1', answer: 'O funcție care se apelează pe ea însăși' },
      { questionId: 'q2', answer: 'O clasă preia atributele alteia' },
    ];

    const result = agent.gradeTest(twoQuestionTest, answers);

    expect(result.score).toBe(100);
    expect(result.correctCount).toBe(2);
  });

  it('feedback-ul marchează toate întrebările ca isCorrect=true', () => {
    const answers: StudentAnswer[] = [
      { questionId: 'q1', answer: 'O funcție care se apelează pe ea însăși' },
      { questionId: 'q2', answer: 'O clasă preia atributele alteia' },
    ];

    const result = agent.gradeTest(twoQuestionTest, answers);

    expect(result.feedback.every((f) => f.isCorrect)).toBe(true);
  });

  it('nu există concepte slabe când totul e corect', () => {
    const answers: StudentAnswer[] = [
      { questionId: 'q1', answer: 'O funcție care se apelează pe ea însăși' },
      { questionId: 'q2', answer: 'O clasă preia atributele alteia' },
    ];

    const result = agent.gradeTest(twoQuestionTest, answers);

    expect(result.weakConcepts).toHaveLength(0);
  });

  it('compararea e case-insensitive (MAJUSCULE = minuscule)', () => {
    const answers: StudentAnswer[] = [
      { questionId: 'q1', answer: 'O FUNCȚIE CARE SE APELEAZĂ PE EA ÎNSĂȘI' },
      { questionId: 'q2', answer: 'o clasă preia atributele alteia' },
    ];

    const result = agent.gradeTest(twoQuestionTest, answers);

    expect(result.score).toBe(100);
  });

  it('score 100% pentru 3 din 3 corecte', () => {
    const answers: StudentAnswer[] = [
      { questionId: 'q1', answer: 'O funcție care se apelează pe ea însăși' },
      { questionId: 'q2', answer: 'O clasă preia atributele alteia' },
      { questionId: 'q3', answer: 'O adresă de memorie' },
    ];

    const result = agent.gradeTest(threeQuestionTest, answers);

    expect(result.score).toBe(100);
    expect(result.correctCount).toBe(3);
  });
});

// ─────────────────────────────────────────────
// 3. gradeTest() — 0% când toate sunt greșite
// ─────────────────────────────────────────────

describe('EvaluatorAgent.gradeTest() — toate greșite → 0%', () => {
  it('returnează score=0 când toate răspunsurile sunt greșite', () => {
    const answers: StudentAnswer[] = [
      { questionId: 'q1', answer: 'O buclă' },           // greșit
      { questionId: 'q2', answer: 'O funcție' },          // greșit
    ];

    const result = agent.gradeTest(twoQuestionTest, answers);

    expect(result.score).toBe(0);
    expect(result.correctCount).toBe(0);
  });

  it('feedback-ul marchează toate ca isCorrect=false', () => {
    const answers: StudentAnswer[] = [
      { questionId: 'q1', answer: 'O buclă' },
      { questionId: 'q2', answer: 'O funcție' },
    ];

    const result = agent.gradeTest(twoQuestionTest, answers);

    expect(result.feedback.every((f) => !f.isCorrect)).toBe(true);
  });

  it('score=0 când studentul nu trimite niciun răspuns', () => {
    const result = agent.gradeTest(twoQuestionTest, []);

    expect(result.score).toBe(0);
    expect(result.correctCount).toBe(0);
  });

  it('score=0 pentru 3 din 3 greșite', () => {
    const answers: StudentAnswer[] = [
      { questionId: 'q1', answer: 'O buclă' },
      { questionId: 'q2', answer: 'Un tip de date' },
      { questionId: 'q3', answer: 'O valoare' },
    ];

    const result = agent.gradeTest(threeQuestionTest, answers);

    expect(result.score).toBe(0);
    expect(result.correctCount).toBe(0);
  });

  it('scorul parțial: 1 din 2 corect → 50%', () => {
    const answers: StudentAnswer[] = [
      { questionId: 'q1', answer: 'O funcție care se apelează pe ea însăși' }, // corect
      { questionId: 'q2', answer: 'O funcție' },                                // greșit
    ];

    const result = agent.gradeTest(twoQuestionTest, answers);

    expect(result.score).toBe(50);
    expect(result.correctCount).toBe(1);
  });

  it('scorul parțial: 2 din 3 corecte → 67%', () => {
    const answers: StudentAnswer[] = [
      { questionId: 'q1', answer: 'O funcție care se apelează pe ea însăși' }, // corect
      { questionId: 'q2', answer: 'O clasă preia atributele alteia' },          // corect
      { questionId: 'q3', answer: 'O valoare' },                                // greșit
    ];

    const result = agent.gradeTest(threeQuestionTest, answers);

    expect(result.score).toBe(67);
    expect(result.correctCount).toBe(2);
  });
});

// ─────────────────────────────────────────────
// 4. Retry logic — reapelează Gemini când JSON e invalid
// ─────────────────────────────────────────────

describe('EvaluatorAgent.generateTest() — retry logic', () => {
  it('reușește la a 2-a încercare când primul răspuns e JSON invalid', async () => {
    const validPayload = {
      questions: [
        {
          id: 'q1',
          text: 'Test retry?',
          type: 'grila',
          options: ['A', 'B'],
          correctAnswer: 'A',
          explanation: 'E',
          difficulty: 'usor',
          concept: 'retry-concept',
        },
      ],
    };

    mockGenerateContent
      .mockResolvedValueOnce({ response: { text: () => 'Acesta nu este JSON!' } })     // attempt 0 → eșec
      .mockResolvedValueOnce({ response: { text: () => JSON.stringify(validPayload) } }); // attempt 1 → succes

    const result = await agent.generateTest({ ...defaultConfig, nrQuestions: 1 });

    expect(result.questions).toHaveLength(1);
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });

  it('reușește la a 3-a încercare (două eșecuri consecutive)', async () => {
    const validPayload = {
      questions: [
        {
          id: 'q1', text: 'Q?', type: 'grila', options: ['A'],
          correctAnswer: 'A', explanation: 'E', difficulty: 'usor', concept: 'c',
        },
      ],
    };

    mockGenerateContent
      .mockResolvedValueOnce({ response: { text: () => 'text invalid' } })         // attempt 0
      .mockResolvedValueOnce({ response: { text: () => '{broken json' } })          // attempt 1
      .mockResolvedValueOnce({ response: { text: () => JSON.stringify(validPayload) } }); // attempt 2

    const result = await agent.generateTest({ ...defaultConfig, nrQuestions: 1 });

    expect(result.questions).toHaveLength(1);
    expect(mockGenerateContent).toHaveBeenCalledTimes(3);
  });

  it('aruncă eroare după ce toate cele 3 încercări eșuează', async () => {
    mockGenerateContent
      .mockResolvedValue({ response: { text: () => 'nu e json deloc' } });

    await expect(agent.generateTest(defaultConfig)).rejects.toThrow(
      '[EvaluatorAgent] generateTest a eșuat după'
    );

    expect(mockGenerateContent).toHaveBeenCalledTimes(3); // 0 + 2 retry-uri
  });

  it('aruncă eroare când JSON lipsește câmpul "questions"', async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => JSON.stringify({ altCamp: [] }) },
    });

    await expect(agent.generateTest(defaultConfig)).rejects.toThrow(
      '[EvaluatorAgent] generateTest a eșuat după'
    );
  });

  it('aruncă eroare când "questions" este array gol', async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => JSON.stringify({ questions: [] }) },
    });

    await expect(agent.generateTest(defaultConfig)).rejects.toThrow(
      '[EvaluatorAgent] generateTest a eșuat după'
    );
  });

  it('al doilea apel conține nota de retry în prompt', async () => {
    mockGenerateContent
      .mockResolvedValueOnce({ response: { text: () => 'invalid json' } })
      .mockResolvedValueOnce({
        response: {
          text: () =>
            JSON.stringify({
              questions: [
                { id: 'q1', text: 'T', type: 'grila', correctAnswer: 'A', explanation: 'E', difficulty: 'usor', concept: 'c' },
              ],
            }),
        },
      });

    await agent.generateTest({ ...defaultConfig, nrQuestions: 1 });

    const secondCallArg = mockGenerateContent.mock.calls[1][0] as string;
    expect(secondCallArg).toContain('ATENȚIE');
    expect(secondCallArg).toContain('JSON valid');
  });
});

// ─────────────────────────────────────────────
// 5. Conceptele slabe extrase corect din greșeli
// ─────────────────────────────────────────────

describe('EvaluatorAgent.gradeTest() — extragere concepte slabe', () => {
  it('extrage conceptul întrebării greșite', () => {
    const answers: StudentAnswer[] = [
      { questionId: 'q1', answer: 'O buclă' },          // greșit → concept: 'recursivitate'
      { questionId: 'q2', answer: 'O clasă preia atributele alteia' }, // corect
    ];

    const result = agent.gradeTest(twoQuestionTest, answers);

    expect(result.weakConcepts).toContain('recursivitate');
    expect(result.weakConcepts).not.toContain('OOP');
  });

  it('extrage toate conceptele când toate răspunsurile sunt greșite', () => {
    const answers: StudentAnswer[] = [
      { questionId: 'q1', answer: 'greșit' },
      { questionId: 'q2', answer: 'greșit' },
      { questionId: 'q3', answer: 'greșit' },
    ];

    const result = agent.gradeTest(threeQuestionTest, answers);

    expect(result.weakConcepts).toContain('recursivitate');
    expect(result.weakConcepts).toContain('OOP');
    expect(result.weakConcepts).toContain('pointeri');
    expect(result.weakConcepts).toHaveLength(3);
  });

  it('nu duplică un concept dacă două întrebări pe același concept sunt greșite', () => {
    const testDuplicateConcept: GeneratedTest = {
      ...twoQuestionTest,
      questions: [
        { ...qRecursivitate, id: 'q1', concept: 'recursivitate' },
        { ...qOOP,           id: 'q2', concept: 'recursivitate' }, // același concept
      ],
    };

    const answers: StudentAnswer[] = [
      { questionId: 'q1', answer: 'greșit' },
      { questionId: 'q2', answer: 'greșit' },
    ];

    const result = agent.gradeTest(testDuplicateConcept, answers);

    // Conceptul trebuie să apară o singură dată
    expect(result.weakConcepts.filter((c) => c === 'recursivitate')).toHaveLength(1);
    expect(result.weakConcepts).toHaveLength(1);
  });

  it('feedback-ul include conceptul și explicația pentru fiecare întrebare greșită', () => {
    const answers: StudentAnswer[] = [
      { questionId: 'q1', answer: 'greșit' },
      { questionId: 'q2', answer: 'O clasă preia atributele alteia' }, // corect
    ];

    const result = agent.gradeTest(twoQuestionTest, answers);

    const wrongFeedback = result.feedback.find((f) => !f.isCorrect)!;
    expect(wrongFeedback.concept).toBe('recursivitate');
    expect(wrongFeedback.explanation).toBeTruthy();
    expect(wrongFeedback.correctAnswer).toBe('O funcție care se apelează pe ea însăși');
    expect(wrongFeedback.studentAnswer).toBe('greșit');
  });
});

// ─────────────────────────────────────────────
// 6. Teste pentru helpere pure
// ─────────────────────────────────────────────

describe('cleanJsonMarkdown()', () => {
  it('elimină bloc ```json ... ```', () => {
    const input = '```json\n{"questions": []}\n```';
    expect(cleanJsonMarkdown(input)).toBe('{"questions": []}');
  });

  it('elimină bloc ``` ... ``` fără specificator de limbă', () => {
    const input = '```\n{"questions": []}\n```';
    expect(cleanJsonMarkdown(input)).toBe('{"questions": []}');
  });

  it('lasă JSON curat neschimbat', () => {
    const input = '{"questions": []}';
    expect(cleanJsonMarkdown(input)).toBe('{"questions": []}');
  });

  it('trimite whitespace-ul', () => {
    const input = '  {"questions": []}  ';
    expect(cleanJsonMarkdown(input)).toBe('{"questions": []}');
  });
});

describe('buildTestPrompt()', () => {
  it('conține materialId', () => {
    const prompt = buildTestPrompt(defaultConfig);
    expect(prompt).toContain('mat-uuid-123');
  });

  it('conține numărul de întrebări cerut', () => {
    const prompt = buildTestPrompt(defaultConfig);
    expect(prompt).toContain('2');
  });

  it('conține conceptele slabe', () => {
    const prompt = buildTestPrompt(defaultConfig);
    expect(prompt).toContain('recursivitate');
    expect(prompt).toContain('OOP');
  });

  it('conține dificultatea', () => {
    const prompt = buildTestPrompt(defaultConfig);
    expect(prompt).toContain('mediu');
  });
});

describe('answersMatch()', () => {
  it('true pentru șiruri identice', () => {
    expect(answersMatch('A', 'A')).toBe(true);
  });

  it('true case-insensitive', () => {
    expect(answersMatch('raspuns corect', 'RASPUNS CORECT')).toBe(true);
  });

  it('false pentru răspunsuri diferite', () => {
    expect(answersMatch('A', 'B')).toBe(false);
  });

  it('true pentru array-uri cu aceleași elemente (ordine diferită)', () => {
    expect(answersMatch(['A', 'B', 'C'], ['C', 'A', 'B'])).toBe(true);
  });

  it('false pentru array-uri cu elemente diferite', () => {
    expect(answersMatch(['A', 'B'], ['A', 'C'])).toBe(false);
  });
});
