import os
import glob

agent_files = glob.glob('agents/*.py')

for filepath in agent_files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    
    # 1. Înlocuiri importuri
    content = content.replace(
        "from langchain_google_vertexai import ChatVertexAI",
        "from langchain_google_genai import ChatGoogleGenerativeAI as ChatVertexAI"
    )
    content = content.replace(
        "from langchain_google_vertexai import VertexAIEmbeddings",
        "from langchain_google_genai import GoogleGenerativeAIEmbeddings as VertexAIEmbeddings"
    )
    
    # 2. Înlocuire argumente model_name -> model (dar trebuie să fim atenți la constructorul LLM)
    # Constructorii LLM sunt `ChatVertexAI(`
    # În Python string replace e suficient dacă e specific:
    content = content.replace("model_name=MODEL_FAST,", "model=MODEL_FAST,")
    content = content.replace("model_name=MODEL_PRO,", "model=MODEL_PRO,")
    content = content.replace('model="text-embedding-004"', 'model="models/text-embedding-004"')
    
    # 3. Adăugare instrucțiune LaTeX în alte fișiere unde nu e deja
    latex_instruction = "Folosește sintaxa LaTeX pentru expresii matematice. Formulele inline trebuie puse strict între `$` (ex: `$E=mc^2$`), iar formulele bloc trebuie puse între `$$` pe linii separate. EVITĂ complet utilizarea formatului `\\(` și `\\[` pentru formule, folosește DOAR `$` și `$$`."
    
    if "Ești un evaluator" in content and latex_instruction not in content:
        # evaluator.py
        content = content.replace(
            "Acordă și o scurtă explicație/feedback.",
            f"Acordă și o scurtă explicație/feedback.\n\nRegulă LaTeX: {latex_instruction}"
        )
    
    if "Ești un generator de teste" in content and latex_instruction not in content:
        # generator.py
        content = content.replace(
            "Concentrează-te pe subiectele la care elevul a avut dificultăți",
            f"Concentrează-te pe subiectele la care elevul a avut dificultăți\nRegulă LaTeX: {latex_instruction}"
        )
        
    if "Ești Agentul Analist" in content and latex_instruction not in content:
        # analist.py
        content = content.replace(
            "Încearcă să targetezi cel mai slab concept identificat.",
            f"Încearcă să targetezi cel mai slab concept identificat.\nRegulă LaTeX: {latex_instruction}"
        )

    if original != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Modificat: {filepath}")

print("Terminat.")
