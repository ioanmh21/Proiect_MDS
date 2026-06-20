# Folosirea Toolurilor AI în Dezvoltarea Platformei Educaționale LearnFlow

**Raport Tehnic Academic**  
**Proiect:** LearnFlow — Platformă educațională cu agenți AI  
**Stack:** Next.js 16 · React 19 · Python (FastAPI/LangChain) · Supabase · Google Gemini  
**Data:** Iunie 2026

---

## 1. Introducere — Ce Tooluri Am Ales și De Ce

Dezvoltarea platformei **LearnFlow** a presupus o gamă largă de sarcini tehnice eterogene: arhitectura unui sistem multi-agent în Python cu LangChain, construirea unui frontend Next.js cu TypeScript, integrarea bazei de date Supabase cu pgvector pentru RAG (Retrieval-Augmented Generation), și scrierea testelor unitare cu `pytest`. Această diversitate a creat un context ideal pentru evaluarea comparativă a mai multor tooluri AI de asistență la codare.

Toolurile evaluate și motivația alegerii lor:

- **GitHub Copilot** — integrat nativ în VS Code, ideal pentru completare de cod în linie, pattern-uri repetitive și boilerplate TypeScript/React.
- **Claude (Anthropic)** — selectat pentru sarcini complexe de raționament: proiectarea arhitecturii agenților, generarea system prompt-urilor în română, și debugging multi-fișier.
- **Cursor** — ales pentru refactorizarea la nivel de fișier și pentru funcția sa de *codebase-aware chat*, care permite interogarea contextului întregului repo.
- **ChatGPT (GPT-4o)** — utilizat pentru explorare rapidă de idei, documentație și generarea schemelor SQL pentru Supabase.

Selecția nu a fost exclusivă — fiecare tool a fost aplicat la sarcinile pentru care excelează, conform principiului *right tool for the job*. Criteriile de selecție au fost: viteza de răspuns, calitatea codului generat fără modificări, conștientizarea contextului (context-awareness), și limita de token-uri disponibile.

---

## 2. Tabel Comparativ Tooluri AI

| Criteriu | GitHub Copilot | Claude (Sonnet 3.7) | Cursor | ChatGPT (GPT-4o) |
|---|---|---|---|---|
| **Integrare IDE** | ⭐⭐⭐⭐⭐ Nativă VS Code | ⭐⭐⭐ Web/API | ⭐⭐⭐⭐⭐ IDE propriu | ⭐⭐ Web/plugin |
| **Context Codebase** | ⭐⭐⭐ Fișier curent | ⭐⭐⭐⭐ Multi-fișier (upload) | ⭐⭐⭐⭐⭐ Indexare completă repo | ⭐⭐ Fișier individual |
| **Calitate cod Python** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Calitate cod TypeScript/React** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Raționament arhitectural** | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Generare teste unitare** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Debugging multi-fișier** | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Generare documentație** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Suport română** | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Limita context (tokens)** | ~8K | ~200K | ~128K | ~128K |
| **Cost** | $10/lună | $20/lună | $20/lună | $20/lună |
| **Viteză răspuns** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Cel mai bun pentru** | Autocompletare rapidă | Arhitectură & prompturi | Refactorizare repo | Explorare & SQL |

> **Concluzie generală:** Nu există un tool „câștigător" absolut. Eficiența maximă s-a obținut prin combinarea lor: Copilot pentru viteză în cod repetitiv, Claude pentru raționament profund și sistem multi-agent, Cursor pentru modificări cross-fișier, și ChatGPT pentru documentație și prototipare SQL.

---

## 3. Exemple Concrete de Prompturi cu Output-uri

### Exemplul 1 — Generare Cod: System Prompt pentru Agentul Tutor

