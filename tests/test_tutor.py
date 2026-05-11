"""
Teste pentru agentul Tutor (Agent 01).
Folosește mock-uri pentru a evita apeluri reale la Vertex AI / Supabase.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest
from unittest.mock import MagicMock, patch
from langchain_core.messages import AIMessage, HumanMessage


from agents.tutor import TutorInput, TutorOutput


# ─────────────────────────────────────────────
# TESTE PENTRU TutorInput (validare date)
# ─────────────────────────────────────────────

class TestTutorInput:
    def test_input_valori_default(self):
        """Verifică că valorile default sunt setate corect."""
        input_data = TutorInput(student_question="Ce este OOP?")
        assert input_data.material_context == ""
        assert input_data.use_rag is True
        assert input_data.material_id == ""
        assert input_data.student_name == "Student"
        assert input_data.student_level == "necunoscut"
        assert input_data.conversation_history == []

    def test_input_date_complete(self):
        """Verifică că datele complete se setează corect."""
        input_data = TutorInput(
            student_question="Explică recursivitatea.",
            material_id="550e8400-e29b-41d4-a716-446655440000",
            material_context="Recursivitatea este...",
            student_name="Ana",
            student_level="intermediar",
            weak_points="bucle",
            conversation_history=[{"role": "human", "content": "Salut!"}]
        )
        assert input_data.student_name == "Ana"
        assert input_data.material_id == "550e8400-e29b-41d4-a716-446655440000"
        assert len(input_data.conversation_history) == 1

    def test_input_use_rag_false(self):
        """Verifică că RAG poate fi dezactivat."""
        input_data = TutorInput(
            student_question="Test?",
            use_rag=False,
            material_context="Context manual."
        )
        assert input_data.use_rag is False


# ─────────────────────────────────────────────
# TESTE PENTRU TutorAgent (cu mock LLM + RAG)
# ─────────────────────────────────────────────

class TestTutorAgent:
    @patch("agents.tutor.RAGRetriever")       # mock RAGRetriever (Supabase)
    @patch("agents.tutor.ChatVertexAI")        # mock LLM (Vertex AI)
    def test_run_returneaza_tutor_output(self, MockChatVertexAI, MockRAGRetriever):
        """Verifică că run() returnează un TutorOutput valid (fără RAG)."""
        mock_llm_instance = MagicMock()
        mock_llm_instance.invoke.return_value = AIMessage(content="Recursivitatea este o funcție care se apelează pe ea însăși.")
        MockChatVertexAI.return_value = mock_llm_instance
        MockRAGRetriever.return_value = MagicMock()

        from agents.tutor import TutorAgent
        agent = TutorAgent()

        input_data = TutorInput(
            student_question="Ce este recursivitatea?",
            use_rag=False,
            material_context="Curs: Algoritmi. Recursivitatea este..."
        )
        result = agent.run(input_data)

        assert isinstance(result, TutorOutput)
        assert result.agent == "01_tutor"
        assert isinstance(result.response, str)
        assert len(result.response) > 0

    @patch("agents.tutor.RAGRetriever")
    @patch("agents.tutor.ChatVertexAI")
    def test_run_cu_rag_foloseste_context_din_supabase(self, MockChatVertexAI, MockRAGRetriever):
        """Verifică că RAG este apelat și contextul e injectat când use_rag=True."""
        from agents.rag import RAGResult

        mock_llm_instance = MagicMock()
        mock_llm_instance.invoke.return_value = AIMessage(content="Răspuns bazat pe RAG.")
        MockChatVertexAI.return_value = mock_llm_instance

        mock_rag_instance = MagicMock()
        mock_rag_instance.retrieve.return_value = RAGResult(
            context="Recursivitatea este o funcție care se apelează pe ea însăși.",
            chunks_found=2,
        )
        MockRAGRetriever.return_value = mock_rag_instance

        from agents.tutor import TutorAgent
        agent = TutorAgent()

        result = agent.run(TutorInput(
            student_question="Ce este recursivitatea?",
            material_id="550e8400-e29b-41d4-a716-446655440000",
            use_rag=True,
        ))

        # RAG trebuie să fie apelat
        mock_rag_instance.retrieve.assert_called_once()
        assert result.rag_chunks_used == 2

    @patch("agents.tutor.RAGRetriever")
    @patch("agents.tutor.ChatVertexAI")
    def test_rag_nu_e_apelat_fara_course_id(self, MockChatVertexAI, MockRAGRetriever):
        """Verifică că RAG nu e apelat dacă course_id e gol."""
        mock_llm_instance = MagicMock()
        mock_llm_instance.invoke.return_value = AIMessage(content="Răspuns.")
        MockChatVertexAI.return_value = mock_llm_instance
        mock_rag_instance = MagicMock()
        MockRAGRetriever.return_value = mock_rag_instance

        from agents.tutor import TutorAgent
        agent = TutorAgent()

        result = agent.run(TutorInput(
            student_question="Test?",
            use_rag=True,
            material_id="",     # RAG nu se activează fără material_id
        ))

        mock_rag_instance.retrieve.assert_not_called()
        assert result.rag_chunks_used == 0

    @patch("agents.tutor.RAGRetriever")
    @patch("agents.tutor.ChatVertexAI")
    def test_build_prompt_include_istoricul(self, MockChatVertexAI, MockRAGRetriever):
        """Verifică că istoricul conversației este inclus în mesaje."""
        MockChatVertexAI.return_value = MagicMock()
        MockRAGRetriever.return_value = MagicMock()

        from agents.tutor import TutorAgent
        agent = TutorAgent()

        input_data = TutorInput(
            student_question="Dar exemplul cu factorial?",
            use_rag=False,
            material_context="Context test.",
            conversation_history=[
                {"role": "human", "content": "Ce este recursivitatea?"},
                {"role": "ai", "content": "Recursivitatea este..."}
            ]
        )
        messages = agent._build_prompt(input_data)

        # System message + 2 din istoric + intrebarea curenta = 4 mesaje
        assert len(messages) == 4
        assert isinstance(messages[1], HumanMessage)
        assert isinstance(messages[2], AIMessage)
        assert isinstance(messages[3], HumanMessage)
        assert messages[3].content == "Dar exemplul cu factorial?"

    @patch("agents.tutor.RAGRetriever")
    @patch("agents.tutor.ChatVertexAI")
    def test_llm_este_apelat_o_singura_data(self, MockChatVertexAI, MockRAGRetriever):
        """Verifică că LLM-ul este invocat exact o dată per run()."""
        mock_llm_instance = MagicMock()
        mock_llm_instance.invoke.return_value = AIMessage(content="Răspuns test.")
        MockChatVertexAI.return_value = mock_llm_instance
        MockRAGRetriever.return_value = MagicMock()

        from agents.tutor import TutorAgent
        agent = TutorAgent()
        agent.run(TutorInput(student_question="Test?", use_rag=False))

        mock_llm_instance.invoke.assert_called_once()
