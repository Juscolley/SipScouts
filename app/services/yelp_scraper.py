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


def _search_yelp_public_index(keywords: str, lat: float, lon: float) -> List[Dict]:
    """
    Zero-key free fallback that searches public indexed Yelp business pages (site:yelp.com)
    for the drink/ingredient and cross-references local cafes & bars.
    """
    if not keywords.strip():
        return []

    local_spots = discover_cafes(lat, lon, radius_km=10.0)
    if not local_spots:
        return []

    city_hint = next((s.get("city") for s in local_spots if s.get("city")), "")
    query = f'site:yelp.com "{keywords}" {city_hint} cafe OR coffee OR bar'.strip()

    url = "https://html.duckduckgo.com/html/"
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        )
    }

    try:
        resp = requests.post(url, data={"q": query}, headers=headers, timeout=8)
        if resp.status_code != 200:
            return []
        blob = resp.text.lower()

        results: List[Dict] = []
        for spot in local_spots:
            name = spot.get("name", "")
            if name and len(name) >= 4 and name.lower() in blob:
                results.append(
                    {
                        "id": f"yelp-web-{name}-{spot['latitude']:.4f}",
                        "name": name,
                        "address": spot.get("address") or spot.get("city") or "Nearby",
                        "latitude": float(spot["latitude"]),
                        "longitude": float(spot["longitude"]),
                        "type": spot.get("type", "cafe"),
                        "tags": ["Yelp Review Match", keywords],
                        "source": "yelp",
                    }
                )
        return results[:10]
    except Exception as e:
        logger.debug(f"Public Yelp index fallback skipped: {e}")
        return []


def _run_sync_yelp_search(keywords: str, lat: float, lon: float) -> List[Dict]:
    load_dotenv(override=True)
    api_key = os.getenv("YELP_API_KEY", "").strip()
    if not _is_configured(api_key):
        return _search_yelp_public_index(keywords, lat, lon)

    url = "https://api.yelp.com/v3/businesses/search"
    headers = {"Authorization": f"Bearer {api_key}"}
    params = {
        "term": keywords or "specialty coffee cocktails",
        "latitude": lat,
        "longitude": lon,
        "radius": 10000,
        "categories": "coffee,cafes,bars,cocktailbars,tea",
        "limit": 15,
        "sort_by": "best_match",
    }

    try:
        resp = requests.get(url, headers=headers, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        results: List[Dict] = []

        for biz in data.get("businesses", []):
            coords = biz.get("coordinates", {})
            b_lat = coords.get("latitude")
            b_lon = coords.get("longitude")
            name = biz.get("name")
            if not (name and b_lat is not None and b_lon is not None):
                continue

            cats = [c.get("alias", "") for c in biz.get("categories", [])]
            cat_titles = [c.get("title", "") for c in biz.get("categories", []) if c.get("title")]
            venue_type = "bar" if any("bar" in c or "lounge" in c or "pub" in c for c in cats) else "cafe"

            loc_Obj = biz.get("location", {})
            display_addr = ", ".join(loc_Obj.get("display_address", [])) or loc_Obj.get("address1") or "Nearby"

            tags = ["Yelp"]
            if biz.get("rating"):
                tags.append(f"★ {biz['rating']}")
            tags.extend(cat_titles[:2])

            results.append(
                {
                    "id": f"yelp-{biz.get('id', name)}",
                    "name": name,
                    "address": display_addr,
                    "latitude": float(b_lat),
                    "longitude": float(b_lon),
                    "type": venue_type,
                    "tags": tags,
                    "source": "yelp",
                }
            )
        return results
    except Exception as e:
        logger.warning(f"Yelp API error, falling back to public Yelp search: {e}")
        return _search_yelp_public_index(keywords, lat, lon)


async def search_cafes(keywords: str, lat: float, lon: float) -> List[Dict]:
    """Asynchronously queries Yelp (API if configured, or free public Yelp index fallback)."""
    return await asyncio.to_thread(_run_sync_yelp_search, keywords, lat, lon)
