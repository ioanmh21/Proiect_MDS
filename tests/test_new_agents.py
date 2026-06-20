"""
Teste pentru Generator (Agent 04) și Evaluator (Agent 03).
Folosește mock-uri pentru a evita apeluri reale la Vertex AI / Supabase.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import json
import unittest
from unittest.mock import MagicMock, patch

from agents.generator import GeneratorAgent, build_analysis_prompt, build_generation_prompt
from agents.evaluator import EvaluatorAgent, TestConfig


class TestNewAgents(unittest.TestCase):

    # ─────────────────────────────────────────────
    # TESTE PENTRU GeneratorAgent
    # ─────────────────────────────────────────────

    @patch('agents.generator.ChatVertexAI')
    @patch('agents.generator.create_client')
    def test_generator_prompt_and_parsing(self, mock_client, mock_llm):
        """Verifică că GeneratorAgent construiește prompt corect și parsează răspunsul LLM."""
        agent = GeneratorAgent()

        # Test build_analysis_prompt include transcriptul
        prompt = build_analysis_prompt("Transcript test despre recursivitate")
        self.assertIn("Transcript test despre recursivitate", prompt)
        self.assertIn("flashcards_count", prompt)  # trebuie să ceară planul

        # Test build_generation_prompt include cuvântul REZUMAT în structura JSON cerută
        gen_prompt = build_generation_prompt("Transcript test", {"flashcards_count": 5})
        self.assertIn("Transcript test", gen_prompt)
        self.assertIn("rezumat", gen_prompt)

        # Mock Supabase — returnează chunks
        mock_supabase = MagicMock()
        agent.supabase = mock_supabase

        mock_chunks_res = MagicMock()
        mock_chunks_res.data = [{"content": "Acesta este un test"}] * 10
        mock_supabase.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value = mock_chunks_res

        # Mock LLM — doi pași: analiza + generare
        mock_llm_instance = MagicMock()
        agent.llm = mock_llm_instance

        # Pas 1: răspuns analiză (plan)
        mock_analysis_response = MagicMock()
        mock_analysis_response.content = json.dumps({"flashcards_count": 1})

        # Pas 2: răspuns generare materiale
        mock_gen_response = MagicMock()
        mock_gen_response.content = json.dumps({
            "rezumat": {
                "introducere": "Intro test",
                "capitole": [{"titlu": "Cap 1", "continut": "Continut 1"}]
            },
            "notite": ["Notita 1", "Notita 2"],
            "flashcards": [{"termen": "Term 1", "definitie": "Def 1"}],
            "plan_lectie": {
                "durata_min": 50,
                "etape": [{"titlu": "Etapa 1", "descriere": "Desc", "durata_min": 50}]
            }
        })

        # invoke este apelat de două ori: analiza + generare
        mock_llm_instance.invoke.side_effect = [mock_analysis_response, mock_gen_response]

        # Mock RPC save_generated_materials
        mock_rpc_res = MagicMock()
        mock_rpc_res.data = {"success": True, "flashcards_count": 1, "quiz_count": 1, "lesson_plan_id": "123"}
        mock_supabase.rpc.return_value.execute.return_value = mock_rpc_res

        res = agent.generate_all_materials("mat123")
        self.assertEqual(res["flashcards_count"], 1)

        # LLM trebuie apelat exact de 2 ori (analiza + generare)
        self.assertEqual(mock_llm_instance.invoke.call_count, 2)

        # Supabase RPC trebuie apelat cu save_generated_materials
        mock_supabase.rpc.assert_called_once_with(
            "save_generated_materials",
            unittest.mock.ANY
        )

    @patch('agents.generator.ChatVertexAI')
    @patch('agents.generator.create_client')
    def test_generator_ridica_eroare_fara_chunks(self, mock_client, mock_llm):
        """Verifică că GeneratorAgent aruncă ValueError dacă materialul nu are chunk-uri."""
        agent = GeneratorAgent()

        mock_supabase = MagicMock()
        agent.supabase = mock_supabase

        # Supabase returnează listă goală
        mock_empty = MagicMock()
        mock_empty.data = []
        mock_supabase.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value = mock_empty

        with self.assertRaises(ValueError) as ctx:
            agent.generate_all_materials("mat_fara_chunks")

        self.assertIn("nu are chunk-uri", str(ctx.exception))

    # ─────────────────────────────────────────────
    # TESTE PENTRU EvaluatorAgent
    # ─────────────────────────────────────────────

    @patch('agents.evaluator.ChatVertexAI')
    @patch('agents.evaluator.create_client')
    def test_evaluator_generation(self, mock_client, mock_llm):
        """Verifică că EvaluatorAgent generează un test valid și parsează JSON-ul LLM-ului."""
        agent = EvaluatorAgent()

        # Mock LLM JSON output (cu spații extra — simulează răspuns real Gemini)
        mock_llm_instance = MagicMock()
        agent.llm = mock_llm_instance
        mock_response = MagicMock()
        mock_response.content = """
        {
          "questions": [
            {
              "id": "q1",
              "text": "Intrebare?",
              "type": "grila",
              "options": ["A", "B"],
              "correct_answer": "A",
              "explanation": "Expl",
              "difficulty": "usor",
              "concept": "concept1"
            }
          ]
        }
        """
        mock_llm_instance.invoke.return_value = mock_response

        # Mock Supabase (pentru salvarea testului)
        mock_supabase = MagicMock()
        agent.supabase = mock_supabase

        config = TestConfig(
            nrQuestions=1,
            types=["grila"],
            difficulty="usor",
            weakConcepts=["c1"]
        )

        test = agent.generate_test("mat123", config)

        # Eval: parsarea produce un obiect valid
        self.assertIsNotNone(test)               # Nu s-a returnat None
        self.assertEqual(len(test.questions), 1) # Exact o întrebare parsată
        self.assertEqual(test.questions[0].correct_answer, "A")  # Valoarea corectă extrasă

    @patch('agents.evaluator.ChatVertexAI')
    @patch('agents.evaluator.create_client')
    def test_evaluator_json_cu_markdown_blocks(self, mock_client, mock_llm):
        """Eval: Agentul gestionează JSON învelit în blocuri markdown (```json ... ```)."""
        agent = EvaluatorAgent()

        mock_llm_instance = MagicMock()
        agent.llm = mock_llm_instance

        # Simulează răspuns LLM cu bloc markdown (comportament comun Gemini)
        mock_response = MagicMock()
        mock_response.content = """```json
{
  "questions": [
    {
      "id": "q2",
      "text": "Ce este OOP?",
      "type": "grila",
      "options": ["Programare orientata obiect", "Altceva"],
      "correct_answer": "Programare orientata obiect",
      "explanation": "OOP inseamna Object-Oriented Programming.",
      "difficulty": "usor",
      "concept": "OOP"
    }
  ]
}
```"""
        mock_llm_instance.invoke.return_value = mock_response
        agent.supabase = MagicMock()

        config = TestConfig(nrQuestions=1, types=["grila"], difficulty="usor", weakConcepts=["OOP"])
        test = agent.generate_test("mat_oop", config)

        # Blocul markdown trebuie eliminat și JSON-ul parsat corect
        self.assertIsNotNone(test)
        self.assertEqual(test.questions[0].concept, "OOP")

    @patch('agents.evaluator.ChatVertexAI')
    @patch('agents.evaluator.create_client')
    def test_evaluator_returneaza_none_la_json_invalid(self, mock_client, mock_llm):
        """Verifică că generate_test() returnează None dacă LLM-ul dă JSON invalid la toate retry-urile."""
        agent = EvaluatorAgent()

        mock_llm_instance = MagicMock()
        agent.llm = mock_llm_instance

        # Toate cele 3 răspunsuri sunt invalide
        mock_response = MagicMock()
        mock_response.content = "Nu știu să generez JSON azi."
        mock_llm_instance.invoke.return_value = mock_response
        agent.supabase = MagicMock()

        config = TestConfig(nrQuestions=1, types=["grila"], difficulty="usor", weakConcepts=["x"])
        result = agent.generate_test("mat_invalid", config)

        self.assertIsNone(result)  # Toate retry-urile au eșuat


if __name__ == '__main__':
    unittest.main()
