import asyncio
import logging
import os
import re
from typing import Dict, List, Optional
import requests
from dotenv import load_dotenv
from app.services.distance import calculate_haversine_distance

load_dotenv()
logger = logging.getLogger(__name__)

# Maximum distance (in miles) allowed from the user's search center (works globally across all countries).
MAX_LOCAL_DISTANCE_MILES = 55.0

MOCKTAIL_KEYWORDS = (
    "mocktail", "mocktails", "zero-proof", "zero proof", "non-alcoholic", "na cocktail",
    "seedlip", "ghia", "botanical", "shrub", "adaptogen", "phony negroni",
    "kin euphorics", "de soi", "kombucha", "temperance",
)

COCKTAIL_KEYWORDS = (
    "negroni", "mezcal", "martini", "margarita", "spritz", "old fashioned",
    "manhattan", "mojito", "daiquiri", "paloma", "sour", "gimlet", "chartreuse",
    "amaro", "campari", "aperol", "yuzu", "elderflower", "bourbon", "rye",
    "whiskey", "scotch", "gin", "tequila", "rum", "vodka", "sake", "soju",
    "wine", "beer", "cocktail", "speakeasy", "aperitivo", "vermouth",
    "absinthe", "pisco", "caipirinha", "sangria", "mule", "bitters", "bar",
)

TEA_KEYWORDS = (
    "tea", "matcha", "hojicha", "chai", "masala", "oolong", "earl grey",
    "sencha", "jasmine", "chamomile", "hibiscus", "pu-erh", "puerh", "rooibos",
    "boba", "bubble tea", "milk tea", "tisane", "herbal", "yerba mate",
    "london fog", "genmaicha", "gyokuro", "darjeeling", "assam", "white tea",
)

# Valid Google Places types for venues that actually serve drinks/beverages
ALLOWED_DRINK_VENUE_TYPES = frozenset({
    "cafe", "coffee_shop", "tea_house", "bar", "cocktail_bar", "wine_bar",
    "pub", "night_club", "bakery", "juice_shop", "ice_cream_shop",
    "dessert_shop", "restaurant", "bistro", "brunch_restaurant",
    "breakfast_restaurant", "bubble_tea_store", "brewery", "winery",
    "distillery", "lounge", "meal_takeaway", "food",
})

# Non-beverage retail/service primary types to always reject (e.g., Apple Store -> electronics_store)
BLOCKED_PRIMARY_TYPES = frozenset({
    "electronics_store", "cell_phone_store", "computer_store",
    "department_store", "clothing_store", "shoe_store", "jewelry_store",
    "furniture_store", "hardware_store", "home_goods_store",
    "home_improvement_store", "auto_repair", "car_dealer", "car_rental",
    "gas_station", "bank", "atm", "pharmacy", "hospital", "doctor",
    "dentist", "gym", "fitness_center", "beauty_salon", "hair_care",
    "lodging", "school", "university", "library", "museum", "park",
    "real_estate_agency", "insurance_agency", "lawyer", "accounting",
    "travel_agency", "post_office", "pet_store", "veterinary_care",
    "laundry", "dry_cleaning", "storage", "moving_company", "movie_theater",
    "stadium", "shopping_mall", "supermarket", "grocery_store",
})


def _is_valid_drink_venue(types: List[str], primary_type: Optional[str] = None) -> bool:
    """Ensures a Google Places result is a legitimate food/beverage venue and not unrelated retail (e.g., Apple Store)."""
    pt = (primary_type or "").strip().lower()
    if pt in BLOCKED_PRIMARY_TYPES:
        return False
    normalized_types = {t.strip().lower() for t in (types or []) if t}
    if pt:
        normalized_types.add(pt)
    if not normalized_types:
        return False
    return bool(normalized_types & ALLOWED_DRINK_VENUE_TYPES)


def _is_configured(val: Optional[str]) -> bool:
    return bool(val and val.strip() and val.strip().lower() != "placeholder")


_ACCENT_TWINS = {
    "latte": "(latte OR latté)",
    "cafe": "(cafe OR café)",
    "creme": "(creme OR crème)",
    "acai": "(acai OR açaí)",
    "pina": "(pina OR piña)",
    "rose": "(rose OR rosé)",
    "pena": "(pena OR peña)",
    "jalapeno": "(jalapeno OR jalapeño)",
    "frappe": "(frappe OR frappé)",
    "mate": "(mate OR maté)",
    "curacao": "(curacao OR curaçao)",
}


def _expand_accent_twins(keywords: str) -> str:
    """Expands common folded beverage terms to match both unaccented and accented Google Places venues."""
    if not keywords:
        return ""
    pattern = re.compile(r"\b(" + "|".join(_ACCENT_TWINS.keys()) + r")\b", re.IGNORECASE)
    return pattern.sub(lambda m: _ACCENT_TWINS[m.group(0).lower()], keywords)


