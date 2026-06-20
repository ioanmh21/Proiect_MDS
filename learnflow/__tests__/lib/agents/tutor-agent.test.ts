/**
 * __tests__/lib/agents/tutor-agent.test.ts
 * ==========================================
 * Teste Jest complete pentru TutorAgent.
 *
 * Acoperire:
 *  1. run() returnează string non-empty
 *  2. System prompt-ul conține datele din studentProfile
 *  3. Contextul RAG e inclus în system prompt
 *  4. needsReview = true când același concept apare de 3+ ori în conversație
 *  5. Eroarea Gemini e propagată corect
 *
 * Mock: @google/generative-ai complet izolat cu jest.mock()
 */

import {
  TutorAgent,
  TutorAgentInput,
  StudentProfile,
  ConversationMessage,
  buildSystemPrompt,
  detectReviewConcept,
} from '@/lib/agents/tutor-agent';

// ─────────────────────────────────────────────
// Mock @google/generative-ai
// ─────────────────────────────────────────────

// Referință mutabilă la funcția sendMessage pentru a putea fi reconfigurată per test
const mockSendMessage = jest.fn();
const mockStartChat = jest.fn(() => ({ sendMessage: mockSendMessage }));
const mockGetGenerativeModel = jest.fn(() => ({ startChat: mockStartChat }));

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
}));

// ─────────────────────────────────────────────
// Fixture-uri comune (refolosite în beforeEach)
// ─────────────────────────────────────────────

let defaultProfile: StudentProfile;
let defaultInput: TutorAgentInput;
let shortHistory: ConversationMessage[];
let agent: TutorAgent;

beforeEach(() => {
  jest.clearAllMocks();

  // Profil student complet
  defaultProfile = {
    name: 'Andrei Popescu',
    level: 'intermediar',
    weakPoints: ['recursivitate', 'pointeri'],
    className: 'a 10-a B',
  };

  // Istoric scurt (fără repeat-uri)
  shortHistory = [
    { role: 'user', content: 'Ce este OOP?' },
    { role: 'model', content: 'OOP înseamnă programare orientată pe obiect...' },
  ];

  // Input de bază
  defaultInput = {
    studentQuestion: 'Explică-mi cum funcționează moștenirea.',
    studentProfile: defaultProfile,
    ragContext: 'Capitol 3: Moștenirea permite reutilizarea codului.',
    conversationHistory: shortHistory,
  };

  // Răspuns Gemini implicit (succes)
  mockSendMessage.mockResolvedValue({
    response: {
      text: () => 'Moștenirea permite unei clase să preia proprietățile alteia. Poți da un exemplu?',
    },
  });

  agent = new TutorAgent('fake-api-key-pentru-teste');
});

// ─────────────────────────────────────────────
// 1. run() returnează string non-empty
// ─────────────────────────────────────────────

describe('TutorAgent.run() — răspuns valid', () => {
  it('returnează un TutorAgentOutput cu response string non-empty', async () => {
    const output = await agent.run(defaultInput);

    expect(output).toBeDefined();
    expect(typeof output.response).toBe('string');
    expect(output.response.length).toBeGreaterThan(0);
  });

  it('response-ul conține textul returnat de Gemini', async () => {
    const output = await agent.run(defaultInput);

    expect(output.response).toBe(
      'Moștenirea permite unei clase să preia proprietățile alteia. Poți da un exemplu?'
    );
  });

  it('apelează sendMessage exact o singură dată per run()', async () => {
    await agent.run(defaultInput);

    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(mockSendMessage).toHaveBeenCalledWith(defaultInput.studentQuestion);
  });
});

// ─────────────────────────────────────────────
// 2. System prompt-ul conține datele din studentProfile
// ─────────────────────────────────────────────

