import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from agents.rag import RAGRetriever

rag = RAGRetriever()
print("Retrieving with None...")
result = rag.retrieve(query="test", material_id=None)
print("Chunks found:", result.chunks_found)
