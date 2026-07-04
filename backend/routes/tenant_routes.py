"""
Tenant Management Routes (Super Admin Only)
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List
from datetime import datetime, timezone
import uuid

from database import db
from tenant_models import (
    Tenant, TenantCreate, TenantUpdate, TenantResponse, TenantStatus, TenantSettings
)
from auth import get_current_user, require_super_admin, hash_password

router = APIRouter(prefix="/tenants", tags=["Tenant Management"])

# Default password for new tenant admins
DEFAULT_ADMIN_PASSWORD = "changeme123"


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
    """Create a new tenant with initial admin user"""
    # Check subdomain uniqueness
    existing = await db.tenants.find_one({"subdomain": data.subdomain.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Subdomain already in use")
    
    tenant_id = f"tenant-{data.subdomain.lower()}"
    
    # Create tenant
    tenant_doc = {
        "id": tenant_id,
        "name": data.name,
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
    
    # Create default battalions
    default_battalions = [
        {"id": f"bat-{tenant_id}-8110", "tenant_id": tenant_id, "battalion_number": "8110", "name": "Battalion 8110", "chief_payroll": None},
        {"id": f"bat-{tenant_id}-8114", "tenant_id": tenant_id, "battalion_number": "8114", "name": "Battalion 8114", "chief_payroll": None},
    ]
    if default_battalions:
        await db.battalions.insert_many(default_battalions)
    
    return TenantResponse(
        **tenant_doc,
        user_count=1,
        station_count=0
    )


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
