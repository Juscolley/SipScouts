import logging
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app import models

logger = logging.getLogger(__name__)


def record_search(db: Session, drink: str, city: str = None, zip_code: str = None) -> None:
    """Increment search count for a given drink/date.
    Creates a new Analytics row if none exists for today and the given drink.
    """
    today = datetime.utcnow().date()
    analytics = (
        db.query(models.Analytics)
        .filter(models.Analytics.date == today, models.Analytics.drink == drink)
        .first()
    )
    if not analytics:
        analytics = models.Analytics(date=today, drink=drink, city=city, zip_code=zip_code, search_count=1)
        db.add(analytics)
    else:
        analytics.search_count += 1
        if city:
            analytics.city = city
        if zip_code:
            analytics.zip_code = zip_code
    db.commit()
    logger.debug("Recorded search analytics: %s", analytics)


def record_selection(db: Session, drink: str, city: str = None, zip_code: str = None) -> None:
    """Increment selection count when a user selects a cafe for a drink."""
    today = datetime.utcnow().date()
    analytics = (
        db.query(models.Analytics)
        .filter(models.Analytics.date == today, models.Analytics.drink == drink)
        .first()
    )
    if not analytics:
        analytics = models.Analytics(date=today, drink=drink, city=city, zip_code=zip_code, selection_count=1)
        db.add(analytics)
    else:
        analytics.selection_count += 1
        if city:
            analytics.city = city
        if zip_code:
            analytics.zip_code = zip_code
    db.commit()
    logger.debug("Recorded selection analytics: %s", analytics)


def get_aggregated_data(db: Session, days: int = 60):
    """Return aggregated analytics for the past *days* days."""
    cutoff = datetime.utcnow() - timedelta(days=days)
    results = (
        db.query(models.Analytics)
        .filter(models.Analytics.created_at >= cutoff)
        .order_by(models.Analytics.created_at.desc())
        .all()
    )
    return [
        {
            "date": a.date.isoformat(),
            "drink": a.drink,
            "city": a.city,
            "zip_code": a.zip_code,
            "search_count": a.search_count,
            "selection_count": a.selection_count,
        }
        for a in results
    ]


def purge_old_analytics(db: Session, retention_days: int = 60) -> int:
    """Delete analytics older than *retention_days*.
    Returns the number of rows deleted.
    """
    cutoff = datetime.utcnow() - timedelta(days=retention_days)
    deleted = db.query(models.Analytics).filter(models.Analytics.created_at < cutoff).delete()
    db.commit()
    logger.info("Purged %s old analytics rows", deleted)
    return deleted
