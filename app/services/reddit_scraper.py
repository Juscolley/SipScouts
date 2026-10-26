import asyncio
import logging
import os
from typing import Dict, List
import requests
from dotenv import load_dotenv
from app.services.discovery import discover_cafes

load_dotenv()
logger = logging.getLogger(__name__)


def _is_configured(val: str | None) -> bool:
    return bool(val and val.strip() and val.strip().lower() != "placeholder")


def _fetch_reddit_text(keywords: str, city_hint: str) -> str:
    """
    Fetches Reddit discussion text for the drink/ingredient + city.
    Uses PRAW (Official Reddit API) if credentials are set in .env,
    and automatically falls back to Reddit's public JSON search endpoint if not yet configured.
    """
    load_dotenv(override=True)
    client_id = os.getenv("REDDIT_CLIENT_ID", "").strip()
    client_secret = os.getenv("REDDIT_CLIENT_SECRET", "").strip()
    user_agent = os.getenv("REDDIT_USER_AGENT", "SipScoutsBot/1.0").strip()

    query = f"{keywords} {city_hint} cafe OR coffee OR cocktail OR bar".strip()
    collected_text: List[str] = []

    if _is_configured(client_id) and _is_configured(client_secret):
        try:
            import praw

            reddit = praw.Reddit(
                client_id=client_id,
                client_secret=client_secret,
                user_agent=user_agent,
            )
            for submission in reddit.subreddit("all").search(query, sort="relevance", limit=15):
                collected_text.append(f"{submission.title} {submission.selftext}")
            if collected_text:
                return "\n".join(collected_text).lower()
        except Exception as e:
            logger.info(f"PRAW search fallback to public JSON: {e}")

    # Zero-key fallback using public Reddit search JSON
    try:
        url = "https://www.reddit.com/search.json"
        headers = {"User-Agent": user_agent}
        params = {"q": query, "sort": "relevance", "limit": 15}
        resp = requests.get(url, headers=headers, params=params, timeout=8)
        if resp.status_code == 200:
            data = resp.json()
            for child in data.get("data", {}).get("children", []):
                post = child.get("data", {})
                collected_text.append(f"{post.get('title', '')} {post.get('selftext', '')}")
    except Exception as e:
        logger.debug(f"Reddit public search error: {e}")

    return "\n".join(collected_text).lower()


def _run_sync_reddit_search(keywords: str, lat: float, lon: float) -> List[Dict]:
    if not keywords.strip():
        return []

    local_spots = discover_cafes(lat, lon, radius_km=10.0)
    if not local_spots:
        return []

    city_hint = next((s.get("city") for s in local_spots if s.get("city")), "")
    reddit_blob = _fetch_reddit_text(keywords, city_hint)
    if not reddit_blob:
        return []

    results: List[Dict] = []
    for spot in local_spots:
        name = spot.get("name", "")
        if not name or len(name) < 4:
            continue
        if name.lower() in reddit_blob:
            results.append(
                {
                    "id": f"reddit-{name}-{spot['latitude']:.4f}",
                    "name": name,
                    "address": spot.get("address") or spot.get("city") or "Local Gem",
                    "latitude": float(spot["latitude"]),
                    "longitude": float(spot["longitude"]),
                    "type": spot.get("type", "cafe"),
                    "tags": ["Reddit Thread Pick", keywords],
                    "source": "reddit",
                }
            )

    return results[:10]


async def search_cafes(keywords: str, lat: float, lon: float) -> List[Dict]:
    """Asynchronously searches Reddit threads and cross-references local cafes/bars."""
    return await asyncio.to_thread(_run_sync_reddit_search, keywords, lat, lon)
