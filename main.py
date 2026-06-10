from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List

# Importă toți agenții
from agents.tutor import TutorAgent, TutorInput
from agents.moderare import ModerareAgent, ModerareInput
from agents.evaluator import EvaluatorAgent, TestConfig, Answer
from agents.generator import GeneratorAgent
from agents.ingestion import IngestionAgent
from agents.profile import ProfileAgent, TestResult
from agents.analist import AnalistAgent

app = FastAPI(title="LearnFlow AI Microservice", description="API care expune toți agenții de Inteligență Artificială")

# Permitem accesul frontend-ului (Next.js) de pe orice port local
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────
# Inițializare Agenți
# ─────────────────────────────────────────────
print("Start initializare agenti AI...")
tutor_agent = TutorAgent()
moderare_agent = ModerareAgent()
evaluator_agent = EvaluatorAgent()
generator_agent = GeneratorAgent()
ingestion_agent = IngestionAgent()
profile_agent = ProfileAgent()
analist_agent = AnalistAgent()
print("Toti agentii sunt gata!")

# ─────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────

# 1. TUTOR & MODERARE
@app.post("/tutor/chat")
async def chat_with_tutor(input_data: TutorInput):
    """
    Răspunde întrebărilor elevilor. Filtrează inputul și outputul prin agentul de moderare.
    """
    # Verifică ce zice elevul
    mod_res = moderare_agent.run(ModerareInput(text=input_data.student_question))
    if not mod_res.is_safe:
        return {"response": f"Mesajul tău a fost blocat deoarece încalcă politicile: {mod_res.reason}", "is_safe": False}
        
    # Generează răspuns (async)
    tutor_res = await tutor_agent.arun(input_data)
    
    # Verifică ce zice AI-ul
    ai_mod = moderare_agent.run(ModerareInput(text=tutor_res.response))
    if not ai_mod.is_safe:
        return {"response": "Din motive de siguranță, răspunsul a fost blocat.", "is_safe": False}
        
    return tutor_res

# 2. GENERATOR DE MATERIALE
class GenerateRequest(BaseModel):
    material_id: str

@app.post("/generator/generate")
def generate_materials(req: GenerateRequest):
    """
    Asamblează transcriptul și generează dintr-un foc rezumatul, flashcards, întrebările de test și planul de lecție.
    """
    try:
        res = generator_agent.generate_all_materials(req.material_id)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 3. EVALUATOR (Generare Test)
class GenerateTestRequest(BaseModel):
    material_id: str
    config: TestConfig

@app.post("/evaluator/generate_test")
def generate_test(req: GenerateTestRequest):
    """
    Generează un test personalizat folosind AI-ul.
    """
    test = evaluator_agent.generate_test(req.material_id, req.config)
    if not test:
        raise HTTPException(status_code=500, detail="Nu s-a putut genera testul JSON.")
    return test

# 4. EVALUATOR (Corectare Test) + UPDATE PROFIL
class GradeTestRequest(BaseModel):
    test_id: str
    user_id: str
    user_answers: List[Answer]

@app.post("/evaluator/grade_test")
def grade_test(req: GradeTestRequest):
    """
    Corectează răspunsurile, oferă feedback cu AI pentru greșeli, și declanșează Agentul Profil.
    """
    # Corectăm
    grade_res = evaluator_agent.grade_test(req.test_id, req.user_answers)
    if not grade_res:
        raise HTTPException(status_code=404, detail="Testul nu a fost găsit în baza de date.")
        
    # Generăm lista de rezultate pe concepte pentru profil
    test_results = []
    for fb in grade_res.feedback:
        # Preluăm conceptul greșit pentru profil (aici simplificăm ca mapare de ID)
        test_results.append(TestResult(concept=fb.questionId, isCorrect=fb.isCorrect))
        
    # Actualizăm profilul elevului (punctele slabe)
    profile_agent.update_weak_concepts(req.user_id, test_results)
    
    return grade_res

# 5. INGESTIE (Procesare PDF nou)
class IngestionRequest(BaseModel):
    material_id: str

@app.post("/ingestion/process_material")
def ingest_material(req: IngestionRequest):
    """
    Descarcă fișierul (PDF, TXT, Video, Audio) din Supabase, îi extrage/transcrie textul în chunks și generează embeddings.
    """
    try:
        res = ingestion_agent.process_material(req.material_id)
        return res
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# 6. ANALIST (Progres Elev)
@app.get("/analist/progress/{user_id}")
def get_student_progress(user_id: str):
    """
    Returnează progresul elevului (scor, teste completate, timp studiu) și recomandări AI.
    """
    try:
        res = analist_agent.get_student_progress(user_id)
        return res
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Eroare la generarea progresului: {str(e)}")