describe('buildSystemPrompt() — date din studentProfile', () => {
  it('conține numele studentului', () => {
    const prompt = buildSystemPrompt(defaultProfile);
    expect(prompt).toContain('Andrei Popescu');
  });

  it('conține clasa studentului', () => {
    const prompt = buildSystemPrompt(defaultProfile);
    expect(prompt).toContain('a 10-a B');
  });

  it('conține nivelul studentului', () => {
    const prompt = buildSystemPrompt(defaultProfile);
    expect(prompt).toContain('intermediar');
  });

  it('listează toate punctele slabe', () => {
    const prompt = buildSystemPrompt(defaultProfile);
    expect(prompt).toContain('recursivitate');
    expect(prompt).toContain('pointeri');
  });

  it('afișează "necunoscute" când nu există puncte slabe', () => {
    const profileFaraSlabiciuni: StudentProfile = {
      ...defaultProfile,
      weakPoints: [],
    };
    const prompt = buildSystemPrompt(profileFaraSlabiciuni);
    expect(prompt).toContain('necunoscute');
  });

  it('startChat primește systemInstruction cu datele profilului', async () => {
    await agent.run(defaultInput);

    const startChatCall = (mockStartChat.mock.calls as any)[0][0];
    expect(startChatCall.systemInstruction).toContain('Andrei Popescu');
    expect(startChatCall.systemInstruction).toContain('a 10-a B');
    expect(startChatCall.systemInstruction).toContain('intermediar');
  });
});

// ─────────────────────────────────────────────
// 3. Contextul RAG e inclus în system prompt
// ─────────────────────────────────────────────

describe('buildSystemPrompt() — context RAG', () => {
  it('include contextul RAG când este furnizat', () => {
    const ragContext = 'Fragment din curs: recursivitatea este o funcție care se apelează pe sine.';
    const prompt = buildSystemPrompt(defaultProfile, ragContext);

    expect(prompt).toContain(ragContext);
    expect(prompt).toContain('Context din materialul de curs');
  });

  it('nu include secțiunea RAG când contextul lipsește', () => {
    const prompt = buildSystemPrompt(defaultProfile, undefined);

    expect(prompt).not.toContain('Context din materialul de curs');
  });

  it('run() trimite RAG-ul în systemInstruction către Gemini', async () => {
    await agent.run(defaultInput);

    const startChatCall = (mockStartChat.mock.calls as any)[0][0];
    expect(startChatCall.systemInstruction).toContain(
      'Capitol 3: Moștenirea permite reutilizarea codului.'
    );
  });

  it('run() fără ragContext nu include secțiunea Context', async () => {
    const inputFaraRag: TutorAgentInput = { ...defaultInput, ragContext: undefined };
    await agent.run(inputFaraRag);

    const startChatCall = (mockStartChat.mock.calls as any)[0][0];
    expect(startChatCall.systemInstruction).not.toContain('Context din materialul de curs');
  });
});

// ─────────────────────────────────────────────
// 4. needsReview = true când un concept apare 3+ ori
// ─────────────────────────────────────────────

