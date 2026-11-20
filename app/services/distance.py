import logging
import math
from typing import Dict, List, Optional
import httpx

logger = logging.getLogger(__name__)


def calculate_haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculates the great-circle distance between two points on Earth in miles
    given their latitudes and longitudes in decimal degrees.
    """
    # Earth radius in miles
    R = 3958.8

    # Convert decimal degrees to radians
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)

    # Differences in coordinates
    dlon = lon2_rad - lon1_rad
    dlat = lat2_rad - lat1_rad

    # Haversine formula
    a = math.sin(dlat / 2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    distance = R * c

    return distance


async def attach_road_distances_km(origin_lat: float, origin_lon: float, venues: List[Dict]) -> None:
    """
    Populates `distance_km` on each venue using real street/road distances from the OSRM Table API
    (distance only, no travel time), falling back to Haversine if OSRM is unavailable.
    """
    if not venues:
        return

    # OSRM public table endpoint comfortably handles up to ~50 coordinates in one call
    batch = venues[:50]
    coords = [f"{origin_lon:.6f},{origin_lat:.6f}"]
    for v in batch:
        coords.append(f"{float(v['lng']):.6f},{float(v['lat']):.6f}")

    url = f"https://router.project-osrm.org/table/v1/driving/{';'.join(coords)}?sources=0&annotations=distance"
    road_meters: Optional[List[Optional[float]]] = None

    try:
        async with httpx.AsyncClient(timeout=4.5) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                matrix = data.get("distances")
                if isinstance(matrix, list) and matrix and isinstance(matrix[0], list):
                    road_meters = matrix[0][1:]
    except Exception as e:
        logger.debug(f"OSRM road distance fallback to Haversine: {e}")

    for idx, v in enumerate(venues):
        meters = road_meters[idx] if (road_meters is not None and idx < len(road_meters)) else None
        if isinstance(meters, (int, float)) and meters >= 0:
            v["distance_km"] = round(float(meters) / 1000.0, 3)
            v["distance_mode"] = "driving"
        else:
            v["distance_km"] = round(
                calculate_haversine_distance(origin_lat, origin_lon, float(v["lat"]), float(v["lng"])) * 1.609344,
                3,
            )
            v["distance_mode"] = "straight_line"
