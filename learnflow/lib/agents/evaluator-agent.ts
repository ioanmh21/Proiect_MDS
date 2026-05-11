import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

export interface TestConfig {
  nrQuestions: number;
  types: string[];
  difficulty: string;
  weakConcepts: string[];
}

export interface Question {
  id: string;
  text: string;
  type: string;
  options?: string[];
  correct_answer: string | string[];
  explanation: string;
  difficulty: string;
  concept: string;
}

export interface GeneratedTest {
  questions: Question[];
}

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

/**
 * Generates a test using Gemini Flash based on the material ID and config.
 * Includes JSON validation and a retry mechanism (max 2 retries) if the response is invalid.
 * The generated test is then saved to Supabase.
 */
export async function generateTest(materialId: string, config: TestConfig): Promise<GeneratedTest | null> {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  let prompt = `
Vei acționa ca un evaluator educațional expert. Generează un test pe baza materialului educațional cu ID: ${materialId}.

Cerințe specifice:
- Numărul de întrebări: ${config.nrQuestions}
- Tipurile de întrebări permise: ${config.types.join(", ")}
- Dificultatea testului: ${config.difficulty}
- Focalizează-te în mod special pe următoarele concepte slabe: ${config.weakConcepts.join(", ")}
- Limba: Testul și toate explicațiile trebuie să fie EXCLUSIV în limba română.

Trebuie să returnezi rezultatul sub forma unui obiect JSON cu structura de mai jos. 
Structura JSON necesară:
{
  "questions": [
    {
      "id": "un identificator unic pentru întrebare",
      "text": "textul întrebării",
      "type": "tipul întrebării (ex: grilă, adevărat/fals)",
      "options": ["opțiunea 1", "opțiunea 2", "opțiunea 3"], // obligatoriu pentru întrebări cu răspunsuri multiple, altfel omite sau lasă gol
      "correct_answer": "răspunsul corect sau un array de răspunsuri corecte",
      "explanation": "explicația detaliată a răspunsului corect",
      "difficulty": "nivelul de dificultate al întrebării",
      "concept": "conceptul cheie testat de această întrebare"
    }
  ]
}

Returnează DOAR JSON valid, fără text în afara JSON-ului.
  `.trim();

  let retries = 0;
  const maxRetries = 2;

  while (retries <= maxRetries) {
    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      
      // Attempt to extract JSON from the text, handling possible markdown formatting
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON object found in the response.");
      }
      
      const parsedJson: GeneratedTest = JSON.parse(jsonMatch[0]);

      // Basic validation
      if (!parsedJson.questions || !Array.isArray(parsedJson.questions)) {
        throw new Error("Invalid JSON structure: 'questions' array is missing.");
      }

      // Save to Supabase
      const { data, error } = await supabase
        .from('tests')
        .insert([{
            material_id: materialId,
            config: config,
            content: parsedJson,
            created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) {
         console.error("Error saving test to Supabase:", error);
         // Depending on requirements, we might still return the test even if save fails
      } else {
         console.log("Test successfully saved to Supabase:", data);
      }

      return parsedJson;

    } catch (error) {
      console.error(`Attempt ${retries + 1} failed:`, error);
      retries++;
      
      if (retries <= maxRetries) {
        console.log("Retrying with a stricter prompt...");
        prompt = `
Cererea anterioară a eșuat deoarece răspunsul tău nu a fost un JSON valid.
Te rog să generezi testul respectând strict următoarele condiții:
- Numărul de întrebări: ${config.nrQuestions}
- Tipurile de întrebări: ${config.types.join(", ")}
- Dificultatea testului: ${config.difficulty}
- Focalizare pe conceptele slabe: ${config.weakConcepts.join(", ")}
- Limba: română

Structura JSON obligatorie:
{
  "questions": [
    {
      "id": "string",
      "text": "string",
      "type": "string",
      "options": ["string"],
      "correct_answer": "string",
      "explanation": "string",
      "difficulty": "string",
      "concept": "string"
    }
  ]
}

Returnează DOAR JSON valid, fără text în afara JSON-ului.
`.trim();
      } else {
        console.error("Max retries reached. Failed to generate test.");
        return null;
      }
    }
  }
  
  return null;
}

export interface Answer {
  questionId: string;
  answer: string | string[];
}

export interface Feedback {
  questionId: string;
  isCorrect: boolean;
  correctAnswer: string | string[];
  userAnswer: string | string[];
  explanation?: string;
}

