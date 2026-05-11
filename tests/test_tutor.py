"""
Teste pentru agentul Tutor (Agent 01).
Folosește mock-uri pentru a evita apeluri reale la Vertex AI.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest
from unittest.mock import MagicMock, patch
from langchain_core.messages import AIMessage


# ─────────────────────────────────────────────
# TESTE PENTRU TutorInput (validare date)
# ─────────────────────────────────────────────

from agents.tutor import TutorInput, TutorOutput


class TestTutorInput:
    def test_input_valori_default(self):
        """Verifică că valorile default sunt setate corect."""
        input_data = TutorInput(student_question="Ce este OOP?")
        assert input_data.material_context == "Nu a fost furnizat niciun material de curs."
        assert input_data.student_name == "Student"
        assert input_data.student_level == "necunoscut"
        assert input_data.conversation_history == []

    def test_input_date_complete(self):
        """Verifică că datele complete se setează corect."""
        input_data = TutorInput(
            student_question="Explică recursivitatea.",
            material_context="Recursivitatea este...",
            student_name="Ana",
            student_level="intermediar",
            weak_points="bucle",
            conversation_history=[{"role": "human", "content": "Salut!"}]
        )
        assert input_data.student_name == "Ana"
        assert len(input_data.conversation_history) == 1


# ─────────────────────────────────────────────
# TESTE PENTRU TutorAgent (cu mock LLM)
# ─────────────────────────────────────────────

class TestTutorAgent:
    @patch("agents.tutor.ChatVertexAI")
    def test_run_returneaza_tutor_output(self, MockChatVertexAI):
        """Verifică că run() returnează un TutorOutput valid."""
        # Configurăm mock-ul LLM să returneze un răspuns
        mock_llm_instance = MagicMock()
        mock_llm_instance.invoke.return_value = AIMessage(content="Recursivitatea este o funcție care se apelează pe ea însăși.")
        MockChatVertexAI.return_value = mock_llm_instance

        from agents.tutor import TutorAgent
        agent = TutorAgent()

        input_data = TutorInput(
            student_question="Ce este recursivitatea?",
            material_context="Curs: Algoritmi. Recursivitatea este..."
        )
        result = agent.run(input_data)

        assert isinstance(result, TutorOutput)
        assert result.agent == "01_tutor"
        assert isinstance(result.response, str)
        assert len(result.response) > 0

    @patch("agents.tutor.ChatVertexAI")
    def test_build_prompt_include_istoricul(self, MockChatVertexAI):
        """Verifică că istoricul conversației este inclus în mesaje."""
        from langchain_core.messages import HumanMessage, AIMessage
        MockChatVertexAI.return_value = MagicMock()

        from agents.tutor import TutorAgent
        agent = TutorAgent()

        input_data = TutorInput(
            student_question="Dar exemplul cu factorial?",
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

    @patch("agents.tutor.ChatVertexAI")
    def test_llm_este_apelat_o_singura_data(self, MockChatVertexAI):
        """Verifică că LLM-ul este invocat exact o dată per run()."""
        mock_llm_instance = MagicMock()
        mock_llm_instance.invoke.return_value = AIMessage(content="Răspuns test.")
        MockChatVertexAI.return_value = mock_llm_instance

        from agents.tutor import TutorAgent
        agent = TutorAgent()
        agent.run(TutorInput(student_question="Test?"))

        mock_llm_instance.invoke.assert_called_once()
