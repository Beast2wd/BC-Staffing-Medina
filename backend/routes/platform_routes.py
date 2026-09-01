"""
Platform settings routes - for managing BC Staffing platform-wide settings
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import Response
from typing import Optional, List
from datetime import datetime, timezone
from pydantic import BaseModel
import os
import uuid
import base64
import requests

from database import db
from auth import get_current_user, require_super_admin

router = APIRouter(prefix="/platform", tags=["Platform"])

# Emergent Object Storage configuration
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "bc-staffing"
_storage_key = None  # Module-level, cached after first init


def init_storage(force: bool = False):
    """Initialize Emergent Object Storage. Call once at startup."""
    global _storage_key
    if _storage_key and not force:
        return _storage_key
    if not EMERGENT_KEY:
        raise HTTPException(status_code=500, detail="Storage not configured: EMERGENT_LLM_KEY missing")
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    """Upload file to Emergent Object Storage."""
    key = init_storage()
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120
    )
    if resp.status_code == 404:
        # Storage key may have expired, reinit and retry
        key = init_storage(force=True)
        resp = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data, timeout=120
        )
    resp.raise_for_status()
    return resp.json()


def get_object(path: str) -> tuple:
    """Download file from Emergent Object Storage. Returns (content_bytes, content_type)."""
    key = init_storage()
    resp = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key}, timeout=60
    )
    if resp.status_code == 404:
        # Storage key may have expired, reinit and retry
        key = init_storage(force=True)
        resp = requests.get(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key}, timeout=60
        )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


class PlatformSettings(BaseModel):
    """Platform-wide settings schema"""
    logo_url: Optional[str] = None
    login_background_url: Optional[str] = None
    intro_video_url: Optional[str] = None
    intro_video_sound: Optional[bool] = False  # Whether to prompt users to enable sound
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
            "intro_video_url": None,
            "intro_video_sound": False,
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
            "hero_description": "Integrated platform that facilitate staffing, overtime and deployment accountability and tracking, data collection for organizational analysis, sharing, and reporting — enhancing operational efficiency, personnel management, and emergency response.",
            "intro_video_url": None,
            "intro_video_sound": False
        }
    
    # Return only public-safe fields
    return {
        "logo_url": settings.get("logo_url"),
        "login_background_url": settings.get("login_background_url"),
        "intro_video_url": settings.get("intro_video_url"),
        "intro_video_sound": settings.get("intro_video_sound", False),
        "primary_color": settings.get("primary_color", "#dc2626"),
        "secondary_color": settings.get("secondary_color", "#1e3a5f"),
        "accent_color": settings.get("accent_color", "#f59e0b"),
        "hero_backgrounds": settings.get("hero_backgrounds", []),
        "hero_title": settings.get("hero_title", "BC STAFFING"),
        "hero_subtitle": settings.get("hero_subtitle", "Fire & EMS Staffing Solutions"),
        "hero_description": settings.get("hero_description", "")
    }


@router.post("/upload-video")
async def upload_intro_video(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_super_admin())
):
    """Upload intro video for landing page (Super Admin only)"""
    # Validate file type
    allowed_types = ["video/mp4", "video/webm", "video/ogg", "video/quicktime"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail=f"Invalid file type. Allowed: {', '.join(allowed_types)}")
    
    # Validate file size (max 50MB)
    MAX_SIZE = 50 * 1024 * 1024  # 50MB
    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 50MB")
    
    # Generate unique filename and storage path
    ext = file.filename.split(".")[-1] if "." in file.filename else "mp4"
    filename = f"intro_video_{uuid.uuid4().hex[:8]}.{ext}"
    storage_path = f"{APP_NAME}/videos/{filename}"
    
    # Determine content type
    content_types = {
        "mp4": "video/mp4",
        "webm": "video/webm",
        "ogg": "video/ogg",
        "mov": "video/quicktime"
    }
    content_type = content_types.get(ext.lower(), "video/mp4")
    
    # Upload to Emergent Object Storage
    try:
        result = put_object(storage_path, content, content_type)
        video_url = f"/api/platform/video/{filename}"
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload video: {str(e)}")
    
    # Update platform settings with video URL and storage path
    await db.platform_settings.update_one(
        {"id": "platform"},
        {
            "$set": {
                "intro_video_url": video_url,
                "intro_video_storage_path": result.get("path", storage_path),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        },
        upsert=True
    )
    
    return {"message": "Video uploaded successfully", "video_url": video_url}


@router.get("/video/{filename}")
async def serve_video(filename: str, request=None):
    """Serve uploaded video files from Emergent Object Storage"""
    from fastapi import Request
    
    # Get storage path from platform settings
    settings = await db.platform_settings.find_one({"id": "platform"}, {"_id": 0})
    storage_path = settings.get("intro_video_storage_path") if settings else None
    
    if not storage_path:
        storage_path = f"{APP_NAME}/videos/{filename}"
    
    # Determine content type
    ext = filename.split(".")[-1].lower()
    content_types = {
        "mp4": "video/mp4",
        "webm": "video/webm",
        "ogg": "video/ogg",
        "mov": "video/quicktime"
    }
    content_type = content_types.get(ext, "video/mp4")
    
    try:
        data, _ = get_object(storage_path)
        return Response(content=data, media_type=content_type, headers={
            "Accept-Ranges": "bytes",
            "Content-Length": str(len(data))
        })
    except Exception as e:
        raise HTTPException(status_code=404, detail="Video not found")


@router.head("/video/{filename}")
async def head_video(filename: str):
    """Handle HEAD requests for video files from Emergent Object Storage"""
    # Get storage path from platform settings
    settings = await db.platform_settings.find_one({"id": "platform"}, {"_id": 0})
    storage_path = settings.get("intro_video_storage_path") if settings else None
    
    if not storage_path:
        storage_path = f"{APP_NAME}/videos/{filename}"
    
    ext = filename.split(".")[-1].lower()
    content_types = {
        "mp4": "video/mp4",
        "webm": "video/webm", 
        "ogg": "video/ogg",
        "mov": "video/quicktime"
    }
    content_type = content_types.get(ext, "video/mp4")
    
    try:
        data, _ = get_object(storage_path)
        return Response(
            content=None,
            headers={
                "Accept-Ranges": "bytes",
                "Content-Length": str(len(data)),
                "Content-Type": content_type,
                "Cache-Control": "public, max-age=86400"
            }
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Video not found")


@router.delete("/video")
async def delete_intro_video(
    current_user: dict = Depends(require_super_admin())
):
    """Delete intro video reference (Super Admin only). Note: Emergent storage doesn't support delete, so we soft-delete by clearing the DB reference."""
    # Update settings to remove video URL (soft-delete - storage doesn't support actual delete)
    await db.platform_settings.update_one(
        {"id": "platform"},
        {
            "$set": {
                "intro_video_url": None,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {"message": "Intro video removed"}
