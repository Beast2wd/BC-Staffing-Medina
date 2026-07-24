"""
Tenant Management Routes (Super Admin Only)
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel
import uuid

from database import db
from tenant_models import (
    Tenant, TenantCreate, TenantUpdate, TenantResponse, TenantStatus, TenantSettings,
    TenantBrandingUpdate
)
from auth import get_current_user, require_super_admin, hash_password
from tenant_templates import (
    TEMPLATES, DEFAULT_SHIFTS, DEFAULT_RANKS, DEFAULT_APPARATUS_TYPES,
    get_template, get_all_templates
)

router = APIRouter(prefix="/tenants", tags=["Tenant Management"])

# Default password for new tenant admins
DEFAULT_ADMIN_PASSWORD = "changeme123"


# ===================== TEMPLATE MODELS =====================

class StationConfig(BaseModel):
    number: str
    name: str
    battalion: str
    min_staffing: int = 4

class BattalionConfig(BaseModel):
    number: str
    name: str

class ApparatusConfig(BaseModel):
    station: str
    name: str
    type: str

class TenantOnboardingRequest(BaseModel):
    # Basic Info
    name: str
    subdomain: str
    admin_email: str
    admin_name: str = "Admin User"
    admin_payroll: str = "100001"
    
    # Template Selection
    template: str = "blank"  # blank, small, medium, large, or copy
    copy_from_tenant_id: Optional[str] = None
    
    # Custom Configuration (overrides template if provided)
    shifts: Optional[List[str]] = None
    battalions: Optional[List[BattalionConfig]] = None
    stations: Optional[List[StationConfig]] = None
    apparatus_types: Optional[List[str]] = None
    ranks: Optional[List[str]] = None


@router.get("", response_model=List[TenantResponse])
async def list_tenants(current_user: dict = Depends(require_super_admin())):
    """List all tenants (Super Admin only)"""
    tenants = await db.tenants.find({}, {"_id": 0}).to_list(1000)
    
    # Add counts for each tenant
    result = []
    for tenant in tenants:
        user_count = await db.users.count_documents({"tenant_id": tenant["id"]})
        station_count = await db.stations.count_documents({"tenant_id": tenant["id"]})
        result.append(TenantResponse(
            **tenant,
            user_count=user_count,
            station_count=station_count
        ))
    
    return result


# ===================== TEMPLATE ENDPOINTS =====================

@router.get("/templates")
async def get_templates(current_user: dict = Depends(require_super_admin())):
    """Get all available onboarding templates"""
    return {
        "templates": get_all_templates(),
        "defaults": {
            "shifts": DEFAULT_SHIFTS,
            "ranks": DEFAULT_RANKS,
            "apparatus_types": DEFAULT_APPARATUS_TYPES
        }
    }


@router.get("/templates/{template_id}")
async def get_template_details(template_id: str, current_user: dict = Depends(require_super_admin())):
    """Get detailed configuration for a specific template"""
    template = get_template(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return {
        "id": template_id,
        **template,
        "defaults": {
            "shifts": DEFAULT_SHIFTS,
            "ranks": DEFAULT_RANKS,
            "apparatus_types": DEFAULT_APPARATUS_TYPES
        }
    }


# ===================== BRANDING ROUTES =====================
# IMPORTANT: These routes MUST be defined BEFORE /{tenant_id} routes
# Otherwise FastAPI will interpret "branding" as a tenant_id

@router.get("/branding")
async def get_current_tenant_branding(current_user: dict = Depends(get_current_user)):
    """Get branding settings for the current user's tenant"""
    tenant_id = current_user.get("tenant_id")
    
    if not tenant_id:
        # Return default branding for users without a tenant
        return {
            "custom_branding": False,
            "logo_url": None,
            "login_background_url": None,
            "primary_color": "#dc2626",
            "secondary_color": "#1e3a5f",
            "accent_color": "#f59e0b",
            "tenant_name": "BC Staffing"
        }
    
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    settings = tenant.get("settings", {})
    return {
        "custom_branding": settings.get("custom_branding", False),
        "logo_url": settings.get("logo_url"),
        "login_background_url": settings.get("login_background_url"),
        "primary_color": settings.get("primary_color") or "#dc2626",
        "secondary_color": settings.get("secondary_color") or "#1e3a5f",
        "accent_color": settings.get("accent_color") or "#f59e0b",
        "tenant_name": tenant.get("name", "BC Staffing")
    }


