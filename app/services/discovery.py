import asyncio
import logging
import threading
import time
from typing import Dict, List, Optional, Tuple
import requests
from app.services.text_utils import fold_latin_accents

logger = logging.getLogger(__name__)

# In-memory cache so parallel scrapers sharing the same (lat, lon) reuse Overpass results instantly
_OVERPASS_CACHE: Dict[Tuple[float, float], Tuple[float, List[Dict]]] = {}
_CACHE_TTL_SECONDS = 900  # 15 minutes
_GLOBAL_LOCK = threading.Lock()
_COORD_LOCKS: Dict[Tuple[float, float], threading.Lock] = {}

OVERPASS_ENDPOINTS = (
    "https://overpass-api.de/api/interpreter",
)

OVERPASS_HEADERS = {
    "User-Agent": "SipScouts/1.0 (https://sipscouts.com; hello@sipscouts.com)",
    "Accept": "application/json",
}


def _get_coord_lock(key: Tuple[float, float]) -> threading.Lock:
    with _GLOBAL_LOCK:
        if key not in _COORD_LOCKS:
            _COORD_LOCKS[key] = threading.Lock()
        return _COORD_LOCKS[key]


def _format_instagram_url(raw_ig: str) -> Optional[str]:
    if not raw_ig:
        return None
    val = raw_ig.strip()
    if val.startswith("http://") or val.startswith("https://"):
        return val
    handle = val.lstrip("@").strip("/")
    if handle:
        return f"https://www.instagram.com/{handle}/"
    return None


def discover_cafes(lat: float, lon: float, radius_km: float = 10.0) -> List[Dict]:
    """
    Finds cafes, tea houses, and cocktail bars near a given location using the free OpenStreetMap Overpass API.
    Uses a single-flight thread lock per coordinate so parallel scrapers (OSM, Instagram/TikTok, Reddit, Twitter)
    make only 1 shared request instead of stampeding Overpass in dense cities like Los Angeles or NYC.
    """
    cache_key = (round(lat, 2), round(lon, 2))
    now = time.time()
    if cache_key in _OVERPASS_CACHE:
        ts, cached_list = _OVERPASS_CACHE[cache_key]
        if now - ts < _CACHE_TTL_SECONDS and cached_list is not None:
            return cached_list

    coord_lock = _get_coord_lock(cache_key)
    with coord_lock:
        # Double-check cache after acquiring single-flight lock
        now = time.time()
        if cache_key in _OVERPASS_CACHE:
            ts, cached_list = _OVERPASS_CACHE[cache_key]
            if now - ts < _CACHE_TTL_SECONDS and cached_list is not None:
                return cached_list

        # Use a fast spatial bounding box (~6km around lat/lon) + strict 2.8s timeout so Overpass queues never stall searches
        delta = 0.055
        south, west, north, east = lat - delta, lon - delta, lat + delta, lon + delta
        query = f"""
        [out:json][timeout:3][bbox:{south:.4f},{west:.4f},{north:.4f},{east:.4f}];
        (
          node["amenity"="cafe"];
          node["amenity"="bar"];
          node["shop"="tea"];
          node["shop"="coffee"];
        );
        out 70;
        """

        for endpoint in OVERPASS_ENDPOINTS:
            try:
                response = requests.post(
                    endpoint,
                    data={"data": query},
                    headers=OVERPASS_HEADERS,
                    timeout=(2.0, 2.8),
                )
                if response.status_code != 200:
                    continue
                data = response.json()

                cafes: List[Dict] = []
                for element in data.get("elements", []):
                    tags = element.get("tags", {})

                    c_lat = element.get("lat") or element.get("center", {}).get("lat")
                    c_lon = element.get("lon") or element.get("center", {}).get("lon")

                    name = tags.get("name")
                    if not (name and c_lat is not None and c_lon is not None):
                        continue

                    website = tags.get("website") or tags.get("contact:website") or tags.get("url")
                    instagram = tags.get("contact:instagram") or tags.get("instagram") or ""
                    instagram_url = _format_instagram_url(instagram)
                    if website and "instagram.com/" in website.lower() and not instagram_url:
                        instagram_url = website
                        website = None

                    phone = tags.get("phone") or tags.get("contact:phone")
                    amenity = tags.get("amenity", "cafe")
                    venue_type = "bar" if amenity in ("bar", "pub") else "cafe"

                    street = " ".join(filter(None, [tags.get("addr:housenumber"), tags.get("addr:street")]))
                    city = tags.get("addr:city") or tags.get("addr:suburb") or tags.get("addr:town") or ""
                    state = tags.get("addr:state") or tags.get("addr:country") or ""
                    address_parts = [p for p in (street, city, state) if p]
                    address = ", ".join(address_parts) if address_parts else "Local Neighborhood Spot"

                    cafes.append(
                        {
                            "name": name,
                            "address": address,
                            "latitude": float(c_lat),
                            "longitude": float(c_lon),
                            "website": website,
                            "instagram": instagram,
                            "instagram_url": instagram_url,
                            "phone": phone,
                            "cuisine": tags.get("cuisine", ""),
                            "drink_tags": " ".join(
                                str(v)
                                for k, v in tags.items()
                                if any(w in k for w in ("drink", "coffee", "tea", "cocktail", "cuisine", "bar", "microbrewery"))
                            ),
                            "city": city,
                            "type": venue_type,
                        }
                    )

                _OVERPASS_CACHE[cache_key] = (time.time(), cafes)
                logger.info(f"Discovered {len(cafes)} cafes/tea houses/bars within {radius_km}km via OpenStreetMap ({endpoint}).")
                return cafes

            except Exception as e:
                logger.warning(f"Overpass endpoint {endpoint} note: {e}")

        # Cache empty result briefly so concurrent threads do not re-query Overpass sequentially on failure
        _OVERPASS_CACHE[cache_key] = (time.time(), [])
        return []


