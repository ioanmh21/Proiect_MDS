"""
Agent 04 - Generator de Materiale
=================================
Responsabilități:
Extrage toate chunk-urile din baza de date pentru un anumit material, le asamblează într-un transcript complet, și folosește un proces Gemini în DOI PAȘI:
1. Pasul 1 (Analysis): Gândește planul testului în funcție de document.
2. Pasul 2 (Generation): Generează toate materialele (Rezumat, Notițe, Flashcards, Întrebări, Plan de Lecție).
Toate sunt salvate automat prin procedura RPC în baza de date Supabase.
"""

import os
import sys
import json
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from config import GCP_PROJECT_ID, GCP_LOCATION, MODEL_FAST, SUPABASE_URL, SUPABASE_KEY
from langchain_google_genai import ChatGoogleGenerativeAI as ChatVertexAI
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
    plan_lectie: PlanLectie

# ─────────────────────────────────────────────
# Prompturi pentru Generator (Two-Step Process)
# ─────────────────────────────────────────────

def build_analysis_prompt(transcript: str) -> str:
    return f"""
Ești un profesor expert. Analizează transcriptul următor și creează un plan pentru generarea de materiale educaționale.
Documentul poate fi scurt sau lung, simplu sau complex. Decide numărul optim de:
- Flashcards (între 5 și 20, în funcție de numărul de concepte și termeni cheie)

Transcript:
{transcript}

Returnează DOAR un JSON valid, fără block de markdown (fara ```json). Format exact:
{{
  "flashcards_count": 10
}}
""".strip()

def build_generation_prompt(transcript: str, plan: dict) -> str:
    return f"""
Ești un asistent educațional expert. Ai la dispoziție transcriptul unei lecții și un plan de generare.
Sarcina ta este să generezi conținutul efectiv pe baza planului.

Planul cerut:
- Flashcards: {plan.get('flashcards_count', 10)}

Transcript:
{transcript}

Returnează DOAR JSON valid, fără markdown. Structura exactă:
{{
  "rezumat": {{
    "introducere": "...",
    "capitole": [{{"titlu": "...", "continut": "..."}}]
  }},
  "notite": ["...", "..."],
  "flashcards": [{{"termen": "...", "definitie": "..."}}],
  "plan_lectie": {{
    "durata_min": 50,
    "etape": [{{"titlu": "...", "descriere": "...", "durata_min": 10}}]
  }}
}}
""".strip()

def clean_json_markdown(raw_text: str) -> str:
    raw_text = raw_text.strip()
    if raw_text.startswith("```json"):
        raw_text = raw_text[7:]
    if raw_text.startswith("```"):
        raw_text = raw_text[3:]
    if raw_text.endswith("```"):
        raw_text = raw_text[:-3]
    return raw_text.strip()

# ─────────────────────────────────────────────
# Clasa Principală Generator
# ─────────────────────────────────────────────

class GeneratorAgent:
    def __init__(self):
        # Folosim Gemini 1.5 Flash pentru viteză/context mare
        self.llm = ChatVertexAI(
            model=MODEL_FAST,
            project=GCP_PROJECT_ID,
            location=GCP_LOCATION,
            temperature=0.3,
            max_output_tokens=8192,
        )
        self.supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        self.MAX_TRANSCRIPT_CHARS = 500000

    def generate_all_materials(self, material_id: str) -> Dict[str, Any]:
        """
        Funcția principală: preia chunkurile, asamblează transcriptul, cheamă LLM (2 pași) și salvează datele.
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
        
        # 2. Pas 1: Analiza Documentului (Planning)
        print("[GeneratorAgent] Pas 1: Analiza documentului și planificarea structurii...")
        analysis_prompt = build_analysis_prompt(full_transcript)
        analysis_res = self.llm.invoke([HumanMessage(content=analysis_prompt)])
        
        raw_analysis = clean_json_markdown(analysis_res.content)
        
        try:
            plan = json.loads(raw_analysis)
            print(f"[GeneratorAgent] Plan generat cu succes: {plan}")
        except Exception as e:
            print(f"[GeneratorAgent] Eroare parsare plan: {e}. Folosim plan fallback.")
            plan = {
                "flashcards_count": 10
            }

        # 3. Pas 2: Generare
        print("[GeneratorAgent] Pas 2: Generarea materialelor...")
        gen_prompt = build_generation_prompt(full_transcript, plan)
        response = self.llm.invoke([HumanMessage(content=gen_prompt)])
        
        raw_text = clean_json_markdown(response.content)
            
        try:
            parsed = json.loads(raw_text)
            # Validăm automat folosind Pydantic
            materials = GeneratedMaterials(**parsed)
        except Exception as e:
            raise ValueError(f"[GeneratorAgent] Parsare sau Validare JSON eșuată: {e}\n\n{raw_text[:500]}")
            
        print("[GeneratorAgent] Răspuns primit și validat cu succes.")
        
        # 4. Salvare atomică folosind Supabase RPC
        rpc_params = {
            "p_material_id": material_id,
            "p_summary": materials.rezumat.model_dump(),
            "p_notes": materials.notite,
            "p_flashcards": [f.model_dump() for f in materials.flashcards],
            "p_quiz": [],  # Întrebările se vor genera separat la cererea elevului
            "p_lesson_plan": materials.plan_lectie.model_dump(),
        }
        
        rpc_res = self.supabase.rpc("save_generated_materials", rpc_params).execute()
        
        data = rpc_res.data
        if not data or not data.get("success"):
            raise ValueError(f"[GeneratorAgent] Tranzacția de salvare a eșuat. {data}")
            
        print(f"[GeneratorAgent] Salvare OK - Flashcards: {data.get('flashcards_count')}")
        
        return {
            "material_id": material_id,
            "flashcards_count": data.get('flashcards_count'),
            "lesson_plan_id": data.get('lesson_plan_id')
        }

if __name__ == "__main__":
    agent = GeneratorAgent()
    print("Agentul Generator este pregătit!")
