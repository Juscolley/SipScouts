import asyncio
import logging
import time
from typing import Dict, List, Tuple
import requests

logger = logging.getLogger(__name__)

# In-memory cache so parallel scrapers sharing the same (lat, lon) reuse Overpass results instantly
_OVERPASS_CACHE: Dict[Tuple[float, float, float], Tuple[float, List[Dict]]] = {}
_CACHE_TTL_SECONDS = 900  # 15 minutes


def discover_cafes(lat: float, lon: float, radius_km: float = 10.0) -> List[Dict]:
    """
    Finds cafes and bars near a given location using the free OpenStreetMap Overpass API.
    Includes a 15-minute coordinate cache so parallel scrapers never duplicate network calls.
    """
    cache_key = (round(lat, 2), round(lon, 2), round(radius_km, 1))
    now = time.time()
    if cache_key in _OVERPASS_CACHE:
        ts, cached_list = _OVERPASS_CACHE[cache_key]
        if now - ts < _CACHE_TTL_SECONDS and cached_list:
            return cached_list

    radius_meters = int(min(radius_km, 15.0) * 1000)

    query = f"""
    [out:json][timeout:10];
    (
      node["amenity"~"^(cafe|bar)$"](around:{radius_meters},{lat},{lon});
      way["amenity"~"^(cafe|bar)$"](around:{radius_meters},{lat},{lon});
    );
    out center 60;
    """

    url = "https://overpass-api.de/api/interpreter"

    try:
        response = requests.post(url, data={"data": query}, timeout=10)
        response.raise_for_status()
        data = response.json()

        cafes: List[Dict] = []
        for element in data.get("elements", []):
            tags = element.get("tags", {})

            c_lat = element.get("lat") or element.get("center", {}).get("lat")
            c_lon = element.get("lon") or element.get("center", {}).get("lon")

            name = tags.get("name")
            if not (name and c_lat is not None and c_lon is not None):
                continue

            website = tags.get("website") or tags.get("contact:website")
            instagram = tags.get("contact:instagram") or tags.get("instagram") or ""
            amenity = tags.get("amenity", "cafe")
            venue_type = "bar" if amenity == "bar" else "cafe"

            street = " ".join(filter(None, [tags.get("addr:housenumber"), tags.get("addr:street")]))
            city = tags.get("addr:city") or tags.get("addr:suburb") or ""
            state = tags.get("addr:state") or ""
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
                    "cuisine": tags.get("cuisine", ""),
                    "drink_tags": " ".join(
                        str(v) for k, v in tags.items() if "drink" in k or "coffee" in k or "cocktail" in k or "cuisine" in k
                    ),
                    "city": city,
                    "type": venue_type,
                }
            )

        if cafes:
            _OVERPASS_CACHE[cache_key] = (now, cafes)
        logger.info(f"Discovered {len(cafes)} cafes/bars within {radius_km}km via OpenStreetMap.")
        return cafes

    except Exception as e:
        logger.error(f"Error discovering cafes via Overpass: {e}")
        return []


def _run_osm_keyword_search(keywords: str, lat: float, lon: float) -> List[Dict]:
    spots = discover_cafes(lat, lon, radius_km=10.0)
    if not spots:
        return []

    kw_lower = keywords.strip().lower()
    is_bar_query = any(w in kw_lower for w in ("negroni", "mezcal", "cocktail", "martini", "spritz", "margarita", "gin", "whiskey", "wine", "beer"))

    matched: List[Dict] = []
    fallback: List[Dict] = []

    for s in spots:
        searchable = f"{s['name']} {s.get('cuisine', '')} {s.get('drink_tags', '')}".lower()
        tag_list = ["OpenStreetMap"]
        if keywords:
            tag_list.append(keywords)
        if s.get("website"):
            tag_list.append("Direct Menu / Site")

        item = {
            "id": f"osm-{s['name']}-{s['latitude']:.4f}",
            "name": s["name"],
            "address": s.get("address", "Local Spot"),
            "latitude": float(s["latitude"]),
            "longitude": float(s["longitude"]),
            "type": s.get("type", "cafe"),
            "tags": tag_list,
            "source": "osm",
        }

        if kw_lower and any(tok in searchable for tok in kw_lower.split() if len(tok) > 2):
            matched.append(item)
        elif (is_bar_query and s.get("type") == "bar") or (not is_bar_query and s.get("type") == "cafe"):
            fallback.append(item)

    return (matched + fallback)[:15]


async def search_cafes(keywords: str, lat: float, lon: float) -> List[Dict]:
    """Asynchronously discovers local independent cafes and bars from OpenStreetMap."""
    return await asyncio.to_thread(_run_osm_keyword_search, keywords, lat, lon)
