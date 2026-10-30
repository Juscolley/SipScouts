import asyncio
import logging
import os
from typing import Dict, List, Optional
import requests
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

COCKTAIL_KEYWORDS = (
    "negroni", "mezcal", "martini", "margarita", "spritz", "old fashioned",
    "manhattan", "mojito", "daiquiri", "paloma", "sour", "gimlet", "chartreuse",
    "amaro", "campari", "aperol", "yuzu", "elderflower", "bourbon", "rye",
    "whiskey", "scotch", "gin", "tequila", "rum", "vodka", "sake", "soju",
    "wine", "beer", "cocktail", "speakeasy", "aperitivo", "mocktail", "vermouth",
    "absinthe", "pisco", "caipirinha", "sangria", "mule", "bitters", "bar",
)

TEA_KEYWORDS = (
    "tea", "matcha", "hojicha", "chai", "masala", "oolong", "earl grey",
    "sencha", "jasmine", "chamomile", "hibiscus", "pu-erh", "puerh", "rooibos",
    "boba", "bubble tea", "milk tea", "tisane", "herbal", "yerba mate",
    "london fog", "genmaicha", "gyokuro", "darjeeling", "assam", "white tea",
)


def _is_configured(val: Optional[str]) -> bool:
    return bool(val and val.strip() and val.strip().lower() != "placeholder")


def build_smart_search_query(keywords: str) -> str:
    """Builds a category-aware query supporting specialty coffee, tea houses, and craft cocktail bars."""
    kw = (keywords or "").strip()
    kw_lower = kw.lower()
    if any(w in kw_lower for w in COCKTAIL_KEYWORDS):
        return f"{kw} cocktail bar OR speakeasy OR lounge OR bar".strip()
    if any(w in kw_lower for w in TEA_KEYWORDS):
        return f"{kw} tea house OR matcha bar OR cafe".strip()
    if kw:
        return f"{kw} specialty cafe OR tea house OR cocktail bar".strip()
    return "specialty coffee OR tea house OR cocktail bar"


def _extract_links(website_uri: Optional[str]) -> tuple[Optional[str], Optional[str]]:
    if not website_uri:
        return None, None
    u = website_uri.strip()
    if "instagram.com/" in u.lower():
        return None, u
    return u, None


def _search_places_new(api_key: str, query: str, lat: float, lon: float, radius_m: float = 12000.0) -> List[Dict]:
    """Queries Google Places API (New) Text Search endpoint including phone, open status, and website/social links."""
    url = "https://places.googleapis.com/v1/places:searchText"
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": (
            "places.id,places.displayName,places.formattedAddress,"
            "places.location,places.types,places.rating,places.primaryType,"
            "places.nationalPhoneNumber,places.internationalPhoneNumber,"
            "places.websiteUri,places.currentOpeningHours.openNow,places.regularOpeningHours.openNow"
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
    kw_lower = query.lower()
    is_cocktail_query = any(w in kw_lower for w in COCKTAIL_KEYWORDS)

    for place in data.get("places", []):
        loc = place.get("location", {})
        p_lat = loc.get("latitude")
        p_lon = loc.get("longitude")
        name = place.get("displayName", {}).get("text")
        if not (name and p_lat is not None and p_lon is not None):
            continue

        types = place.get("types", []) or []
        venue_type = (
            "bar"
            if any(t in types for t in ("bar", "night_club", "pub", "wine_bar", "liquor_store")) or is_cocktail_query
            else "cafe"
        )
        tags = ["Google Places"]
        if place.get("rating"):
            tags.append(f"★ {place['rating']}")

        phone = place.get("nationalPhoneNumber") or place.get("internationalPhoneNumber")
        open_now = place.get("currentOpeningHours", {}).get("openNow")
        if open_now is None:
            open_now = place.get("regularOpeningHours", {}).get("openNow")

        website, instagram_url = _extract_links(place.get("websiteUri"))

        results.append(
            {
                "id": f"google-{place.get('id', name)}",
                "name": name,
                "address": place.get("formattedAddress", "Nearby"),
                "latitude": float(p_lat),
                "longitude": float(p_lon),
                "type": venue_type,
                "tags": tags,
                "phone": phone,
                "open_now": open_now,
                "website": website,
                "instagram_url": instagram_url,
                "source": "google",
            }
        )
    return results


def _search_places_legacy(api_key: str, query: str, lat: float, lon: float, radius_m: int = 12000) -> List[Dict]:
    """Fallback to legacy Google Places Text Search API."""
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

        open_now = place.get("opening_hours", {}).get("open_now")

        results.append(
            {
                "id": f"google-{place.get('place_id', name)}",
                "name": name,
                "address": place.get("formatted_address", "Nearby"),
                "latitude": float(p_lat),
                "longitude": float(p_lon),
                "type": venue_type,
                "tags": tags,
                "open_now": open_now,
                "source": "google",
            }
        )
    return results


def _run_sync_google_search(keywords: str, lat: float, lon: float) -> List[Dict]:
    load_dotenv(override=True)
    api_key = os.getenv("GOOGLE_PLACES_API_KEY", "").strip()
    if not _is_configured(api_key):
        return []

    search_query = build_smart_search_query(keywords)
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
    """Asynchronously searches Google Places API (New + Legacy fallback) for cafes, tea houses, & bars."""
    return await asyncio.to_thread(_run_sync_google_search, keywords, lat, lon)