export interface GradeResult {
  score: number;
  feedback: Feedback[];
  weakConcepts: string[];
}

/**
 * Grades a test based on user answers, using Gemini to generate custom feedback for wrong answers.
 * Saves the results to Supabase test_results table.
 */
export async function gradeTest(testId: string, userAnswers: Answer[]): Promise<GradeResult | null> {
  // 1. Preia testul din Supabase
  const { data: testRecord, error } = await supabase
    .from('tests')
    .select('content')
    .eq('id', testId)
    .single();

  if (error || !testRecord || !testRecord.content) {
    console.error("Eroare la preluarea testului din Supabase:", error);
    return null;
  }

  const testContent = testRecord.content as GeneratedTest;
  const questions = testContent.questions;
  
  if (!questions || !Array.isArray(questions)) {
    console.error("Testul nu conține întrebări valide.");
    return null;
  }

  let correctCount = 0;
  const feedbackList: Feedback[] = [];
  const weakConceptsSet = new Set<string>();
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  // 2. Compară răspunsurile și generează feedback
  for (const q of questions) {
    const userAnswerObj = userAnswers.find(ua => ua.questionId === q.id);
    const userAnswer = userAnswerObj ? userAnswerObj.answer : "";
    
    let isCorrect = false;
    
    // Comparare răspunsuri (tratează arrays și strings)
    if (Array.isArray(q.correct_answer) && Array.isArray(userAnswer)) {
      const sortedCorrect = [...q.correct_answer].map(a => String(a).toLowerCase().trim()).sort();
      const sortedUser = [...userAnswer].map(a => String(a).toLowerCase().trim()).sort();
      isCorrect = JSON.stringify(sortedCorrect) === JSON.stringify(sortedUser);
    } else {
      isCorrect = String(q.correct_answer).toLowerCase().trim() === String(userAnswer).toLowerCase().trim();
    }

    const feedbackItem: Feedback = {
      questionId: q.id,
      isCorrect,
      correctAnswer: q.correct_answer,
      userAnswer: userAnswer,
    };

    if (isCorrect) {
      correctCount++;
      feedbackItem.explanation = q.explanation;
    } else {
      if (q.concept) {
        weakConceptsSet.add(q.concept);
      }
      
      // 3. Sub-apel Gemini pentru feedback
      const userAnswerStr = Array.isArray(userAnswer) ? userAnswer.join(", ") : String(userAnswer);
      feedbackItem.explanation = await generateFeedback(q, userAnswerStr);
    }
    
    feedbackList.push(feedbackItem);
  }

  // 4. Calculează scorul procentual
  const score = Math.round((correctCount / questions.length) * 100);
  const weakConcepts = Array.from(weakConceptsSet);

  const gradeResult: GradeResult = {
    score,
    feedback: feedbackList,
    weakConcepts
  };

  // 5. Salvează rezultatul în test_results
  const { error: insertError } = await supabase
    .from('test_results')
    .insert([{
      test_id: testId,
      score: score,
      results_data: gradeResult,
      created_at: new Date().toISOString()
    }]);

  if (insertError) {
    console.error("Eroare la salvarea rezultatelor în Supabase:", insertError);
  }

  return gradeResult;
}

/**
 * Generates personalized educational feedback for a wrong answer using Gemini Flash.
 * Explains WHY the answer is wrong, WHAT is correct and why, and gives a mnemonic/example.
 */
export async function generateFeedback(question: Question, userAnswer: string): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  
  const correctAnswerStr = Array.isArray(question.correct_answer) 
    ? question.correct_answer.join(", ") 
    : question.correct_answer;

  const prompt = `
Avem următoarea întrebare dintr-un test educațional:
"${question.text}"
Răspunsul corect este: "${correctAnswerStr}"
Elevul a răspuns greșit: "${userAnswer}"

Te rog să generezi un feedback educațional constructiv, în limba română, de MAXIM 3 propoziții.
Feedback-ul trebuie să îndeplinească următoarele condiții:
1. Explică DE CE răspunsul elevului este greșit.
2. Explică CE este corect și de ce.
3. Oferă un sfat mnemonic (un truc de memorare) sau un exemplu concret pentru a reține ușor informația corectă.

Fii prietenos și încurajator!
  `.trim();

  try {
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (error) {
    console.error("Eroare la generarea feedback-ului cu Gemini:", error);
    return \`Răspunsul tău este incorect. Răspunsul corect era: \${correctAnswerStr}.\`;
  }
}
