/**
 * lib/agents/tutor-agent.ts
 * =========================
 * Agent Tutor (TypeScript / Next.js side)
 *
 * Responsabilități:
 *  1. Construiește system prompt-ul cu profilul studentului și contextul RAG.
 *  2. Trimite conversația la Gemini (Google Generative AI).
 *  3. Detectează dacă un concept apare de 3+ ori în istoric → needsReview = true.
 *  4. Propagă erorile Gemini spre caller.
 */

import {
  GoogleGenerativeAI,
  GenerativeModel,
  Content,
} from '@google/generative-ai';

// ─────────────────────────────────────────────
// Tipuri publice
// ─────────────────────────────────────────────

export interface StudentProfile {
  name: string;
  level: 'incepator' | 'intermediar' | 'avansat';
  weakPoints: string[];
  className: string;
}

export interface ConversationMessage {
  role: 'user' | 'model';
  content: string;
}

export interface TutorAgentInput {
  studentQuestion: string;
  studentProfile: StudentProfile;
  ragContext?: string;
  conversationHistory?: ConversationMessage[];
}

export interface TutorAgentOutput {
  response: string;
  needsReview: boolean;
  reviewConcept?: string;
}

// ─────────────────────────────────────────────
// Helper: detectează concepte repetate în istoric
// ─────────────────────────────────────────────

/**
 * Numără câte ori apare fiecare cuvânt semnificativ (>5 litere) în mesajele
 * studentului din conversație. Dacă un cuvânt apare de ≥3 ori → needsReview.
 */
export function detectReviewConcept(
  history: ConversationMessage[]
): { needsReview: boolean; concept?: string } {
  const userMessages = history
    .filter((m) => m.role === 'user')
    .map((m) => m.content.toLowerCase());

  const wordCount: Record<string, number> = {};

  for (const msg of userMessages) {
    // tokenizare simplă: cuvinte alfanumerice cu cel puțin 5 caractere
    const words = msg.match(/\b[a-zăîșțâéè]{5,}\b/g) ?? [];
    for (const word of words) {
      wordCount[word] = (wordCount[word] ?? 0) + 1;
    }
  }

  for (const [concept, count] of Object.entries(wordCount)) {
    if (count >= 3) {
      return { needsReview: true, concept };
    }
  }

  return { needsReview: false };
}

// ─────────────────────────────────────────────
// Helper: construiește system prompt-ul
// ─────────────────────────────────────────────

export function buildSystemPrompt(
  profile: StudentProfile,
  ragContext?: string
): string {
  const weakPointsList =
    profile.weakPoints.length > 0
      ? profile.weakPoints.join(', ')
      : 'necunoscute';

  const ragSection = ragContext
    ? `\n## Context din materialul de curs:\n${ragContext}`
    : '';

  return `Ești un tutore AI educațional inteligent și empatic pentru platforma LearnFlow.

## Profilul studentului:
- Nume: ${profile.name}
- Clasa: ${profile.className}
- Nivel estimat: ${profile.level}
- Puncte slabe identificate: ${weakPointsList}

## Rolul tău:
- Răspunzi ÎNTOTDEAUNA bazat pe contextul materialului furnizat.
- Adaptezi stilul explicațiilor la nivelul studentului (${profile.level}).
- Folosești LaTeX pentru formule matematice ($formula$).
- La finalul fiecărui răspuns pui o întrebare de verificare a înțelegerii.${ragSection}`;
}

// ─────────────────────────────────────────────
// Clasa principală TutorAgent
// ─────────────────────────────────────────────

export class TutorAgent {
  private model: GenerativeModel;

  constructor(apiKey?: string) {
    const key = apiKey ?? process.env.GEMINI_API_KEY ?? '';
    const genAI = new GoogleGenerativeAI(key);
    this.model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }

  async run(input: TutorAgentInput): Promise<TutorAgentOutput> {
    const {
      studentQuestion,
      studentProfile,
      ragContext,
      conversationHistory = [],
    } = input;

    // 1. Detectează dacă un concept necesită revizuire
    const { needsReview, concept: reviewConcept } = detectReviewConcept([
      ...conversationHistory,
      { role: 'user', content: studentQuestion },
    ]);

    // 2. Construiește system prompt-ul
    const systemPrompt = buildSystemPrompt(studentProfile, ragContext);

    // 3. Construiește istoricul pentru Gemini
    const history: Content[] = conversationHistory.map((msg) => ({
      role: msg.role,
      parts: [{ text: msg.content }],
    }));

    // 4. Pornește sesiunea de chat cu system instruction + istoric
    const chat = this.model.startChat({
      systemInstruction: systemPrompt,
      history,
    });

    // 5. Trimite întrebarea curentă (aruncă eroarea dacă Gemini eșuează)
    const result = await chat.sendMessage(studentQuestion);
    const response = result.response.text();

    return {
      response,
      needsReview,
      reviewConcept,
    };
  }
}
