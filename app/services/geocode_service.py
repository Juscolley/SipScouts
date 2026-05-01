import os
from typing import Tuple, Optional
import requests
from dotenv import load_dotenv

load_dotenv()

NOMINATIM_USER_AGENT = os.getenv("NOMINATIM_USER_AGENT", "SipScoutsApp/1.0 (example@example.com)")


def geocode_zip(zip_code: str) -> Tuple[Optional[float], Optional[float], Optional[str], Optional[str]]:
    """Return (lat, lon, city, zip) for a given US zip code using OSM Nominatim.
    Returns None values if the lookup fails.
    """
    url = "https://nominatim.openstreetmap.org/search"
    params = {
        "postalcode": zip_code,
        "country": "us",
        "format": "json",
        "addressdetails": 1,
        "limit": 1,
    }
    headers = {"User-Agent": NOMINATIM_USER_AGENT}
    try:
        resp = requests.get(url, params=params, headers=headers, timeout=5)
        resp.raise_for_status()
        data = resp.json()
        if not data:
            return None, None, None, None
        entry = data[0]
        lat = float(entry.get("lat"))
        lon = float(entry.get("lon"))
        address = entry.get("address", {})
        city = address.get("city") or address.get("town") or address.get("village")
        return lat, lon, city, zip_code
    except Exception as e:
        # In production you would log this
        return None, None, None, None
