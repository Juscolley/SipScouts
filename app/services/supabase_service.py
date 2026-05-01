import os
from typing import Optional
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

_supabase_client: Optional[Client] = None


def get_supabase() -> Client:
    """Returns a cached Supabase client instance."""
    global _supabase_client
    if _supabase_client is None:
        url = os.getenv("SUPABASE_URL", "")
        key = os.getenv("SUPABASE_ANON_KEY", "")
        if not url or not key:
            raise RuntimeError("SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env")
        _supabase_client = create_client(url, key)
    return _supabase_client


def log_search_event(
    drink: str = "",
    ingredient: str = "",
    city: str = "",
    zip_code: str = "",
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    result_count: int = 0,
    user_id: Optional[str] = None,
) -> None:
    """
    Anonymously logs a search event to the Supabase search_events table.
    PII (user_id) is optional – anonymous searches are fully supported.
    """
    try:
        client = get_supabase()
        payload: dict = {
            "drink": drink or None,
            "ingredient": ingredient or None,
            "city": city or None,
            "zip_code": zip_code or None,
            "latitude": latitude,
            "longitude": longitude,
            "result_count": result_count,
            "user_id": user_id,
        }
        # Remove None values to keep payload clean
        payload = {k: v for k, v in payload.items() if v is not None}
        client.table("search_events").insert(payload).execute()
    except Exception as e:
        # Non-fatal – we never want analytics to break discovery
        print(f"[Supabase] Failed to log search event: {e}")

