"""
Agent 06 - Profile
==================
Responsabilități:
1. Actualizează profilul elevului (weak_concepts) pe baza rezultatelor la teste.
2. Trimite un eveniment către tabela `agent_events` pentru analist.
"""

import os
import sys
from typing import List, Dict, Any
from pydantic import BaseModel

sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from config import SUPABASE_URL, SUPABASE_KEY
from supabase import create_client, Client

class TestResult(BaseModel):
    concept: str
    isCorrect: bool

class WeakConcept(BaseModel):
    concept: str
    errorRate: int

class ProfileAgent:
    def __init__(self):
        self.supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    def update_weak_concepts(self, user_id: str, test_results: List[TestResult]) -> None:
        if not test_results:
            return

        # 1. Fetch profil
        res = self.supabase.table("student_profiles").select("weak_concepts").eq("id", user_id).execute()
        existing_concepts = []
        if res.data and isinstance(res.data[0].get("weak_concepts"), list):
            existing_concepts = [WeakConcept(**c) for c in res.data[0]["weak_concepts"]]

        # 2. Calculează erorile
        concept_stats = {}
        for r in test_results:
            if not r.concept:
                continue
            if r.concept not in concept_stats:
                concept_stats[r.concept] = {"total": 0, "wrong": 0}
            concept_stats[r.concept]["total"] += 1
            if not r.isCorrect:
                concept_stats[r.concept]["wrong"] += 1

        updated_concepts = {c.concept: c.errorRate for c in existing_concepts}

        for concept, stats in concept_stats.items():
            if stats["wrong"] > 0:
                error_rate = int((stats["wrong"] / stats["total"]) * 100)
                updated_concepts[concept] = error_rate

        final_concepts = [WeakConcept(concept=c, errorRate=r) for c, r in updated_concepts.items()]
        final_concepts.sort(key=lambda x: x.errorRate, reverse=True)

        # 3. Salvează în DB
        data_to_upsert = {
            "id": user_id,
            "weak_concepts": [c.model_dump() for c in final_concepts]
        }
        self.supabase.table("student_profiles").upsert(data_to_upsert).execute()

        # 4. Trimite event
        event_payload = {
            "updatedConcepts": [c.model_dump() for c in final_concepts],
            "source": "evaluator_agent_test_grading"
        }
        self.supabase.table("agent_events").insert({
            "type": "weak_concepts_updated",
            "user_id": user_id,
            "payload": event_payload
        }).execute()
        print(f"[ProfileAgent] Conceptele slabe actualizate pentru {user_id}.")

if __name__ == "__main__":
    agent = ProfileAgent()
    print("Agentul Profil este pregătit!")
