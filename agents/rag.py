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

Optimizări pentru materiale școlare:
  - Chunk-uri mai mari (1200 chars) cu overlap generos (200 chars)
    pentru a păstra contexte complete (definiții, exerciții, demonstrații)
  - Separatori adaptați materialelor academice (titluri, paragrafe, enumerări)
  - Retrieval cu top_k=8 și prag de similaritate coborât la 0.3
    pentru a aduce mai mult context relevant
  - Numerotarea chunk-urilor cu pagina sursă
"""

import os
import sys
import re
from typing import Optional
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from langchain_google_genai import GoogleGenerativeAIEmbeddings as VertexAIEmbeddings
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
# Funcții de pre-procesare text
# ─────────────────────────────────────────────
def clean_text_for_indexing(text: str) -> str:
    """
    Curăță textul extras din PDF pentru o indexare mai bună.
    - Elimină linii goale repetate
    - Normalizează spațiile
    - Păstrează structura (titluri, enumerări, ecuații)
    """
    # Elimină caractere de control (dar păstrează \n și \t)
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', text)
    # Normalizează spațiile multiple pe aceeași linie
    text = re.sub(r'[^\S\n]+', ' ', text)
    # Elimină mai mult de 2 linii goale consecutive
    text = re.sub(r'\n{3,}', '\n\n', text)
    # Elimină spațiile de la începutul și sfârșitul fiecărei linii
    lines = [line.strip() for line in text.split('\n')]
    text = '\n'.join(lines)
    return text.strip()


# ─────────────────────────────────────────────
# RAG Retriever
# ─────────────────────────────────────────────
class RAGRetriever:
    def __init__(self):
        self.embeddings = VertexAIEmbeddings(
            model="models/text-embedding-004",
            project=GCP_PROJECT_ID,
            location=GCP_LOCATION,
        )
        self.supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

        # Text splitter optimizat pentru materiale școlare:
        # - Chunk-uri de 700 caractere → focus semantic mai bun pe cuvinte cheie / definiții
        # - Overlap de 150 caractere → asigură continuitate între chunk-uri
        # - Separatori specifici materialelor academice
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=700,
            chunk_overlap=150,
            separators=[
                "\n\n\n",       # Secțiuni mari (capitole)
                "\n\n",         # Paragrafe
                "\n",           # Linii noi (enumerări, pași de rezolvare)
                ". ",           # Propoziții
                "; ",           # Enumerări cu punct-virgulă
                ", ",           # Clauze
                " ",            # Cuvinte
            ],
        )

    def retrieve(
        self,
        query: str,
        material_id: Optional[str] = None,
        top_k: int = 12,
        similarity_threshold: float = 0.25,
    ) -> RAGResult:
        """
        Caută chunk-urile cele mai relevante pentru o întrebare.

        Args:
            query: Întrebarea studentului
            material_id: UUID-ul materialului din Supabase (optional)
            top_k: Numărul maxim de chunk-uri returnate (default: 8)
            similarity_threshold: Pragul minim de similaritate (default: 0.3)

        Returns:
            RAGResult cu textul concatenat al chunk-urilor relevante
        """
        # 1. Generează embedding pentru întrebare
        query_embedding = self.embeddings.embed_query(query)

        # 2. Caută în Supabase prin funcția de Hybrid Search (Vector + Full Text)
        response = self.supabase.rpc(
            "hybrid_search_chunks",
            {
                "query_text": query,
                "query_embedding": query_embedding,
                "match_count": top_k,
                "filter_material_id": material_id,
            },
        ).execute()

        chunks = response.data or []

        if not chunks:
            return RAGResult(
                context="Nu s-au găsit materiale relevante pentru această întrebare.",
                chunks_found=0,
            )

        # 3. Concatenează chunk-urile în ordinea similarității
        #    cu separator clar și cu informații despre pagină
        context_parts = []
        similarities = []
        for i, chunk in enumerate(chunks, 1):
            page = chunk.get("page_number")
            similarity = chunk.get("similarity", 0)
            prefix = f"[Fragment {i}"
            if page:
                prefix += f", Pagina {page}"
            prefix += f", Relevanță: {similarity:.0%}]"
            context_parts.append(f"{prefix}\n{chunk['content']}")
            similarities.append(round(similarity, 3))

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
        page_map: Optional[dict[int, str]] = None,
    ) -> int:
        """
        Indexează textul unui material: clean → split → embed → store în chunks.

        Args:
            text: Textul extras din material (PDF, etc.)
            material_id: UUID-ul materialului din tabelul `materials`
            page_map: Dicționar {page_number: page_text} pentru a asocia
                      fiecare chunk cu pagina din care provine

        Returns:
            Numărul de chunk-uri indexate
        """
        # 0. Curăță textul
        text = clean_text_for_indexing(text)

        if not text.strip():
            return 0

        # 1. Dacă avem page_map, indexăm pagină cu pagină
        #    pentru a păstra asocierea chunk → pagină
        if page_map:
            return self._index_with_pages(page_map, material_id)

        # 2. Fallback: split simplu (fără pagini)
        text_chunks = self.text_splitter.split_text(text)
        if not text_chunks:
            return 0

        # 3. Generează embeddings (batch pentru eficiență)
        embeddings = self.embeddings.embed_documents(text_chunks)

        # 4. Inserează în tabelul `chunks` existent
        rows = [
            {
                "material_id": material_id,
                "content": chunk,
                "embedding": embedding,
                "page_number": None,
            }
            for chunk, embedding in zip(text_chunks, embeddings)
        ]

        self.supabase.table("chunks").insert(rows).execute()
        return len(rows)

    def _index_with_pages(self, page_map: dict[int, str], material_id: str) -> int:
        """
        Indexează pagină cu pagină, asociind fiecare chunk
        cu numărul paginii din care provine.
        """
        all_rows = []

        for page_num, page_text in sorted(page_map.items()):
            page_text = clean_text_for_indexing(page_text)
            if not page_text.strip():
                continue

            page_chunks = self.text_splitter.split_text(page_text)
            if not page_chunks:
                continue

            page_embeddings = self.embeddings.embed_documents(page_chunks)

            for chunk, embedding in zip(page_chunks, page_embeddings):
                all_rows.append({
                    "material_id": material_id,
                    "content": chunk,
                    "embedding": embedding,
                    "page_number": page_num,
                })

        if all_rows:
            # Insert in batches of 50 to avoid payload too large
            batch_size = 50
            for i in range(0, len(all_rows), batch_size):
                batch = all_rows[i:i + batch_size]
                self.supabase.table("chunks").insert(batch).execute()

        return len(all_rows)

    def delete_material_chunks(self, material_id: str) -> None:
        """Șterge toate chunk-urile unui material (ex: la re-indexare)."""
        self.supabase.table("chunks").delete().eq(
            "material_id", material_id
        ).execute()
