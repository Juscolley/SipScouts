import asyncio
import logging
import os
import re
from typing import Dict, List, Optional
from urllib.parse import quote
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


_DRINK_SYNONYMS = {
    "hojicha": '(hojicha OR "roasted green tea" OR houjicha)',
    "houjicha": '(hojicha OR "roasted green tea" OR houjicha)',
    "seedlip": '(seedlip OR "non-alcoholic spirit" OR "zero-proof")',
    "phony negroni": '("phony negroni" OR "non-alcoholic negroni" OR "zero-proof negroni" OR "n/a negroni")',
    "zero-proof": '("zero-proof" OR "zero proof" OR mocktail OR "non-alcoholic" OR "spirit-free")',
    "zero proof": '("zero-proof" OR "zero proof" OR mocktail OR "non-alcoholic" OR "spirit-free")',
    "mocktail": '(mocktail OR "zero-proof" OR "zero proof" OR "non-alcoholic" OR "spirit-free")',
    "genmaicha": '(genmaicha OR "brown rice green tea")',
    "london fog": '("london fog" OR "earl grey latte")',
    "espresso tonic": '("espresso tonic" OR "espresso & tonic")',
    "cortado": '(cortado OR gibraltar)',
    "dubai chocolate": '("dubai chocolate" OR "pistachio kataifi" OR "pistachio kunafa")',
    "yuzu": '(yuzu OR "japanese citrus")',
    "ghia": '(ghia OR "non-alcoholic aperitif" OR "zero-proof aperitif")',
}

# Equivalent phrases used when scanning review/editorial text for drink evidence
_EVIDENCE_SYNONYMS: Dict[str, tuple[str, ...]] = {
    "hojicha": ("hojicha", "houjicha", "roasted green tea"),
    "houjicha": ("hojicha", "houjicha", "roasted green tea"),
    "seedlip": ("seedlip", "non-alcoholic spirit", "zero-proof", "zero proof"),
    "phony": ("phony negroni", "non-alcoholic negroni", "zero-proof negroni", "n/a negroni"),
    "zero-proof": ("zero-proof", "zero proof", "mocktail", "non-alcoholic", "spirit-free"),
    "mocktail": ("mocktail", "zero-proof", "zero proof", "non-alcoholic", "spirit-free"),
    "genmaicha": ("genmaicha", "brown rice green tea"),
    "cortado": ("cortado", "gibraltar"),
    "ghia": ("ghia", "non-alcoholic aperitif", "zero-proof aperitif"),
}


def _expand_accent_twins(keywords: str) -> str:
    """Expands common folded beverage terms and regional drink synonyms for Google Places search."""
    if not keywords:
        return ""
    expanded = keywords
    # Expand multi-word or single-word drink synonyms first
    for term, syn in _DRINK_SYNONYMS.items():
        if re.search(r"\b" + re.escape(term) + r"\b", expanded, re.IGNORECASE):
            expanded = re.sub(r"\b" + re.escape(term) + r"\b", syn, expanded, flags=re.IGNORECASE)
    pattern = re.compile(r"\b(" + "|".join(_ACCENT_TWINS.keys()) + r")\b", re.IGNORECASE)
    return pattern.sub(lambda m: _ACCENT_TWINS[m.group(0).lower()], expanded)


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


def _classify_venue_type(
    types: List[str],
    primary_type: Optional[str],
    name: str,
    is_mocktail_query: bool,
) -> str:
    """Classifies venue type strictly from Google Places metadata (never from query-expansion words like 'bar')."""
    pt = (primary_type or "").strip().lower()
    tset = {t.strip().lower() for t in (types or []) if t}
    if pt:
        tset.add(pt)
    name_lower = (name or "").lower()

    bar_types = {"bar", "cocktail_bar", "wine_bar", "pub", "night_club", "lounge", "brewery", "distillery", "liquor_store"}
    tea_types = {"tea_house", "bubble_tea_store"}
    cafe_types = {"cafe", "coffee_shop", "bakery", "ice_cream_shop", "dessert_shop", "juice_shop"}
    has_tea_name = bool(re.search(r"\b(tea|matcha|boba|chai)\b", name_lower))

    # 1. Explicit primaryType from Google Places takes precedence
    if pt in tea_types:
        return "tea_house"
    if pt in bar_types:
        return "zero_proof" if is_mocktail_query and "zero" in name_lower else "bar"
    if pt in cafe_types:
        # A coffee shop/cafe whose name explicitly centers on tea/matcha/boba (e.g., "Matcha Cafe Maiko") is a tea_house
        if has_tea_name and "coffee" not in name_lower:
            return "tea_house"
        return "cafe"

    # 2. Fallback to secondary types / name only when primaryType is generic (e.g., "restaurant" or missing)
    if tset & bar_types and not (tset & cafe_types):
        return "zero_proof" if is_mocktail_query and "zero" in name_lower else "bar"
    if has_tea_name or (tset & tea_types and not (tset & cafe_types) and "coffee" not in name_lower and "dumpling" not in name_lower):
        return "tea_house"
    if is_mocktail_query and ("zero" in name_lower or "mocktail" in name_lower or "kava" in name_lower):
        return "zero_proof"
    return "cafe"


