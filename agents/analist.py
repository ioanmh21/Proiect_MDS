"""
Agent 03 - Analist
==================
Responsabilități:
1. Preluarea datelor despre elev (test_results, study_sessions, weak_concepts).
2. Agregarea acestora pentru a oferi un raport de progres (scor mediu, timp de studiu, teste completate).
3. Generarea unei recomandări AI folosind Gemini pe baza lacunelor identificate.
"""

from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from langchain_google_genai import ChatGoogleGenerativeAI as ChatVertexAI
from langchain_core.messages import SystemMessage, HumanMessage
import json

import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from config import SUPABASE_URL, SUPABASE_KEY, GCP_PROJECT_ID, GCP_LOCATION, MODEL_FAST
from supabase import create_client, Client

class AiRecommendation(BaseModel):
    title: str
    description: str
    estimatedTime: str
    difficulty: str

class ProgressReport(BaseModel):
    averageScore: float
    studyTime: str
    testsCompleted: int
    aiRecommendation: AiRecommendation
    testsHistory: List[dict] = []

ANALIST_SYSTEM_PROMPT = """Ești Agentul Analist dintr-o platformă educațională. Rolul tău este să analizezi progresul unui elev și să generezi o singură recomandare educațională personalizată.
Ai la dispoziție următoarele informații:
- Conceptele la care elevul are lacune (weak_concepts) cu rata de eroare asociată.
- Scorurile recente.

Trebuie să generezi un JSON valid, fără block de markdown (fără ```json), cu exact această structură:
{
  "title": "Titlu scurt și atrăgător pentru o lecție sau test",
  "description": "Explicație clară de ce ai recomandat asta și cum îl va ajuta.",
  "estimatedTime": "Ex: 15m, 20m, 30m",
  "difficulty": "Ușor, Mediu sau Greu"
}

Recomandarea trebuie să fie prietenoasă, directă și adresată elevului ("Pe baza activității tale... îți recomand..."). Încearcă să targetezi cel mai slab concept identificat.
Regulă LaTeX: Folosește sintaxa LaTeX pentru expresii matematice. Formulele inline trebuie puse strict între `$` (ex: `$E=mc^2$`), iar formulele bloc trebuie puse între `$$` pe linii separate. EVITĂ complet utilizarea formatului `\\(` și `\\[` pentru formule, folosește DOAR `$` și `$$`.
"""

class AnalistAgent:
    def __init__(self):
        self.supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        self.llm = ChatVertexAI(
            model=MODEL_FAST,
            project=GCP_PROJECT_ID,
            location=GCP_LOCATION,
            temperature=0.3,
            max_output_tokens=1024,
        )

    def format_study_time(self, minutes: int) -> str:
        if minutes == 0:
            return "0m"
        if minutes < 60:
            return f"{minutes}m"
        hours = minutes // 60
        mins = minutes % 60
        if mins == 0:
            return f"{hours}h"
        return f"{hours}h {mins}m"

    def get_student_progress(self, user_id: str) -> ProgressReport:
        average_score = 0.0
        tests_completed = 0
        tests_history = []
        total_minutes = 0
        weak_concepts = []

        # 1. Fetch test results
        try:
            tests_res = self.supabase.table("test_results").select("score, created_at, materials(title)").eq("student_id", user_id).order("created_at", desc=False).execute()
            if tests_res.data:
                tests = tests_res.data
                tests_completed = len(tests)
                valid_scores = [float(t["score"]) for t in tests if t.get("score") is not None]
                if valid_scores:
                    average_score = round(sum(valid_scores) / len(valid_scores), 1)
                
                for i, t in enumerate(tests):
                    if t.get("score") is not None:
                        mat_title = t.get("materials", {}).get("title", f"Test {i+1}") if t.get("materials") else f"Test {i+1}"
                        # trunchiem titlul pt a încăpea frumos în chart
                        if len(mat_title) > 15:
                            mat_title = mat_title[:15] + "..."
                        tests_history.append({
                            "name": mat_title,
                            "score": float(t["score"])
                        })
        except Exception as e:
            print(f"[AnalistAgent] Error fetching tests: {e}")

        # 2. Fetch study sessions (fallback la 0 dacă lipsește tabela/coloana)
        try:
            sessions_res = self.supabase.table("study_sessions").select("*").eq("user_id", user_id).execute()
            if sessions_res.data:
                # Daca exista vreo coloana de durata, o folosim, altfel estimam 30m / sesiune
                for s in sessions_res.data:
                    if "duration_minutes" in s and s["duration_minutes"] is not None:
                        total_minutes += int(s["duration_minutes"])
                    elif "duration" in s and s["duration"] is not None:
                        total_minutes += int(s["duration"])
                    else:
                        total_minutes += 30 # estimare default
        except Exception as e:
            print(f"[AnalistAgent] Error fetching study sessions (might not exist): {e}")

        # 3. Fetch weak concepts
        try:
            profile_res = self.supabase.table("student_profiles").select("weak_concepts").eq("id", user_id).execute()
            if profile_res.data and len(profile_res.data) > 0 and isinstance(profile_res.data[0].get("weak_concepts"), list):
                weak_concepts = profile_res.data[0]["weak_concepts"]
        except Exception as e:
            print(f"[AnalistAgent] Error fetching profiles: {e}")

        # 4. Generate AI Recommendation
        prompt_data = f"Lacune identificate: {weak_concepts}\nScor Mediu recent: {average_score}\nTeste completate: {tests_completed}"
        messages = [
            SystemMessage(content=ANALIST_SYSTEM_PROMPT),
            HumanMessage(content=prompt_data)
        ]
        
        ai_title = "Continuă să înveți!"
        ai_desc = "Îți recomandăm să parcurgi din nou materialele recente pentru a-ți consolida cunoștințele. Mai ai puțin până stăpânești perfect subiectele."
        ai_time = "15m"
        ai_diff = "Ușor"

        try:
            res = self.llm.invoke(messages)
            content = res.content.strip()
            
            if content.startswith("```json"):
                content = content[7:-3]
            elif content.startswith("```"):
                content = content[3:-3]
                
            ai_data = json.loads(content)
            ai_title = ai_data.get("title", ai_title)
            ai_desc = ai_data.get("description", ai_desc)
            ai_time = ai_data.get("estimatedTime", ai_time)
            ai_diff = ai_data.get("difficulty", ai_diff)
        except Exception as e:
            print(f"[AnalistAgent] Error parsing LLM JSON: {e}")

        return ProgressReport(
            averageScore=average_score,
            studyTime=self.format_study_time(total_minutes),
            testsCompleted=tests_completed,
            aiRecommendation=AiRecommendation(
                title=ai_title,
                description=ai_desc,
                estimatedTime=ai_time,
                difficulty=ai_diff
            ),
            testsHistory=tests_history
        )

if __name__ == "__main__":
    agent = AnalistAgent()
    print("Agentul Analist este pregătit!")
