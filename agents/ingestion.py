"""
Agent 05 - Ingestie (Document Processing)
=========================================
Responsabilități:
1. Descarcă fișierul PDF din Supabase Storage (sau de la un URL public).
2. Extrage textul folosind pypdf.
3. Folosește RAGRetriever pentru a sparge textul în chunks, a genera embeddings și a le salva în baza de date.
4. Marchează materialul ca 'completed'.
"""

import os
import sys
import io
import requests
import pypdf

sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from config import SUPABASE_URL, SUPABASE_KEY
from supabase import create_client, Client
from agents.rag import RAGRetriever

class IngestionAgent:
    def __init__(self):
        self.supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        self.rag = RAGRetriever()

    def process_pdf_material(self, material_id: str) -> dict:
        """
        Procesează un material existent în baza de date.
        """
        print(f"[IngestionAgent] Se proceseaza materialul {material_id}...")
        
        # 1. Obținem detaliile materialului
        res = self.supabase.table("materials").select("file_url, status").eq("id", material_id).execute()
        if not res.data:
            raise ValueError(f"Materialul {material_id} nu a fost găsit.")
            
        material = res.data[0]
        file_url = material.get("file_url")
        
        if not file_url:
            raise ValueError(f"Materialul {material_id} nu are file_url valid.")
            
        if "mock-url.com" in file_url:
            self.supabase.table("materials").update({"status": "error"}).eq("id", material_id).execute()
            raise ValueError("Frontend-ul a simulat un upload (mock-url.com). Verifică bucket-ul din Supabase (probabil lipsește sau ai probleme de RLS la upload).")
            
        # 2. Descărcăm PDF-ul
        print(f"[IngestionAgent] Se descarca PDF de la: {file_url}")
        response = requests.get(file_url, timeout=10)
        response.raise_for_status()
        
        # 3. Extragem textul
        print(f"[IngestionAgent] Extragere text din PDF...")
        pdf_file = io.BytesIO(response.content)
        reader = pypdf.PdfReader(pdf_file)
        
        full_text = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                full_text.append(text)
                
        raw_text = "\n\n".join(full_text)
        
        if not raw_text.strip():
            # Marchează ca eroare
            self.supabase.table("materials").update({"status": "error"}).eq("id", material_id).execute()
            raise ValueError("PDF-ul nu conține text (sau este doar imagine scanată).")
            
        # 4. Chunking & Embeddings (folosind RAGRetriever care are text_splitter + VertexAI)
        print(f"[IngestionAgent] Catre indexare (chunks + embeddings)...")
        # Ne asigurăm că vechile chunkuri sunt șterse dacă re-indexăm
        self.rag.delete_material_chunks(material_id)
        
        # Salvăm
        chunks_indexed = self.rag.index_material(text=raw_text, material_id=material_id)
        
        # 5. Marcăm ca finalizat
        self.supabase.table("materials").update({"status": "completed"}).eq("id", material_id).execute()
        
        print(f"[IngestionAgent] Finalizat cu succes. {chunks_indexed} chunks indexate.")
        return {"material_id": material_id, "chunks_count": chunks_indexed}

if __name__ == "__main__":
    agent = IngestionAgent()
    print("Agentul Ingestie este pregatit!")
