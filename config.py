"""
Configurare centralizată pentru toți agenții LearnFlow.
Setează variabilele în fișierul .env din rădăcina proiectului.
"""
import os
from dotenv import load_dotenv

load_dotenv()

# Google Cloud / Vertex AI / GenAI
GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID", "proiectmds-495617")
GCP_LOCATION = os.getenv("GCP_LOCATION", "us-central1")

# Asigurăm compatibilitatea API Key pentru noul SDK (langchain-google-genai)
if "GOOGLE_AI_API_KEY" in os.environ and "GOOGLE_API_KEY" not in os.environ:
    os.environ["GOOGLE_API_KEY"] = os.environ["GOOGLE_AI_API_KEY"]

# Modele disponibile
MODEL_FAST = "gemini-2.5-flash"      # Agent Tutor, Moderare, Personalizare (rapid, ieftin)
MODEL_PRO = "gemini-2.5-pro"         # Agent Analist (raționament complex)

# Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
