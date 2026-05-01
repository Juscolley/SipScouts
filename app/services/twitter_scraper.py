import asyncio
from typing import List, Dict

async def search_cafes(keywords: str, lat: float, lon: float) -> List[Dict]:
    """Placeholder Twitter scraper.
    In production this would use Twitter API v2 (Bearer Token) to search recent tweets for the keywords.
    Returns a list of dicts with at least: name, address, latitude, longitude, source='twitter'.
    """
    await asyncio.sleep(0)
    return []
