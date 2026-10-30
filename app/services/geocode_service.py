import os
from typing import Tuple, Optional
import requests
from dotenv import load_dotenv

load_dotenv()

NOMINATIM_USER_AGENT = "SipScoutsDiscovery/2.0 (https://sipscouts.com)"


def _geocode_via_google(query: str, api_key: str) -> Tuple[Optional[float], Optional[float], Optional[str], Optional[str]]:
    """Uses Google Places Text Search (New or Legacy) to geocode any postal code, city, or address worldwide."""
    if not api_key or api_key.strip().lower() == "placeholder":
        return None, None, None, None

    # 1. Try Google Places API (New)
    try:
        resp = requests.post(
            "https://places.googleapis.com/v1/places:searchText",
            headers={
                "Content-Type": "application/json",
                "X-Goog-Api-Key": api_key.strip(),
                "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location",
            },
            json={"textQuery": query, "maxResultCount": 1},
            timeout=6,
        )
        if resp.status_code == 200:
            places = resp.json().get("places", [])
            if places:
                p = places[0]
                loc = p.get("location", {})
                lat, lon = loc.get("latitude"), loc.get("longitude")
                if lat is not None and lon is not None:
                    label = p.get("formattedAddress") or p.get("displayName", {}).get("text") or query
                    return float(lat), float(lon), label, query
    except Exception:
        pass

    # 2. Try Google Maps Geocoding / Legacy Text Search API
    try:
        resp = requests.get(
            "https://maps.googleapis.com/maps/api/place/textsearch/json",
            params={"query": query, "key": api_key.strip()},
            timeout=6,
        )
        if resp.status_code == 200:
            results = resp.json().get("results", [])
            if results:
                r = results[0]
                loc = r.get("geometry", {}).get("location", {})
                lat, lon = loc.get("lat"), loc.get("lng")
                if lat is not None and lon is not None:
                    label = r.get("formatted_address") or r.get("name") or query
                    return float(lat), float(lon), label, query
    except Exception:
        pass

    return None, None, None, None


def geocode_zip(zip_or_city: str) -> Tuple[Optional[float], Optional[float], Optional[str], Optional[str]]:
    """Return (lat, lon, city_label, query) for any zip code, postal code, or city worldwide (US, Europe, Asia, etc.)."""
    load_dotenv(override=True)
    cleaned = (zip_or_city or "").strip()
    if not cleaned:
        return None, None, None, None

    # First try Google Places (works globally for cities, neighborhoods, and postal codes)
    google_key = os.getenv("GOOGLE_PLACES_API_KEY", "").strip()
    g_lat, g_lon, g_city, g_zip = _geocode_via_google(cleaned, google_key)
    if g_lat is not None and g_lon is not None:
        return g_lat, g_lon, g_city, g_zip

    # Fallback: OpenStreetMap Nominatim (worldwide — no country restriction)
    url = "https://nominatim.openstreetmap.org/search"
    headers = {"User-Agent": NOMINATIM_USER_AGENT}
    params = {
        "q": cleaned,
        "format": "json",
        "addressdetails": 1,
        "limit": 1,
    }

    try:
        resp = requests.get(url, params=params, headers=headers, timeout=6)
        resp.raise_for_status()
        data = resp.json()
        if not data:
            return None, None, None, None
        entry = data[0]
        lat = float(entry.get("lat"))
        lon = float(entry.get("lon"))
        address = entry.get("address", {})
        city = (
            address.get("city")
            or address.get("town")
            or address.get("village")
            or address.get("suburb")
            or address.get("county")
            or entry.get("display_name", cleaned).split(",")[0]
        )
        postcode = address.get("postcode") or (cleaned if cleaned[:5].isdigit() else None)
        return lat, lon, city, postcode
    except Exception:
        return None, None, None, None


def geocode_client_ip(client_ip: str) -> Tuple[Optional[float], Optional[float], Optional[str]]:
    """Resolves a visitor's approximate (lat, lon, city) from their request IP when browser GPS wasn't sent."""
    ip_clean = (client_ip or "").split(",")[0].strip()
    try:
        url = (
            f"https://get.geojs.io/v1/ip/geo/{ip_clean}.json"
            if ip_clean and ip_clean not in ("127.0.0.1", "::1", "localhost")
            else "https://get.geojs.io/v1/ip/geo.json"
        )
        resp = requests.get(url, timeout=4)
        if resp.status_code == 200:
            data = resp.json()
            lat = float(data.get("latitude"))
            lon = float(data.get("longitude"))
            city = ", ".join(filter(None, [data.get("city"), data.get("region"), data.get("country_code")]))
            return lat, lon, city
    except Exception:
        pass
    return None, None, None
