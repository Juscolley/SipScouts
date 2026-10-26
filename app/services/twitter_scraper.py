import asyncio
import logging
import os
from typing import Dict, List, Optional
import requests
from dotenv import load_dotenv
from app.services.discovery import discover_cafes

load_dotenv()
logger = logging.getLogger(__name__)


def _is_configured(val: Optional[str]) -> bool:
    return bool(val and val.strip() and val.strip().lower() != "placeholder")


def _run_sync_twitter_search(keywords: str, lat: float, lon: float) -> List[Dict]:
    """
    Searches X (Twitter) API v2 recent tweets if TWITTER_BEARER_TOKEN is configured.
    Automatically stays on standby if no token or 'placeholder' is set.
    """
    load_dotenv(override=True)
    bearer_token = os.getenv("TWITTER_BEARER_TOKEN", "").strip()
    if not _is_configured(bearer_token) or not keywords.strip():
        # Standby mode when no paid X API key is provided
        return []

    local_spots = discover_cafes(lat, lon, radius_km=10.0)
    if not local_spots:
        return []

    city_hint = next((s.get("city") for s in local_spots if s.get("city")), "")
    url = "https://api.twitter.com/2/tweets/search/recent"
    headers = {"Authorization": f"Bearer {bearer_token}"}
    params = {
        "query": f'"{keywords}" {city_hint} (cafe OR coffee OR bar OR cocktail) -is:retweet',
        "max_results": 20,
    }

    try:
        resp = requests.get(url, headers=headers, params=params, timeout=8)
        if resp.status_code != 200:
            return []
        data = resp.json()
        tweet_blob = " ".join(t.get("text", "") for t in data.get("data", [])).lower()
        if not tweet_blob:
            return []

        results: List[Dict] = []
        for spot in local_spots:
            name = spot.get("name", "")
            if name and len(name) >= 4 and name.lower() in tweet_blob:
                results.append(
                    {
                        "id": f"twitter-{name}-{spot['latitude']:.4f}",
                        "name": name,
                        "address": spot.get("address") or spot.get("city") or "Nearby",
                        "latitude": float(spot["latitude"]),
                        "longitude": float(spot["longitude"]),
                        "type": spot.get("type", "cafe"),
                        "tags": ["X / Twitter Mention", keywords],
                        "source": "twitter",
                    }
                )
        return results[:10]
    except Exception as e:
        logger.warning(f"Twitter scraper error: {e}")
        return []


async def search_cafes(keywords: str, lat: float, lon: float) -> List[Dict]:
    """Asynchronously runs the X/Twitter v2 scraper (or instant standby if unconfigured)."""
    return await asyncio.to_thread(_run_sync_twitter_search, keywords, lat, lon)
