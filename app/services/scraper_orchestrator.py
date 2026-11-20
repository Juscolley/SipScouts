import asyncio
import logging
import re
import time
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlparse
import httpx

from app import models
from app.database import SessionLocal
from app.services.distance import calculate_haversine_distance, attach_road_distances_km
from app.services.text_utils import fold_latin_accents
from app.services import (
    google_scraper,
    yelp_scraper,
    instagram_scraper,
    discovery as osm_scraper,
    reddit_scraper,
    twitter_scraper,
)

logger = logging.getLogger(__name__)

# Fast 5.0-second parallel window (Google Places & Yelp finish in ~1.2s; late scrapers save in background)
PARALLEL_SCRAPER_TIMEOUT_SECONDS = 5.0

# Fast in-memory search result cache: (query_lower, lat_rounded, lon_rounded) -> (timestamp, venues)
_SEARCH_CACHE: Dict[Tuple[str, float, float], Tuple[float, List[Dict]]] = {}
_SEARCH_CACHE_TTL = 600  # 10 minutes

# In-memory Instagram handle cache by domain to avoid redundant web scraping
_IG_DOMAIN_CACHE: Dict[str, Optional[str]] = {}

_IGNORE_IG_HANDLES = {
    "p", "reel", "reels", "stories", "explore", "about", "legal", "terms",
    "privacy", "developer", "help", "support", "directory", "accounts", "direct",
    "instagram", "facebook", "twitter", "linkedin", "tiktok", "youtube", "share"
}

# Fallback official Instagram handles for multi-location/pop-up venues whose Google Places listing lacks a websiteUri
_KNOWN_VENUE_IG: Dict[str, str] = {
    "pinup coffee": "https://www.instagram.com/pinupcoffeeco/",
}


async def _extract_instagram_from_website(client: httpx.AsyncClient, website_url: str) -> Optional[str]:
    """Fast, safe scraper to extract the official Instagram profile link from a venue's website HTML."""
    if not website_url or not website_url.startswith("http"):
        return None
    try:
        domain = urlparse(website_url).netloc.lower()
        if domain in _IG_DOMAIN_CACHE:
            return _IG_DOMAIN_CACHE[domain]

        resp = await client.get(
            website_url,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
                ),
                "Accept": "text/html,application/xhtml+xml",
            },
            follow_redirects=True,
            timeout=2.2,
        )
        if resp.status_code == 200:
            matches = re.findall(r'instagram\.com/([a-zA-Z0-9_\.]{3,30})/?', resp.text, re.IGNORECASE)
            for m in matches:
                clean_handle = m.lower().strip(".")
                if clean_handle and clean_handle not in _IGNORE_IG_HANDLES:
                    ig_url = f"https://www.instagram.com/{clean_handle}/"
                    _IG_DOMAIN_CACHE[domain] = ig_url
                    return ig_url

        _IG_DOMAIN_CACHE[domain] = None
        return None
    except Exception as e:
        logger.debug(f"IG website crawl skipped for {website_url}: {e}")
        return None


async def enrich_venues_with_instagram(venues: List[Dict]) -> None:
    """Enriches venues missing instagram_url in parallel using their website (plus known-venue fallback)."""
    for v in venues:
        if not v.get("instagram_url"):
            name_low = (v.get("name") or "").lower()
            for needle, ig_url in _KNOWN_VENUE_IG.items():
                if needle in name_low:
                    v["instagram_url"] = ig_url
                    break

    to_enrich = [v for v in venues if not v.get("instagram_url") and v.get("website")]
    if not to_enrich:
        return

    # Cap parallel crawls to top 40 venues (concurrency-limited) so results beyond #15 still get IG links
    targets = to_enrich[:40]
    sem = asyncio.Semaphore(20)

    async def _bounded_extract(client: httpx.AsyncClient, url: str) -> Optional[str]:
        async with sem:
            return await _extract_instagram_from_website(client, url)

    try:
        async with httpx.AsyncClient(verify=False) as client:
            results = await asyncio.gather(
                *[_bounded_extract(client, v["website"]) for v in targets],
                return_exceptions=True
            )
            for v, res in zip(targets, results):
                if isinstance(res, str) and res.startswith("https://"):
                    v["instagram_url"] = res
    except Exception as e:
        logger.warning(f"Parallel Instagram website enrichment notice: {e}")


def _normalize_venue(raw: Dict, default_tag: str) -> Optional[Dict]:
    name = (raw.get("name") or "").strip()
    lat = raw.get("lat") if raw.get("lat") is not None else raw.get("latitude")
    lng = raw.get("lng") if raw.get("lng") is not None else raw.get("longitude")
    if not name or lat is None or lng is None:
        return None

    # Deduplicate tags & ensure at most one star rating tag
    raw_tags = list(raw.get("tags") or [])
    tags: List[str] = []
    has_star = False
    for t in raw_tags:
        if not t or t in ("Exact Match", "Potential Match"):
            continue
        if default_tag and t.strip().lower() == default_tag.strip().lower():
            continue
        if t.startswith("★"):
            if has_star:
                continue
            has_star = True
        if t not in tags:
            tags.append(t)

    raw_type = (raw.get("type") or "cafe").strip().lower()
    venue_type = raw_type if raw_type in ("bar", "cafe", "tea_house", "zero_proof") else "cafe"

    return {
        "id": str(raw.get("id") or f"{name}-{float(lat):.4f}-{float(lng):.4f}"),
        "name": name,
        "address": raw.get("address") or "Nearby",
        "type": venue_type,
        "lat": float(lat),
        "lng": float(lng),
        "tags": tags[:5],
        "rating": raw.get("rating"),
        "phone": raw.get("phone"),
        "open_now": raw.get("open_now"),
        "website": raw.get("website"),
        "instagram_url": raw.get("instagram_url"),
        "photo_url": raw.get("photo_url"),
        "evidence": raw.get("evidence"),
        "match_tier": raw.get("match_tier", "exact"),
        "source": raw.get("source", "scout"),
    }