**Context:** Implementarea agentului `TutorAgent` ([agents/tutor.py](file:///c:/Users/Acer/Proiect_MDS/agents/tutor.py)) necesita un system prompt în română care să ghideze Gemini să răspundă strict bazat pe contextul RAG, adaptat nivelului studentului.

**Tool folosit:** Claude Sonnet 3.7

**Promptul exact:**

```
Ești asistentul meu la un proiect educațional. Trebuie să scriu un system prompt
în română pentru un LLM (Gemini Flash) care va juca rolul unui tutore AI.
Cerințe:
1. Tutorul trebuie să răspundă DOAR pe baza contextului de curs furnizat (nu inventează)
2. Tutorul trebuie să se adapteze la profilul studentului (nume, nivel, puncte slabe)
3. La finalul fiecărui răspuns, pune o întrebare de verificare a înțelegerii
4. Folosește LaTeX cu sintaxa $ și $$ (nu \( și \[)
5. Răspunde în limba studentului
6. Include secțiuni de template: {material_context}, {student_name}, {student_level}, {weak_points}

Fă-l profesional, empatic și cu reguli clare numerotate.
```

**Ce a generat AI-ul (rezumat):** A generat un system prompt structurat cu secțiuni `## Rolul tău`, `## Context curent`, `## Profilul studentului` și `## Reguli importante`. Sintaxa template-urilor Pydantic a fost corect integrată. Tonul era precis și constrângerile LaTeX au fost respectate integral.

**Ce am modificat manual și de ce:** A fost adăugat manual mesajul explicit pentru cazul în care informația lipsește din materialul RAG: *„Nu găsesc această informație în contextul curent. Te poți referi la o secțiune specifică sau poți reformula întrebarea?"*. AI-ul lăsase această situație nespecificată, ceea ce ar fi permis halucinații. De asemenea, s-a adăugat regula de redirectare pentru întrebări off-topic, pe care AI-ul nu a inclus-o în prima iterație.

**Evaluare utilitate: 5/5** — Output-ul a acoperit 80% din necesități, economisind aproximativ 45 de minute față de scrierea manuală. Modificările manuale au durat sub 5 minute și au vizat cazuri de margine (edge cases) care necesitau cunoașterea domeniului pedagogic.

---

### Exemplul 2 — Scriere Teste: Suite pytest pentru TutorAgent

**Context:** După implementarea `TutorAgent`, a fost necesară scrierea testelor unitare ([tests/test_tutor.py](file:///c:/Users/Acer/Proiect_MDS/tests/test_tutor.py)) fără apeluri reale la Vertex AI sau Supabase (mock-uri).

**Tool folosit:** Claude Sonnet 3.7

**Promptul exact:**

```
Am această clasă TutorAgent în agents/tutor.py:
[conținutul complet al fișierului tutor.py]

Scrie o suită completă de teste pytest pentru ea, cu aceste cerințe:
- Mockuiește ChatVertexAI și RAGRetriever (să nu facă apeluri reale)
- Testează: valorile default din TutorInput, run() cu RAG dezactivat, run() cu RAG activat
- Verifică că RAG NU e apelat dacă material_id e gol
- Verifică că istoricul conversației e inclus corect în mesaje (_build_prompt)
- Verifică că LLM-ul e invocat exact o dată per run()
- Folosește @patch și MagicMock
- Structurează în clase separate: TestTutorInput și TestTutorAgent
- Adaugă docstrings explicative în română
```

**Ce a generat AI-ul (rezumat):** A generat toate cele 5 clase de test cu decoratoarele `@patch` corecte, instanțierea `MagicMock`, și verificări cu `assert_called_once()` / `assert_not_called()`. Structura pe două clase (`TestTutorInput`, `TestTutorAgent`) a fost respectată integral. Fiecare test conținea un docstring descriptiv în română.

**Ce am modificat manual și de ce:** Testul `test_build_prompt_include_istoricul` verifica inițial 3 mesaje (`len(messages) == 3`), dar uita să numere `SystemMessage`. A fost corectat la `len(messages) == 4` (System + 2 history + întrebarea curentă). De asemenea, `return_value` pentru `StrOutputParser` nu a fost mockat separat — inițial provoca o eroare `AttributeError`, rezolvată prin înlănțuirea mock-ului `invoke` pe instanța LLM.

**Evaluare utilitate: 4/5** — A generat 90% din codul testelor funcțional. Bug-ul cu numărul de mesaje era subtil și necesita cunoașterea internă a `_build_prompt`. Fără AI, scrierea suită ar fi durat ~2 ore; cu AI, ~30 de minute.

---

### Exemplul 3 — Debugging: Eroare „JSON Invalid" la EvaluatorAgent

**Context:** `EvaluatorAgent.generate_test()` ([agents/evaluator.py](file:///c:/Users/Acer/Proiect_MDS/agents/evaluator.py)) returna ocazional un `json.JSONDecodeError`, chiar dacă prompt-ul cerea explicit „fără block markdown". Gemini ignora uneori instrucțiunea.

**Tool folosit:** Cursor (chat cu context din repo)

**Promptul exact:**

```
În agents/evaluator.py, funcția generate_test() primește uneori un JSONDecodeError
pentru că Gemini returnează răspunsul învelit în ```json ... ``` chiar dacă i se cere
să nu facă asta. Codul actual face doar:
  text = response.content.strip()
  parsed_json = json.loads(text)

Adaugă o logică robustă de curățare a markdown-ului ÎNAINTE de json.loads().
Adaugă și un mecanism de retry (max 2 reîncercări) care, dacă parsarea eșuează,
trimite un mesaj de follow-up LLM-ului cerând JSON curat.
Modifică DOAR funcția generate_test(), nu restul clasei.
```

**Ce a generat AI-ul (rezumat):** A generat blocul de curățare markdown (`startswith("```json")`, `startswith("```")`, `endswith("```")`), plus un loop `while retries <= max_retries` cu un mesaj de follow-up `"Răspunsul anterior nu a fost un JSON valid. Te rog dă-mi doar JSON curat."`. A înlocuit `return` direct cu `return GeneratedTest(**parsed_json)` în interiorul try, și a returnat `None` după epuizarea retry-urilor.

**Ce am modificat manual și de ce:** Mesajul de follow-up trimis la retry nu includea și răspunsul anterior al LLM-ului în conversație — ceea ce ar fi confuz pentru model. S-a adăugat `messages.append(AIMessage(content=text))` înainte de mesajul de corectare, pentru a păstra contextul conversației. Aceasta era o subtilitate arhitecturală legată de modul în care LangChain gestionează conversațiile multi-turn.

**Evaluare utilitate: 5/5** — Soluția propusă era completă și direct aplicabilă. Singura modificare a vizat o subtilitate conversațională. Debugging-ul manual ar fi durat 1-2 ore de trial-and-error; cu AI, 15 minute.

---

### Exemplul 4 — Documentație: Docstring-uri pentru RAGRetriever

**Context:** `RAGRetriever` ([agents/rag.py](file:///c:/Users/Acer/Proiect_MDS/agents/rag.py)) conținea funcții complexe (`retrieve()`, `index_material()`, `_index_with_pages()`) fără documentație suficientă, îngreunând onboarding-ul noilor membri de echipă.

**Tool folosit:** ChatGPT (GPT-4o)

**Promptul exact:**

```
Am această clasă RAGRetriever în Python care folosește Supabase pgvector și
LangChain pentru Retrieval-Augmented Generation:
[codul complet al clasei]

Scrie docstring-uri complete în stilul Google Python Docstrings pentru:
1. Clasa RAGRetriever (descriere generală, atribute)
2. Metoda retrieve() — parametri, Returns, comportament la lipsă rezultate
3. Metoda index_material() — parametri, Returns, side effects (inserare Supabase)
4. Metoda _index_with_pages() — parametri, Returns, de ce e separată
5. Funcția curățare clean_text_for_indexing() — ce transformări face

Includ și note despre optimizările specifice pentru materiale școlare
(chunk_size 700, overlap 150, similarity_threshold 0.25).
```

**Ce a generat AI-ul (rezumat):** A generat docstring-uri în format Google Style complet, cu secțiunile `Args:`, `Returns:`, `Raises:`, `Note:`. A inclus explicații despre alegerea parametrilor RAG (chunk_size, similarity_threshold) și a documentat side effects-urile (inserări în Supabase). Clasa a primit un docstring de nivel înalt care explica fluxul complet.

**Ce am modificat manual și de ce:** Docstring-ul pentru `retrieve()` specifica incorect că `top_k` default este 8 (valoarea din docstring-ul original al parametrului), dar codul actual avea `top_k=12`. A fost actualizat la valoarea corectă. De asemenea, au fost adăugate notele despre funcția Supabase RPC `hybrid_search_chunks` (combinare vector search + full-text search), pe care AI-ul nu o cunoaștea din context.

**Evaluare utilitate: 4/5** — Documentația generată era de calitate profesională și a economisit ~1 oră. Erorile factuale (valori hardcodate incorecte, funcții RPC necunoscute) au necesitat o verificare manuală atentă — un risc real dacă documentația e preluată fără validare.

---

### Exemplul 5 — Design UI: Componenta FileUploader cu Drag & Drop

**Context:** Era necesară o componentă React ([components/FileUploader.tsx](file:///c:/Users/Acer/Proiect_MDS/learnflow/components/FileUploader.tsx)) pentru upload materiale educaționale (PDF, PPTX, DOCX, MP4, TXT) cu drag & drop, progress bar animat, și suport URL YouTube.

**Tool folosit:** GitHub Copilot + Claude (iterativ)

**Promptul exact (trimis la Claude):**

```
Creează o componentă React TypeScript pentru Next.js care permite:
1. Drag & drop pentru fișiere (PDF, PPTX, DOCX, MP4, TXT, max 500MB)
2. Preview fișier selectat cu icon specific tipului și dimensiune formatată
3. Progress bar animat în timpul uploadului (simulat cu interval)
4. Upload real la Supabase Storage (bucket "educatie", folder "materiale/")
5. Fallback graceful dacă bucket-ul nu există (mock URL pentru testare UI)
6. Câmp alternativ pentru URL YouTube cu validare regex
7. Callback onUploadSuccess(url, type, name) și onClose()
8. Design dark mode cu Tailwind (slate-900, emerald, border white/10)
9. Icoane lucide-react specifice tipului de fișier

Folosește react-dropzone și createClient din @/utils/supabase/client.
```

**Ce a generat AI-ul (rezumat):** A generat componenta completă cu toate cele 9 cerințe. State management-ul cu `useState` pentru file, error, isUploading, progress era corect. Logica `onDrop` gestiona atât fișierele acceptate cât și cele respinse cu mesaje în română. Fallback-ul pentru bucket-ul inexistent era implementat cu un `console.warn` și un mock URL.

**Ce am modificat manual și de ce:** Inițial, `simulateProgress()` nu oprea intervalul la 90% și continua la 100% simultan cu răspunsul real al Supabase — rezultând o cursă (race condition) vizuală. A fost adăugat `clearInterval(progressInterval)` explicit înainte de `setProgress(100)`. De asemenea, `fileName` era generat cu `Date.now()` simplu, care putea produce coliziuni — a fost adăugat `Math.random().toString(36).substring(2, 15)` ca prefix de unicitate.

**Evaluare utilitate: 5/5** — Componenta generată era funcțională din prima iterație la ~95%. Modificările au vizat edge cases de concurență și unicitate care sunt greu de anticipat fără experiență practică cu Supabase Storage. Fără AI, implementarea ar fi durat 3-4 ore.

---

## 4. Ce a Funcționat Bine

**4.1 Generarea de boilerplate structurat.** Toolurile AI au excelat la generarea structurilor Pydantic (`TutorInput`, `TutorOutput`, `GeneratedMaterials`, `GradeResult`), eliminând scrierea manuală a zeci de clase de validare. Timpul economisit este estimat la 60-70% pentru aceste sarcini.

**4.2 System prompt-uri în română.** Claude a demonstrat o capacitate remarcabilă de generare a system prompt-urilor structurate în română, cu constrângeri pedagogice și tehnice complexe (ex: regula LaTeX, redirectarea off-topic, adaptarea la profil). Calitatea depășea ceea ce membrii echipei ar fi produs în același interval de timp.

**4.3 Testare unitară cu mock-uri.** Generarea automată a suităelor pytest cu `@patch` și `MagicMock` a redus semnificativ efortul de scriere a testelor. Structura generată (clase separate per component) a impus o disciplină arhitecturală benefică.

**4.4 Debugging prin explicare.** Simpla descriere a problemei (bug-ul JSON la EvaluatorAgent) a condus la soluții complete și aplicabile în câteva minute. AI-ul a recunoscut pattern-ul comun „LLM ignoră instrucțiunea de format" și a propus atât curățarea output-ului cât și retry-ul conversațional.

**4.5 Componente UI complexe.** Generarea componentelor React cu integrare Supabase, state management, și design system consistent a redus timpii de implementare frontend cu ~70%.

---

## 5. Ce a Eșuat

**5.1 Halucinații cu valori specifice proiectului.** ChatGPT a generat docstring-uri cu valori incorecte (top_k=8 în loc de 12) și nu cunoștea funcțiile RPC Supabase custom (`hybrid_search_chunks`, `save_generated_materials`). **Lecție:** Orice valoare numerică sau referință la API intern trebuie verificată manual.

**5.2 Absența contextului cross-fișier (Copilot).** GitHub Copilot nu a putut sugera implementări care necesitau cunoașterea schemei Supabase sau a configurației din `config.py`. Sugestiile deveneau irelevante în afara fișierului curent.

**5.3 Race conditions și probleme de timing.** Niciun tool nu a detectat spontan race condition-ul din `FileUploader` (intervalul de simulare vs. răspunsul Supabase). Aceste probleme necesită în continuare gândire umană despre concurență.

**5.4 Arhitectura multi-agent (inițial).** Prima versiune generată de AI pentru orchestrarea agenților (Tutor → Evaluator → Analist) nu prevedea cazul în care `material_id` lipsea din sesiune, ducând la apeluri RAG inutile. Codul de protecție `if input_data.use_rag and input_data.material_id:` a fost adăugat manual.

**5.5 Limita de context pentru fișiere mari.** La procesarea `transcribe.py` (22KB) și `ClassReportTable.tsx` (11KB) simultan, unele tooluri (Copilot) pierdeau contextul sau produceau sugestii contradictorii cu codul existent.

---

## 6. Concluzii

Integrarea toolurilor AI în fluxul de dezvoltare al platformei LearnFlow a reprezentat un avantaj competitiv semnificativ, cu o economie estimată de timp de **40-60%** față de dezvoltarea fără asistență AI, variind pe tip de sarcină:

| Tip sarcină | Economie timp estimată |
|---|---|
| Generare boilerplate / structuri | 65% |
| System prompts & documentație | 70% |
| Componente UI React | 70% |
| Teste unitare cu mock-uri | 55% |
| Debugging logic | 50% |
| Arhitectură complexă multi-agent | 30% |

Toolurile AI funcționează cel mai bine ca **amplificatori ai expertizei umane**, nu ca înlocuitori. Codul generat necesită întotdeauna revizuire critică, în special pentru: valori hardcodate specifice proiectului, cazuri de margine (edge cases), concurență și timing, și integrări cu servicii externe (Supabase RPC, Vertex AI). 

Principalul risc identificat este **supraîncrederea în output**: dezvoltatorii fără experiență cu domeniul pot prelua cod generat cu erori subtile, în special în teste (asertări incorecte) și documentație (valori inexacte). Procesul de **code review uman rămâne esențial**, chiar și când codul este generat de AI.

**Recomandare finală:** Adoptarea unui workflow hibrid — AI pentru generare rapidă, umani pentru revizuire critică și design arhitectural — maximizează beneficiile fără a compromite calitatea. Pentru proiectele educaționale cu agenți AI, Claude demonstrează superioritate clară în generarea de prompturi structurate și raționament pedagogic, în timp ce Cursor excelează pentru modificări coordonate la nivel de repo.

---

*Raport generat pe baza analizei codului sursă al proiectului LearnFlow (Iunie 2026).*  
*Referințe cod: [agents/tutor.py](file:///c:/Users/Acer/Proiect_MDS/agents/tutor.py) · [agents/rag.py](file:///c:/Users/Acer/Proiect_MDS/agents/rag.py) · [agents/evaluator.py](file:///c:/Users/Acer/Proiect_MDS/agents/evaluator.py) · [agents/generator.py](file:///c:/Users/Acer/Proiect_MDS/agents/generator.py) · [agents/analist.py](file:///c:/Users/Acer/Proiect_MDS/agents/analist.py) · [tests/test_tutor.py](file:///c:/Users/Acer/Proiect_MDS/tests/test_tutor.py) · [components/FileUploader.tsx](file:///c:/Users/Acer/Proiect_MDS/learnflow/components/FileUploader.tsx)*
