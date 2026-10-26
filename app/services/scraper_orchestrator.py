import asyncio
import logging
import time
from datetime import datetime
from typing import Dict, List, Tuple

from app import models
from app.database import SessionLocal
from app.services.distance import calculate_haversine_distance
from app.services import (
    google_scraper,
    yelp_scraper,
    instagram_scraper,
    discovery as osm_scraper,
    reddit_scraper,
    twitter_scraper,
)

logger = logging.getLogger(__name__)

# 10-12 second parallel window (safely under the 15s total UX ceiling)
PARALLEL_SCRAPER_TIMEOUT_SECONDS = 11.5

# Fast in-memory search result cache: (query_lower, lat_rounded, lon_rounded) -> (timestamp, venues)
_SEARCH_CACHE: Dict[Tuple[str, float, float], Tuple[float, List[Dict]]] = {}
_SEARCH_CACHE_TTL = 600  # 10 minutes


def _normalize_venue(raw: Dict, default_tag: str) -> Dict | None:
    name = (raw.get("name") or "").strip()
    lat = raw.get("lat") if raw.get("lat") is not None else raw.get("latitude")
    lng = raw.get("lng") if raw.get("lng") is not None else raw.get("longitude")
    if not name or lat is None or lng is None:
        return None

    tags = list(raw.get("tags") or [])
    if default_tag and default_tag not in tags:
        tags.insert(0, default_tag)

    return {
        "id": str(raw.get("id") or f"{name}-{float(lat):.4f}-{float(lng):.4f}"),
        "name": name,
        "address": raw.get("address") or "Nearby",
        "type": "bar" if raw.get("type") == "bar" else "cafe",
        "lat": float(lat),
        "lng": float(lng),
        "tags": tags[:5],
        "source": raw.get("source", "scout"),
    }


def _deduplicate_and_merge(venues: List[Dict]) -> List[Dict]:
    """Deduplicates venues across scrapers by normalized name and combines source tags."""
    by_key: Dict[str, Dict] = {}
    for v in venues:
        key = "".join(ch for ch in v["name"].lower() if ch.isalnum())
        if not key:
            continue
        if key not in by_key:
            by_key[key] = dict(v)
        else:
            existing = by_key[key]
            merged_tags = list(existing.get("tags", []))
            for t in v.get("tags", []):
                if t not in merged_tags:
                    merged_tags.append(t)
            existing["tags"] = merged_tags[:6]
            if existing.get("address") in ("Nearby", "Local Neighborhood Spot") and v.get("address"):
                existing["address"] = v["address"]
    return list(by_key.values())


def _save_venues_to_db(venues: List[Dict], keyword: str) -> None:
    """Persists discovered venues into the SQLite Cafe table (Zero-Drop persistence)."""
    if not venues:
        return
    db = SessionLocal()
    try:
        for v in venues:
            existing = (
                db.query(models.Cafe)
                .filter(models.Cafe.name == v["name"])
                .first()
            )
            if existing:
                drinks = [d.strip() for d in (existing.found_drinks or "").split(",") if d.strip()]
                if keyword and keyword.lower() not in [d.lower() for d in drinks]:
                    drinks.append(keyword)
                    existing.found_drinks = ", ".join(drinks)
                existing.last_scraped = datetime.utcnow()
            else:
                db.add(
                    models.Cafe(
                        name=v["name"],
                        address=v.get("address", "Nearby"),
                        latitude=v["lat"],
                        longitude=v["lng"],
                        found_drinks=keyword or "",
                        last_scraped=datetime.utcnow(),
                    )
                )
        db.commit()
    except Exception as e:
        logger.warning(f"Zero-drop DB save warning: {e}")
    finally:
        db.close()