def _run_osm_keyword_search(keywords: str, lat: float, lon: float) -> List[Dict]:
    spots = discover_cafes(lat, lon, radius_km=10.0)
    if not spots:
        return []

    kw_lower = fold_latin_accents(keywords).strip().lower()
    is_bar_query = any(
        w in kw_lower
        for w in (
            "negroni", "mezcal", "cocktail", "martini", "spritz", "margarita",
            "gin", "whiskey", "bourbon", "rye", "tequila", "rum", "vodka",
            "wine", "beer", "amaro", "chartreuse", "aperol", "campari",
            "old fashioned", "mojito", "paloma", "sake", "soju", "bar", "speakeasy",
        )
    )
    is_tea_query = any(
        w in kw_lower
        for w in (
            "tea", "matcha", "hojicha", "chai", "oolong", "earl grey",
            "sencha", "jasmine", "chamomile", "hibiscus", "boba", "bubble tea",
            "milk tea", "tisane", "herbal", "yerba mate", "london fog",
        )
    )

    matched: List[Dict] = []
    fallback: List[Dict] = []

    for s in spots:
        searchable = fold_latin_accents(f"{s['name']} {s.get('cuisine', '')} {s.get('drink_tags', '')}").lower()
        tag_list = ["OpenStreetMap"]
        if keywords:
            tag_list.append(keywords)
        if is_tea_query and ("tea" in searchable or "matcha" in searchable or "boba" in searchable):
            tag_list.append("Tea & Matcha Spot")

        item = {
            "id": f"osm-{s['name']}-{s['latitude']:.4f}",
            "name": s["name"],
            "address": s.get("address", "Local Spot"),
            "latitude": float(s["latitude"]),
            "longitude": float(s["longitude"]),
            "type": s.get("type", "cafe"),
            "tags": tag_list,
            "phone": s.get("phone"),
            "website": s.get("website"),
            "instagram_url": s.get("instagram_url"),
            "source": "osm",
        }

        if kw_lower and any(tok in searchable for tok in kw_lower.split() if len(tok) > 2):
            item["match_tier"] = "exact"
            matched.append(item)
        elif (is_bar_query and s.get("type") == "bar") or (not is_bar_query and s.get("type") == "cafe"):
            item["match_tier"] = "potential"
            fallback.append(item)

    return (matched + fallback)[:15]


async def search_cafes(keywords: str, lat: float, lon: float) -> List[Dict]:
    """Asynchronously discovers local independent cafes, tea houses, and bars from OpenStreetMap."""
    return await asyncio.to_thread(_run_osm_keyword_search, keywords, lat, lon)
