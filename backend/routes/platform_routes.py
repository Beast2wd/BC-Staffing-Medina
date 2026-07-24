"""
Platform settings routes - for managing BC Staffing platform-wide settings
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, List
from datetime import datetime, timezone
from pydantic import BaseModel

from database import db
from auth import get_current_user, require_super_admin

router = APIRouter(prefix="/platform", tags=["Platform"])


class PlatformSettings(BaseModel):
    """Platform-wide settings schema"""
    logo_url: Optional[str] = None
    login_background_url: Optional[str] = None
    primary_color: Optional[str] = "#dc2626"
    secondary_color: Optional[str] = "#1e3a5f"
    accent_color: Optional[str] = "#f59e0b"
    hero_backgrounds: Optional[List[str]] = []
    hero_title: Optional[str] = "BC STAFFING"
    hero_subtitle: Optional[str] = "Fire & EMS Staffing Solutions"
    hero_description: Optional[str] = ""


@router.get("/settings")
async def get_platform_settings(current_user: dict = Depends(require_super_admin())):
    """Get platform-wide settings (Super Admin only)"""
    settings = await db.platform_settings.find_one({"id": "platform"}, {"_id": 0})
    
    if not settings:
        # Return defaults if no settings exist
        return {
            "id": "platform",
            "logo_url": "https://customer-assets-jai6qajn.emergentagent.net/job_medina-fire-staffing/artifacts/1pvs2bmb_IMG_9603.png",
            "login_background_url": "https://customer-assets-jai6qajn.emergentagent.net/job_medina-fire-staffing/artifacts/47tmgavx_IMG_9619.jpeg",
            "primary_color": "#dc2626",
            "secondary_color": "#1e3a5f",
            "accent_color": "#f59e0b",
            "hero_backgrounds": [
                "https://customer-assets-jai6qajn.emergentagent.net/job_medina-fire-staffing/artifacts/cr3ip2ql_IMG_9576.jpeg",
                "https://customer-assets-jai6qajn.emergentagent.net/job_medina-fire-staffing/artifacts/hqj9d35t_IMG_9577.jpeg",
                "https://customer-assets-jai6qajn.emergentagent.net/job_medina-fire-staffing/artifacts/3q4ymzj2_IMG_9578.jpeg",
                "https://customer-assets-jai6qajn.emergentagent.net/job_medina-fire-staffing/artifacts/0uf3omjc_IMG_9588.jpeg",
                "https://customer-assets-jai6qajn.emergentagent.net/job_medina-fire-staffing/artifacts/4iqph7i8_IMG_9582.jpeg"
            ],
            "hero_title": "BC STAFFING",
            "hero_subtitle": "Fire & EMS Staffing Solutions",
            "hero_description": "Integrated platform that facilitate staffing, overtime and deployment accountability and tracking, data collection for organizational analysis, sharing, and reporting — enhancing operational efficiency, personnel management, and emergency response."
        }
    
    return settings


@router.put("/settings")
async def update_platform_settings(
    settings: PlatformSettings,
    current_user: dict = Depends(require_super_admin())
):
    """Update platform-wide settings (Super Admin only)"""
    settings_doc = settings.model_dump()
    settings_doc["id"] = "platform"
    settings_doc["updated_at"] = datetime.now(timezone.utc).isoformat()
    settings_doc["updated_by"] = current_user.get("payroll_number")
    
    await db.platform_settings.update_one(
        {"id": "platform"},
        {"$set": settings_doc},
        upsert=True
    )
    
    return {"message": "Platform settings updated successfully"}


@router.get("/settings/public")
async def get_public_platform_settings():
    """Get platform settings for public pages (no auth required)"""
    settings = await db.platform_settings.find_one({"id": "platform"}, {"_id": 0})
    
    if not settings:
        return {
            "logo_url": "https://customer-assets-jai6qajn.emergentagent.net/job_medina-fire-staffing/artifacts/1pvs2bmb_IMG_9603.png",
            "login_background_url": "https://customer-assets-jai6qajn.emergentagent.net/job_medina-fire-staffing/artifacts/47tmgavx_IMG_9619.jpeg",
            "primary_color": "#dc2626",
            "secondary_color": "#1e3a5f",
            "accent_color": "#f59e0b",
            "hero_backgrounds": [
                "https://customer-assets-jai6qajn.emergentagent.net/job_medina-fire-staffing/artifacts/cr3ip2ql_IMG_9576.jpeg",
                "https://customer-assets-jai6qajn.emergentagent.net/job_medina-fire-staffing/artifacts/hqj9d35t_IMG_9577.jpeg",
                "https://customer-assets-jai6qajn.emergentagent.net/job_medina-fire-staffing/artifacts/3q4ymzj2_IMG_9578.jpeg",
                "https://customer-assets-jai6qajn.emergentagent.net/job_medina-fire-staffing/artifacts/0uf3omjc_IMG_9588.jpeg",
                "https://customer-assets-jai6qajn.emergentagent.net/job_medina-fire-staffing/artifacts/4iqph7i8_IMG_9582.jpeg"
            ],
            "hero_title": "BC STAFFING",
            "hero_subtitle": "Fire & EMS Staffing Solutions",
            "hero_description": "Integrated platform that facilitate staffing, overtime and deployment accountability and tracking, data collection for organizational analysis, sharing, and reporting — enhancing operational efficiency, personnel management, and emergency response."
        }
    
    # Return only public-safe fields
    return {
        "logo_url": settings.get("logo_url"),
        "login_background_url": settings.get("login_background_url"),
        "primary_color": settings.get("primary_color", "#dc2626"),
        "secondary_color": settings.get("secondary_color", "#1e3a5f"),
        "accent_color": settings.get("accent_color", "#f59e0b"),
        "hero_backgrounds": settings.get("hero_backgrounds", []),
        "hero_title": settings.get("hero_title", "BC STAFFING"),
        "hero_subtitle": settings.get("hero_subtitle", "Fire & EMS Staffing Solutions"),
        "hero_description": settings.get("hero_description", "")
    }