@router.put("/branding")
async def update_tenant_branding(
    branding: TenantBrandingUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update branding settings for the current user's tenant (Admin only)"""
    # Check if user is admin
    if current_user.get("role") not in ["admin"]:
        raise HTTPException(status_code=403, detail="Only admins can update branding")
    
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=400, detail="No tenant associated with user")
    
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Build the update document
    update_fields = {
        "settings.custom_branding": branding.custom_branding,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if branding.logo_url is not None:
        update_fields["settings.logo_url"] = branding.logo_url
    if branding.login_background_url is not None:
        update_fields["settings.login_background_url"] = branding.login_background_url
    if branding.primary_color is not None:
        update_fields["settings.primary_color"] = branding.primary_color
    if branding.secondary_color is not None:
        update_fields["settings.secondary_color"] = branding.secondary_color
    if branding.accent_color is not None:
        update_fields["settings.accent_color"] = branding.accent_color
    
    await db.tenants.update_one(
        {"id": tenant_id},
        {"$set": update_fields}
    )
    
    return {"message": "Branding updated successfully"}


@router.post("/branding/logo")
async def upload_tenant_logo(current_user: dict = Depends(get_current_user)):
    """
    Get a pre-signed URL or instructions for logo upload.
    For simplicity, we accept base64 encoded images directly in the branding update.
    """
    if current_user.get("role") not in ["admin"]:
        raise HTTPException(status_code=403, detail="Only admins can upload logos")
    
    return {
        "message": "To upload a logo, use the PUT /api/tenants/branding endpoint with logo_url field",
        "instructions": [
            "Convert your logo image to base64 format",
            "Or host the image on an external service and provide the URL",
            "Recommended size: 200x200 pixels",
            "Supported formats: PNG, JPG, SVG"
        ]
    }


@router.delete("/branding/logo")
async def delete_tenant_logo(current_user: dict = Depends(get_current_user)):
    """Remove the custom logo and revert to default"""
    if current_user.get("role") not in ["admin"]:
        raise HTTPException(status_code=403, detail="Only admins can delete logos")
    
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=400, detail="No tenant associated with user")
    
    await db.tenants.update_one(
        {"id": tenant_id},
        {
            "$set": {
                "settings.logo_url": None,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {"message": "Logo removed successfully"}


@router.post("/branding/reset")
async def reset_tenant_branding(current_user: dict = Depends(get_current_user)):
    """Reset all branding to defaults"""
    if current_user.get("role") not in ["admin"]:
        raise HTTPException(status_code=403, detail="Only admins can reset branding")
    
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=400, detail="No tenant associated with user")
    
    await db.tenants.update_one(
        {"id": tenant_id},
        {
            "$set": {
                "settings.custom_branding": False,
                "settings.logo_url": None,
                "settings.primary_color": "#dc2626",
                "settings.secondary_color": "#1e3a5f",
                "settings.accent_color": "#f59e0b",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {"message": "Branding reset to defaults"}


@router.get("/copy-source/{tenant_id}")
async def get_tenant_for_copy(tenant_id: str, current_user: dict = Depends(require_super_admin())):
    """Get a tenant's full configuration for copying to a new tenant"""
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Get all battalions
    battalions = await db.battalions.find({"tenant_id": tenant_id}, {"_id": 0}).to_list(100)
    
    # Get all stations
    stations = await db.stations.find({"tenant_id": tenant_id}, {"_id": 0}).to_list(100)
    
    # Get apparatus from stations
    apparatus = []
    for station in stations:
        for app in station.get("apparatus", []):
            apparatus.append({
                "station": station.get("station_number"),
                "name": app.get("name"),
                "type": app.get("type", "Engine")
            })
    
    return {
        "tenant": tenant,
        "battalions": [{"number": b.get("battalion_number"), "name": b.get("name")} for b in battalions],
        "stations": [
            {
                "number": s.get("station_number"),
                "name": s.get("name"),
                "battalion": s.get("battalion_id", "").replace(f"bat-{tenant_id}-", ""),
                "min_staffing": s.get("minimum_staffing", 4)
            }
            for s in stations
        ],
        "apparatus": apparatus
    }


@router.get("/{tenant_id}", response_model=TenantResponse)
async def get_tenant(tenant_id: str, current_user: dict = Depends(require_super_admin())):
    """Get a specific tenant"""
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    user_count = await db.users.count_documents({"tenant_id": tenant_id})
    station_count = await db.stations.count_documents({"tenant_id": tenant_id})
    
    return TenantResponse(**tenant, user_count=user_count, station_count=station_count)


@router.post("", response_model=TenantResponse)
async def create_tenant(data: TenantCreate, current_user: dict = Depends(require_super_admin())):
    """Create a new tenant with initial admin user (simple creation)"""
    # Check subdomain uniqueness
    existing = await db.tenants.find_one({"subdomain": data.subdomain.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Subdomain already in use")
    
    tenant_id = f"tenant-{data.subdomain.lower()}"
    
    # Append "BC Staffing" to name if not already present
    tenant_name = data.name
    if not tenant_name.lower().endswith("bc staffing"):
        tenant_name = f"{tenant_name} BC Staffing"
    
    # Create tenant
    tenant_doc = {
        "id": tenant_id,
        "name": tenant_name,
        "subdomain": data.subdomain.lower(),
        "status": TenantStatus.ACTIVE,
        "settings": (data.settings or TenantSettings()).model_dump(),
        "admin_email": data.admin_email,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_active": True
    }
    
    await db.tenants.insert_one(tenant_doc)
    
    # Create initial admin user for the tenant
    admin_id = str(uuid.uuid4())
    admin_doc = {
        "id": admin_id,
        "tenant_id": tenant_id,
        "payroll_number": data.admin_payroll,
        "password_hash": hash_password(DEFAULT_ADMIN_PASSWORD),
        "name": data.admin_name,
        "rank": "Administrator",
        "role": "admin",
        "is_active": True,
        "must_change_password": True,
        "email": data.admin_email,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(admin_doc)
    
    return TenantResponse(
        **tenant_doc,
        user_count=1,
        station_count=0
    )


@router.post("/onboard")
async def onboard_tenant(data: TenantOnboardingRequest, current_user: dict = Depends(require_super_admin())):
    """
    Create a new tenant with full onboarding configuration.
    Supports templates, copying from existing tenants, and custom configuration.
    """
    # Check subdomain uniqueness
    existing = await db.tenants.find_one({"subdomain": data.subdomain.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Subdomain already in use")
    
    tenant_id = f"tenant-{data.subdomain.lower()}"
    
    # Append "BC Staffing" to name if not already present
    tenant_name = data.name
    if not tenant_name.lower().endswith("bc staffing"):
        tenant_name = f"{tenant_name} BC Staffing"
    
    # Get configuration from template or copy source
    battalions_config = []
    stations_config = []
    apparatus_config = []
    shifts = data.shifts or DEFAULT_SHIFTS
    ranks = data.ranks or DEFAULT_RANKS
    
    if data.template == "copy" and data.copy_from_tenant_id:
        # Copy from existing tenant
        source_battalions = await db.battalions.find({"tenant_id": data.copy_from_tenant_id}, {"_id": 0}).to_list(100)
        source_stations = await db.stations.find({"tenant_id": data.copy_from_tenant_id}, {"_id": 0}).to_list(100)
        
        battalions_config = [
            {"number": b.get("battalion_number"), "name": b.get("name")}
            for b in source_battalions
        ]
        stations_config = [
            {
                "number": s.get("station_number"),
                "name": s.get("name"),
                "battalion": s.get("battalion_id", "").split("-")[-1],  # Extract battalion number
                "min_staffing": s.get("minimum_staffing", 4)
            }
            for s in source_stations
        ]
        # Copy apparatus from stations
        for s in source_stations:
            for app in s.get("apparatus", []):
                apparatus_config.append({
                    "station": s.get("station_number"),
                    "name": app.get("name"),
                    "type": app.get("type", "Engine")
                })
    elif data.template != "blank":
        # Use template
        template = get_template(data.template)
        battalions_config = template.get("battalions", [])
        stations_config = template.get("stations", [])
        apparatus_config = template.get("apparatus", [])
    
    # Override with custom configuration if provided
    if data.battalions:
        battalions_config = [b.model_dump() for b in data.battalions]
    if data.stations:
        stations_config = [s.model_dump() for s in data.stations]
    
    # Create tenant record
    tenant_doc = {
        "id": tenant_id,
        "name": tenant_name,
        "subdomain": data.subdomain.lower(),
        "status": TenantStatus.ACTIVE,
        "settings": TenantSettings(
            shifts=shifts,
            ranks=ranks,
            apparatus_types=data.apparatus_types or [a["name"] for a in DEFAULT_APPARATUS_TYPES]
        ).model_dump(),
        "admin_email": data.admin_email,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_active": True
    }
    
    await db.tenants.insert_one(tenant_doc)
    
    # Create initial admin user
    admin_id = str(uuid.uuid4())
    admin_doc = {
        "id": admin_id,
        "tenant_id": tenant_id,
        "payroll_number": data.admin_payroll,
        "password_hash": hash_password(DEFAULT_ADMIN_PASSWORD),
        "name": data.admin_name,
        "rank": "Administrator",
        "role": "admin",
        "is_active": True,
        "is_super_admin": False,
        "must_change_password": True,
        "email": data.admin_email,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(admin_doc)
    
    # Create battalions
    battalion_docs = []
    for bat in battalions_config:
        battalion_docs.append({
            "id": f"bat-{tenant_id}-{bat['number']}",
            "tenant_id": tenant_id,
            "battalion_number": bat["number"],
            "name": bat["name"],
            "chief_payroll": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    if battalion_docs:
        await db.battalions.insert_many(battalion_docs)
    
    # Create stations with apparatus
    station_docs = []
    for sta in stations_config:
        # Find apparatus for this station
        station_apparatus = [
            {"name": app["name"], "type": app["type"]}
            for app in apparatus_config
            if app["station"] == sta["number"]
        ]
        
        station_docs.append({
            "id": f"sta-{tenant_id}-{sta['number']}",
            "tenant_id": tenant_id,
            "station_number": sta["number"],
            "name": sta["name"],
            "battalion_id": f"bat-{tenant_id}-{sta['battalion']}",
            "minimum_staffing": sta.get("min_staffing", 4),
            "apparatus": station_apparatus,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    if station_docs:
        await db.stations.insert_many(station_docs)
    
    return {
        "tenant": TenantResponse(
            **tenant_doc,
            user_count=1,
            station_count=len(station_docs)
        ),
        "created": {
            "battalions": len(battalion_docs),
            "stations": len(station_docs),
            "admin_user": data.admin_name
        },
        "admin_credentials": {
            "payroll_number": data.admin_payroll,
            "temporary_password": DEFAULT_ADMIN_PASSWORD,
            "must_change": True
        }
    }


@router.put("/{tenant_id}", response_model=TenantResponse)
async def update_tenant(
    tenant_id: str, 
    data: TenantUpdate, 
    current_user: dict = Depends(require_super_admin())
):
    """Update a tenant"""
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    # Convert settings to dict if present
    if "settings" in update_data and update_data["settings"]:
        update_data["settings"] = update_data["settings"].model_dump()
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.tenants.find_one_and_update(
        {"id": tenant_id},
        {"$set": update_data},
        return_document=True
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    del result["_id"]
    
    user_count = await db.users.count_documents({"tenant_id": tenant_id})
    station_count = await db.stations.count_documents({"tenant_id": tenant_id})
    
    return TenantResponse(**result, user_count=user_count, station_count=station_count)


@router.delete("/{tenant_id}")
async def deactivate_tenant(tenant_id: str, current_user: dict = Depends(require_super_admin())):
    """Deactivate a tenant (soft delete)"""
    result = await db.tenants.update_one(
        {"id": tenant_id},
        {"$set": {"is_active": False, "status": TenantStatus.SUSPENDED}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Also deactivate all users in this tenant
    await db.users.update_many(
        {"tenant_id": tenant_id},
        {"$set": {"is_active": False}}
    )
    
    return {"message": "Tenant deactivated"}


@router.post("/{tenant_id}/activate")
async def activate_tenant(tenant_id: str, current_user: dict = Depends(require_super_admin())):
    """Reactivate a deactivated tenant"""
    result = await db.tenants.update_one(
        {"id": tenant_id},
        {"$set": {"is_active": True, "status": TenantStatus.ACTIVE}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    return {"message": "Tenant activated"}


@router.get("/{tenant_id}/stats")
async def get_tenant_stats(tenant_id: str, current_user: dict = Depends(require_super_admin())):
    """Get detailed statistics for a tenant"""
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    stats = {
        "tenant": tenant,
        "counts": {
            "users": await db.users.count_documents({"tenant_id": tenant_id}),
            "active_users": await db.users.count_documents({"tenant_id": tenant_id, "is_active": True}),
            "personnel": await db.personnel.count_documents({"tenant_id": tenant_id}),
            "stations": await db.stations.count_documents({"tenant_id": tenant_id}),
            "battalions": await db.battalions.count_documents({"tenant_id": tenant_id}),
            "staffing_records": await db.staffing_records.count_documents({"tenant_id": tenant_id}),
            "overtime_records": await db.overtime_records.count_documents({"tenant_id": tenant_id}),
            "deployments": await db.deployments.count_documents({"tenant_id": tenant_id}),
        }
    }
    
    return stats


@router.post("/{tenant_id}/impersonate")
async def impersonate_tenant(
    tenant_id: str, 
    mode: str = "view",  # "view" or "full"
    current_user: dict = Depends(require_super_admin())
):
    """
    Generate an impersonation token for a tenant.
    - mode="view": Read-only access to view tenant data
    - mode="full": Full admin access for testing/support
    """
    from auth import create_token
    
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    if not tenant.get("is_active"):
        raise HTTPException(status_code=400, detail="Cannot impersonate inactive tenant")
    
    # Find the tenant's admin user (or first active user)
    tenant_admin = await db.users.find_one(
        {"tenant_id": tenant_id, "role": "admin", "is_active": True},
        {"_id": 0}
    )
    
    if not tenant_admin:
        tenant_admin = await db.users.find_one(
            {"tenant_id": tenant_id, "is_active": True},
            {"_id": 0}
        )
    
    if not tenant_admin:
        raise HTTPException(status_code=400, detail="No active users in this tenant")
    
    # For impersonation, we use the super admin's ID but with the tenant context
    impersonation_role = "admin" if mode == "full" else "viewer"
    
    # Create token with super admin privileges but scoped to tenant
    token = create_token(
        user_id=current_user["id"],  # Super admin's ID for audit
        role=impersonation_role,
        tenant_id=tenant_id,
        is_super_admin=True  # Keep super admin flag
    )
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "impersonation": {
            "tenant_id": tenant_id,
            "tenant_name": tenant.get("name"),
            "mode": mode,
            "impersonating_as": tenant_admin.get("name"),
            "original_user": current_user.get("name")
        }
    }


@router.get("/{tenant_id}/data-preview")
async def get_tenant_data_preview(tenant_id: str, current_user: dict = Depends(require_super_admin())):
    """Get a preview of tenant data for support/testing purposes (view-only)"""
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Get sample data from key collections
    preview = {
        "tenant": tenant,
        "users": await db.users.find(
            {"tenant_id": tenant_id}, 
            {"_id": 0, "password_hash": 0}
        ).limit(10).to_list(10),
        "personnel": await db.personnel.find(
            {"tenant_id": tenant_id}, 
            {"_id": 0}
        ).limit(10).to_list(10),
        "stations": await db.stations.find(
            {"tenant_id": tenant_id}, 
            {"_id": 0}
        ).to_list(20),
        "battalions": await db.battalions.find(
            {"tenant_id": tenant_id}, 
            {"_id": 0}
        ).to_list(10),
        "recent_staffing": await db.staffing_records.find(
            {"tenant_id": tenant_id}, 
            {"_id": 0}
        ).sort("date", -1).limit(5).to_list(5),
        "recent_overtime": await db.overtime_records.find(
            {"tenant_id": tenant_id}, 
            {"_id": 0}
        ).sort("date", -1).limit(5).to_list(5),
    }
    
    return preview
