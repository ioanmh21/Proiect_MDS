# Documentație Testare — LearnFlow

> **Platformă educațională cu agenți AI** | Next.js · Python · LangChain · Supabase · Google Gemini

---

## Cuprins

1. [Introducere și Strategie de Testare](#1-introducere-și-strategie-de-testare)
2. [Tehnologii Folosite](#2-tehnologii-folosite)
3. [Structura Testelor (Unit Tests)](#3-structura-testelor-unit-tests)
4. [Evaluarea Agenților AI (Evals)](#4-evaluarea-agenților-ai-evals)
5. [Instrucțiuni de Rulare](#5-instrucțiuni-de-rulare)

---

## 1. Introducere și Strategie de Testare

### Despre Proiect

**LearnFlow** este o platformă educațională care orchestrează un sistem multi-agent bazat pe AI. Agenții specializați colaborează pentru a oferi tutorat personalizat, generare automată de teste, moderare de conținut și analiză de progres, toate alimentate de **Google Gemini Flash** prin LangChain și de un pipeline **RAG (Retrieval-Augmented Generation)** construit pe Supabase pgvector.

### Provocările Testării

Testarea unui sistem bazat pe LLM-uri ridică provocări specifice față de testarea software tradițională:

- **Non-determinism**: Același prompt poate genera răspunsuri diferite la fiecare rulare.
- **Dependențe externe**: Agenții depind de Google Vertex AI (Gemini), Supabase pgvector și embeddings — servicii costisitoare și cu latență.
- **Corectitudinea semantică**: Un răspuns poate fi corect din punct de vedere gramatical, dar incorect pedagogic sau factual.

### Strategia Adoptată

Abordăm testarea pe **trei niveluri**, conform principiului piramidei de testare:

```
         ┌─────────────────────┐
         │  INTEGRARE (E2E)    │  ← Supabase real + Gemini real
         │  integration_*.py   │     Rulat manual, înainte de release
         ├─────────────────────┤
         │   UNIT TESTS        │  ← Mock complet al LLM + Supabase
         │   test_*.py         │     Rulat automat la fiecare commit (CI)
         ├─────────────────────┤
         │  EVALS (Behavior)   │  ← Verificare comportament agent prin
         │  (embedded în unit) │     inspecția output-urilor mockat
         └─────────────────────┘
```

| Nivel | Scop | Viteza | Necesită servicii externe |
|---|---|---|---|
| **Unit Tests** | Validare logică internă, contracte Pydantic, flux de control | < 5s | ❌ Nu |
| **Evals comportamentale** | Verificare că agentul respectă regulile definite în prompt | < 5s | ❌ Nu (mock) |
| **Teste de Integrare** | Validare end-to-end cu Supabase + Gemini reale | ~30s | ✅ Da |

**Principiu cheie**: Toate testele din suita `test_*.py` rulează **complet offline**, fără a apela API-uri externe, prin utilizarea sistematică a `unittest.mock`. Aceasta garantează rularea rapidă și stabilă în medii CI/CD.

---

## 2. Tehnologii Folosite

### Backend — Framework de Testare Python

| Tehnologie | Versiune | Rol |
|---|---|---|
| **pytest** | `9.0.3` | Runner principal de teste; descoperire automată, fixtures, raportare |
| **pytest-asyncio** | `1.3.0` | Suport pentru testarea funcțiilor `async/await` (ex: `TutorAgent.arun()`) |
| **pytest-benchmark** | `5.2.3` | Benchmarking performanță pentru funcțiile critice (RAG retrieve, generare embeddings) |
| **pytest-socket** | `0.7.0` | Blochează apelurile de rețea neintenționat în unit tests, garantând izolarea |
| **pytest-recording** | `0.13.4` | Înregistrează și redă (replay) răspunsuri HTTP reale pentru teste repetabile |
| **unittest.mock** | stdlib | `MagicMock`, `@patch` pentru izolarea dependențelor externe |
| **Pydantic v2** | `2.13.4` | Validarea schemelor de input/output ale agenților (ValidationError testing) |

### Backend — Dependențe Agenți (în context de testare)

| Tehnologie | Rol în testare |
|---|---|
| **LangChain Core** `1.4.0` | `AIMessage`, `HumanMessage`, `SystemMessage` — folosite în construirea mock-urilor |
| **langchain-google-genai** | Mockat prin `@patch("agents.*.ChatVertexAI")` |
| **Supabase Python** `2.30.0` | Mockat prin `@patch("agents.*.create_client")` |
| **FastAPI** `0.136.1` | Framework API testat indirect prin agenți |

### Frontend — Testare Next.js

> ⚠️ Testele frontend (Jest/Vitest pentru componente React) sunt planificate. Suita curentă acoperă exclusiv logica backend Python a agenților.

---

## 3. Structura Testelor (Unit Tests)

### Hartă Fișiere de Teste

```
tests/
├── __init__.py
├── test_tutor.py          ← Agent 01 Tutor (5 teste)
├── test_rag.py            ← Modulul RAG (4 teste)
├── test_moderare.py       ← Agent 02 Moderare (4 teste)
├── test_new_agents.py     ← Generator + Evaluator (5 teste)
├── integration_rag.py     ← Test integrare RAG (manual)
└── integration_tutor.py   ← Test E2E Tutor + RAG (manual)
```

---

### 3.1 `test_tutor.py` — Agentul Tutor (01)

Testează clasa [`TutorAgent`](agents/tutor.py) — agentul central care răspunde la întrebările studenților pe baza contextului RAG și a profilului acestora.

**Dependențe mockat**: `ChatVertexAI`, `RAGRetriever`

#### Clasa `TestTutorInput` — Validare scheme Pydantic

| Test | Scenariu | Verifică |
|---|---|---|
| `test_input_valori_default` | Creare input minim (doar întrebare) | Valorile default: `use_rag=True`, `material_id=""`, `student_name="Student"`, `conversation_history=[]` |
| `test_input_date_complete` | Creare input cu toate câmpurile | Setarea corectă a `material_id` UUID, `student_name`, `conversation_history` cu 1 element |
| `test_input_use_rag_false` | Dezactivarea RAG explicit | `use_rag=False` se propagă corect |

#### Clasa `TestTutorAgent` — Comportament agent

| Test | Scenariu | Verifică |
|---|---|---|
| `test_run_returneaza_tutor_output` | `run()` fără RAG, cu context manual | Returnează `TutorOutput` valid; `agent == "01_tutor"`; răspuns non-gol |
| `test_run_cu_rag_foloseste_context_din_supabase` | `run()` cu `use_rag=True` și `material_id` valid | RAG este apelat (`retrieve.assert_called_once()`); `rag_chunks_used == 2` |
| `test_rag_nu_e_apelat_fara_course_id` | `use_rag=True` dar `material_id=""` | RAG **nu** este apelat (`retrieve.assert_not_called()`); `rag_chunks_used == 0` |
| `test_build_prompt_include_istoricul` | Conversație cu 2 mesaje în istoric | Lista de mesaje conține 4 elemente: `SystemMessage` + `HumanMessage` + `AIMessage` + întrebarea curentă |
| `test_llm_este_apelat_o_singura_data` | Apel simplu `run()` | LLM-ul este invocat **exact o dată** (`invoke.assert_called_once()`) |

---

### 3.2 `test_rag.py` — Modulul RAG

Testează [`RAGRetriever`](agents/rag.py) — componenta de căutare semantică în pgvector care alimentează toți agenții cu context relevant din materialele de curs.

**Dependențe mockat**: `VertexAIEmbeddings` (Google text-embedding-004), `create_client` (Supabase)

#### Clasa `TestRAGResult` — Validare schema rezultat

| Test | Scenariu | Verifică |
|---|---|---|
| `test_result_cu_chunks` | RAGResult cu 3 chunks | `chunks_found == 3`, context non-gol |
| `test_result_gol` | RAGResult fără rezultate | `chunks_found == 0` |

#### Clasa `TestRAGRetriever` — Comportament retriever

| Test | Scenariu | Verifică |
|---|---|---|
| `test_retrieve_gaseste_chunks` | Supabase returnează 2 chunks cu similaritate 0.92 și 0.85 | `chunks_found == 2`; context conține textul și `Pagina 5`; `similarity_scores` are 2 elemente; funcția RPC `hybrid_search_chunks` apelată cu parametrii corecți (`query_text`, `query_embedding`, `match_count=12`, `filter_material_id`) |
| `test_retrieve_fara_material_id` | Apel `retrieve()` fără `material_id` (caută global) | `chunks_found == 0`; mesajul de fallback `"Nu s-au găsit"` prezent în context |
| `test_index_material_insereaza_chunks` | Indexare text de 200 cuvinte (fără `page_map`) | Returnează `count > 0`; tabelul `"chunks"` (nu `document_chunks`) este accesat; `insert` apelat o singură dată |
| `test_delete_material_chunks` | Ștergere chunks pentru un `material_id` | Metoda `.eq("material_id", UUID)` apelată corect pe tabela Supabase |

---

### 3.3 `test_moderare.py` — Agentul Moderare (02)

Testează [`ModerareAgent`](agents/moderare.py) — agentul care filtrează conținutul nesigur (limbaj vulgar, prompt injection, conținut ofensator) înainte ca mesajele să ajungă la alți agenți.

**Dependențe mockat**: `ChatVertexAI`

#### Clasa `TestModerareInput`

| Test | Scenariu | Verifică |
|---|---|---|
| `test_input_text_simplu` | Creare `ModerareInput` cu text | Câmpul `text` se stochează corect |

#### Clasa `TestModerareAgent`

| Test | Scenariu | Verifică |
|---|---|---|
| `test_text_safe_returneaza_is_safe_true` | LLM răspunde `"SAFE"` | `ModerareOutput.is_safe == True`; `reason == ""` |
| `test_text_unsafe_returneaza_is_safe_false` | LLM răspunde `"UNSAFE Conține limbaj ofensator."` | `ModerareOutput.is_safe == False`; `"ofensator"` prezent în `reason` |
| `test_llm_este_apelat_o_singura_data` | Apel simplu `run()` | LLM invocat **exact o dată** |

---

### 3.4 `test_new_agents.py` — Generator (04) și Evaluator (03)

Testează [`GeneratorAgent`](agents/generator.py) și [`EvaluatorAgent`](agents/evaluator.py) — agenții responsabili cu generarea materialelor educaționale și a testelor de evaluare.

**Dependențe mockat**: `ChatVertexAI`, `create_client` (Supabase)

#### Clasa `TestNewAgents`

| Test | Scenariu | Verifică |
|---|---|---|
| `test_generator_prompt_and_parsing` | Generator face 2 apeluri LLM (analiză + generare), Supabase returnează chunks | `build_analysis_prompt()` include transcriptul; `build_generation_prompt()` include `rezumat`; LLM apelat de **2 ori**; RPC `save_generated_materials` apelat; `flashcards_count == 1` |
| `test_generator_ridica_eroare_fara_chunks` | Material fără chunk-uri în Supabase | `ValueError` ridicat cu mesajul `"nu are chunk-uri"` |
| `test_evaluator_generation` | Evaluator generează test cu o întrebare grilă din JSON mockat | `generate_test()` returnează `GeneratedTest` cu 1 întrebare; `correct_answer == "A"`; structura Pydantic validată corect |
| `test_evaluator_json_cu_markdown_blocks` | LLM returnează JSON în bloc markdown (\`\`\`json...\`\`\`) | Blocul markdown eliminat; JSON parsat corect; `concept == "OOP"` |
| `test_evaluator_returneaza_none_la_json_invalid` | LLM dă text invalid la toate retry-urile | `generate_test()` returnează `None` (toate cele 3 încercări au eșuat) |

---

## 4. Evaluarea Agenților AI (Evals)

### Filosofia Evals

Spre deosebire de unit testele clasice (care verifică **dacă codul se execută corect**), evaluările de agenți AI verifică **dacă agentul se comportă corect** — dacă respectă instrucțiunile din system prompt, dacă parsează corect output-ul LLM-ului și dacă gestionează cazurile de margine.

Deoarece nu putem verifica semantic răspunsul unui LLM real în teste automate rapide, evals-urile noastre se concentrează pe **contracte comportamentale observabile**: ce se întâmplă cu output-ul agentului dat un anumit răspuns mockat al LLM-ului.

---

### 4.1 Eval: Respectarea Formatului JSON (EvaluatorAgent)

**Scenariul testat**: LLM-ul returnează uneori JSON învelit în blocuri markdown (` ```json ... ``` `), ignorând instrucțiunea din prompt. Agentul trebuie să gestioneze robust această situație.

**Mecanism de eval**: `test_evaluator_generation` furnizează un răspuns LLM cu spații și indentare suplimentară (simulând răspuns real). Se verifică că parsarea Pydantic reușește.

```python
# Răspuns LLM mockat cu spații extra (simulează răspuns real Gemini)
mock_response.content = """
{
  "questions": [
    {
      "id": "q1",
      "text": "Intrebare?",
      "type": "grila",
      "options": ["A", "B"],
      "correct_answer": "A",
      "explanation": "Expl",
      "difficulty": "usor",
      "concept": "concept1"
    }
  ]
}
"""
# Eval: parsarea produce un obiect valid
test = agent.generate_test("mat123", config)
self.assertIsNotNone(test)               # Nu s-a returnat None (nu au eșuat retry-urile)
self.assertEqual(len(test.questions), 1) # Exact o întrebare parsată
self.assertEqual(test.questions[0].correct_answer, "A")  # Valoarea corectă extrasă
```

**Metrică urmărită**: Rata de succes a parsării JSON (dacă `generate_test()` returnează `None`, înseamnă că toate cele 3 încercări de retry au eșuat).

---

### 4.2 Eval: Clasificare Binară Moderare (ModerareAgent)

**Scenariul testat**: Agentul de moderare trebuie să clasifice corect conținutul în `SAFE` / `UNSAFE` bazat pe formatul de răspuns al LLM-ului și să extragă motivul în cazul `UNSAFE`.

**Mecanism de eval**: Se testează cele două ramuri ale clasificatorului cu răspunsuri LLM mockat precise.

```python
# Eval 1 — Text sigur → is_safe=True, reason=""
mock_llm_instance.invoke.return_value = AIMessage(content="SAFE")
result = agent.run(ModerareInput(text="Cum funcționează un arbore binar?"))
assert result.is_safe is True
assert result.reason == ""

# Eval 2 — Text nesigur → is_safe=False, reason extras
mock_llm_instance.invoke.return_value = AIMessage(content="UNSAFE Conține limbaj ofensator.")
result = agent.run(ModerareInput(text="Text ofensator..."))
assert result.is_safe is False
assert "ofensator" in result.reason  # Motivul este extras corect din răspuns
```

**Metrică urmărită**: Acuratețea clasificării (True Positive, True Negative) pe scenariile de test definite.

---

### 4.3 Eval: Activarea Condiționată a RAG (TutorAgent)

**Scenariul testat**: RAG trebuie activat **numai** când sunt îndeplinite ambele condiții: `use_rag=True` **ȘI** `material_id` non-gol. Orice altă combinație nu trebuie să apeleze Supabase.

**Mecanism de eval**: Inspecția directă a apelurilor mock cu `assert_called_once()` și `assert_not_called()`.

```python
# Eval 1 — RAG TREBUIE apelat
result = agent.run(TutorInput(
    student_question="Ce este recursivitatea?",
    material_id="550e8400-e29b-41d4-a716-446655440000",  # UUID valid
    use_rag=True,
))
mock_rag_instance.retrieve.assert_called_once()  # RAG invocat
assert result.rag_chunks_used == 2               # Chunks returnate

# Eval 2 — RAG NU trebuie apelat (material_id gol)
result = agent.run(TutorInput(
    student_question="Test?",
    use_rag=True,
    material_id="",   # Gol → RAG dezactivat
))
mock_rag_instance.retrieve.assert_not_called()  # RAG ignorat
assert result.rag_chunks_used == 0
```

**Metrică urmărită**: Zero apeluri false la Supabase (fiecare apel RAG consumă embeddings tokens și latență).

---

### 4.4 Eval: Integritate Conversație Multi-Turn (TutorAgent)

**Scenariul testat**: La fiecare apel, tutorul trebuie să includă istoricul complet al conversației în lista de mesaje trimisă LLM-ului, în ordinea corectă și cu rolurile corecte.

**Mecanism de eval**: Inspectarea directă a output-ului metodei interne `_build_prompt()`.

```python
input_data = TutorInput(
    student_question="Dar exemplul cu factorial?",
    use_rag=False,
    material_context="Context test.",
    conversation_history=[
        {"role": "human", "content": "Ce este recursivitatea?"},
        {"role": "ai",    "content": "Recursivitatea este..."}
    ]
)
messages = agent._build_prompt(input_data)

# Eval: structura completă a mesajelor
assert len(messages) == 4           # System + HumanMsg + AIMsg + întrebare curentă
assert isinstance(messages[0], SystemMessage)
assert isinstance(messages[1], HumanMessage)   # primul mesaj din istoric
assert isinstance(messages[2], AIMessage)      # răspunsul tutorului din istoric
assert isinstance(messages[3], HumanMessage)   # întrebarea curentă
assert messages[3].content == "Dar exemplul cu factorial?"
```

**Metrică urmărită**: Ordinea și tipurile corecte ale mesajelor — o eroare aici ar determina tutorul să ignore contextul conversației.

---

### 4.5 Eval: Completitudine Indexare RAG (RAGRetriever)

**Scenariul testat**: Funcția `index_material()` trebuie să proceseze corect textul (split → embed → insert) și să scrie în tabelul `chunks` (nu în altă tabelă).

**Mecanism de eval**: Verificarea numelui tabelei Supabase accesat și că `insert` a fost apelat.

```python
text = "Paragraf 1. " * 100 + "\n\n" + "Paragraf 2. " * 100
count = retriever.index_material(text=text, material_id=FAKE_MATERIAL_ID, page_number=3)

assert count > 0                                              # Cel puțin un chunk creat
mock_sb.table.assert_called_with("chunks")                   # Tabelul corect accesat
mock_sb.table.return_value.insert.assert_called_once()       # Insert efectuat
```

**Metrică urmărită**: Numărul de chunks generați și utilizarea tabelei corecte din schema Supabase.

---

### 4.6 Evals de Integrare (Manuale)

Testele din `integration_rag.py` și `integration_tutor.py` sunt **evals end-to-end** care validează comportamentul real al sistemului cu servicii live.

#### `integration_rag.py` — Eval Pipeline RAG Complet

Verifică întregul flux: text brut → chunk-uri → embeddings reale (768 dimensiuni) → stocare pgvector → căutare semantică cu scor de similaritate.

**Scenarii evaluate**:
- Indexare text despre recursivitate (1 pagină)
- 3 query-uri semantice: definiție, dezavantaje, exemplu factorial
- Verificare vizuală a scorurilor de similaritate returnate (>0.25 threshold)
- Cleanup opțional al datelor de test

**Output așteptat**:
```
✅ Indexate N chunk-uri pentru material UUID
🔍 Query: 'Ce este recursivitatea?'
📦 Chunks găsite: 2
📊 Similaritate: [0.89, 0.84]
```

#### `integration_tutor.py` — Eval E2E Tutor + RAG

Verifică fluxul complet: `TutorInput` → reformulare query cu LLM → RAG retrieve din Supabase → Gemini Flash → `TutorOutput` cu răspuns pedagogic.

**Condiție de succes**: `rag_chunks_used > 0` (tutorul a găsit și utilizat context din baza de date).

---

## 5. Instrucțiuni de Rulare

### Cerințe Preliminare

```bash
# 1. Creează și activează virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate    # Linux/Mac

# 2. Instalează dependențele
pip install -r requirements.txt
```

### Variabile de Mediu

Creează un fișier `.env` în rădăcina proiectului:

```env
# Google Cloud (pentru testele de integrare)
GCP_PROJECT_ID=your-gcp-project-id
GCP_LOCATION=europe-west1

# Supabase (pentru testele de integrare)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key
```

> **Notă**: Variabilele `.env` **nu sunt necesare** pentru unit tests (toate serviciile sunt mockat). Sunt necesare doar pentru testele de integrare.

---

### Rulare Unit Tests (Recomandat — Fără Servicii Externe)

```bash
# Rulează TOATE unit testele
venv\Scripts\python.exe -m pytest tests/test_tutor.py tests/test_rag.py tests/test_moderare.py tests/test_new_agents.py -v

# Rulează cu raport detaliat de acoperire
venv\Scripts\python.exe -m pytest tests/test_tutor.py tests/test_rag.py tests/test_moderare.py tests/test_new_agents.py -v --tb=short

# Rulează un singur fișier de teste
venv\Scripts\python.exe -m pytest tests/test_tutor.py -v

# Rulează un singur test după nume
venv\Scripts\python.exe -m pytest tests/test_tutor.py::TestTutorAgent::test_run_cu_rag_foloseste_context_din_supabase -v

# Rulează cu output sumar (fără verbose)
venv\Scripts\python.exe -m pytest tests/test_tutor.py tests/test_rag.py tests/test_moderare.py tests/test_new_agents.py
```

**Output așteptat (toate testele trec)**:
```
======================== test session starts ========================
collected 23 items

tests/test_tutor.py::TestTutorInput::test_input_valori_default PASSED
tests/test_tutor.py::TestTutorInput::test_input_date_complete PASSED
tests/test_tutor.py::TestTutorInput::test_input_use_rag_false PASSED
tests/test_tutor.py::TestTutorAgent::test_run_returneaza_tutor_output PASSED
tests/test_tutor.py::TestTutorAgent::test_run_cu_rag_foloseste_context_din_supabase PASSED
tests/test_tutor.py::TestTutorAgent::test_rag_nu_e_apelat_fara_course_id PASSED
tests/test_tutor.py::TestTutorAgent::test_build_prompt_include_istoricul PASSED
tests/test_tutor.py::TestTutorAgent::test_llm_este_apelat_o_singura_data PASSED
tests/test_rag.py::TestRAGResult::test_result_cu_chunks PASSED
tests/test_rag.py::TestRAGResult::test_result_gol PASSED
tests/test_rag.py::TestRAGRetriever::test_retrieve_gaseste_chunks PASSED
tests/test_rag.py::TestRAGRetriever::test_retrieve_fara_material_id PASSED
tests/test_rag.py::TestRAGRetriever::test_index_material_insereaza_chunks PASSED
tests/test_rag.py::TestRAGRetriever::test_delete_material_chunks PASSED
tests/test_moderare.py::TestModerareInput::test_input_text_simplu PASSED
tests/test_moderare.py::TestModerareAgent::test_text_safe_returneaza_is_safe_true PASSED
tests/test_moderare.py::TestModerareAgent::test_text_unsafe_returneaza_is_safe_false PASSED
tests/test_moderare.py::TestModerareAgent::test_llm_este_apelat_o_singura_data PASSED
tests/test_new_agents.py::TestNewAgents::test_evaluator_generation PASSED
tests/test_new_agents.py::TestNewAgents::test_evaluator_json_cu_markdown_blocks PASSED
tests/test_new_agents.py::TestNewAgents::test_evaluator_returneaza_none_la_json_invalid PASSED
tests/test_new_agents.py::TestNewAgents::test_generator_prompt_and_parsing PASSED
tests/test_new_agents.py::TestNewAgents::test_generator_ridica_eroare_fara_chunks PASSED
========================= 23 passed in 3.79s =========================
```

---

### Rulare Teste de Integrare (Necesită Servicii Externe)

> ⚠️ **Atenție**: Aceste teste fac apeluri reale la Google Vertex AI și Supabase. Asigură-te că ai credențialele configurate și că există un `material_id` valid în tabela `materials`.

#### Pas 1 — Autentificare Google Cloud

```bash
gcloud auth application-default login
```

#### Pas 2 — Configurare `MATERIAL_ID`

Deschide fișierele de integrare și înlocuiește placeholder-ul cu un UUID real:
```python
# În tests/integration_rag.py și tests/integration_tutor.py
MATERIAL_ID = "550e8400-e29b-41d4-a716-446655440000"  # UUID real din tabela materials
```

#### Pas 3 — Rulare în Ordine

```bash
# ÎNTÂI: indexează date de test în Supabase
venv\Scripts\python.exe tests\integration_rag.py

# APOI: testează tutorul cu datele indexate
venv\Scripts\python.exe tests\integration_tutor.py
```

---

### Rulare cu `unittest` (Alternativ)

```bash
# Pentru test_new_agents.py care folosește unittest.TestCase
venv\Scripts\python.exe -m unittest tests/test_new_agents.py -v
```

---

### Sumar Rapid

| Comandă | Ce rulează | Durată | Necesită .env |
|---|---|---|---|
| `pytest tests/test_tutor.py -v` | Unit tests Agent Tutor (5 teste) | ~2s | ❌ |
| `pytest tests/test_rag.py -v` | Unit tests RAG (4 teste) | ~2s | ❌ |
| `pytest tests/test_moderare.py -v` | Unit tests Moderare (4 teste) | ~1s | ❌ |
| `pytest tests/test_new_agents.py -v` | Unit tests Generator + Evaluator (5 teste) | ~2s | ❌ |
| `pytest tests/test_*.py -v` | Toate unit testele (23 teste) | ~4s | ❌ |
| `python tests/integration_rag.py` | Integrare RAG (Supabase + Gemini) | ~30s | ✅ |
| `python tests/integration_tutor.py` | E2E Tutor + RAG | ~15s | ✅ |

---

## 7. Frontend — Testare Next.js (TypeScript) & AI Evals

Proiectul conține și un modul complex de teste unitare și evaluări automate cu AI (Evals) pentru logica agenților mutată în frontend/backend-ul Next.js (`lib/agents/`).

### 7.1 Unit Tests (Jest + ts-jest)
Sistemul cuprinde 63 de teste Jest complet izolate (mock pe `@google/generative-ai` și `@supabase/supabase-js`), acoperind:
- **TutorAgent** (`tutor-agent.test.ts`): 25 teste care validează generarea de răspunsuri, detectarea conceptelor de revizuit (flag-ul `needsReview` la 3 repetiții), construirea prompturilor cu date de profil și RAG, propagarea erorilor Gemini.
- **EvaluatorAgent** (`evaluator-agent.test.ts`): 38 teste care validează parsarea robustă de JSON, corectarea răspunsurilor (inclusiv extragerea conceptelor greșite) și mecanismul de *Retry Logic* (reapelarea LLM-ului când formatul e invalid).

**Rulare:**
```bash
cd learnflow
npm test
```

### 7.2 AI Evals (Evaluarea Calitativă a Agenților)
Pe lângă validarea structurală, am implementat 3 scripturi de tip AI Evals în folderul `learnflow/evals/`:
1. **Tutor Eval (`tutor-eval.ts`)**: Măsoară calitatea răspunsurilor TutorAgent pe un dataset de 10 QA-uri bazate pe un RAG real. Un al doilea apel Gemini acționează ca "AI Judge", dând o notă de la 1 la 5 cu justificare.
2. **Hallucination Eval (`hallucination-eval.ts`)**: Măsoară rata de halucinații a Material Generator-ului. Se generează flashcards dintr-un transcript, iar AI Judge verifică dacă itemii sunt riguros ancorați în textul sursă (Da/Nu/Parțial).
3. **Reporter (`reporter.ts`)**: Generează automat un raport Markdown (`[timestamp]-report.md`) și log-uri JSON pentru a urmări evoluția agenților (Trend-uri de regresie sau îmbunătățire) și a sugera optimizări de prompt (ex: "Calitate Slabă", "Alertă Halucinații").

### 7.3 Teste de Integrare End-to-End (Jest)
Sistemul dispune de un mediu izolat de teste de integrare capabil să execute fluxuri E2E pe baza de date reală Supabase (via API-ul Service Role) și API-ul real Google Gemini.  

**Facilități:**
- **Mediu Controlat**: Se folosește `scripts/setup-test-db.ts` pentru a crea efemer utilizatori în tabela auth, evitând erorile de constrângere la Foreign Key și asigurând izolare completă pe bază de `TEST_USER_ID`.
- **Pipeline-ul RAG/Ingestie (`__tests__/integration/ingestion.test.ts`)**: Testează de la upload-ul fișierelor în Supabase Storage, inserția materialului, chunking și vectorizare, până la query-ul semantic folosind RPC-ul (`hybrid_search_chunks`).
- **GeneratorAgent (`__tests__/integration/generator.test.ts`)**: Se validează output-ul integrat, parsarea și formatarea complexă a LLM-ului.

**Rulare:**
```bash
cd learnflow
npm run test:integration
```
*(Asigură-te că există un fișier `.env.test` configurat conform instrucțiunilor din README).*

---

*Documentație generată pentru LearnFlow — Iunie 2026*
*Referințe cod: [agents/](agents/) · [tests/](tests/) · [learnflow/__tests__/](learnflow/__tests__/) · [learnflow/evals/](learnflow/evals/)*
