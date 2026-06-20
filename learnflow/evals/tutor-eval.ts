import { TutorAgent, StudentProfile, TutorAgentInput } from '../lib/agents/tutor-agent';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Încărcăm variabilele de mediu din folderul root
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// ─────────────────────────────────────────────
// 1. Definire Dataset și Context Real
// ─────────────────────────────────────────────

const RAG_CONTEXT = `Programarea Orientată pe Obiecte (OOP) în C++ se bazează pe patru piloni principali: încapsulare, moștenire, polimorfism și abstractizare. 
Încapsularea ascunde detaliile de implementare, expunând doar interfața necesară. 
Moștenirea permite unei clase (derivată) să preia atributele și metodele altei clase (de bază), favorizând reutilizarea codului. 
Polimorfismul permite obiectelor să fie tratate ca instanțe ale clasei de bază, iar la apelarea unor metode virtuale se va executa implementarea specifică obiectului real (polimorfism la rulare).
Abstractizarea se realizează prin clase abstracte, care conțin cel puțin o metodă pur virtuală (declarată cu = 0) și nu pot fi instanțiate direct.`;

const DATASET = [
  {
    question: "Care sunt cei patru piloni principali ai OOP în C++?",
    expectedAnswer: "Încapsulare, moștenire, polimorfism și abstractizare.",
  },
  {
    question: "Explică-mi pe scurt ce înseamnă încapsularea.",
    expectedAnswer: "Ascunde detaliile de implementare și expune doar interfața necesară.",
  },
  {
    question: "Cum ajută moștenirea în dezvoltarea software?",
    expectedAnswer: "Permite preluarea atributelor și metodelor de la o clasă de bază, favorizând reutilizarea codului.",
  },
  {
    question: "Ce face polimorfismul la rulare?",
    expectedAnswer: "Permite ca apelul unei metode virtuale printr-o referință/pointer de bază să execute metoda din clasa derivată reală.",
  },
  {
    question: "Cum se realizează abstractizarea în C++?",
    expectedAnswer: "Prin intermediul claselor abstracte care conțin metode pur virtuale.",
  },
  {
    question: "Pot să instanțiez o clasă abstractă?",
    expectedAnswer: "Nu, clasele abstracte nu pot fi instanțiate direct.",
  },
  {
    question: "Cum declar o metodă pur virtuală în C++?",
    expectedAnswer: "Adăugând sufixul '= 0' la finalul declarației metodei virtuale.",
  },
  {
    question: "Ce este o clasă derivată?",
    expectedAnswer: "O clasă care moștenește sau preia atribute și metode de la o altă clasă (clasa de bază).",
  },
  {
    question: "Dacă vreau să ascund cum funcționează intern o metodă, ce pilon OOP folosesc?",
    expectedAnswer: "Încapsularea.",
  },
  {
    question: "Ce fel de metode sunt necesare pentru a crea o clasă abstractă?",
    expectedAnswer: "Cel puțin o metodă pur virtuală.",
  }
];

const mockProfile: StudentProfile = {
  name: "Elev Evaluare",
  className: "A XII-a",
  level: "intermediar",
  weakPoints: []
};

// ─────────────────────────────────────────────
// 2. AI Judge - Evaluator bazat pe Gemini
// ─────────────────────────────────────────────

interface EvaluationResult {
  score: number;
  justification: string;
}

async function evaluateWithJudge(
  question: string,
  expected: string,
  actual: string
): Promise<EvaluationResult> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `Ești un profesor care evaluează un asistent educațional AI.
Evaluează următorul răspuns generat de asistent.

Întrebarea elevului: "${question}"
Răspunsul așteptat (referință): "${expected}"
Răspunsul asistentului AI: "${actual}"

Cerințe:
1. Oferă o notă de la 1 la 5 (1 = greșit/nealiniat cu referința, 5 = perfect, clar, acoperă referința). Reține că asistentul trebuie să pună o întrebare de follow-up la final (aceea este obligatorie, ignor-o la calcularea exactității informației).
2. Justifică scurt nota în maxim 2 propoziții.

Returnează DOAR un JSON valid, de forma:
{
  "score": 5,
  "justification": "textul justificării scurte"
}`;

  const result = await model.generateContent(prompt);
  let text = result.response.text().trim();
  
  if (text.startsWith('```json')) text = text.slice(7);
  else if (text.startsWith('```')) text = text.slice(3);
  if (text.endsWith('```')) text = text.slice(0, -3);

  try {
    return JSON.parse(text.trim());
  } catch (e) {
    console.error("Failed to parse judge JSON:", text);
    return { score: 0, justification: "Eroare la parsarea evaluării." };
  }
}

