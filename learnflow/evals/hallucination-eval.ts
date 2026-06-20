import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// ─────────────────────────────────────────────
// 1. Configurare Dataset (Transcript sursă)
// ─────────────────────────────────────────────

const TRANSCRIPT = `Sistemul solar este format din Soare și obiectele cerești care orbitează în jurul acestuia. 
Acestea includ opt planete, sateliții lor naturali, planete pitice și miliarde de corpuri mici (asteroizi, comete, meteoroizi). 
Cele patru planete interioare, Mercur, Venus, Pământ și Marte, sunt planete terestre, fiind compuse în principal din rocă și metal. 
Cele patru planete exterioare sunt giganți gazoși. Jupiter și Saturn sunt compuse în principal din hidrogen și heliu, 
în timp ce Uranus și Neptun sunt numiți giganți de gheață. Soarele conține 99.86% din masa întregului sistem solar.`;

// Structura pe care o așteptăm de la Generatorul de Materiale
interface GeneratedMaterial {
  flashcards: Array<{ front: string; back: string }>;
  quiz: Array<{ question: string; answer: string }>;
}

// ─────────────────────────────────────────────
// 2. Funcții de interacțiune cu Gemini (Agent & Judecător)
// ─────────────────────────────────────────────

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "mock-key");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

/**
 * Simulează Agentul Generator.
 * Generează flashcards și un quiz din transcriptul dat.
 */
async function generateMaterials(transcript: string, isMock: boolean): Promise<GeneratedMaterial> {
  if (isMock) {
    // În mock mode, includem intenționat o halucinație pentru a demonstra capabilitatea evaluatorului
    await new Promise(r => setTimeout(r, 300));
    return {
      flashcards: [
        { front: "Câte planete terestre există în sistemul solar?", back: "Patru: Mercur, Venus, Pământ și Marte." },
        { front: "Ce procent din masa sistemului solar este conținută de Soare?", back: "99.86%" },
        { front: "Cine a descoperit planeta Uranus?", back: "William Herschel în 1781." } // <-- HALUCINAȚIE (nu e în text)
      ],
      quiz: [
        { question: "Din ce sunt compuse planetele terestre?", answer: "Din rocă și metal." },
        { question: "Care este temperatura medie pe Jupiter?", answer: "-110 grade Celsius." }, // <-- HALUCINAȚIE
        { question: "Care sunt cele două planete considerate giganți de gheață?", answer: "Uranus și Neptun." }
      ]
    };
  }

  const prompt = `Generează 3 flashcards și 3 întrebări de quiz strict pe baza următorului text. 
Returnează doar un JSON valid cu structura: { "flashcards": [{ "front": "", "back": "" }], "quiz": [{ "question": "", "answer": "" }] }.

Text:
${transcript}`;

  const result = await model.generateContent(prompt);
  let text = result.response.text().trim();
  if (text.startsWith('```json')) text = text.slice(7);
  else if (text.startsWith('```')) text = text.slice(3);
  if (text.endsWith('```')) text = text.slice(0, -3);

  return JSON.parse(text.trim());
}

/**
 * AI Judge pentru verificarea halucinațiilor.
 * Verifică dacă afirmația/întrebarea este ancorată în transcript.
 */
type VerificationStatus = 'Da' | 'Parțial' | 'Nu';

interface JudgeResult {
  status: VerificationStatus;
  reason: string;
}

async function judgeHallucination(
  content: string, 
  transcript: string, 
  isMock: boolean,
  mockResponse?: JudgeResult
): Promise<JudgeResult> {
  if (isMock) {
    await new Promise(r => setTimeout(r, 100));
    return mockResponse || { status: 'Da', reason: 'Informația este prezentă exact în text.' };
  }

  const prompt = `Ești un evaluator strict de "Fact-Checking" și detectare a halucinațiilor AI.
Sarcina ta este să verifici dacă următorul conținut (flashcard/întrebare) poate fi dedus EXACT din transcriptul sursă.

TRANSCRIPT SURSĂ:
"${transcript}"

CONȚINUT DE VERIFICAT:
"${content}"

Cerințe:
1. Status poate fi doar: "Da" (informația e în text), "Parțial" (o parte e în text, o parte e inventată), sau "Nu" (informația lipsește din text sau e contradictorie).
2. Oferă un motiv scurt (max 1 propoziție).

Returnează DOAR un JSON de forma: { "status": "Da|Parțial|Nu", "reason": "motivul" }`;

  const result = await model.generateContent(prompt);
  let text = result.response.text().trim();
  if (text.startsWith('```json')) text = text.slice(7);
  else if (text.startsWith('```')) text = text.slice(3);
  if (text.endsWith('```')) text = text.slice(0, -3);

  return JSON.parse(text.trim());
}