def _deduplicate_and_merge(venues: List[Dict]) -> List[Dict]:
    """Deduplicates venues across scrapers by normalized name and combines source tags & contact info."""
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
            has_star = any(t.startswith("★") for t in merged_tags)
            for t in v.get("tags", []):
                if t.startswith("★"):
                    if has_star:
                        continue
                    has_star = True
                if t not in merged_tags:
                    merged_tags.append(t)
            existing["tags"] = merged_tags[:6]
            if existing.get("address") in ("Nearby", "Local Neighborhood Spot") and v.get("address"):
                existing["address"] = v["address"]
            for field in ("phone", "open_now", "website", "instagram_url", "photo_url", "rating"):
                if existing.get(field) is None and v.get(field) is not None:
                    existing[field] = v[field]
            if not existing.get("evidence") and v.get("evidence"):
                existing["evidence"] = v["evidence"]
            if existing.get("type") == "cafe" and v.get("type") in ("tea_house", "zero_proof", "bar"):
                existing["type"] = v["type"]
            if v.get("match_tier") == "exact" and (existing.get("evidence") or v.get("evidence")):
                existing["match_tier"] = "exact"
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
        kw_lower = fold_latin_accents(keyword).lower().strip()
        for c in cafes:
            if c.latitude is None or c.longitude is None:
                continue
            dist_miles = calculate_haversine_distance(lat, lon, c.latitude, c.longitude)
            if dist_miles <= radius_km * 0.621371:
                found = fold_latin_accents(c.found_drinks or "").lower()
                cname = fold_latin_accents(c.name or "").lower()
                if not kw_lower or kw_lower in found or kw_lower in cname:
                    in_found = bool(kw_lower and kw_lower in found)
                    results.append(
                        {
                            "id": f"db-{c.id}",
                            "name": c.name,
                            "address": c.address or "Nearby",
                            "type": "cafe",
                            "lat": float(c.latitude),
                            "lng": float(c.longitude),
                            "tags": [t for t in [keyword, "Verified Local Spot"] if t],
                            "evidence": f"Previously scouted for {keyword}" if in_found else None,
                            "match_tier": "exact" if (not kw_lower or in_found) else "potential",
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
    lat: float = 39.8283,
    lon: float = -98.5795,
) -> List[Dict]:
    """
    Fires all 6 SipScouts scrapers simultaneously in parallel with a 10–12 second window.
    Any scraper finishing after the window is NOT dropped — its results are saved in the
    background to the database and in-memory cache so no hidden gem is ever lost.
    """
    raw_keywords = " ".join(p.strip() for p in (drink, ingredient) if p and p.strip()).strip()
    keywords = fold_latin_accents(raw_keywords)
    cache_key = (keywords.lower(), round(lat, 2), round(lon, 2))

    now = time.time()
    if cache_key in _SEARCH_CACHE:
        ts, cached_venues = _SEARCH_CACHE[cache_key]
        if now - ts < _SEARCH_CACHE_TTL and cached_venues:
            fresh_list = [dict(v) for v in cached_venues]
            await attach_road_distances_km(lat, lon, fresh_list)
            fresh_list.sort(key=lambda v: v.get("distance_km") if isinstance(v.get("distance_km"), (int, float)) else 99999.0)
            return fresh_list

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

    deduped_with_dist = []
    for v in _deduplicate_and_merge(collected):
        d = calculate_haversine_distance(lat, lon, v["lat"], v["lng"])
        if d <= 55.0:
            v["_dist_mi"] = d
            deduped_with_dist.append(v)

    deduped_with_dist.sort(key=lambda x: x["_dist_mi"])
    # Adaptive search radius: in dense metros, don't pad with far-away spots if >=12 matches exist within 18 miles
    near_18 = [v for v in deduped_with_dist if v["_dist_mi"] <= 18.0]
    near_35 = [v for v in deduped_with_dist if v["_dist_mi"] <= 35.0]
    if len(near_18) >= 12:
        deduped = near_18
    elif len(near_35) >= 12:
        deduped = near_35
    else:
        deduped = deduped_with_dist

    for v in deduped:
        v.pop("_dist_mi", None)
        if keywords and v.get("match_tier") == "exact" and not v.get("evidence"):
            v["match_tier"] = "potential"

    # Scrape website HTML in parallel for official Instagram handles and attach real road distances
    await asyncio.gather(
        enrich_venues_with_instagram(deduped),
        attach_road_distances_km(lat, lon, deduped),
    )
    deduped.sort(key=lambda v: v.get("distance_km") if isinstance(v.get("distance_km"), (int, float)) else 99999.0)

    # Persist discovered venues to SQLite in background thread
    if deduped:
        asyncio.create_task(asyncio.to_thread(_save_venues_to_db, deduped, keywords))
        _SEARCH_CACHE[cache_key] = (now, deduped)

    return deduped
