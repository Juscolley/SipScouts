from sqlalchemy import Column, Integer, String, Float, DateTime
from app.database import Base
from datetime import datetime

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    phone_number = Column(String, unique=True, index=True, nullable=True)
    latitude = Column(Float)
    longitude = Column(Float)
    radius_km = Column(Float, default=10.0)
    timezone = Column(String, default="America/New_York") # Store timezone string
    favorite_drink = Column(String, default="espresso soda") # Store the user's preferred drink
    created_at = Column(DateTime, default=datetime.utcnow)

class Cafe(Base):
    __tablename__ = "cafes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    address = Column(String)
    latitude = Column(Float)
    longitude = Column(Float)
    website = Column(String, nullable=True)
    found_drinks = Column(String, default="") # comma-separated list of found specific drinks
    last_scraped = Column(DateTime, default=datetime.utcnow)

class Special(Base):
    __tablename__ = "specials"

    id = Column(Integer, primary_key=True, index=True)
    cafe_id = Column(Integer, index=True)
    description = Column(String)
    extracted_at = Column(DateTime, default=datetime.utcnow)

class Favorite(Base):
    __tablename__ = "favorites"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True)
    cafe_id = Column(Integer, index=True)
    added_at = Column(DateTime, default=datetime.utcnow)

class Analytics(Base):
    __tablename__ = "analytics"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(DateTime, default=datetime.utcnow)
    drink = Column(String, index=True)
    city = Column(String, nullable=True)
    zip_code = Column(String, nullable=True)
    search_count = Column(Integer, default=0)
    selection_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
