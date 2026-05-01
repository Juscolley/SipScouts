import requests
import logging
from typing import List, Dict

logger = logging.getLogger(__name__)

def discover_cafes(lat: float, lon: float, radius_km: float = 10.0) -> List[Dict]:
    """
    Finds cafes near a given location using the free OpenStreetMap Overpass API.
    radius is converted to meters for the API.
    """
    radius_meters = radius_km * 1000
    
    # Overpass QL query: find nodes tagged as 'cafe' around lat/lon
    query = f"""
    [out:json];
    (
      node["amenity"="cafe"](around:{radius_meters},{lat},{lon});
      way["amenity"="cafe"](around:{radius_meters},{lat},{lon});
    );
    out center;
    """
    
    url = "https://overpass-api.de/api/interpreter"
    
    try:
        response = requests.post(url, data={"data": query}, timeout=15)
        response.raise_for_status()
        data = response.json()
        
        cafes = []
        for element in data.get("elements", []):
            tags = element.get("tags", {})
            
            # For ways (polygons), lat/lon are in "center"
            c_lat = element.get("lat") or element.get("center", {}).get("lat")
            c_lon = element.get("lon") or element.get("center", {}).get("lon")
            
            name = tags.get("name")
            website = tags.get("website") or tags.get("contact:website")
            
            if name and c_lat and c_lon:
                cafes.append({
                    "name": name,
                    "latitude": c_lat,
                    "longitude": c_lon,
                    "website": website,
                    "city": tags.get("addr:city", "")
                })
                
        logger.info(f"Discovered {len(cafes)} cafes within {radius_km}km.")
        return cafes
        
    except Exception as e:
        logger.error(f"Error discovering cafes via Overpass: {e}")
        return []

if __name__ == "__main__":
    # Test coordinates (e.g. Times Square)
    print(discover_cafes(40.7580, -73.9855, 2.0))
