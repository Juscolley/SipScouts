import asyncio
from typing import List, Dict

async def search_cafes(keywords: str, lat: float, lon: float) -> List[Dict]:
    """Placeholder Reddit scraper.
    In production this would use PRAW to search submissions/comments for the given keywords.
    Returns a list of dicts with at least: name, address, latitude, longitude, source='reddit'.
    """
    # TODO: implement real Reddit search using praw with credentials from .env
    await asyncio.sleep(0)  # simulate async
    return []
