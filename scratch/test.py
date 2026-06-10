import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")

supabase = create_client(url, key)

res = supabase.table("test_results").select("*").limit(1).execute()
print("test_results:", res.data)

try:
    res2 = supabase.table("test_results").select("*, materials(title)").limit(1).execute()
    print("with materials:", res2.data)
except Exception as e:
    print("Error joining materials:", e)
