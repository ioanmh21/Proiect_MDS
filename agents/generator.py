"""
Agent 04 - Generator de Materiale
=================================
Responsabilități:
Extrage toate chunk-urile din baza de date pentru un anumit material, le asamblează într-un transcript complet, și folosește un singur apel Gemini pentru a genera:
1. Rezumat structurat
2. Notițe esențiale
3. Flashcards (15 bucăți)
4. Întrebări Quiz (10 bucăți, dificultăți mixte)
5. Plan de lecție (timpi și etape)
Toate sunt salvate automat prin procedura RPC în baza de date Supabase.
"""

import os
import sys
import json
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from config import GCP_PROJECT_ID, GCP_LOCATION, MODEL_FAST, SUPABASE_URL, SUPABASE_KEY
from langchain_google_vertexai import ChatVertexAI
from langchain_core.messages import HumanMessage
from supabase import create_client, Client

# ─────────────────────────────────────────────
# Modele Pydantic pentru Validarea Răspunsului
# ─────────────────────────────────────────────

class RezumatCapitol(BaseModel):
    titlu: str
    continut: str

class Rezumat(BaseModel):
    introducere: str
    capitole: List[RezumatCapitol]

class Flashcard(BaseModel):
    termen: str
    definitie: str

class QuizQuestion(BaseModel):
    text: str
    raspuns: str
    dificultate: str

class EtapaPlanLectie(BaseModel):
    titlu: str
    descriere: str
    durata_min: int

class PlanLectie(BaseModel):
    durata_min: int
    etape: List[EtapaPlanLectie]

class GeneratedMaterials(BaseModel):
    rezumat: Rezumat
    notite: List[str]
    flashcards: List[Flashcard]
    quiz_questions: List[QuizQuestion]
    plan_lectie: PlanLectie

# ─────────────────────────────────────────────
# Prompt pentru Generator
# ─────────────────────────────────────────────

def build_prompt(transcript: str) -> str:
    return f"""
Ești un asistent educațional expert, specializat în crearea de materiale de studiu structurate pentru elevi și studenți.
Ai primit transcriptul complet al unui material educațional. Sarcina ta este să analizezi conținutul în profunzime și să generezi CINCI tipuri de materiale de studiu, toate în limba română.

═══════════════════════════════════════════
TRANSCRIPTUL MATERIALULUI EDUCAȚIONAL:
═══════════════════════════════════════════
{transcript}
═══════════════════════════════════════════

Generează un obiect JSON cu EXACT structura de mai jos.

──────────────────────────────────────────
1. REZUMAT  (cheie: "rezumat")
──────────────────────────────────────────
Structura:
- "introducere" (string, 3-5 propoziții)
- "capitole" (array de obiecte cu "titlu" și "continut")

──────────────────────────────────────────
2. NOTIȚE  (cheie: "notite")
──────────────────────────────────────────
Un array de string-uri (bullet points, MAX 20).

──────────────────────────────────────────
3. FLASHCARDS  (cheie: "flashcards")
──────────────────────────────────────────
Array de 15 flashcards.
- "termen" (MAX 5 cuvinte)
- "definitie" (MAX 2 propoziții)

──────────────────────────────────────────
4. ÎNTREBĂRI QUIZ  (cheie: "quiz_questions")
──────────────────────────────────────────
Array de 10 întrebări de testare cu grade de dificultate.
- "text"
- "raspuns"
- "dificultate": STRICT ("usor", "mediu", "greu")

──────────────────────────────────────────
5. PLAN DE LECȚIE  (cheie: "plan_lectie")
──────────────────────────────────────────
- "durata_min": ex 50
- "etape": array de obiecte cu "titlu", "descriere", "durata_min" (suma timpurilor de la etape trebuie să dea durata totala).

Returnează DOAR JSON valid. Niciun alt text. Fără block de markdown. Format:
{{
  "rezumat": {{...}},
  "notite": [...],
  "flashcards": [...],
  "quiz_questions": [...],
  "plan_lectie": {{...}}
}}
""".strip()