def build_smart_search_query(keywords: str) -> str:
    """Builds a category-aware query supporting specialty coffee, tea houses, craft cocktail bars, and zero-proof spots."""
    kw = (keywords or "").strip()
    kw_lower = kw.lower()
    expanded_kw = _expand_accent_twins(kw)
    if any(w in kw_lower for w in MOCKTAIL_KEYWORDS):
        return f"{expanded_kw} mocktails OR zero-proof OR lounge OR cocktail bar".strip()
    if any(w in kw_lower for w in COCKTAIL_KEYWORDS):
        return f"{expanded_kw} cocktail bar OR speakeasy OR lounge OR bar".strip()
    if any(w in kw_lower for w in TEA_KEYWORDS):
        return f"{expanded_kw} tea house OR matcha bar OR cafe".strip()
    if kw:
        return f"{expanded_kw} specialty cafe OR tea house OR cocktail bar OR zero-proof".strip()
    return "specialty coffee OR tea house OR cocktail bar OR mocktails"


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
        "maxResultCount": 20,
    }
    resp = requests.post(url, json=payload, headers=headers, timeout=10)
    if resp.status_code != 200:
        raise RuntimeError(f"Places API (New) returned {resp.status_code}: {resp.text[:200]}")

    data = resp.json()
    results: List[Dict] = []
    kw_lower = query.lower()
    is_mocktail_query = any(w in kw_lower for w in MOCKTAIL_KEYWORDS)
    is_cocktail_query = any(w in kw_lower for w in COCKTAIL_KEYWORDS)

    for place in data.get("places", []):
        loc = place.get("location", {})
        p_lat = loc.get("latitude")
        p_lon = loc.get("longitude")
        name = place.get("displayName", {}).get("text")
        if not (name and p_lat is not None and p_lon is not None):
            continue

        # Strictly enforce local radius so out-of-state matches (e.g., NYC for a Norfolk search) are rejected
        dist_miles = calculate_haversine_distance(lat, lon, float(p_lat), float(p_lon))
        if dist_miles > MAX_LOCAL_DISTANCE_MILES:
            continue

        types = place.get("types", []) or []
        if not _is_valid_drink_venue(types, place.get("primaryType")):
            continue

        if is_mocktail_query:
            venue_type = "zero_proof"
        elif any(t in types for t in ("bar", "night_club", "pub", "wine_bar", "liquor_store")) or is_cocktail_query:
            venue_type = "bar"
        else:
            venue_type = "cafe"
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
    for place in data.get("results", [])[:20]:
        loc = place.get("geometry", {}).get("location", {})
        p_lat = loc.get("lat")
        p_lon = loc.get("lng")
        name = place.get("name")
        if not (name and p_lat is not None and p_lon is not None):
            continue

        dist_miles = calculate_haversine_distance(lat, lon, float(p_lat), float(p_lon))
        if dist_miles > MAX_LOCAL_DISTANCE_MILES:
            continue

        types = place.get("types", []) or []
        if not _is_valid_drink_venue(types):
            continue

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


def _build_local_category_fallback_query(keywords: str) -> str:
    """Builds a broader local category query when a rare ingredient+drink combo has few exact matches locally."""
    kw = (keywords or "").strip().lower()
    for word in MOCKTAIL_KEYWORDS:
        if word in kw:
            return f"{word} mocktails OR zero-proof lounge OR cocktail bar"
    for word in COCKTAIL_KEYWORDS:
        if word in kw:
            return f"{word} craft cocktail bar OR lounge"
    for word in TEA_KEYWORDS:
        if word in kw:
            return f"{word} tea house OR specialty cafe"
    return "specialty coffee cafe OR craft cocktail bar OR mocktails"


def _run_sync_google_search(keywords: str, lat: float, lon: float) -> List[Dict]:
    load_dotenv(override=True)
    api_key = os.getenv("GOOGLE_PLACES_API_KEY", "").strip()
    if not _is_configured(api_key):
        return []

    kw_clean = (keywords or "").strip()
    search_query = build_smart_search_query(kw_clean)
    collected: List[Dict] = []
    seen_ids = set()

    # Stage 1: Closest Exact Matches within 55 miles (always include drink-venue category context)
    exact_query = search_query
    try:
        exact_results = _search_places_new(api_key, exact_query, lat, lon, radius_m=50000.0)
        for r in exact_results:
            r["match_tier"] = "exact"
            if "Exact Match" not in r["tags"]:
                r["tags"].insert(0, "Exact Match")
            seen_ids.add(r["id"])
            collected.append(r)
    except Exception as e:
        logger.info(f"Places API (New) exact search note: {e}")

    # Stage 2: Potential Local Matches (nearby specialty spots in the same drink/cocktail/tea category within 55 miles)
    if kw_clean:
        fallback_query = _build_local_category_fallback_query(kw_clean)
        try:
            more = _search_places_new(api_key, fallback_query, lat, lon, radius_m=40000.0)
            for r in more:
                if r["id"] not in seen_ids:
                    r["match_tier"] = "potential"
                    if "Potential Match" not in r["tags"]:
                        r["tags"].insert(0, "Potential Match")
                    seen_ids.add(r["id"])
                    collected.append(r)
        except Exception:
            pass

    if collected:
        return collected[:30]

    try:
        legacy = _search_places_legacy(api_key, search_query, lat, lon)
        for r in legacy:
            r["match_tier"] = "exact"
        return legacy
    except Exception as e:
        logger.warning(f"Google Places scraper error: {e}")
        return []


async def search_cafes(keywords: str, lat: float, lon: float) -> List[Dict]:
    """Asynchronously searches Google Places API (New + Legacy fallback) for cafes, tea houses, & bars."""
    return await asyncio.to_thread(_run_sync_google_search, keywords, lat, lon)
