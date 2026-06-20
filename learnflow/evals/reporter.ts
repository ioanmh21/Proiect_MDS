import * as fs from 'fs';
import * as path from 'path';

export interface Issue {
  itemOrQuestion: string;
  actualResponse: string;
  expectedOrVerdict: string;
  judgeReason: string;
}

export interface EvalResults {
  agentName: string;          // ex: "Tutor Agent", "Material Generator"
  metricName: string;         // ex: "Average Score (1-5)", "Hallucination Rate (%)"
  score: number;              // ex: 4.7 sau 33.3
  maxScore: number;           // ex: 5 sau 100
  totalEvaluated: number;
  distribution?: Record<string, number>; // ex: { "5": 9, "4": 0, "2": 1 }
  issues: Issue[];            // exemple concrete de erori/halucinații
}

/**
 * Generează un raport Markdown și un fișier JSON brut pe baza rezultatelor evaluării.
 * Rapoartele sunt salvate în folderul `evals/results/`.
 */
export function generateEvalReport(results: EvalResults[]) {
  const resultsDir = path.join(__dirname, 'results');
  
  // 1. Asigurăm existența folderului
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const mdFilePath = path.join(resultsDir, `${timestamp}-report.md`);
  const jsonFilePath = path.join(resultsDir, `${timestamp}-raw.json`);

  // 2. Căutăm evaluarea anterioară pentru a face comparația
  const files = fs.readdirSync(resultsDir).filter(f => f.endsWith('-raw.json')).sort();
  let previousData: EvalResults[] | null = null;
  
  if (files.length > 0) {
    const lastFile = path.join(resultsDir, files[files.length - 1]);
    try {
      previousData = JSON.parse(fs.readFileSync(lastFile, 'utf-8'));
    } catch (e) {
      console.warn("Nu s-a putut parsa fișierul anterior pentru comparație.");
    }
  }

  // 3. Generăm textul Markdown
  let mdContent = `# Raport Evaluare Agenți AI\n`;
  mdContent += `**Data rulării**: ${new Date().toLocaleString('ro-RO')}\n\n`;

  for (const res of results) {
    mdContent += `## 🤖 Agent: ${res.agentName}\n\n`;
    
    // Comparație cu evaluarea trecută
    let trend = '';
    if (previousData) {
      const prevAgent = previousData.find(p => p.agentName === res.agentName && p.metricName === res.metricName);
      if (prevAgent) {
        const diff = res.score - prevAgent.score;
        const sign = diff > 0 ? '+' : '';
        trend = ` (Față de ultima rulare: ${sign}${diff.toFixed(2)})`;
      } else {
        trend = ` (Prima evaluare pentru această metrică)`;
      }
    }

    // Sumar Scor
    mdContent += `### 📊 Sumar Metrici\n`;
    mdContent += `- **${res.metricName}**: \`${res.score.toFixed(2)} / ${res.maxScore}\`${trend}\n`;
    mdContent += `- **Itemi evaluați**: ${res.totalEvaluated}\n\n`;

    // Distribuție
    if (res.distribution && Object.keys(res.distribution).length > 0) {
      mdContent += `### 📈 Distribuție Scoruri\n`;
      for (const [key, val] of Object.entries(res.distribution).sort((a, b) => Number(b[0]) - Number(a[0]))) {
        mdContent += `- Scor **${key}**: ${val} itemi\n`;
      }
      mdContent += `\n`;
    }

    // Probleme cu exemple
    if (res.issues.length > 0) {
      mdContent += `### 🚨 Probleme Identificate (Exemple)\n`;
      // Luăm primele 3 exemple pentru a nu aglomera raportul
      res.issues.slice(0, 3).forEach((issue, idx) => {
        mdContent += `**Exemplul ${idx + 1}**\n`;
        mdContent += `- **Context/Întrebare**: ${issue.itemOrQuestion}\n`;
        mdContent += `- **Răspuns Generat**: ${issue.actualResponse}\n`;
        mdContent += `- **Referință/Verdict**: ${issue.expectedOrVerdict}\n`;
        mdContent += `- **Justificare AI Judge**: _${issue.judgeReason}_\n\n`;
      });
    } else {
      mdContent += `### ✅ Nu au fost identificate probleme majore.\n\n`;
    }

    // Recomandări pentru îmbunătățirea prompturilor (heuristici)
    mdContent += `### 💡 Recomandări de Îmbunătățire a Prompturilor\n`;
    if (res.metricName.includes("Hallucination") && res.score > 10) {
      mdContent += `> **Alertă Halucinații**: Rata de halucinații este peste pragul critic. Adăugați în system prompt o instrucțiune strictă: *"Dacă răspunsul nu se găsește în context, spune 'Nu am informații'. Sub nicio formă nu inventa date externe."*\n\n`;
    } else if (res.metricName.includes("Score") && res.score < (res.maxScore * 0.8)) {
      mdContent += `> **Calitate Slabă**: Răspunsurile agentului sunt sub nota 8. Recomandăm includerea unor exemple *Few-Shot* în promptul agentului pentru a ghida stilul și lungimea răspunsului dorit.\n\n`;
    } else {
      mdContent += `> Performanță optimă atinsă. Nu sunt necesare modificări majore la nivel de prompt.\n\n`;
    }
    
    mdContent += `---\n\n`;
  }

  // 4. Salvăm fișierele pe disc
  fs.writeFileSync(mdFilePath, mdContent, 'utf-8');
  fs.writeFileSync(jsonFilePath, JSON.stringify(results, null, 2), 'utf-8');

  console.log(`\n📄 Raport generat cu succes!`);
  console.log(`   Markdown: ${mdFilePath}`);
  console.log(`   JSON brut: ${jsonFilePath}\n`);
}

// ==========================================
// TEST RAPID AL FUNCȚIEI PENTRU DEMONSTRAȚIE
// ==========================================

if (require.main === module) {
  const dummyData: EvalResults[] = [
    {
      agentName: "Tutor Agent",
      metricName: "Calitatea Explicațiilor (Score 1-5)",
      score: 4.7,
      maxScore: 5,
      totalEvaluated: 10,
      distribution: { "5": 8, "4": 1, "2": 1 },
      issues: [
        {
          itemOrQuestion: "Ce este încapsularea?",
          actualResponse: "E un fel de funcție privată.",
          expectedOrVerdict: "Ascunderea detaliilor de implementare.",
          judgeReason: "Răspunsul este ezitant și vag."
        }
      ]
    },
    {
      agentName: "Material Generator Agent",
      metricName: "Rata de Halucinații (%)",
      score: 33.33,
      maxScore: 100,
      totalEvaluated: 6,
      issues: [
        {
          itemOrQuestion: "Cine a descoperit planeta Uranus?",
          actualResponse: "William Herschel în 1781.",
          expectedOrVerdict: "N/A",
          judgeReason: "Informația nu apare nicăieri în transcriptul furnizat."
        }
      ]
    }
  ];

  generateEvalReport(dummyData);
  
  // Rulăm a doua oară cu scoruri ușor diferite pentru a arăta comparația (Trend-ul)
  setTimeout(() => {
    dummyData[0].score = 4.9; // O îmbunătățire la Tutor
    dummyData[1].score = 16.66; // O reducere a halucinațiilor
    generateEvalReport(dummyData);
  }, 1000);
}