# ─────────────────────────────────────────────
# Clasa Principală Generator
# ─────────────────────────────────────────────

class GeneratorAgent:
    def __init__(self):
        # Folosim Gemini 1.5 Pro / Flash.
        self.llm = ChatVertexAI(
            model_name=MODEL_FAST,
            project=GCP_PROJECT_ID,
            location=GCP_LOCATION,
            temperature=0.3,
            max_output_tokens=8192,
        )
        self.supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        self.MAX_TRANSCRIPT_CHARS = 500000

    def generate_all_materials(self, material_id: str) -> Dict[str, Any]:
        """
        Funcția principală: preia chunkurile, asamblează transcriptul, cheamă LLM și salvează datele.
        """
        print(f"[GeneratorAgent] START — materialId={material_id}")
        
        # 1. Preia chunk-urile
        res = self.supabase.table("chunks").select("content").eq("material_id", material_id).order("created_at").execute()
        chunks = res.data or []
        
        if not chunks:
            raise ValueError(f"[GeneratorAgent] Materialul {material_id} nu are chunk-uri. Rulați ingestia!")
            
        full_transcript = "\n\n".join([c["content"] for c in chunks])
        if len(full_transcript.strip()) < 50:
            raise ValueError("[GeneratorAgent] Transcriptul este prea scurt pentru a genera materiale.")
            
        if len(full_transcript) > self.MAX_TRANSCRIPT_CHARS:
            full_transcript = full_transcript[:self.MAX_TRANSCRIPT_CHARS] + "\n\n[... trunchiat ...]"
            
        print(f"[GeneratorAgent] Transcript asamblat: {len(chunks)} chunks, {len(full_transcript)} chars.")
        
        # 2. Apelează modelul Gemini
        print("[GeneratorAgent] Se trimite apelul Gemini...")
        prompt = build_prompt(full_transcript)
        response = self.llm.invoke([HumanMessage(content=prompt)])
        
        raw_text = response.content.strip()
        
        # Curăță JSON-ul de markdown
        if raw_text.startswith("```json"):
            raw_text = raw_text[7:]
        if raw_text.startswith("```"):
            raw_text = raw_text[3:]
        if raw_text.endswith("```"):
            raw_text = raw_text[:-3]
            
        try:
            parsed = json.loads(raw_text.strip())
            # Validăm automat folosind Pydantic
            materials = GeneratedMaterials(**parsed)
        except Exception as e:
            raise ValueError(f"[GeneratorAgent] Parsare sau Validare JSON eșuată: {e}\n\n{raw_text[:500]}")
            
        print("[GeneratorAgent] Răspuns primit și validat cu succes.")
        
        # 3. Salvare atomică folosind Supabase RPC
        # Pydantic oferă .model_dump() ca să convertim ușor înapoi în dicționare
        rpc_params = {
            "p_material_id": material_id,
            "p_summary": materials.rezumat.model_dump(),
            "p_notes": materials.notite,
            "p_flashcards": [f.model_dump() for f in materials.flashcards],
            "p_quiz": [q.model_dump() for q in materials.quiz_questions],
            "p_lesson_plan": materials.plan_lectie.model_dump(),
        }
        
        rpc_res = self.supabase.rpc("save_generated_materials", rpc_params).execute()
        
        # Extragem rezultatul dict
        data = rpc_res.data
        if not data or not data.get("success"):
            raise ValueError(f"[GeneratorAgent] Tranzacția de salvare a eșuat. {data}")
            
        print(f"[GeneratorAgent] Salvare OK - Flashcards: {data.get('flashcards_count')}, Quiz: {data.get('quiz_count')}")
        
        return {
            "material_id": material_id,
            "flashcards_count": data.get('flashcards_count'),
            "quiz_count": data.get('quiz_count'),
            "lesson_plan_id": data.get('lesson_plan_id')
        }

if __name__ == "__main__":
    agent = GeneratorAgent()
    print("Agentul Generator este pregătit!")
