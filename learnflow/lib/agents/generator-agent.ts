import { GoogleGenerativeAI } from '@google/generative-ai';

export interface Flashcard {
  front: string;
  back: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  difficulty: 'usor' | 'mediu' | 'greu';
}

export interface GeneratedMaterials {
  summary: string[]; // Capitole
  flashcards: Flashcard[];
  quiz: QuizQuestion[];
  keyConcepts: string[];
  cleanTranscript: string;
}

export class GeneratorAgent {
  private genAI: GoogleGenerativeAI;
  private modelName = 'gemini-1.5-flash';

  constructor(apiKey?: string) {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY is missing');
    }
    this.genAI = new GoogleGenerativeAI(key);
  }

  async generateAllMaterials(transcript: string): Promise<GeneratedMaterials> {
    const model = this.genAI.getGenerativeModel({ model: this.modelName });

    const prompt = `Ești un asistent educațional expert. Analizează următorul transcript și generează materiale educaționale structurate conform cerințelor de mai jos.

TRANSCRIPT:
"""
${transcript}
"""

CERINȚE OBLIGATORII:
1. "summary": Un rezumat structurat în cel puțin 3 capitole.
2. "flashcards": Exact 15 flashcards relevante.
3. "quiz": Exact 10 întrebări grilă cu distribuție de dificultate ('usor', 'mediu', 'greu').
4. "keyConcepts": Conceptele cheie extrase.
5. "cleanTranscript": O versiune curățată și corectată gramatical a transcriptului.

Trebuie să returnezi EXCLUSIV un obiect JSON valid, fără formatare Markdown (\`\`\`json), cu următoarea schemă:
{
  "summary": ["Capitol 1: ...", "Capitol 2: ...", "Capitol 3: ..."],
  "flashcards": [{ "front": "...", "back": "..." }, ... 15 items],
  "quiz": [{ "question": "...", "options": ["A", "B", "C", "D"], "correctAnswer": "A", "difficulty": "usor|mediu|greu" }, ... 10 items],
  "keyConcepts": ["concept1", "concept2"],
  "cleanTranscript": "..."
}
`;

    let retries = 3;
    while (retries > 0) {
      try {
        const result = await model.generateContent(prompt);
        let text = result.response.text().trim();
        
        if (text.startsWith('```json')) text = text.slice(7);
        else if (text.startsWith('```')) text = text.slice(3);
        if (text.endsWith('```')) text = text.slice(0, -3);

        const parsed = JSON.parse(text) as GeneratedMaterials;

        // Basic validation
        if (!parsed.summary || !parsed.flashcards || !parsed.quiz || !parsed.keyConcepts || !parsed.cleanTranscript) {
           throw new Error("Missing required fields in GeneratedMaterials");
        }

        return parsed;
      } catch (err) {
        retries--;
        if (retries === 0) {
          throw new Error(`Failed to generate materials after 3 attempts: ${err}`);
        }
      }
    }
    throw new Error('Unexpected Error in generateAllMaterials');
  }
}