// ─────────────────────────────────────────────
// 3. Rularea Evaluării
// ─────────────────────────────────────────────

async function runEvals() {
  console.log("🚀 Începem evaluarea TutorAgent (Evals Dataset de 10 întrebări)...\n");

  const isMockMode = !process.env.GEMINI_API_KEY;
  if (isMockMode) {
    console.warn("⚠️ GEMINI_API_KEY lipsește din mediu. Rulăm în MOCK MODE (simulare) pentru demonstrație...\n");
  }

  const agent = new TutorAgent(process.env.GEMINI_API_KEY || "mock-key");
  const results = [];

  for (let i = 0; i < DATASET.length; i++) {
    const item = DATASET[i];
    console.log(`⏳ Rulăm întrebarea ${i + 1}/${DATASET.length}...`);
    
    let agentResponse = "";
    let evalResult = { score: 0, justification: "" };

    if (!isMockMode) {
      // 1. Rulăm agentul real
      const input: TutorAgentInput = {
        studentQuestion: item.question,
        studentProfile: mockProfile,
        ragContext: RAG_CONTEXT,
      };
      
      try {
        const out = await agent.run(input);
        agentResponse = out.response;
      } catch (err) {
        agentResponse = "ERROR: " + (err as Error).message;
      }

      // 2. Rulăm AI Judge real
      evalResult = await evaluateWithJudge(item.question, item.expectedAnswer, agentResponse);
    } else {
      // MOCK MODE
      await new Promise(r => setTimeout(r, 200)); // Simulează delay de rețea
      if (i === 1) {
        // Simulăm un răspuns slab intenționat
        agentResponse = "Încapsularea este ceva cu funcții private, cred. Ai înțeles?";
        evalResult = { score: 2, justification: "Răspuns ezitant, incomplet și nu definește clar ascunderea detaliilor de implementare." };
      } else {
        // Simulăm răspunsuri bune
        agentResponse = `${item.expectedAnswer} Ai alte întrebări despre acest concept?`;
        evalResult = { score: 5, justification: "Răspunsul este perfect aliniat cu referința și include întrebarea de follow-up necesară." };
      }
    }

    results.push({
      question: item.question,
      expected: item.expectedAnswer,
      actual: agentResponse,
      score: evalResult.score,
      justification: evalResult.justification
    });
  }

  // ─────────────────────────────────────────────
  // 4. Calcularea și Afișarea Statisticilor
  // ─────────────────────────────────────────────

  console.log("\n=======================================================");
  console.log("📊 REZULTATE EVALUARE (EVALS)");
  console.log("=======================================================\n");

  const totalScore = results.reduce((acc, r) => acc + r.score, 0);
  const averageScore = totalScore / DATASET.length;

  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  results.forEach(r => {
    if (r.score >= 1 && r.score <= 5) distribution[r.score as keyof typeof distribution]++;
  });

  console.log(`⭐ Scor Mediu: ${averageScore.toFixed(2)} / 5.00`);
  console.log(`📈 Distribuție scoruri:`);
  console.log(`   5/5: ${distribution[5]} răspunsuri`);
  console.log(`   4/5: ${distribution[4]} răspunsuri`);
  console.log(`   3/5: ${distribution[3]} răspunsuri`);
  console.log(`   2/5: ${distribution[2]} răspunsuri`);
  console.log(`   1/5: ${distribution[1]} răspunsuri`);

  // Găsește cel mai bun și cel mai slab exemplu
  const best = results.reduce((prev, curr) => (prev.score > curr.score) ? prev : curr);
  const worst = results.reduce((prev, curr) => (prev.score < curr.score) ? prev : curr);

  console.log("\n✅ CEL MAI BUN EXEMPLU (Scor: " + best.score + "):");
  console.log("Q: " + best.question);
  console.log("Expected: " + best.expected);
  console.log("Actual: " + best.actual.substring(0, 150).replace(/\n/g, ' ') + "...");
  console.log("Judecată: " + best.justification);

  console.log("\n⚠️ CEL MAI SLAB EXEMPLU (Scor: " + worst.score + "):");
  console.log("Q: " + worst.question);
  console.log("Expected: " + worst.expected);
  console.log("Actual: " + worst.actual.substring(0, 150).replace(/\n/g, ' ') + "...");
  console.log("Judecată: " + worst.justification);

  console.log("\n=======================================================\n");
}

runEvals().catch(console.error);
