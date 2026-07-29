"""
Weather API routes - fetches weather data from Open-Meteo API
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional
from datetime import datetime, timezone
import httpx

from database import db
from auth import get_current_user, get_tenant_id

router = APIRouter(prefix="/weather", tags=["Weather"])

# Open-Meteo API base URL
OPEN_METEO_API = "https://api.open-meteo.com/v1/forecast"

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
    """
    # If no coordinates provided, get from tenant settings
    if latitude is None or longitude is None:
        tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
        if tenant and tenant.get("settings"):
            settings = tenant["settings"]
            latitude = settings.get("weather_latitude")
            longitude = settings.get("weather_longitude")
    
    # Default to Medina, OH if still no coordinates
    if latitude is None or longitude is None:
        latitude = 41.1381
        longitude = -81.8637
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                OPEN_METEO_API,
                params={
                    "latitude": latitude,
                    "longitude": longitude,
                    "current": "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m",
                    "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,relative_humidity_2m_max,wind_speed_10m_max",
                    "temperature_unit": "fahrenheit",
                    "wind_speed_unit": "mph",
                    "precipitation_unit": "inch",
                    "timezone": "America/New_York",
                    "forecast_days": 4  # Today + 3 days
                }
            )
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=503, detail=f"Weather service unavailable: {str(e)}")
    
    # Parse current weather
    current = data.get("current", {})
    current_weather_info = get_weather_info(current.get("weather_code", 0))
    
    current_weather = {
        "temperature": round(current.get("temperature_2m", 0)),
        "humidity": current.get("relative_humidity_2m", 0),
        "wind_speed": round(current.get("wind_speed_10m", 0)),
        "description": current_weather_info["description"],
        "icon": current_weather_info["icon"]
    }
    
    # Parse daily forecast
    daily = data.get("daily", {})
    forecast = []
    
    for i in range(min(4, len(daily.get("time", [])))):
        weather_info = get_weather_info(daily.get("weather_code", [0])[i])
        forecast.append({
            "date": daily.get("time", [])[i],
            "temp_high": round(daily.get("temperature_2m_max", [0])[i]),
            "temp_low": round(daily.get("temperature_2m_min", [0])[i]),
            "humidity": daily.get("relative_humidity_2m_max", [0])[i],
            "precipitation_chance": daily.get("precipitation_probability_max", [0])[i],
            "wind_speed": round(daily.get("wind_speed_10m_max", [0])[i]),
            "description": weather_info["description"],
            "icon": weather_info["icon"]
        })
    
    return {
        "location": {
            "latitude": latitude,
            "longitude": longitude
        },
        "current": current_weather,
        "forecast": forecast,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }


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
