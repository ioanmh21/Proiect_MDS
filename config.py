"""
Configurare centralizată pentru toți agenții LearnFlow.
Setează variabilele în fișierul .env din rădăcina proiectului.
"""
import os
from dotenv import load_dotenv

load_dotenv()

# Google Cloud / Vertex AI
GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID", "your-gcp-project-id")
GCP_LOCATION = os.getenv("GCP_LOCATION", "us-central1")

# Modele disponibile
MODEL_FAST = "gemini-1.5-flash"      # Agent Tutor, Moderare, Personalizare (rapid, ieftin)
MODEL_PRO = "gemini-1.5-pro"         # Agent Analist (raționament complex)

# Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
