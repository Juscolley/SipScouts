from fastapi import FastAPI, Depends, Request, Form
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv

load_dotenv()

from app import models
from app.database import engine, get_db
from app.scheduler import setup_scheduler
# Twilio SMS service removed (no longer used)

models.Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    scheduler = setup_scheduler(app)
    yield
    # Shutdown
    scheduler.shutdown()

app = FastAPI(title="SIPSCOUTS", lifespan=lifespan)

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Setup templates and static files
templates = Jinja2Templates(directory="app/templates")
app.mount("/static", StaticFiles(directory="app/static"), name="static")

@app.get("/", response_class=HTMLResponse)
async def read_item(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/demo", response_class=HTMLResponse)
async def read_demo(request: Request):
    return templates.TemplateResponse("demo.html", {"request": request})

@app.get("/api/ping")
async def ping():
    return {"message": "pong from FastAPI backend"}

@app.get("/api/search")
async def search_venues(
    drink: str = "",
    ingredient: str = "",
    lat: float | None = None,
    lng: float | None = None,
    zip_code: str = "",
):
    """
    Live Multi-Source Discovery Search Endpoint.
    Runs Google Places, Yelp, Instagram/TikTok, OpenStreetMap, Reddit, and X/Twitter
    in parallel within a 10–12s window with Zero-Drop background caching.
    """
    from app.services.geocode_service import geocode_zip
    from app.services.scraper_orchestrator import orchestrate_search

    search_lat = lat
    search_lng = lng
    city_name = ""

    if (search_lat is None or search_lng is None) and zip_code:
        g_lat, g_lon, g_city, _ = geocode_zip(zip_code)
        if g_lat is not None and g_lon is not None:
            search_lat, search_lng = g_lat, g_lon
            city_name = g_city or ""

    # Default to NYC coordinates if browser geolocation is off and no zip code was given
    if search_lat is None or search_lng is None:
        search_lat = 40.7223
        search_lng = -73.9887

    venues = await orchestrate_search(
        drink=drink,
        ingredient=ingredient,
        lat=search_lat,
        lon=search_lng,
    )

    # Log event to Supabase analytics (non-blocking, anonymous)
    from app.services.supabase_service import log_search_event
    log_search_event(
        drink=drink,
        ingredient=ingredient,
        city=city_name,
        zip_code=zip_code,
        latitude=search_lat,
        longitude=search_lng,
        result_count=len(venues),
    )

    return {"venues": venues, "count": len(venues)}

@app.post("/register")
async def register_user(
    request: Request,
    name: str = Form(...),
    phone: str = Form(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    radius: float = Form(...),
    timezone: str = Form(...),
    drink: str = Form(...),
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.phone_number == phone).first()
    
    if user:
        # Update existing user settings
        user.name = name
        user.latitude = latitude
        user.longitude = longitude
        user.radius_km = radius
        user.timezone = timezone
        user.favorite_drink = drink
    else:
        # Create new user
        user = models.User(
            name=name,
            phone_number=phone,
            latitude=latitude,
            longitude=longitude,
            radius_km=radius,
            timezone=timezone,
            favorite_drink=drink
        )
        db.add(user)
        
    db.commit()

    # SMS functionality removed – no welcome message sent

    return templates.TemplateResponse("success.html", {"request": request, "name": name, "drink": drink})
