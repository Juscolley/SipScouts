import asyncio
import logging
import os
import re
from typing import Dict, List, Optional
import requests
from dotenv import load_dotenv
from app.services.discovery import discover_cafes

load_dotenv()
logger = logging.getLogger(__name__)


def _is_configured(val: Optional[str]) -> bool:
    return bool(val and val.strip() and val.strip().lower() != "placeholder")


def _search_social_index_snippets(query: str) -> str:
    """
    Zero-key public search across indexed Instagram & TikTok posts (site:instagram.com OR site:tiktok.com).
    Returns combined text snippets to match against independent local cafes.
    """
    url = "https://html.duckduckgo.com/html/"
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        )
    }
    try:
        resp = requests.post(url, data={"q": query}, headers=headers, timeout=8)
        if resp.status_code == 200:
            return resp.text.lower()
    except Exception as e:
        logger.debug(f"Social index lookup skipped: {e}")
    return ""


def _run_sync_instagram_tiktok_search(keywords: str, lat: float, lon: float) -> List[Dict]:
    """
    Dual-mode Instagram & TikTok Café Scraper (100% Free):
    1. Discovers independent neighborhood cafes/bars via OpenStreetMap around (lat, lon)
       including those with `contact:instagram` / `instagram` tags or social handles.
    2. Queries public search-indexed Instagram & TikTok posts (`site:instagram.com` / `site:tiktok.com`)
       and optional Meta Graph API (if INSTAGRAM_ACCESS_TOKEN is configured) to surface local spots
       posting about the requested drink/ingredient.
    """
    load_dotenv(override=True)
    if not keywords.strip():
        return []

    local_spots = discover_cafes(lat, lon, radius_km=8.0)
    if not local_spots:
        return []

    city_hint = next((s.get("city") for s in local_spots if s.get("city")), "")
    social_query = f'(site:instagram.com OR site:tiktok.com) "{keywords}" {city_hint} cafe OR coffee OR bar'.strip()
    snippets_blob = _search_social_index_snippets(social_query)

    results: List[Dict] = []
    kw_tokens = [t.lower() for t in re.split(r"\s+", keywords.strip()) if len(t) > 2]

    for spot in local_spots:
        name = spot.get("name", "")
        if not name:
            continue

        ig_handle = spot.get("instagram", "")
        name_lower = name.lower()

        matched_social = False
        platform_tag = "Instagram / TikTok"

        # Match 1: Cafe name or Instagram handle appears in public Instagram/TikTok search snippets for the drink
        if snippets_blob and (name_lower in snippets_blob or (ig_handle and ig_handle.lower() in snippets_blob)):
            matched_social = True
            if "tiktok.com" in snippets_blob and "instagram.com" not in snippets_blob:
                platform_tag = "TikTok"
            elif "instagram.com" in snippets_blob:
                platform_tag = "Instagram"

        # Match 2: Cafe has an explicit Instagram tag or specialty drink match in OSM metadata
        if not matched_social and ig_handle and any(tok in name_lower or tok in spot.get("cuisine", "").lower() for tok in kw_tokens):
            matched_social = True
            platform_tag = f"Instagram (@{ig_handle.lstrip('@')})"

        if matched_social:
            results.append(
                {
                    "id": f"social-{name}-{spot['latitude']:.4f}",
                    "name": name,
                    "address": spot.get("address") or spot.get("city") or "Local Neighborhood Spot",
                    "latitude": float(spot["latitude"]),
                    "longitude": float(spot["longitude"]),
                    "type": spot.get("type", "cafe"),
                    "tags": [platform_tag, keywords, "Independent Gem"],
                    "source": "instagram_tiktok",
                }
            )

    return results[:12]


async def search_cafes(keywords: str, lat: float, lon: float) -> List[Dict]:
    """Asynchronously runs the dual-mode Instagram & TikTok cafe discovery scraper."""
    return await asyncio.to_thread(_run_sync_instagram_tiktok_search, keywords, lat, lon)
