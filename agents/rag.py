"""
RAG (Retrieval-Augmented Generation) cu Supabase pgvector
=========================================================
Folosește schema existentă din Supabase:
  - chunks(id, material_id, content, page_number, embedding, created_at)
  - materials(id, teacher_id, title, class_name, ...)

Responsabilități:
  1. Generează embeddings pentru întrebări (Vertex AI text-embedding-004)
  2. Caută chunk-uri similare în tabelul `chunks` existent
  3. Indexează chunk-uri noi pentru un material
"""

import os
import sys
from typing import Optional
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from langchain_google_vertexai import VertexAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from supabase import create_client, Client
from pydantic import BaseModel
from config import GCP_PROJECT_ID, GCP_LOCATION, SUPABASE_URL, SUPABASE_KEY


# ─────────────────────────────────────────────
# Schema
# ─────────────────────────────────────────────
class DocumentChunk(BaseModel):
    content: str
    page_number: Optional[int] = None


class RAGResult(BaseModel):
    context: str                      # Textul concatenat al chunk-urilor relevante
    chunks_found: int                 # Câte chunk-uri s-au găsit
    similarity_scores: list[float] = []


# ─────────────────────────────────────────────
# RAG Retriever
# ─────────────────────────────────────────────
class RAGRetriever:
    def __init__(self):
        self.embeddings = VertexAIEmbeddings(
            model="text-embedding-004",
            project=GCP_PROJECT_ID,
            location=GCP_LOCATION,
        )
        self.supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=800,
            chunk_overlap=100,
            separators=["\n\n", "\n", ". ", " "],
        )

    def retrieve(
        self,
        query: str,
        material_id: Optional[str] = None,
        top_k: int = 5,
        similarity_threshold: float = 0.5,
    ) -> RAGResult:
        """
        Caută chunk-urile cele mai relevante pentru o întrebare.

        Args:
            query: Întrebarea studentului
            material_id: UUID-ul materialului din Supabase (optional)
            top_k: Numărul maxim de chunk-uri returnate
            similarity_threshold: Pragul minim de similaritate (0-1)

        Returns:
            RAGResult cu textul concatenat al chunk-urilor relevante
        """
        # 1. Generează embedding pentru întrebare
        query_embedding = self.embeddings.embed_query(query)

        # 2. Caută în Supabase prin funcția RPC match_chunks
        response = self.supabase.rpc(
            "match_chunks",
            {
                "query_embedding": query_embedding,
                "match_count": top_k,
                "filter_material_id": material_id,
                "similarity_threshold": similarity_threshold,
            },
        ).execute()

        chunks = response.data or []

        if not chunks:
            return RAGResult(
                context="Nu s-au găsit materiale relevante pentru această întrebare.",
                chunks_found=0,
            )

        # 3. Concatenează chunk-urile în ordinea similarității
        context_parts = []
        similarities = []
        for chunk in chunks:
            page = chunk.get("page_number")
            prefix = f"[Pagina {page}] " if page else ""
            context_parts.append(f"{prefix}{chunk['content']}")
            similarities.append(round(chunk.get("similarity", 0), 3))

        context = "\n\n---\n\n".join(context_parts)

        return RAGResult(
            context=context,
            chunks_found=len(chunks),
            similarity_scores=similarities,
        )

    def index_material(
        self,
        text: str,
        material_id: str,
        page_number: Optional[int] = None,
    ) -> int:
        """
        Indexează textul unui material: split → embed → store în chunks.

        Args:
            text: Textul extras din material (PDF, etc.)
            material_id: UUID-ul materialului din tabelul `materials`
            page_number: Pagina din care provine textul (optional)

        Returns:
            Numărul de chunk-uri indexate
        """
        # 1. Split în chunk-uri
        text_chunks = self.text_splitter.split_text(text)

        if not text_chunks:
            return 0

        # 2. Generează embeddings (batch pentru eficiență)
        embeddings = self.embeddings.embed_documents(text_chunks)

        # 3. Inserează în tabelul `chunks` existent
        rows = [
            {
                "material_id": material_id,
                "content": chunk,
                "embedding": embedding,
                "page_number": page_number,
            }
            for chunk, embedding in zip(text_chunks, embeddings)
        ]

        self.supabase.table("chunks").insert(rows).execute()

        return len(rows)

    def delete_material_chunks(self, material_id: str) -> None:
        """Șterge toate chunk-urile unui material (ex: la re-indexare)."""
        self.supabase.table("chunks").delete().eq(
            "material_id", material_id
        ).execute()
