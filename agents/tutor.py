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



from langchain_google_genai import ChatGoogleGenerativeAI as ChatVertexAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.output_parsers import StrOutputParser
from pydantic import BaseModel
from typing import Optional

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from config import GCP_PROJECT_ID, GCP_LOCATION, MODEL_FAST
from agents.rag import RAGRetriever


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
2. Dacă informația nu se regăsește în material sau rezultatele sunt irelevante, spune clar acest lucru și roagă studentul să reformuleze întrebarea sau să ofere mai multe detalii (ex: "Nu găsesc această informație în contextul curent. Te poți referi la o secțiune specifică sau poți reformula întrebarea?").
3. Folosește exemple concrete și analogii când explici concepte complexe.
4. Încurajează studentul și construiește încrederea în el.
5. La finalul fiecărui răspuns, pune o întrebare de verificare a înțelegerii.
6. Folosește sintaxa LaTeX pentru expresii matematice. Formulele inline trebuie puse strict între `$` (ex: `$E=mc^2$`), iar formulele bloc trebuie puse între `$$` pe linii separate. EVITĂ complet utilizarea formatului `\\(` și `\\[` pentru formule, folosește DOAR `$` și `$$`.

Răspunde în aceeași limbă în care îți scrie studentul.
"""


# ─────────────────────────────────────────────
# Schema pentru inputul agentului (Pydantic)
# ─────────────────────────────────────────────
class TutorInput(BaseModel):
    student_question: str
    material_id: str = ""              # UUID-ul materialului din Supabase
    use_rag: bool = True               # Dacă se face retrieval din Supabase
    material_context: str = ""         # Context manual (fallback dacă RAG e dezactivat)
    student_name: str = "Student"
    student_level: str = "necunoscut"
    weak_points: str = "necunoscute"
    conversation_history: list = []


class TutorOutput(BaseModel):
    response: str
    agent: str = "01_tutor"
    rag_chunks_used: int = 0           # Câte chunk-uri RAG au fost folosite


# ─────────────────────────────────────────────
# Clasa principală a agentului Tutor
# ─────────────────────────────────────────────
class TutorAgent:
    def __init__(self):
        # Inițializează modelul Gemini Flash prin Vertex AI
        self.llm = ChatVertexAI(
            model=MODEL_FAST,
            project=GCP_PROJECT_ID,
            location=GCP_LOCATION,
            temperature=0.4,
            max_output_tokens=2048,
        )
        self.output_parser = StrOutputParser()
        self.rag = RAGRetriever()  # Retriever pgvector

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
            role = msg.get("role", "").lower()
            if role in ["human", "user"]:
                messages.append(HumanMessage(content=msg["content"]))
            elif role in ["ai", "assistant", "model"]:
                messages.append(AIMessage(content=msg["content"]))

        # Adaugă întrebarea curentă
        messages.append(HumanMessage(content=input_data.student_question))

        return messages

    def _rewrite_query_with_history(self, input_data: TutorInput) -> str:
        """Reformulează întrebarea curentă incluzând contextul din istoric."""
        print(f"[DEBUG Tutor] History primit (sync): {len(input_data.conversation_history)} mesaje")
        if not input_data.conversation_history:
            return input_data.student_question

        # Luăm doar ultimele 4 mesaje pentru a nu consuma prea multe tokenuri
        history_text = "\n".join([f"{'Student' if m.get('role', '').lower() in ['human', 'user'] else 'Tutor'}: {m['content']}" for m in input_data.conversation_history[-4:]])
        
        prompt = f"""Având următorul istoric al conversației, reformulează ultima întrebare a studentului astfel încât să devină o întrebare clară, de sine stătătoare (care include subiectul sau conceptele discutate anterior). Dacă întrebarea este deja completă și nu depinde de istoric, las-o exact așa cum e.
Istoric:
{history_text}
Ultima întrebare: {input_data.student_question}
Returnează DOAR întrebarea reformulată, fără ghilimele sau alte explicații."""
        
        try:
            res = self.llm.invoke([HumanMessage(content=prompt)])
            return res.content.strip()
        except Exception:
            return input_data.student_question

    async def _arewrite_query_with_history(self, input_data: TutorInput) -> str:
        """Versiunea async pentru reformularea întrebării."""
        print(f"[DEBUG Tutor] History primit (async): {len(input_data.conversation_history)} mesaje")
        if not input_data.conversation_history:
            return input_data.student_question

        history_text = "\n".join([f"{'Student' if m.get('role', '').lower() in ['human', 'user'] else 'Tutor'}: {m['content']}" for m in input_data.conversation_history[-4:]])
        prompt = f"""Având următorul istoric al conversației, reformulează ultima întrebare a studentului astfel încât să devină o întrebare clară, de sine stătătoare (care include subiectul sau conceptele discutate anterior). Dacă întrebarea este deja completă și nu depinde de istoric, las-o exact așa cum e.
Istoric:
{history_text}
Ultima întrebare: {input_data.student_question}
Returnează DOAR întrebarea reformulată, fără ghilimele sau alte explicații."""
        try:
            res = await self.llm.ainvoke([HumanMessage(content=prompt)])
            return res.content.strip()
        except Exception:
            return input_data.student_question

    def run(self, input_data: TutorInput) -> TutorOutput:
        """Rulează agentul și returnează răspunsul."""
        rag_chunks = 0

        # RAG: aduce context relevant din Supabase dacă e activat
        if input_data.use_rag and input_data.material_id:
            search_query = self._rewrite_query_with_history(input_data)
            rag_result = self.rag.retrieve(
                query=search_query,
                material_id=input_data.material_id,
            )
            input_data = input_data.model_copy(
                update={"material_context": rag_result.context}
            )
            rag_chunks = rag_result.chunks_found
        elif not input_data.material_context:
            input_data = input_data.model_copy(
                update={"material_context": "Nu a fost furnizat niciun material de curs."}
            )

        messages = self._build_prompt(input_data)
        response = self.llm.invoke(messages)
        answer = self.output_parser.invoke(response)

        return TutorOutput(response=answer, rag_chunks_used=rag_chunks)

    async def arun(self, input_data: TutorInput) -> TutorOutput:
        """Versiunea async (pentru FastAPI / streaming)."""
        rag_chunks = 0

        if input_data.use_rag and input_data.material_id:
            search_query = await self._arewrite_query_with_history(input_data)
            rag_result = self.rag.retrieve(
                query=search_query,
                material_id=input_data.material_id,
            )
            input_data = input_data.model_copy(
                update={"material_context": rag_result.context}
            )
            rag_chunks = rag_result.chunks_found
        elif not input_data.material_context:
            input_data = input_data.model_copy(
                update={"material_context": "Nu a fost furnizat niciun material de curs."}
            )

        messages = self._build_prompt(input_data)
        response = await self.llm.ainvoke(messages)
        answer = self.output_parser.invoke(response)
        return TutorOutput(response=answer, rag_chunks_used=rag_chunks)


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
