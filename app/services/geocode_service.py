import os
from typing import Tuple, Optional
import requests
from dotenv import load_dotenv

load_dotenv()

NOMINATIM_USER_AGENT = os.getenv("NOMINATIM_USER_AGENT", "SipScoutsApp/1.0 (example@example.com)")


def geocode_zip(zip_or_city: str) -> Tuple[Optional[float], Optional[float], Optional[str], Optional[str]]:
    """Return (lat, lon, city, zip) for a given US zip code or city/neighborhood using OSM Nominatim.
    Returns None values if the lookup fails.
    """
    cleaned = (zip_or_city or "").strip()
    if not cleaned:
        return None, None, None, None

    url = "https://nominatim.openstreetmap.org/search"
    headers = {"User-Agent": NOMINATIM_USER_AGENT}

    is_zip = cleaned[:5].isdigit()
    if is_zip:
        params = {
            "postalcode": cleaned[:5],
            "country": "us",
            "format": "json",
            "addressdetails": 1,
            "limit": 1,
        }
    else:
        params = {
            "q": cleaned,
            "countrycodes": "us",
            "format": "json",
            "addressdetails": 1,
            "limit": 1,
        }

    try:
        resp = requests.get(url, params=params, headers=headers, timeout=6)
        resp.raise_for_status()
        data = resp.json()
        if not data and is_zip:
            # Fallback to general query if postalcode lookup returned empty
            resp = requests.get(
                url,
                params={"q": cleaned, "countrycodes": "us", "format": "json", "addressdetails": 1, "limit": 1},
                headers=headers,
                timeout=6,
            )
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
            or cleaned
        )
        postcode = address.get("postcode") or (cleaned[:5] if is_zip else None)
        return lat, lon, city, postcode
    except Exception:
        return None, None, None, None
