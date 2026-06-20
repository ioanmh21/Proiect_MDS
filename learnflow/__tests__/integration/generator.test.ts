import { GeneratorAgent, GeneratedMaterials } from '../../lib/agents/generator-agent';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Mock the Gemini SDK
jest.mock('@google/generative-ai');

const MOCK_REALISTIC_RESPONSE: GeneratedMaterials = {
  summary: [
    "Capitol 1: Introducere în React. Cum funcționează virtual DOM.",
    "Capitol 2: Hook-uri fundamentale: useState și useEffect.",
    "Capitol 3: Gestionarea stării globale folosind Context API."
  ],
  flashcards: Array(15).fill({ front: "Ce este Virtual DOM?", back: "O reprezentare in-memory a UI-ului." }),
  quiz: [
    { question: "Q1", options: ["A", "B", "C", "D"], correctAnswer: "A", difficulty: "usor" },
    { question: "Q2", options: ["A", "B", "C", "D"], correctAnswer: "B", difficulty: "mediu" },
    { question: "Q3", options: ["A", "B", "C", "D"], correctAnswer: "C", difficulty: "greu" },
    { question: "Q4", options: ["A", "B", "C", "D"], correctAnswer: "A", difficulty: "usor" },
    { question: "Q5", options: ["A", "B", "C", "D"], correctAnswer: "B", difficulty: "mediu" },
    { question: "Q6", options: ["A", "B", "C", "D"], correctAnswer: "C", difficulty: "greu" },
    { question: "Q7", options: ["A", "B", "C", "D"], correctAnswer: "A", difficulty: "usor" },
    { question: "Q8", options: ["A", "B", "C", "D"], correctAnswer: "B", difficulty: "mediu" },
    { question: "Q9", options: ["A", "B", "C", "D"], correctAnswer: "C", difficulty: "greu" },
    { question: "Q10", options: ["A", "B", "C", "D"], correctAnswer: "D", difficulty: "mediu" },
  ],
  keyConcepts: ["Virtual DOM", "Hooks", "State"],
  cleanTranscript: "React este o bibliotecă JS..."
};

describe('Integration Test: GeneratorAgent', () => {
  let agent: GeneratorAgent;
  let mockGenerateContent: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockGenerateContent = jest.fn().mockResolvedValue({
      response: {
        text: () => JSON.stringify(MOCK_REALISTIC_RESPONSE)
      }
    });

    (GoogleGenerativeAI as jest.Mock).mockImplementation(() => ({
      getGenerativeModel: jest.fn().mockReturnValue({
        generateContent: mockGenerateContent
      })
    }));

    agent = new GeneratorAgent('fake-api-key');
  });

  it('Pipeline complet - generează toate tipurile de materiale conform cerințelor', async () => {
    // 500 word mock transcript (shortened for brevity in code)
    const mockTranscript = "React este o bibliotecă JS... ".repeat(100);

    const result = await agent.generateAllMaterials(mockTranscript);

    // 1) generateAllMaterials() returnează toate 5 tipurile
    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('flashcards');
    expect(result).toHaveProperty('quiz');
    expect(result).toHaveProperty('keyConcepts');
    expect(result).toHaveProperty('cleanTranscript');

    // 2) Rezumatul are cel puțin 3 capitole
    expect(result.summary.length).toBeGreaterThanOrEqual(3);

    // 3) Sunt generate exact 15 flashcards
    expect(result.flashcards.length).toBe(15);

    // 4) Quiz-ul are 10 întrebări cu distribuție de dificultate
    expect(result.quiz.length).toBe(10);
    const difficulties = result.quiz.map(q => q.difficulty);
    expect(difficulties).toContain('usor');
    expect(difficulties).toContain('mediu');
    expect(difficulties).toContain('greu');

    // 5) JSON-ul e valid (a fost parsat corect și nu a aruncat eroare)
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });
});
