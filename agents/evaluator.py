"""
Agent 03 - Evaluator
====================
Responsabilități:
1. Generează teste educaționale structurate din materiale.
2. Corectează testele rezolvate de elevi.
3. Generează feedback personalizat și explicativ pentru răspunsurile greșite.
"""

import os
import sys
import json
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from config import GCP_PROJECT_ID, GCP_LOCATION, MODEL_FAST, SUPABASE_URL, SUPABASE_KEY
from langchain_google_vertexai import ChatVertexAI
from langchain_core.messages import SystemMessage, HumanMessage
from supabase import create_client, Client

# ─────────────────────────────────────────────
# Scheme Pydantic
# ─────────────────────────────────────────────

class TestConfig(BaseModel):
    nrQuestions: int
    types: List[str]
    difficulty: str
    weakConcepts: List[str]

class Question(BaseModel):
    id: str
    text: str
    type: str
    options: Optional[List[str]] = None
    correct_answer: Any  # str or list[str]
    explanation: str
    difficulty: str
    concept: str

class GeneratedTest(BaseModel):
    questions: List[Question]

class Answer(BaseModel):
    questionId: str
    answer: Any

class Feedback(BaseModel):
    questionId: str
    isCorrect: bool
    correctAnswer: Any
    userAnswer: Any
    explanation: Optional[str] = None

class GradeResult(BaseModel):
    score: int
    feedback: List[Feedback]
    weakConcepts: List[str]

# ─────────────────────────────────────────────
# Clasa Principală Evaluator
# ─────────────────────────────────────────────

class EvaluatorAgent:
    def __init__(self):
        self.llm = ChatVertexAI(
            model_name=MODEL_FAST,
            project=GCP_PROJECT_ID,
            location=GCP_LOCATION,
            temperature=0.3,
            max_output_tokens=4096,
        )
        self.supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    def generate_test(self, material_id: str, config: TestConfig) -> Optional[GeneratedTest]:
        """
        Generează un test pe baza setărilor și îl salvează în Supabase.
        """
        prompt = f"""
Vei acționa ca un evaluator educațional expert. Generează un test pe baza materialului educațional cu ID: {material_id}.

Cerințe specifice:
- Numărul de întrebări: {config.nrQuestions}
- Tipurile de întrebări permise: {', '.join(config.types)}
- Dificultatea testului: {config.difficulty}
- Focalizează-te pe conceptele slabe: {', '.join(config.weakConcepts)}
- Limba: Testul trebuie să fie EXCLUSIV în limba română.

Returnează DOAR un JSON valid cu următoarea structură, fără nimic altceva (fără block de markdown):
{{
  "questions": [
    {{
      "id": "id-unic",
      "text": "textul întrebării",
      "type": "tipul întrebării",
      "options": ["opțiunea 1", "opțiunea 2"], // obligatoriu doar la grile
      "correct_answer": "răspunsul corect sau listă de răspunsuri",
      "explanation": "explicația detaliată a răspunsului",
      "difficulty": "usor|mediu|greu",
      "concept": "conceptul cheie"
    }}
  ]
}}
"""
        messages = [HumanMessage(content=prompt.strip())]
        
        retries = 0
        max_retries = 2
        
        while retries <= max_retries:
            try:
                response = self.llm.invoke(messages)
                text = response.content.strip()
                
                # Curăță blockurile de markdown
                if text.startswith("```json"):
                    text = text[7:]
                if text.startswith("```"):
                    text = text[3:]
                if text.endswith("```"):
                    text = text[:-3]
                
                parsed_json = json.loads(text.strip())
                
                if "questions" not in parsed_json:
                    raise ValueError("Structura JSON invalidă: lipsește 'questions'.")
                
                # Salvează testul în Supabase
                test_data = {
                    "material_id": material_id,
                    "config": config.model_dump(),
                    "content": parsed_json,
                }
                
                res = self.supabase.table("tests").insert(test_data).execute()
                print(f"[Evaluator] Test generat și salvat cu succes.")
                
                return GeneratedTest(**parsed_json)
                
            except Exception as e:
                print(f"[Evaluator] Încercarea {retries + 1} a eșuat: {e}")
                retries += 1
                messages.append(HumanMessage(content="Răspunsul anterior nu a fost un JSON valid. Te rog dă-mi doar JSON curat."))
        
        return None

    def generate_feedback(self, question: Question, user_answer: str) -> str:
        """
        Generează feedback personalizat și explicativ pentru un răspuns greșit.
        """
        correct_ans = ", ".join(question.correct_answer) if isinstance(question.correct_answer, list) else str(question.correct_answer)
        
        prompt = f"""
Avem următoarea întrebare dintr-un test educațional:
"{question.text}"
Răspunsul corect este: "{correct_ans}"
Elevul a răspuns greșit: "{user_answer}"

Te rog să generezi un feedback educațional constructiv, în limba română, de MAXIM 3 propoziții.
Condiții:
1. Explică DE CE răspunsul elevului este greșit.
2. Explică CE este corect și de ce.
3. Oferă un truc de memorare sau un exemplu scurt.
Fii prietenos!
"""
        try:
            res = self.llm.invoke([HumanMessage(content=prompt.strip())])
            return res.content.strip()
        except Exception as e:
            print(f"[Evaluator] Eroare la generare feedback: {e}")
            return f"Răspunsul este incorect. Răspunsul corect era: {correct_ans}."

    def grade_test(self, test_id: str, user_answers: List[Answer]) -> Optional[GradeResult]:
        """
        Prelucrează testul din DB, corectează răspunsurile și generează feedback,
        apoi salvează în test_results.
        """
        res = self.supabase.table("tests").select("content").eq("id", test_id).execute()
        
        if not res.data:
            print("[Evaluator] Testul nu a fost găsit în baza de date.")
            return None
            
        test_content = res.data[0].get("content")
        questions = [Question(**q) for q in test_content.get("questions", [])]
        
        correct_count = 0
        feedback_list = []
        weak_concepts = set()
        
        for q in questions:
            # Găsește răspunsul elevului
            ua = next((a for a in user_answers if a.questionId == q.id), None)
            user_ans = ua.answer if ua else ""
            
            is_correct = False
            
            # Verifică array vs string (case-insensitive)
            if isinstance(q.correct_answer, list) and isinstance(user_ans, list):
                sorted_c = sorted([str(x).lower().strip() for x in q.correct_answer])
                sorted_u = sorted([str(x).lower().strip() for x in user_ans])
                is_correct = sorted_c == sorted_u
            else:
                is_correct = str(q.correct_answer).lower().strip() == str(user_ans).lower().strip()
                
            fb = Feedback(
                questionId=q.id,
                isCorrect=is_correct,
                correctAnswer=q.correct_answer,
                userAnswer=user_ans
            )
            
            if is_correct:
                correct_count += 1
                fb.explanation = q.explanation
            else:
                if q.concept:
                    weak_concepts.add(q.concept)
                
                ua_str = ", ".join(user_ans) if isinstance(user_ans, list) else str(user_ans)
                fb.explanation = self.generate_feedback(q, ua_str)
                
            feedback_list.append(fb)
            
        score = int((correct_count / len(questions)) * 100) if questions else 0
        
        grade_res = GradeResult(
            score=score,
            feedback=feedback_list,
            weakConcepts=list(weak_concepts)
        )
        
        # Salvează rezultatele
        self.supabase.table("test_results").insert({
            "test_id": test_id,
            "score": score,
            "results_data": grade_res.model_dump(),
        }).execute()
        
        return grade_res

if __name__ == "__main__":
    agent = EvaluatorAgent()
    print("Agentul Evaluator este pregătit!")
