"""
Teste pentru agentul Moderare (Agent 02).
Folosește mock-uri pentru a evita apeluri reale la Vertex AI.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest
from unittest.mock import MagicMock, patch
from langchain_core.messages import AIMessage

from agents.moderare import ModerareInput, ModerareOutput


# ─────────────────────────────────────────────
# TESTE PENTRU ModerareInput (validare date)
# ─────────────────────────────────────────────

class TestModerareInput:
    def test_input_text_simplu(self):
        """Verifică că inputul se creează corect."""
        input_data = ModerareInput(text="Salut, cum mă pot înscrie la curs?")
        assert input_data.text == "Salut, cum mă pot înscrie la curs?"


# ─────────────────────────────────────────────
# TESTE PENTRU ModerareAgent (cu mock LLM)
# ─────────────────────────────────────────────

class TestModerareAgent:
    @patch("agents.moderare.ChatVertexAI")
    def test_text_safe_returneaza_is_safe_true(self, MockChatVertexAI):
        """Verifică că un text sigur este detectat corect."""
        mock_llm_instance = MagicMock()
        mock_llm_instance.invoke.return_value = AIMessage(content="SAFE")
        MockChatVertexAI.return_value = mock_llm_instance

        from agents.moderare import ModerareAgent
        agent = ModerareAgent()
        result = agent.run(ModerareInput(text="Cum funcționează un arbore binar?"))

        assert isinstance(result, ModerareOutput)
        assert result.is_safe is True
        assert result.reason == ""

    @patch("agents.moderare.ChatVertexAI")
    def test_text_unsafe_returneaza_is_safe_false(self, MockChatVertexAI):
        """Verifică că un text nesigur este detectat corect."""
        mock_llm_instance = MagicMock()
        mock_llm_instance.invoke.return_value = AIMessage(content="UNSAFE Conține limbaj ofensator.")
        MockChatVertexAI.return_value = mock_llm_instance

        from agents.moderare import ModerareAgent
        agent = ModerareAgent()
        result = agent.run(ModerareInput(text="Text ofensator..."))

        assert isinstance(result, ModerareOutput)
        assert result.is_safe is False
        assert "ofensator" in result.reason

    @patch("agents.moderare.ChatVertexAI")
    def test_llm_este_apelat_o_singura_data(self, MockChatVertexAI):
        """Verifică că LLM-ul este invocat exact o dată per run()."""
        mock_llm_instance = MagicMock()
        mock_llm_instance.invoke.return_value = AIMessage(content="SAFE")
        MockChatVertexAI.return_value = mock_llm_instance

        from agents.moderare import ModerareAgent
        agent = ModerareAgent()
        agent.run(ModerareInput(text="Test"))

        mock_llm_instance.invoke.assert_called_once()