// ─────────────────────────────────────────────
// 3. Rularea Evaluării Halucinațiilor
// ─────────────────────────────────────────────

async function runHallucinationEvals() {
  console.log("🚀 Începem evaluarea de HALUCINAȚII (Material Generator Agent)...\n");

  const isMockMode = !process.env.GEMINI_API_KEY;
  if (isMockMode) {
    console.warn("⚠️ GEMINI_API_KEY lipsește. Rulăm în MOCK MODE cu halucinații injectate intenționat...\n");
  }

  console.log("📝 1. Generăm materialele din transcript...");
  const materials = await generateMaterials(TRANSCRIPT, isMockMode);

  // Unificăm tot conținutul pentru iterare ușoară
  const itemsToEvaluate = [
    ...materials.flashcards.map(f => `Flashcard - F: ${f.front} | B: ${f.back}`),
    ...materials.quiz.map(q => `Quiz - Q: ${q.question} | A: ${q.answer}`)
  ];

  console.log(`🔍 2. Verificăm ${itemsToEvaluate.length} elemente cu AI Judge...`);
  
  const results = [];
  let unverifiedCount = 0;

  for (let i = 0; i < itemsToEvaluate.length; i++) {
    const item = itemsToEvaluate[i];
    
    // În mock mode, ghicim corectitudinea pe baza textului "William Herschel" sau "110 grade"
    let mockResponse: JudgeResult = { status: 'Da', reason: 'Prezent în textul sursă.' };
    if (item.includes("William Herschel") || item.includes("110 grade")) {
      mockResponse = { status: 'Nu', reason: 'Informația nu apare nicăieri în transcriptul furnizat.' };
    }

    const judgment = await judgeHallucination(item, TRANSCRIPT, isMockMode, mockResponse);
    
    // Halucinație = Parțial sau Nu
    if (judgment.status !== 'Da') {
      unverifiedCount++;
    }

    results.push({ item, status: judgment.status, reason: judgment.reason });
  }

  // ─────────────────────────────────────────────
  // 4. Calculare Rata și Raport
  // ─────────────────────────────────────────────
  const hallucinationRate = (unverifiedCount / itemsToEvaluate.length) * 100;

  console.log("\n=======================================================");
  console.log("📊 RAPORT HALUCINAȚII (HALLUCINATION EVALS)");
  console.log("=======================================================\n");

  console.log(`Total itemi generați: ${itemsToEvaluate.length}`);
  console.log(`Itemi neverificabili/halucinați: ${unverifiedCount}`);
  console.log(`📉 Rata de Halucinații: ${hallucinationRate.toFixed(2)}%\n`);

  console.log("✅ EXEMPLE VERIFICATE (FĂRĂ HALUCINAȚII):");
  results.filter(r => r.status === 'Da').slice(0, 2).forEach(r => {
    console.log(` - ${r.item}`);
    console.log(`   [Judecată]: ${r.status} (${r.reason})`);
  });

  const hallucinations = results.filter(r => r.status !== 'Da');
  if (hallucinations.length > 0) {
    console.log("\n🚨 EXEMPLE DE HALUCINAȚII DETECTATE:");
    hallucinations.forEach(r => {
      console.log(` - [CONȚINUT GENERAT]: ${r.item}`);
      console.log(`   [VERDICT AI JUDGE]: ${r.status} => ${r.reason}`);
    });
  } else {
    console.log("\n🎉 Nicio halucinație detectată în acest run!");
  }

  console.log("\n=======================================================\n");
}

runHallucinationEvals().catch(console.error);