def _load_cached_db_venues(keyword: str, lat: float, lon: float, radius_km: float = 12.0) -> List[Dict]:
    """Loads any previously saved cafes from the local SQLite database matching the keyword and radius."""
    db = SessionLocal()
    results: List[Dict] = []
    try:
        cafes = db.query(models.Cafe).all()
        kw_lower = keyword.lower().strip()
        for c in cafes:
            if c.latitude is None or c.longitude is None:
                continue
            dist_miles = calculate_haversine_distance(lat, lon, c.latitude, c.longitude)
            if dist_miles <= radius_km * 0.621371:
                found = (c.found_drinks or "").lower()
                if not kw_lower or kw_lower in found or kw_lower in (c.name or "").lower():
                    results.append(
                        {
                            "id": f"db-{c.id}",
                            "name": c.name,
                            "address": c.address or "Nearby",
                            "type": "cafe",
                            "lat": float(c.latitude),
                            "lng": float(c.longitude),
                            "tags": [t for t in [keyword, "Verified Local Spot"] if t],
                            "source": "cache",
                        }
                    )
    except Exception as e:
        logger.debug(f"DB cache lookup skipped: {e}")
    finally:
        db.close()
    return results


async def orchestrate_search(
    drink: str = "",
    ingredient: str = "",
    lat: float = 40.7223,
    lon: float = -73.9887,
) -> List[Dict]:
    """
    Fires all 6 SipScouts scrapers simultaneously in parallel with a 10–12 second window.
    Any scraper finishing after the window is NOT dropped — its results are saved in the
    background to the database and in-memory cache so no hidden gem is ever lost.
    """
    keywords = " ".join(p.strip() for p in (drink, ingredient) if p and p.strip()).strip()
    cache_key = (keywords.lower(), round(lat, 2), round(lon, 2))

    now = time.time()
    if cache_key in _SEARCH_CACHE:
        ts, cached_venues = _SEARCH_CACHE[cache_key]
        if now - ts < _SEARCH_CACHE_TTL and cached_venues:
            return cached_venues

    # Start with any zero-drop database hits already discovered for this area
    collected: List[Dict] = _load_cached_db_venues(keywords, lat, lon)

    scraper_coroutines = [
        ("google", google_scraper.search_cafes(keywords, lat, lon)),
        ("yelp", yelp_scraper.search_cafes(keywords, lat, lon)),
        ("instagram_tiktok", instagram_scraper.search_cafes(keywords, lat, lon)),
        ("osm", osm_scraper.search_cafes(keywords, lat, lon)),
        ("reddit", reddit_scraper.search_cafes(keywords, lat, lon)),
        ("twitter", twitter_scraper.search_cafes(keywords, lat, lon)),
    ]

    tasks = {
        asyncio.create_task(coro, name=name): name
        for name, coro in scraper_coroutines
    }

    done, pending = await asyncio.wait(
        tasks.keys(),
        timeout=PARALLEL_SCRAPER_TIMEOUT_SECONDS,
        return_when=asyncio.ALL_COMPLETED,
    )

    for task in done:
        source_name = tasks[task]
        try:
            raw_list = task.result() or []
            for raw in raw_list:
                norm = _normalize_venue(raw, keywords)
                if norm:
                    collected.append(norm)
        except Exception as e:
            logger.warning(f"Scraper '{source_name}' raised error: {e}")

    # Zero-Drop Background Save for any scraper still running past the 11.5s window
    if pending:
        logger.info(
            f"{len(pending)} slow scraper(s) continuing in background for zero-drop save: "
            f"{[tasks[t] for t in pending]}"
        )

        async def _finish_and_save_slow_tasks(slow_tasks):
            results = await asyncio.gather(*slow_tasks, return_exceptions=True)
            late_venues: List[Dict] = []
            for res in results:
                if isinstance(res, list):
                    for raw in res:
                        norm = _normalize_venue(raw, keywords)
                        if norm:
                            late_venues.append(norm)
            if late_venues:
                await asyncio.to_thread(_save_venues_to_db, late_venues, keywords)
                merged_all = _deduplicate_and_merge(collected + late_venues)
                _SEARCH_CACHE[cache_key] = (time.time(), merged_all)

        asyncio.create_task(_finish_and_save_slow_tasks(list(pending)))

    deduped = _deduplicate_and_merge(collected)

    # Persist discovered venues to SQLite in background thread
    if deduped:
        asyncio.create_task(asyncio.to_thread(_save_venues_to_db, deduped, keywords))
        _SEARCH_CACHE[cache_key] = (now, deduped)

    return deduped