_FOOD_FOLLOWERS = (
    "muffin", "muffins", "scone", "scones", "bagel", "bagels", "cake", "cakes",
    "donut", "donuts", "doughnut", "doughnuts", "croissant", "croissants",
    "pie", "pies", "bread", "waffle", "waffles", "pancake", "pancakes",
    "toast", "tart", "tarts", "cookie", "cookies", "brownie", "danish",
    "biscuit", "cobbler", "jam", "preserve",
)

_BEVERAGE_CONTEXT = (
    "latte", "matcha", "tea", "coffee", "espresso", "drink", "cocktail",
    "mocktail", "iced", "cold brew", "cold foam", "foam", "syrup", "boba",
    "smoothie", "refresher", "lemonade", "soda", "spritz", "chai", "sip",
)


def _token_variants(tok: str) -> tuple[str, ...]:
    """Returns the token plus any known drink/ingredient synonym variants."""
    return _EVIDENCE_SYNONYMS.get(tok, (tok,))


def _token_in_text(tok: str, txt_lower: str) -> bool:
    return any(v in txt_lower for v in _token_variants(tok))


def _is_drink_relevant_text(txt_lower: str, search_tokens: List[str]) -> bool:
    """
    Returns True if text genuinely matches all searched drink/ingredient terms in a beverage context
    (and rejects food-only hits like 'blueberry muffin' or partial single-term hits when 2+ terms were searched).
    """
    matched = [tok for tok in search_tokens if _token_in_text(tok, txt_lower)]
    if not matched:
        return False

    # When both drink + ingredient (2+ tokens) are searched, require ALL tokens in the text
    if len(search_tokens) >= 2:
        if len(matched) < len(search_tokens):
            return False
        # Verify none of the matched tokens only appear inside food phrases (e.g. 'blueberry muffin')
        for tok in search_tokens:
            variants = _token_variants(tok)
            found_non_food = False
            for v in variants:
                if v not in txt_lower:
                    continue
                food_pattern = re.compile(
                    r"\b" + re.escape(v) + r"\s+(" + "|".join(_FOOD_FOLLOWERS) + r")\b"
                )
                cleaned = food_pattern.sub("", txt_lower)
                if v in cleaned:
                    found_non_food = True
                    break
            if not found_non_food:
                return False
        return True

    # Single-token search: reject food-only hits without beverage context
    tok = matched[0]
    has_beverage_ctx = any(b in txt_lower for b in _BEVERAGE_CONTEXT)
    for v in _token_variants(tok):
        if v not in txt_lower:
            continue
        food_pattern = re.compile(
            r"\b" + re.escape(v) + r"\s+(" + "|".join(_FOOD_FOLLOWERS) + r")\b"
        )
        cleaned = food_pattern.sub("", txt_lower)
        if v in cleaned and (has_beverage_ctx or len(search_tokens) == 1):
            return True
    return False


def _extract_match_evidence(
    place: Dict,
    name: str,
    venue_type: str,
    search_tokens: List[str],
) -> tuple[Optional[str], bool]:
    """
    Scans Google Places editorial summary, reviews, and venue name for genuine beverage match proof.
    Returns (evidence_text_or_None, has_strong_evidence).
    """
    if not search_tokens:
        return None, True

    reviews = place.get("reviews") or []
    matching_reviews: List[str] = []
    for rev in reviews:
        txt = (rev.get("text", {}) or {}).get("text") or (rev.get("originalText", {}) or {}).get("text") or ""
        txt_lower = txt.lower()
        if _is_drink_relevant_text(txt_lower, search_tokens):
            matching_reviews.append(txt.strip())

    if matching_reviews:
        # Prefer a review that matches the most search tokens
        matching_reviews.sort(
            key=lambda r: sum(1 for tok in search_tokens if tok in r.lower()),
            reverse=True,
        )
        first = matching_reviews[0]
        snippet = first[:110].rstrip() + ("…" if len(first) > 110 else "")
        for tok in search_tokens:
            idx = first.lower().find(tok)
            if idx != -1:
                start = max(0, idx - 35)
                end = min(len(first), idx + 75)
                snippet = ("…" if start > 0 else "") + first[start:end].strip() + ("…" if end < len(first) else "")
                break
        count = len(matching_reviews)
        return f"Mentioned in {count} review{'s' if count > 1 else ''}: \"{snippet}\"", True

    editorial = ((place.get("editorialSummary") or {}).get("text") or "").strip()
    if editorial and _is_drink_relevant_text(editorial.lower(), search_tokens):
        snippet = editorial[:110].rstrip() + ("…" if len(editorial) > 110 else "")
        return f"Profile: \"{snippet}\"", True

    name_lower = (name or "").lower()
    matched_in_name = [tok for tok in search_tokens if _token_in_text(tok, name_lower)]
    if matched_in_name:
        if len(matched_in_name) == len(search_tokens):
            return f"Specialty in name: {name}", True
        matched_str = ", ".join(m.capitalize() for m in matched_in_name)
        unconfirmed_str = ", ".join(t for t in search_tokens if t not in matched_in_name)
        return f"{matched_str} specialist; {unconfirmed_str} not confirmed", False

    return None, False


