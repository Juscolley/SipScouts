import asyncio
from typing import List, Dict

async def search_cafes(keywords: str, lat: float, lon: float) -> List[Dict]:
    """Placeholder Google Places scraper.
    In production this would call the Google Places API with the provided credentials.
    Returns a list of dicts with at least: name, address, latitude, longitude, source='google'.
    """
    await asyncio.sleep(0)
    return []
