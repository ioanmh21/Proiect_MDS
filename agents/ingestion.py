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
import tempfile

sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from config import SUPABASE_URL, SUPABASE_KEY
from supabase import create_client, Client
from agents.rag import RAGRetriever
from transcribe import run_pipeline

class IngestionAgent:
    def __init__(self):
        self.supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        self.rag = RAGRetriever()

    def process_material(self, material_id: str) -> dict:
        """
        Procesează un material (PDF, TXT, Video, Audio) existent în baza de date.
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
            
        # Identificare tip fișier după extensie din URL
        file_ext = os.path.splitext(file_url.split('?')[0])[1].lower()

        # 2. Descărcăm fișierul
        print(f"[IngestionAgent] Se descarca fisierul de la: {file_url} (Extensie detectata: {file_ext})")
        # Timeout mărit pentru posibile fișiere video
        response = requests.get(file_url, timeout=60)
        response.raise_for_status()
        
        page_map = {}
        full_text_parts = []

        # 3. Procesare logică în funcție de tipul fișierului
        if file_ext == '.pdf':
            print(f"[IngestionAgent] Extragere text din PDF...")
            pdf_file = io.BytesIO(response.content)
            reader = pypdf.PdfReader(pdf_file)
            for i, page in enumerate(reader.pages, 1):
                text = page.extract_text()
                if text and text.strip():
                    page_map[i] = text
                    full_text_parts.append(text)
            if not full_text_parts:
                self.supabase.table("materials").update({"status": "error"}).eq("id", material_id).execute()
                raise ValueError("PDF-ul nu contine text (sau este doar imagine scanata).")
                
        elif file_ext == '.txt':
            print(f"[IngestionAgent] Extragere text brut din fisier .txt...")
            text = response.content.decode('utf-8')
            if not text.strip():
                self.supabase.table("materials").update({"status": "error"}).eq("id", material_id).execute()
                raise ValueError("Fisierul TXT este gol.")
            page_map[1] = text
            full_text_parts.append(text)
            
        elif file_ext in ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.mp3', '.wav', '.m4a']:
            print(f"[IngestionAgent] Procesare Video/Audio via Whisper...")
            # Salvăm temporar pe disc pentru că ffmpeg/whisper au nevoie de fisier local
            with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp_file:
                tmp_file.write(response.content)
                tmp_file_path = tmp_file.name
            
            try:
                # Apelăm scriptul tău de transcriere
                transcribe_result = run_pipeline(source=tmp_file_path, model_name="base")
                transcript = transcribe_result.get("transcript", "")
                
                if not transcript.strip():
                    self.supabase.table("materials").update({"status": "error"}).eq("id", material_id).execute()
                    raise ValueError("Whisper nu a detectat niciun discurs valid in fisierul media.")
                    
                page_map[1] = transcript
                full_text_parts.append(transcript)
            finally:
                # Curățăm fișierul temporar după procesare
                if os.path.exists(tmp_file_path):
                    os.remove(tmp_file_path)
        else:
            self.supabase.table("materials").update({"status": "error"}).eq("id", material_id).execute()
            raise ValueError(f"Extensie de fisier nesuportata: {file_ext}")
            
        # 4. Chunking & Embeddings cu asociere pagină-chunk
        print(f"[IngestionAgent] Catre indexare (chunks + embeddings)...")
        # Ne asigurăm că vechile chunkuri sunt șterse dacă re-indexăm
        self.rag.delete_material_chunks(material_id)
        
        # Indexăm cu page_map pentru a asocia fiecare chunk cu pagina sursă
        chunks_indexed = self.rag.index_material(
            text="\n\n".join(full_text_parts),
            material_id=material_id,
            page_map=page_map,
        )
        
        # 5. Marcăm ca finalizat
        self.supabase.table("materials").update({"status": "completed"}).eq("id", material_id).execute()
        
        print(f"[IngestionAgent] Finalizat cu succes. {chunks_indexed} chunks indexate.")
        return {"material_id": material_id, "chunks_count": chunks_indexed}

if __name__ == "__main__":
    agent = IngestionAgent()
    print("Agentul Ingestie este pregatit!")
