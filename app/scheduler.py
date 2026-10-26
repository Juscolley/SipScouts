import logging
from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.orm import Session
import pytz

from app import models
from app.database import SessionLocal
from app.services.distance import calculate_haversine_distance
from app.services.discovery import discover_cafes
from app.services.playwright_scraper import scrape_cafe_site
from app.services.inspirational_scraper import fetch_daily_quote


logger = logging.getLogger(__name__)

def update_cafe_data_background():
    """
    Background job that runs periodically to discover new cafes and 
    scrape their sites for espresso sodas.
    For MVP, we just iterate through all active user locations and discover nearby.
    """
    logger.info("Starting background cafe discovery and scraping process...")
    db: Session = SessionLocal()
    try:
        users = db.query(models.User).all()
        # To avoid redundant API calls, track processed coordinates (roughly)
        processed_locs = []
        
        for user in users:
            # Simple check to not re-discover the exact same lat/lon radius multiple times
            loc_key = (round(user.latitude, 2), round(user.longitude, 2))
            if loc_key in processed_locs:
                continue
            processed_locs.append(loc_key)
            
            cafes = discover_cafes(user.latitude, user.longitude, user.radius_km)
            
            for c_data in cafes:
                # Check if cafe already exists
                existing = db.query(models.Cafe).filter(
                    models.Cafe.name == c_data['name'], 
                    models.Cafe.latitude == c_data['latitude']
                ).first()
                
                # If we have a website, scrape it
                website = c_data.get('website')
                found_drink_str = ""
                special = None
                
                if website:
                    scrape_results = scrape_cafe_site(website, user.favorite_drink)
                    if scrape_results.get('has_drink', False):
                        found_drink_str = user.favorite_drink.lower().strip()
                    special = scrape_results['special_desc']
                
                if existing:
                    current_drinks = [d.strip() for d in (existing.found_drinks or "").lower().split(",") if d.strip()]
                    if found_drink_str and found_drink_str not in current_drinks:
                        current_drinks.append(found_drink_str)
                    existing.found_drinks = ",".join(current_drinks)
                    existing.last_scraped = datetime.utcnow()
                    db.commit()
                    cafe_id = existing.id
                else:
                    new_cafe = models.Cafe(
                        name=c_data['name'],
                        address=c_data.get('city', ''),
                        latitude=c_data['latitude'],
                        longitude=c_data['longitude'],
                        website=website,
                        found_drinks=found_drink_str
                    )
                    db.add(new_cafe)
                    db.commit()
                    db.refresh(new_cafe)
                    cafe_id = new_cafe.id
                
                # Update special
                if special:
                    existing_special = db.query(models.Special).filter(models.Special.cafe_id == cafe_id).first()
                    if existing_special:
                        existing_special.description = special
                        existing_special.extracted_at = datetime.utcnow()
                    else:
                        new_special = models.Special(cafe_id=cafe_id, description=special)
                        db.add(new_special)
                    db.commit()

        logger.info("Background update complete.")
    finally:
        db.close()

def daily_dispatch_job(timezone_str: str):
    """
    Triggered exactly at 5:00 AM for a specific timezone.
    Finds out all users in this timezone and sends them the daily text.
    """
    logger.info(f"Triggering 5:00 AM dispatch for timezone: {timezone_str}")
    db: Session = SessionLocal()
    
    try:
        users = db.query(models.User).filter(models.User.timezone == timezone_str).all()
        if not users:
            return
            
        quote_data = fetch_daily_quote()
        
        for user in users:
            user_drink = user.favorite_drink.lower().strip()
            all_cafes = db.query(models.Cafe).all()
            
            nearby_cafes = []
            for c in all_cafes:
                cafe_drinks = [d.strip() for d in (c.found_drinks or "").lower().split(",") if d.strip()]
                if user_drink not in cafe_drinks:
                    continue

                dist = calculate_haversine_distance(user.latitude, user.longitude, c.latitude, c.longitude)
                if dist <= (user.radius_km * 0.621371):  # convert km to miles
                    # fetch specials
                    special_rec = db.query(models.Special).filter(models.Special.cafe_id == c.id).first()
                    
                    nearby_cafes.append({
                        "name": c.name,
                        "distance_miles": dist,
                        "special_desc": special_rec.description if special_rec else None
                    })
                    
            # Sort closest to furthest radially
            nearby_cafes.sort(key=lambda x: x["distance_miles"])
            
            logger.info(f"Daily digest prepared for {user.name}: {len(nearby_cafes)} nearby cafes.")
            
    finally:
        db.close()


def setup_scheduler(app):
    scheduler = BackgroundScheduler()
    
    # 1. Background scraping job - runs every 6 hours
    scheduler.add_job(update_cafe_data_background, 'interval', hours=6)
    
    # 2. Daily dispatch jobs. For MVP, we'll schedule a cron for common US timezones.
    # In a full production app, you'd dynamically load all distinct user timezones from the DB
    timezones = ["America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York"]
    
    for tz_str in timezones:
        try:
            tz = pytz.timezone(tz_str)
            scheduler.add_job(
                daily_dispatch_job, 
                CronTrigger(hour=5, minute=0, timezone=tz), 
                args=[tz_str]
            )
            logger.info(f"Scheduled 5:00 AM dispatch for {tz_str}")
        except Exception as e:
            logger.error(f"Failed to schedule job for timezone {tz_str}: {e}")

    scheduler.start()
    return scheduler
