"""
Test de integrare RAG - necesită:
  1. supabase_setup.sql rulat în Supabase
  2. .env configurat cu SUPABASE_URL și SUPABASE_KEY reale
  3. gcloud auth application-default login executat

Rulează cu: venv\Scripts\python.exe tests\integration_rag.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from agents.rag import RAGRetriever

print("=" * 50)
print("TEST INTEGRARE RAG")
print("=" * 50)

retriever = RAGRetriever()

# ─────────────────────────────────────────────
# PASUL 1: Indexează un text de test
# ─────────────────────────────────────────────
print("\n[1] Indexare text de test...")

# IMPORTANT: înlocuiește cu un material_id REAL din tabelul tău `materials`
# Poți obține un ID din Supabase -> Table Editor -> materials -> copiezi un id
MATERIAL_ID = "INLOCUIESTE-CU-UN-UUID-REAL"

if MATERIAL_ID == "INLOCUIESTE-CU-UN-UUID-REAL":
    print("❌ Înlocuiește MATERIAL_ID cu un UUID real din tabelul `materials`!")
    sys.exit(1)

text_test = """
Recursivitatea este o tehnică de programare în care o funcție se apelează pe ea însăși.

Orice funcție recursivă are două componente esențiale:
1. Cazul de bază (baza recurenței) - condiția care oprește recursivitatea
2. Cazul recursiv - apelul funcției cu un argument mai mic/simplu

Exemplu clasic: Factorial
  factorial(0) = 1             <- cazul de bază
  factorial(n) = n * factorial(n-1)  <- cazul recursiv

Avantaje: cod mai curat și mai elegant pentru probleme precum arbori, grafuri.
Dezavantaje: consum mare de memorie (stack overflow pentru recursii adânci).
"""

count = retriever.index_material(
    text=text_test,
    material_id=MATERIAL_ID,
    page_number=1,
)
print(f"✅ Indexate {count} chunk-uri pentru material {MATERIAL_ID}")

# ─────────────────────────────────────────────
# PASUL 2: Caută în materialul indexat
# ─────────────────────────────────────────────
print("\n[2] Căutare semantică...")

queries = [
    "Ce este recursivitatea?",
    "Care sunt dezavantajele recursivității?",
    "Cum funcționează factorial recursiv?",
]

for query in queries:
    result = retriever.retrieve(
        query=query,
        material_id=MATERIAL_ID,
        top_k=2,
    )
    print(f"\n  🔍 Query: '{query}'")
    print(f"  📦 Chunks găsite: {result.chunks_found}")
    if result.chunks_found > 0:
        print(f"  📊 Similaritate: {result.similarity_scores}")
        print(f"  📄 Context (primele 200 caractere):")
        print(f"     {result.context[:200]}...")
    else:
        print(f"  ⚠️  {result.context}")

# ─────────────────────────────────────────────
# PASUL 3: Cleanup (opțional)
# ─────────────────────────────────────────────
print("\n[3] Curățare date de test (optional)...")
raspuns = input("Ștergi chunk-urile de test? (y/N): ").strip().lower()
if raspuns == "y":
    retriever.delete_material_chunks(MATERIAL_ID)
    print("✅ Chunk-urile de test au fost șterse.")
else:
    print("ℹ️  Chunk-urile au rămas în baza de date.")

print("\n✅ Test de integrare completat!")
