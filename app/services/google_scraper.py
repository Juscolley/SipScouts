import asyncio
import logging
import os
from typing import Dict, List, Optional
import requests
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)


def _is_configured(val: Optional[str]) -> bool:
    return bool(val and val.strip() and val.strip().lower() != "placeholder")


def _search_places_new(api_key: str, query: str, lat: float, lon: float, radius_m: float = 10000.0) -> List[Dict]:
    """Queries Google Places API (New) Text Search endpoint."""
    url = "https://places.googleapis.com/v1/places:searchText"
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": (
            "places.id,places.displayName,places.formattedAddress,"
            "places.location,places.types,places.rating,places.primaryType"
        ),
    }
    payload = {
        "textQuery": query,
        "locationBias": {
            "circle": {
                "center": {"latitude": lat, "longitude": lon},
                "radius": min(radius_m, 50000.0),
            }
        },
        "maxResultCount": 15,
    }
    resp = requests.post(url, json=payload, headers=headers, timeout=10)
    if resp.status_code != 200:
        raise RuntimeError(f"Places API (New) returned {resp.status_code}: {resp.text[:200]}")

    data = resp.json()
    results: List[Dict] = []
    for place in data.get("places", []):
        loc = place.get("location", {})
        p_lat = loc.get("latitude")
        p_lon = loc.get("longitude")
        name = place.get("displayName", {}).get("text")
        if not (name and p_lat is not None and p_lon is not None):
            continue

        types = place.get("types", []) or []
        venue_type = "bar" if any(t in types for t in ("bar", "night_club", "pub", "wine_bar")) else "cafe"
        tags = ["Google Places"]
        if place.get("rating"):
            tags.append(f"★ {place['rating']}")

        results.append(
            {
                "id": f"google-{place.get('id', name)}",
                "name": name,
                "address": place.get("formattedAddress", "Nearby"),
                "latitude": float(p_lat),
                "longitude": float(p_lon),
                "type": venue_type,
                "tags": tags,
                "source": "google",
            }
        )
    return results


def _search_places_legacy(api_key: str, query: str, lat: float, lon: float, radius_m: int = 10000) -> List[Dict]:
    """Fallback to legacy Google Places Text Search API if the user enabled the classic Places API."""
    url = "https://maps.googleapis.com/maps/api/place/textsearch/json"
    params = {
        "query": query,
        "location": f"{lat},{lon}",
        "radius": radius_m,
        "key": api_key,
    }
    resp = requests.get(url, params=params, timeout=10)
    resp.raise_for_status()
    data = resp.json()

    results: List[Dict] = []
    for place in data.get("results", [])[:15]:
        loc = place.get("geometry", {}).get("location", {})
        p_lat = loc.get("lat")
        p_lon = loc.get("lng")
        name = place.get("name")
        if not (name and p_lat is not None and p_lon is not None):
            continue

        types = place.get("types", []) or []
        venue_type = "bar" if any(t in types for t in ("bar", "night_club")) else "cafe"
        tags = ["Google Places"]
        if place.get("rating"):
            tags.append(f"★ {place['rating']}")

        results.append(
            {
                "id": f"google-{place.get('place_id', name)}",
                "name": name,
                "address": place.get("formatted_address", "Nearby"),
                "latitude": float(p_lat),
                "longitude": float(p_lon),
                "type": venue_type,
                "tags": tags,
                "source": "google",
            }
        )
    return results


def _run_sync_google_search(keywords: str, lat: float, lon: float) -> List[Dict]:
    load_dotenv(override=True)
    api_key = os.getenv("GOOGLE_PLACES_API_KEY", "").strip()
    if not _is_configured(api_key):
        return []

    search_query = f"{keywords} cafe OR coffee OR cocktail bar".strip()
    try:
        results = _search_places_new(api_key, search_query, lat, lon)
        if results:
            return results
    except Exception as e:
        logger.info(f"Places API (New) fallback to legacy Text Search: {e}")

    try:
        return _search_places_legacy(api_key, search_query, lat, lon)
    except Exception as e:
        logger.warning(f"Google Places scraper error: {e}")
        return []


async def search_cafes(keywords: str, lat: float, lon: float) -> List[Dict]:
    """Asynchronously searches Google Places API (New + Legacy fallback) for cafes & bars."""
    return await asyncio.to_thread(_run_sync_google_search, keywords, lat, lon)
