"""
Agent 01 - Tutor
================
Rolul principal: Ajută studentul să înțeleagă materialul, răspunde la întrebări
și ghidează procesul de învățare pe baza contextului din cursuri.

Flux (din Diagrama 2):
  Elev: Incepe Sesiune
       -> 07. Personalizare (aduce profilul studentului din Supabase)
       -> 01. Tutor (conversatie bazata pe context + profil)
       -> 02. Evaluator (verifica daca raspunsul e corect)
       -> Feedback -> Supabase DB
"""



from langchain_google_vertexai import ChatVertexAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.output_parsers import StrOutputParser
from pydantic import BaseModel
from typing import Optional

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from config import GCP_PROJECT_ID, GCP_LOCATION, MODEL_FAST


# ─────────────────────────────────────────────
# Prompt System - Tutorul are un rol bine definit
# ─────────────────────────────────────────────
TUTOR_SYSTEM_PROMPT = """Ești un tutore AI educațional inteligent și empatic, specializat în predarea materialelor de curs.

## Rolul tău:
- Ajuți studenții să înțeleagă conceptele din cursuri cu răbdare și claritate.
- Răspunzi ÎNTOTDEAUNA bazat pe contextul materialului furnizat.
- Dacă întrebarea nu are legătură cu materialul de curs, redirecționezi politicos.
- Adaptezi stilul explicațiilor la nivelul studentului.

## Context curent al materialului:
{material_context}

## Profilul studentului:
- Nume: {student_name}
- Nivel estimat: {student_level}
- Puncte slabe identificate: {weak_points}

## Reguli importante:
1. Nu inventa informații care nu există în materialul de curs.
2. Dacă nu știi ceva, spune "Această informație nu se regăsește în materialul de curs."
3. Folosește exemple concrete și analogii când explici concepte complexe.
4. Încurajează studentul și construiește încrederea în el.
5. La finalul fiecărui răspuns, pune o întrebare de verificare a înțelegerii.

Răspunde în aceeași limbă în care îți scrie studentul.
"""


# ─────────────────────────────────────────────
# Schema pentru inputul agentului (Pydantic)
# ─────────────────────────────────────────────
class TutorInput(BaseModel):
    student_question: str
    material_context: str = "Nu a fost furnizat niciun material de curs."
    student_name: str = "Student"
    student_level: str = "necunoscut"
    weak_points: str = "necunoscute"
    conversation_history: list = []


class TutorOutput(BaseModel):
    response: str
    agent: str = "01_tutor"


# ─────────────────────────────────────────────
# Clasa principală a agentului Tutor
# ─────────────────────────────────────────────
class TutorAgent:
    def __init__(self):
        # Inițializează modelul Gemini Flash prin Vertex AI
        self.llm = ChatVertexAI(
            model_name=MODEL_FAST,
            project=GCP_PROJECT_ID,
            location=GCP_LOCATION,
            temperature=0.4,       # Puțin creativ, dar consistent
            max_output_tokens=2048,
        )
        self.output_parser = StrOutputParser()

    def _build_prompt(self, input_data: TutorInput) -> list:
        """Construiește lista de mesaje pentru LangChain."""
        # System message cu context injectat
        system_msg = SystemMessage(
            content=TUTOR_SYSTEM_PROMPT.format(
                material_context=input_data.material_context,
                student_name=input_data.student_name,
                student_level=input_data.student_level,
                weak_points=input_data.weak_points,
            )
        )

        messages = [system_msg]

        # Adaugă istoricul conversației (memorie)
        for msg in input_data.conversation_history:
            if msg["role"] == "human":
                messages.append(HumanMessage(content=msg["content"]))
            elif msg["role"] == "ai":
                messages.append(AIMessage(content=msg["content"]))

        # Adaugă întrebarea curentă
        messages.append(HumanMessage(content=input_data.student_question))

        return messages

    def run(self, input_data: TutorInput) -> TutorOutput:
        """Rulează agentul și returnează răspunsul."""
        messages = self._build_prompt(input_data)

        # Trimite la Gemini Flash prin Vertex AI
        response = self.llm.invoke(messages)
        answer = self.output_parser.invoke(response)

        return TutorOutput(response=answer)

    async def arun(self, input_data: TutorInput) -> TutorOutput:
        """Versiunea async (pentru FastAPI / streaming)."""
        messages = self._build_prompt(input_data)
        response = await self.llm.ainvoke(messages)
        answer = self.output_parser.invoke(response)
        return TutorOutput(response=answer)


# ─────────────────────────────────────────────
# Test rapid - rulează direct cu: python agents/tutor.py
# ─────────────────────────────────────────────
if __name__ == "__main__":
    agent = TutorAgent()

    test_input = TutorInput(
        student_question="Poți să-mi explici ce este o funcție recursivă?",
        material_context="""
        Curs: Algoritmi și Structuri de Date
        Capitol 3: Recursivitate
        
        O funcție recursivă este o funcție care se apelează pe ea însăși.
        Orice funcție recursivă trebuie să aibă:
        1. Un caz de bază (baza recurenței) - care oprește recursivitatea.
        2. Un caz recursiv - care se apropie de cazul de bază.
        
        Exemplu clasic: Factorial(n) = n * Factorial(n-1), cu Factorial(0) = 1
        """,
        student_name="Mihai",
        student_level="începător",
        weak_points="înțelegerea bucle și funcțiilor",
        conversation_history=[]
    )

    print("🎓 Agent Tutor (01) - Test\n" + "="*40)
    result = agent.run(test_input)
    print(result.response)
