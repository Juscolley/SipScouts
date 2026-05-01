import asyncio
from typing import List, Dict

async def search_cafes(keywords: str, lat: float, lon: float) -> List[Dict]:
    """Placeholder Yelp scraper.
    In production this would call the Yelp Fusion API with the provided credentials.
    Returns a list of dicts with at least: name, address, latitude, longitude, source='yelp'.
    """
    await asyncio.sleep(0)
    return []