describe('detectReviewConcept() — flag needsReview', () => {
  it('needsReview = false pentru conversație normală (fără repetiții)', () => {
    const result = detectReviewConcept(shortHistory);
    expect(result.needsReview).toBe(false);
  });

  it('needsReview = true când același concept apare de 3 ori în mesajele user', () => {
    const history: ConversationMessage[] = [
      { role: 'user', content: 'Nu înțeleg recursivitate.' },
      { role: 'model', content: 'Recursivitatea este...' },
      { role: 'user', content: 'Poți explica din nou recursivitate?' },
      { role: 'model', content: 'Sigur! Recursivitatea...' },
      { role: 'user', content: 'Inca nu înțeleg recursivitate deloc.' },
    ];

    const result = detectReviewConcept(history);
    expect(result.needsReview).toBe(true);
    expect(result.concept).toBe('recursivitate');
  });

  it('needsReview = false când apare de exact 2 ori (sub prag)', () => {
    const history: ConversationMessage[] = [
      { role: 'user', content: 'Ce este recursivitate?' },
      { role: 'model', content: 'Recursivitatea este...' },
      { role: 'user', content: 'Înțeleg acum recursivitate, mulțumesc.' },
    ];

    const result = detectReviewConcept(history);
    expect(result.needsReview).toBe(false);
  });

  it('ignoră mesajele role=model la numărarea conceptelor', () => {
    // "recursivitate" apare de 3 ori dar toate în mesaje model → nu needsReview
    const history: ConversationMessage[] = [
      { role: 'user', content: 'Explică moștenire.' },
      { role: 'model', content: 'recursivitate recursivitate recursivitate' },
    ];

    const result = detectReviewConcept(history);
    expect(result.needsReview).toBe(false);
  });

  it('run() setează needsReview = true în output când se atinge pragul', async () => {
    const historyRepetata: ConversationMessage[] = [
      { role: 'user', content: 'Nu înțeleg recursivitate.' },
      { role: 'model', content: 'Hai să explicăm.' },
      { role: 'user', content: 'Tot nu înțeleg recursivitate.' },
      { role: 'model', content: 'Încearcă altfel.' },
    ];

    const inputRepetitiv: TutorAgentInput = {
      ...defaultInput,
      studentQuestion: 'Explicați recursivitate din nou vă rog.',
      conversationHistory: historyRepetata,
    };

    const output = await agent.run(inputRepetitiv);

    expect(output.needsReview).toBe(true);
    expect(output.reviewConcept).toBe('recursivitate');
  });

  it('run() setează needsReview = false pentru conversație normală', async () => {
    const output = await agent.run(defaultInput);
    expect(output.needsReview).toBe(false);
    expect(output.reviewConcept).toBeUndefined();
  });
});

// ─────────────────────────────────────────────
// 5. Eroarea Gemini e propagată corect
// ─────────────────────────────────────────────

describe('TutorAgent.run() — propagare erori Gemini', () => {
  it('propagă eroarea când Gemini aruncă o excepție de rețea', async () => {
    mockSendMessage.mockRejectedValue(new Error('Network error: connection refused'));

    await expect(agent.run(defaultInput)).rejects.toThrow(
      'Network error: connection refused'
    );
  });

  it('propagă eroarea când Gemini returnează SAFETY block', async () => {
    mockSendMessage.mockRejectedValue(
      new Error('[GoogleGenerativeAI Error]: SAFETY block triggered')
    );

    await expect(agent.run(defaultInput)).rejects.toThrow('SAFETY block triggered');
  });

  it('propagă eroarea când API key este invalid (403)', async () => {
    mockSendMessage.mockRejectedValue(
      new Error('[GoogleGenerativeAI Error]: API key not valid. 403')
    );

    await expect(agent.run(defaultInput)).rejects.toThrow('API key not valid');
  });

  it('nu înghite eroarea — nu returnează fallback silențios', async () => {
    mockSendMessage.mockRejectedValue(new Error('Timeout'));

    // run() trebuie să arunce, nu să returneze un răspuns gol
    let threw = false;
    try {
      await agent.run(defaultInput);
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });
});

// ─────────────────────────────────────────────
// 6. Istoricul conversației e trimis corect
// ─────────────────────────────────────────────

describe('TutorAgent.run() — istoricul conversației', () => {
  it('trimite istoricul formatat corect în Content[] la startChat', async () => {
    await agent.run(defaultInput);

    const startChatCall = (mockStartChat.mock.calls as any)[0][0];
    expect(startChatCall.history).toEqual([
      { role: 'user', parts: [{ text: 'Ce este OOP?' }] },
      { role: 'model', parts: [{ text: 'OOP înseamnă programare orientată pe obiect...' }] },
    ]);
  });

  it('pornește cu history gol dacă nu există conversationHistory', async () => {
    const inputFaraIstoricik: TutorAgentInput = {
      ...defaultInput,
      conversationHistory: undefined,
    };

    await agent.run(inputFaraIstoricik);

    const startChatCall = (mockStartChat.mock.calls as any)[0][0];
    expect(startChatCall.history).toEqual([]);
  });
});
