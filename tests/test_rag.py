"""
Teste pentru modulul RAG (agents/rag.py).
Folosește mock-uri pentru Supabase și Vertex AI Embeddings.
Schema Supabase: chunks(id, material_id, content, page_number, embedding, created_at)
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest
from unittest.mock import MagicMock, patch

from agents.rag import RAGResult, DocumentChunk

FAKE_MATERIAL_ID = "550e8400-e29b-41d4-a716-446655440000"


# ─────────────────────────────────────────────
# TESTE PENTRU RAGResult
# ─────────────────────────────────────────────

class TestRAGResult:
    def test_result_cu_chunks(self):
        result = RAGResult(context="Conținut relevant.", chunks_found=3)
        assert result.chunks_found == 3
        assert result.context == "Conținut relevant."

    def test_result_gol(self):
        result = RAGResult(context="", chunks_found=0)
        assert result.chunks_found == 0


# ─────────────────────────────────────────────
# TESTE PENTRU RAGRetriever
# ─────────────────────────────────────────────

class TestRAGRetriever:
    @patch("agents.rag.create_client")
    @patch("agents.rag.VertexAIEmbeddings")
    def test_retrieve_gaseste_chunks(self, MockEmbeddings, MockSupabase):
        """Verifică că retrieve() returnează RAGResult corect când Supabase găsește chunks."""
        mock_emb_instance = MagicMock()
        mock_emb_instance.embed_query.return_value = [0.1] * 768
        MockEmbeddings.return_value = mock_emb_instance

        mock_sb = MagicMock()
        mock_sb.rpc.return_value.execute.return_value = MagicMock(data=[
            {"content": "Recursivitatea este...", "page_number": 5, "similarity": 0.92},
            {"content": "Cazul de bază oprește recursivitatea.", "page_number": 6, "similarity": 0.85},
        ])
        MockSupabase.return_value = mock_sb

        from agents.rag import RAGRetriever
        retriever = RAGRetriever()
        result = retriever.retrieve(
            query="Ce este recursivitatea?",
            material_id=FAKE_MATERIAL_ID,
        )

        assert isinstance(result, RAGResult)
        assert result.chunks_found == 2
        assert "Recursivitatea" in result.context
        assert "[Pagina 5]" in result.context
        assert len(result.similarity_scores) == 2
        # Verifică că RPC-ul corect e apelat
        mock_sb.rpc.assert_called_with(
            "match_chunks",
            {
                "query_embedding": [0.1] * 768,
                "match_count": 5,
                "filter_material_id": FAKE_MATERIAL_ID,
                "similarity_threshold": 0.5,
            }
        )

    @patch("agents.rag.create_client")
    @patch("agents.rag.VertexAIEmbeddings")
    def test_retrieve_fara_material_id(self, MockEmbeddings, MockSupabase):
        """Verifică că retrieve() funcționează fără material_id (caută în tot)."""
        mock_emb_instance = MagicMock()
        mock_emb_instance.embed_query.return_value = [0.1] * 768
        MockEmbeddings.return_value = mock_emb_instance

        mock_sb = MagicMock()
        mock_sb.rpc.return_value.execute.return_value = MagicMock(data=[])
        MockSupabase.return_value = mock_sb

        from agents.rag import RAGRetriever
        retriever = RAGRetriever()
        result = retriever.retrieve(query="Test?")  # fără material_id

        assert result.chunks_found == 0
        assert "Nu s-au găsit" in result.context

    @patch("agents.rag.create_client")
    @patch("agents.rag.VertexAIEmbeddings")
    def test_index_material_insereaza_chunks(self, MockEmbeddings, MockSupabase):
        """Verifică că index_material() face split, embed și insert în chunks."""
        mock_emb_instance = MagicMock()
        mock_emb_instance.embed_documents.return_value = [[0.1] * 768, [0.2] * 768]
        MockEmbeddings.return_value = mock_emb_instance

        mock_sb = MagicMock()
        MockSupabase.return_value = mock_sb

        from agents.rag import RAGRetriever
        retriever = RAGRetriever()

        text = "Paragraf 1. " * 100 + "\n\n" + "Paragraf 2. " * 100
        count = retriever.index_material(
            text=text,
            material_id=FAKE_MATERIAL_ID,
            page_number=3,
        )

        assert count > 0
        # Verifică că tabelul `chunks` e folosit (nu document_chunks)
        mock_sb.table.assert_called_with("chunks")
        mock_sb.table.return_value.insert.assert_called_once()

    @patch("agents.rag.create_client")
    @patch("agents.rag.VertexAIEmbeddings")
    def test_delete_material_chunks(self, MockEmbeddings, MockSupabase):
        """Verifică că delete_material_chunks() apelează Supabase cu material_id."""
        MockEmbeddings.return_value = MagicMock()
        mock_sb = MagicMock()
        MockSupabase.return_value = mock_sb

        from agents.rag import RAGRetriever
        retriever = RAGRetriever()
        retriever.delete_material_chunks(FAKE_MATERIAL_ID)

        mock_sb.table.return_value.delete.return_value.eq.assert_called_once_with(
            "material_id", FAKE_MATERIAL_ID
        )
