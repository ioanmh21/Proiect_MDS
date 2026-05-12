import unittest
from unittest.mock import MagicMock, patch
from pydantic import ValidationError

from agents.generator import GeneratorAgent, build_prompt
from agents.evaluator import EvaluatorAgent, TestConfig

class TestNewAgents(unittest.TestCase):
    @patch('agents.generator.ChatVertexAI')
    @patch('agents.generator.create_client')
    def test_generator_prompt_and_parsing(self, mock_client, mock_llm):
        agent = GeneratorAgent()
        
        # Test prompt builder
        prompt = build_prompt("Transcript test")
        self.assertIn("Transcript test", prompt)
        self.assertIn("REZUMAT", prompt)
        
        # Mock Supabase
        mock_supabase = MagicMock()
        agent.supabase = mock_supabase
        
        # Mock chunks response
        mock_chunks = MagicMock()
        mock_chunks.data = [{"content": "Acesta este un test"}] * 10
        mock_supabase.table().select().eq().order().execute.return_value = mock_chunks
        
        # Mock LLM response
        mock_llm_instance = MagicMock()
        agent.llm = mock_llm_instance
        
        mock_response = MagicMock()
        mock_response.content = """
        {
          "rezumat": {
            "introducere": "Intro",
            "capitole": [{"titlu": "Cap 1", "continut": "Cont 1"}]
          },
          "notite": ["Notita 1", "Notita 2"],
          "flashcards": [{"termen": "Term 1", "definitie": "Def 1"}],
          "quiz_questions": [{"text": "Q1", "raspuns": "A1", "dificultate": "usor"}],
          "plan_lectie": {
            "durata_min": 50,
            "etape": [{"titlu": "Etapa 1", "descriere": "Desc", "durata_min": 50}]
          }
        }
        """
        mock_llm_instance.invoke.return_value = mock_response
        
        # Mock RPC save
        mock_rpc_res = MagicMock()
        mock_rpc_res.data = {"success": True, "flashcards_count": 1, "quiz_count": 1, "lesson_plan_id": "123"}
        mock_supabase.rpc().execute.return_value = mock_rpc_res
        
        res = agent.generate_all_materials("mat123")
        self.assertEqual(res["flashcards_count"], 1)

    @patch('agents.evaluator.ChatVertexAI')
    @patch('agents.evaluator.create_client')
    def test_evaluator_generation(self, mock_client, mock_llm):
        agent = EvaluatorAgent()
        
        # Mock LLM JSON output
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
        
        # Mock DB
        agent.supabase = MagicMock()
        
        config = TestConfig(
            nrQuestions=1,
            types=["grila"],
            difficulty="usor",
            weakConcepts=["c1"]
        )
        
        test = agent.generate_test("mat123", config)
        self.assertIsNotNone(test)
        self.assertEqual(len(test.questions), 1)
        self.assertEqual(test.questions[0].correct_answer, "A")

if __name__ == '__main__':
    unittest.main()
