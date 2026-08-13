"""
Weather API routes - fetches weather data from Open-Meteo API
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional
from datetime import datetime, timezone, timedelta
import httpx

from database import db
from auth import get_current_user, get_tenant_id

router = APIRouter(prefix="/weather", tags=["Weather"])

# Open-Meteo API base URL
OPEN_METEO_API = "https://api.open-meteo.com/v1/forecast"

# Simple in-memory cache for weather data (10 minute TTL)
_weather_cache = {}
CACHE_TTL_SECONDS = 600  # 10 minutes

# Weather code to description mapping
WEATHER_CODES = {
    0: {"description": "Clear sky", "icon": "sun"},
    1: {"description": "Mainly clear", "icon": "sun"},
    2: {"description": "Partly cloudy", "icon": "cloud-sun"},
    3: {"description": "Overcast", "icon": "cloud"},
    45: {"description": "Foggy", "icon": "cloud-fog"},
    48: {"description": "Depositing rime fog", "icon": "cloud-fog"},
    51: {"description": "Light drizzle", "icon": "cloud-drizzle"},
    53: {"description": "Moderate drizzle", "icon": "cloud-drizzle"},
    55: {"description": "Dense drizzle", "icon": "cloud-drizzle"},
    56: {"description": "Light freezing drizzle", "icon": "cloud-drizzle"},
    57: {"description": "Dense freezing drizzle", "icon": "cloud-drizzle"},
    61: {"description": "Slight rain", "icon": "cloud-rain"},
    63: {"description": "Moderate rain", "icon": "cloud-rain"},
    65: {"description": "Heavy rain", "icon": "cloud-rain"},
    66: {"description": "Light freezing rain", "icon": "cloud-rain"},
    67: {"description": "Heavy freezing rain", "icon": "cloud-rain"},
    71: {"description": "Slight snow", "icon": "cloud-snow"},
    73: {"description": "Moderate snow", "icon": "cloud-snow"},
    75: {"description": "Heavy snow", "icon": "cloud-snow"},
    77: {"description": "Snow grains", "icon": "cloud-snow"},
    80: {"description": "Slight rain showers", "icon": "cloud-rain"},
    81: {"description": "Moderate rain showers", "icon": "cloud-rain"},
    82: {"description": "Violent rain showers", "icon": "cloud-rain"},
    85: {"description": "Slight snow showers", "icon": "cloud-snow"},
    86: {"description": "Heavy snow showers", "icon": "cloud-snow"},
    95: {"description": "Thunderstorm", "icon": "cloud-lightning"},
    96: {"description": "Thunderstorm with slight hail", "icon": "cloud-lightning"},
    99: {"description": "Thunderstorm with heavy hail", "icon": "cloud-lightning"},
}


def get_weather_info(code: int) -> dict:
    """Get weather description and icon from code"""
    return WEATHER_CODES.get(code, {"description": "Unknown", "icon": "cloud"})


def degrees_to_compass(degrees: float) -> str:
    """Convert wind direction degrees to compass direction"""
    if degrees is None:
        return "N/A"
    # Normalize degrees to 0-360
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
    Get current weather and 3-day forecast.
    If lat/long not provided, uses tenant's configured location.
    Results are cached for 10 minutes to prevent rate limiting.
    """
    location_name = None
    
    # If no coordinates provided, get from tenant settings
    if latitude is None or longitude is None:
        tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
        if tenant and tenant.get("settings"):
            settings = tenant["settings"]
            latitude = settings.get("weather_latitude")
            longitude = settings.get("weather_longitude")
            location_name = settings.get("weather_location_name")
    
    # Default to Medina, OH if still no coordinates
    if latitude is None or longitude is None:
        latitude = 41.1381
        longitude = -81.8637
        location_name = "Medina, OH"
    
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
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                OPEN_METEO_API,
                params={
                    "latitude": latitude,
                    "longitude": longitude,
                    "current": "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m",
                    "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,relative_humidity_2m_max,wind_speed_10m_max,wind_direction_10m_dominant",
                    "temperature_unit": "fahrenheit",
                    "wind_speed_unit": "mph",
                    "precipitation_unit": "inch",
                    "timezone": "America/New_York",
                    "forecast_days": 4  # Today + 3 days
                }
            )
            
            # Handle rate limiting specifically
            if response.status_code == 429:
                # Return cached data if available, even if expired
                if cached:
                    _, cache_data = cached
                    cache_data["location"]["name"] = location_name
                    cache_data["cached"] = True
                    cache_data["rate_limited"] = True
                    return cache_data
                raise HTTPException(status_code=503, detail="Weather service is temporarily unavailable due to rate limiting. Please try again in a few minutes.")
            
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
    
    # Parse current weather
    current = data.get("current", {})
    current_weather_info = get_weather_info(current.get("weather_code", 0))
    wind_direction_degrees = current.get("wind_direction_10m")
    
    current_weather = {
        "temperature": round(current.get("temperature_2m", 0)),
        "humidity": current.get("relative_humidity_2m", 0),
        "wind_speed": round(current.get("wind_speed_10m", 0)),
        "wind_direction": degrees_to_compass(wind_direction_degrees),
        "wind_direction_degrees": wind_direction_degrees,
        "description": current_weather_info["description"],
        "icon": current_weather_info["icon"]
    }
    
    # Parse daily forecast
    daily = data.get("daily", {})
    forecast = []
    
    for i in range(min(4, len(daily.get("time", [])))):
        weather_info = get_weather_info(daily.get("weather_code", [0])[i])
        daily_wind_dir = daily.get("wind_direction_10m_dominant", [None])[i] if daily.get("wind_direction_10m_dominant") else None
        forecast.append({
            "date": daily.get("time", [])[i],
            "temp_high": round(daily.get("temperature_2m_max", [0])[i]),
            "temp_low": round(daily.get("temperature_2m_min", [0])[i]),
            "humidity": daily.get("relative_humidity_2m_max", [0])[i],
            "precipitation_chance": daily.get("precipitation_probability_max", [0])[i],
            "wind_speed": round(daily.get("wind_speed_10m_max", [0])[i]),
            "wind_direction": degrees_to_compass(daily_wind_dir),
            "description": weather_info["description"],
            "icon": weather_info["icon"]
        })
    
    result = {
        "location": {
            "latitude": latitude,
            "longitude": longitude,
            "name": location_name
        },
        "current": current_weather,
        "forecast": forecast,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "cached": False
    }
    
    # Cache the result
    _weather_cache[cache_key] = (datetime.now(timezone.utc), result.copy())
    
    return result


