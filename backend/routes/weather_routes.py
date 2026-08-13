"""
Weather API routes - fetches weather data from WeatherAPI.com
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional
from datetime import datetime, timezone, timedelta
import httpx
import os

from database import db
from auth import get_current_user, get_tenant_id

router = APIRouter(prefix="/weather", tags=["Weather"])

# WeatherAPI.com configuration
WEATHER_API_KEY = os.environ.get("WEATHER_API_KEY", "")
WEATHER_API_BASE = "https://api.weatherapi.com/v1"

# Simple in-memory cache for weather data (10 minute TTL)
_weather_cache = {}
CACHE_TTL_SECONDS = 600  # 10 minutes

# Weather condition to icon mapping (for consistency with existing frontend)
CONDITION_ICONS = {
    "sunny": "sun",
    "clear": "sun",
    "partly cloudy": "cloud-sun",
    "cloudy": "cloud",
    "overcast": "cloud",
    "mist": "cloud-fog",
    "fog": "cloud-fog",
    "freezing fog": "cloud-fog",
    "patchy rain": "cloud-drizzle",
    "light rain": "cloud-drizzle",
    "light drizzle": "cloud-drizzle",
    "drizzle": "cloud-drizzle",
    "moderate rain": "cloud-rain",
    "heavy rain": "cloud-rain",
    "rain": "cloud-rain",
    "light snow": "cloud-snow",
    "moderate snow": "cloud-snow",
    "heavy snow": "cloud-snow",
    "snow": "cloud-snow",
    "sleet": "cloud-snow",
    "ice": "cloud-snow",
    "blizzard": "cloud-snow",
    "thundery": "cloud-lightning",
    "thunder": "cloud-lightning",
}


def get_icon_for_condition(condition_text: str) -> str:
    """Map WeatherAPI condition text to our icon names"""
    condition_lower = condition_text.lower()
    for key, icon in CONDITION_ICONS.items():
        if key in condition_lower:
            return icon
    return "cloud"  # default


def degrees_to_compass(degrees: float) -> str:
    """Convert wind direction degrees to compass direction"""
    if degrees is None:
        return "N/A"
    degrees = degrees % 360
    directions = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", 
                  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]
    index = round(degrees / 22.5) % 16
    return directions[index]


@router.get("/forecast")
async def get_weather_forecast(
    latitude: Optional[float] = Query(None, description="Latitude for weather location"),
    longitude: Optional[float] = Query(None, description="Longitude for weather location"),
    current_user: dict = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id)
):
    """
    Get current weather and 3-day forecast using WeatherAPI.com.
    If lat/long not provided, uses tenant's configured location.
    Results are cached for 10 minutes.
    """
    location_name = None
    location_query = None
    
    # If no coordinates provided, get from tenant settings
    if latitude is None or longitude is None:
        tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
        if tenant and tenant.get("settings"):
            settings = tenant["settings"]
            latitude = settings.get("weather_latitude")
            longitude = settings.get("weather_longitude")
            location_name = settings.get("weather_location_name")
    
    # Default to Medina, TX if still no coordinates
    if latitude is None or longitude is None:
        latitude = 29.7969
        longitude = -99.2464
        location_name = "Medina, TX"
    
    # Build location query for WeatherAPI (lat,lon format)
    location_query = f"{latitude},{longitude}"
    
    # Check cache first
    cache_key = f"{latitude:.4f},{longitude:.4f}"
    cached = _weather_cache.get(cache_key)
    if cached:
        cache_time, cache_data = cached
        if datetime.now(timezone.utc) - cache_time < timedelta(seconds=CACHE_TTL_SECONDS):
            # Return cached data with updated location name
            cache_data["location"]["name"] = location_name
            cache_data["cached"] = True
            return cache_data
    
    if not WEATHER_API_KEY:
        raise HTTPException(status_code=503, detail="Weather service not configured")
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{WEATHER_API_BASE}/forecast.json",
                params={
                    "key": WEATHER_API_KEY,
                    "q": location_query,
                    "days": 4,  # Today + 3 days
                    "aqi": "no",
                    "alerts": "no"
                }
            )
            
            # Handle specific error codes
            if response.status_code == 401 or response.status_code == 403:
                raise HTTPException(status_code=503, detail="Weather service authentication failed")
            if response.status_code == 429:
                # Return cached data if available
                if cached:
                    _, cache_data = cached
                    cache_data["location"]["name"] = location_name
                    cache_data["cached"] = True
                    cache_data["rate_limited"] = True
                    return cache_data
                raise HTTPException(status_code=503, detail="Weather service quota exceeded")
            if response.status_code == 400:
                raise HTTPException(status_code=400, detail="Invalid location")
            
            response.raise_for_status()
            data = response.json()
            
    except httpx.HTTPError as e:
        # Return cached data if available on error
        if cached:
            _, cache_data = cached
            cache_data["location"]["name"] = location_name
            cache_data["cached"] = True
            cache_data["error_fallback"] = True
            return cache_data
        raise HTTPException(status_code=503, detail=f"Weather service unavailable: {str(e)}")
    
    # Parse current weather from WeatherAPI response
    current_data = data.get("current", {})
    condition = current_data.get("condition", {})
    
    current_weather = {
        "temperature": round(current_data.get("temp_f", 0)),
        "humidity": current_data.get("humidity", 0),
        "wind_speed": round(current_data.get("wind_mph", 0)),
        "wind_direction": current_data.get("wind_dir", "N"),
        "wind_direction_degrees": current_data.get("wind_degree", 0),
        "description": condition.get("text", "Unknown"),
        "icon": get_icon_for_condition(condition.get("text", "")),
        "feels_like": round(current_data.get("feelslike_f", 0)),
        "uv": current_data.get("uv", 0),
        "condition_icon": condition.get("icon", "")  # WeatherAPI's icon URL
    }
    
    # Parse forecast
    forecast_data = data.get("forecast", {}).get("forecastday", [])
    forecast = []
    
    for day in forecast_data:
        day_data = day.get("day", {})
        day_condition = day_data.get("condition", {})
        forecast.append({
            "date": day.get("date"),
            "temp_high": round(day_data.get("maxtemp_f", 0)),
            "temp_low": round(day_data.get("mintemp_f", 0)),
            "humidity": day_data.get("avghumidity", 0),
            "precipitation_chance": day_data.get("daily_chance_of_rain", 0),
            "wind_speed": round(day_data.get("maxwind_mph", 0)),
            "wind_direction": "N/A",  # Not provided in daily forecast
            "description": day_condition.get("text", "Unknown"),
            "icon": get_icon_for_condition(day_condition.get("text", "")),
            "condition_icon": day_condition.get("icon", "")
        })
    
    # Get location info from response
    location_data = data.get("location", {})
    api_location_name = f"{location_data.get('name', '')}, {location_data.get('region', '')}"
    
    result = {
        "location": {
            "latitude": latitude,
            "longitude": longitude,
            "name": location_name or api_location_name,
            "city": location_data.get("name"),
            "region": location_data.get("region"),
            "country": location_data.get("country")
        },
        "current": current_weather,
        "forecast": forecast,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "cached": False,
        "source": "WeatherAPI.com"
    }
    
    # Cache the result
    _weather_cache[cache_key] = (datetime.now(timezone.utc), result.copy())
    
    return result


@router.put("/location")
async def update_weather_location(
    latitude: float = Query(..., description="Latitude"),
    longitude: float = Query(..., description="Longitude"),
    location_name: Optional[str] = Query(None, description="Display name for location"),
    current_user: dict = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id)
):
    """Update tenant's weather location settings"""
    # Update tenant settings
    await db.tenants.update_one(
        {"id": tenant_id},
        {
            "$set": {
                "settings.weather_latitude": latitude,
                "settings.weather_longitude": longitude,
                "settings.weather_location_name": location_name,
                "settings.weather_updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {
        "message": "Weather location updated",
        "location": {
            "latitude": latitude,
            "longitude": longitude,
            "name": location_name
        }
    }


@router.get("/geocode")
async def geocode_location(
    query: str = Query(..., min_length=2, description="City name, ZIP code, or address"),
    current_user: dict = Depends(get_current_user)
):
    """
    Geocode a location query using WeatherAPI.com's search endpoint.
    Returns matching locations with coordinates.
    """
    if not WEATHER_API_KEY:
        raise HTTPException(status_code=503, detail="Weather service not configured")
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{WEATHER_API_BASE}/search.json",
                params={
                    "key": WEATHER_API_KEY,
                    "q": query
                }
            )
            
            if response.status_code == 400:
                return {"results": []}
            
            response.raise_for_status()
            data = response.json()
            
            results = []
            for item in data:
                results.append({
                    "name": item.get("name"),
                    "region": item.get("region"),
                    "country": item.get("country"),
                    "latitude": item.get("lat"),
                    "longitude": item.get("lon"),
                    "display_name": f"{item.get('name')}, {item.get('region')}, {item.get('country')}"
                })
            
            return {"results": results}
            
    except httpx.HTTPError as e:
        raise HTTPException(status_code=503, detail=f"Geocoding service unavailable: {str(e)}")


@router.get("/reverse-geocode")
async def reverse_geocode(
    latitude: float = Query(..., description="Latitude"),
    longitude: float = Query(..., description="Longitude"),
    current_user: dict = Depends(get_current_user)
):
    """
    Reverse geocode coordinates to get location name.
    Uses WeatherAPI.com's search with lat,lon query.
    """
    if not WEATHER_API_KEY:
        raise HTTPException(status_code=503, detail="Weather service not configured")
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # WeatherAPI accepts lat,lon as a query
            response = await client.get(
                f"{WEATHER_API_BASE}/search.json",
                params={
                    "key": WEATHER_API_KEY,
                    "q": f"{latitude},{longitude}"
                }
            )
            
            response.raise_for_status()
            data = response.json()
            
            if data and len(data) > 0:
                item = data[0]
                return {
                    "name": item.get("name"),
                    "region": item.get("region"),
                    "country": item.get("country"),
                    "latitude": item.get("lat"),
                    "longitude": item.get("lon"),
                    "display_name": f"{item.get('name')}, {item.get('region')}"
                }
            
            return {
                "name": "Unknown",
                "region": "",
                "country": "",
                "latitude": latitude,
                "longitude": longitude,
                "display_name": f"{latitude:.4f}, {longitude:.4f}"
            }
            
    except httpx.HTTPError as e:
        # Return coordinates as fallback
        return {
            "name": "Unknown",
            "latitude": latitude,
            "longitude": longitude,
            "display_name": f"{latitude:.4f}, {longitude:.4f}"
        }