def _search_places_new(
    api_key: str,
    query: str,
    lat: float,
    lon: float,
    radius_m: float = 12000.0,
    raw_keywords: str = "",
) -> List[Dict]:
    """Queries Google Places API (New) Text Search endpoint including phone, open status, photos, reviews, and links."""
    url = "https://places.googleapis.com/v1/places:searchText"
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": (
            "places.id,places.displayName,places.formattedAddress,"
            "places.location,places.types,places.rating,places.primaryType,"
            "places.nationalPhoneNumber,places.internationalPhoneNumber,"
            "places.websiteUri,places.currentOpeningHours.openNow,places.regularOpeningHours.openNow,"
            "places.photos,places.editorialSummary,places.reviews"
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
    kw_source = (raw_keywords or query).lower()
    is_mocktail_query = any(w in kw_source for w in MOCKTAIL_KEYWORDS)
    search_tokens = [
        t for t in re.split(r"[\s,+]+", (raw_keywords or "").lower())
        if len(t) >= 3 and t not in {"the", "and", "with", "for", "latte"}
    ]
    if not search_tokens and raw_keywords:
        search_tokens = [raw_keywords.strip().lower()]

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
        primary_type = place.get("primaryType")
        if not _is_valid_drink_venue(types, primary_type):
            continue

        venue_type = _classify_venue_type(types, primary_type, name, is_mocktail_query)
        tags: List[str] = []
        rating_val = place.get("rating")
        if rating_val:
            tags.append(f"★ {rating_val}")

        phone = place.get("nationalPhoneNumber") or place.get("internationalPhoneNumber")
        open_now = place.get("currentOpeningHours", {}).get("openNow")
        if open_now is None:
            open_now = place.get("regularOpeningHours", {}).get("openNow")

        website, instagram_url = _extract_links(place.get("websiteUri"))

        photos = place.get("photos") or []
        photo_url: Optional[str] = None
        if photos and isinstance(photos[0], dict) and photos[0].get("name"):
            photo_url = f"/api/place-photo?name={quote(photos[0]['name'], safe='')}"

        evidence, has_strong_evidence = _extract_match_evidence(place, name, venue_type, search_tokens)

        results.append(
            {
                "id": f"google-{place.get('id', name)}",
                "name": name,
                "address": place.get("formattedAddress", "Nearby"),
                "latitude": float(p_lat),
                "longitude": float(p_lon),
                "type": venue_type,
                "rating": rating_val,
                "tags": tags,
                "phone": phone,
                "open_now": open_now,
                "website": website,
                "instagram_url": instagram_url,
                "photo_url": photo_url,
                "evidence": evidence,
                "has_strong_evidence": has_strong_evidence,
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
        exact_results = _search_places_new(api_key, exact_query, lat, lon, radius_m=50000.0, raw_keywords=kw_clean)
        for r in exact_results:
            r["match_tier"] = "exact" if (not kw_clean or r.get("has_strong_evidence")) else "potential"
            seen_ids.add(r["id"])
            collected.append(r)
    except Exception as e:
        logger.info(f"Places API (New) exact search note: {e}")

    # Stage 2: Potential Local Matches (nearby specialty spots in the same drink/cocktail/tea category within 55 miles)
    if kw_clean:
        fallback_query = _build_local_category_fallback_query(kw_clean)
        try:
            more = _search_places_new(api_key, fallback_query, lat, lon, radius_m=40000.0, raw_keywords=kw_clean)
            for r in more:
                if r["id"] not in seen_ids:
                    r["match_tier"] = "exact" if r.get("has_strong_evidence") else "potential"
                    seen_ids.add(r["id"])
                    collected.append(r)
        except Exception:
            pass

    if collected:
        return collected[:30]

    try:
        legacy = _search_places_legacy(api_key, search_query, lat, lon)
        for r in legacy:
            r["match_tier"] = "potential" if kw_clean else "exact"
        return legacy
    except Exception as e:
        logger.warning(f"Google Places scraper error: {e}")
        return []


async def search_cafes(keywords: str, lat: float, lon: float) -> List[Dict]:
    """Asynchronously searches Google Places API (New + Legacy fallback) for cafes, tea houses, & bars."""
    return await asyncio.to_thread(_run_sync_google_search, keywords, lat, lon)
