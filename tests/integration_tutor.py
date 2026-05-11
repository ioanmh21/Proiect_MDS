"""
Test end-to-end: Tutor + RAG cu Supabase real + Gemini Flash.
Necesită: .env configurat, gcloud auth, supabase_setup.sql rulat,
          și integration_rag.py rulat înainte (să existe date în chunks).

Rulează cu: venv\Scripts\python.exe tests\integration_tutor.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from agents.tutor import TutorAgent, TutorInput

# ÎNLOCUIEȘTE cu un material_id real care are chunks indexate
MATERIAL_ID = "INLOCUIESTE-CU-UN-UUID-REAL"

if MATERIAL_ID == "INLOCUIESTE-CU-UN-UUID-REAL":
    print("❌ Înlocuiește MATERIAL_ID cu un UUID real din tabelul `materials`!")
    sys.exit(1)

print("=" * 50)
print("TEST END-TO-END: Tutor + RAG")
print("=" * 50)

agent = TutorAgent()

test_input = TutorInput(
    student_question="Ce este recursivitatea și care sunt dezavantajele ei?",
    material_id=MATERIAL_ID,
    use_rag=True,
    student_name="Test Student",
    student_level="începător",
    weak_points="funcții recursive",
)

print(f"\n❓ Întrebare: {test_input.student_question}")
print(f"📚 Material ID: {test_input.material_id}")
print("\n⏳ Se procesează...\n")

result = agent.run(test_input)

print(f"📦 Chunk-uri RAG folosite: {result.rag_chunks_used}")
print(f"🤖 Agent: {result.agent}")
print(f"\n💬 Răspuns Tutor:\n{'-'*40}")
print(result.response)
print("-" * 40)

if result.rag_chunks_used == 0:
    print("\n⚠️  ATENȚIE: Nu s-au găsit chunk-uri RAG. Verifică că:")
    print("   1. supabase_setup.sql a fost rulat în Supabase")
    print("   2. integration_rag.py a fost rulat pentru a indexa date")
    print("   3. MATERIAL_ID corespunde unui material cu chunks existente")
else:
    print(f"\n✅ RAG funcționează! S-au folosit {result.rag_chunks_used} chunk-uri din Supabase.")