@router.put("/location")
async def update_weather_location(
    latitude: float = Query(..., description="Latitude"),
    longitude: float = Query(..., description="Longitude"),
    location_name: Optional[str] = Query(None, description="Location display name"),
    current_user: dict = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id)
):
    """Update tenant's weather location settings (Admin only)"""
    # Check if user is admin
    if current_user.get("role") not in ["admin", "battalion_chief"]:
        if not current_user.get("is_super_admin"):
            raise HTTPException(status_code=403, detail="Only admins can update weather location")
    
    await db.tenants.update_one(
        {"id": tenant_id},
        {
            "$set": {
                "settings.weather_latitude": latitude,
                "settings.weather_longitude": longitude,
                "settings.weather_location_name": location_name,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {
        "message": "Weather location updated successfully",
        "location": {
            "latitude": latitude,
            "longitude": longitude,
            "name": location_name
        }
    }


@router.get("/location")
async def get_weather_location(
    current_user: dict = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id)
):
    """Get tenant's configured weather location"""
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    settings = tenant.get("settings", {})
    
    return {
        "latitude": settings.get("weather_latitude"),
        "longitude": settings.get("weather_longitude"),
        "location_name": settings.get("weather_location_name"),
        "is_configured": settings.get("weather_latitude") is not None
    }



@router.get("/geocode")
async def geocode_location(
    query: str = Query(..., description="Location to geocode (city, ZIP, address)"),
    current_user: dict = Depends(get_current_user)
):
    """
    Geocode a location string to coordinates.
    This proxies through the backend to avoid CORS issues with Nominatim.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                "https://nominatim.openstreetmap.org/search",
                params={
                    "q": query,
                    "format": "json",
                    "limit": 1,
                    "addressdetails": 1,
                    "countrycodes": "us"
                },
                headers={
                    "User-Agent": "BCStaffing/1.0 (Fire Department Staffing Application)"
                }
            )
            response.raise_for_status()
            data = response.json()
            
            if not data:
                raise HTTPException(status_code=404, detail="Location not found")
            
            result = data[0]
            return {
                "latitude": float(result["lat"]),
                "longitude": float(result["lon"]),
                "display_name": result["display_name"],
                "short_name": result["display_name"].split(",")[0]
            }
    except httpx.HTTPError as e:
        raise HTTPException(status_code=503, detail=f"Geocoding service unavailable: {str(e)}")


@router.get("/reverse-geocode")
async def reverse_geocode_location(
    latitude: float = Query(..., description="Latitude"),
    longitude: float = Query(..., description="Longitude"),
    current_user: dict = Depends(get_current_user)
):
    """
    Reverse geocode coordinates to a location name.
    This proxies through the backend to avoid CORS issues with Nominatim.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                "https://nominatim.openstreetmap.org/reverse",
                params={
                    "lat": latitude,
                    "lon": longitude,
                    "format": "json"
                },
                headers={
                    "User-Agent": "BCStaffing/1.0 (Fire Department Staffing Application)"
                }
            )
            response.raise_for_status()
            data = response.json()
            
            address = data.get("address", {})
            name = (
                address.get("city") or 
                address.get("town") or 
                address.get("county") or 
                address.get("village") or 
                "Unknown Location"
            )
            
            return {
                "latitude": latitude,
                "longitude": longitude,
                "location_name": name,
                "display_name": data.get("display_name", name)
            }
    except httpx.HTTPError as e:
        raise HTTPException(status_code=503, detail=f"Geocoding service unavailable: {str(e)}")
