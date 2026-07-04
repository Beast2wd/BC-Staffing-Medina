"""
Personnel routes - Multi-tenant enabled
"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from typing import List, Optional
import uuid

from database import db
from models import UserRole, PersonnelBase, PersonnelCreate, PersonnelUpdate
from auth import get_current_user, require_role, hash_password
from routes.user_notifications_routes import create_notification_for_personnel

router = APIRouter(prefix="/personnel", tags=["Personnel"])

# Default password for new personnel - they must change on first login
DEFAULT_PASSWORD = "changeme123"


@router.get("", response_model=List[PersonnelBase])
async def get_personnel(
    battalion_id: Optional[str] = None,
    station_id: Optional[str] = None,
    shift: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    tenant_id = current_user.get("_tenant_id") or current_user.get("tenant_id")
    query = {"is_active": True}
    
    # Add tenant filtering (skip for super admin without tenant context)
    if tenant_id:
        query["tenant_id"] = tenant_id
    
    if battalion_id:
        query["battalion_id"] = battalion_id
    if station_id:
        query["station_id"] = station_id
    if shift:
        query["shift"] = shift
    
    personnel = await db.personnel.find(query, {"_id": 0}).to_list(1000)
    return personnel


@router.get("/{personnel_id}", response_model=PersonnelBase)
async def get_personnel_by_id(personnel_id: str, current_user: dict = Depends(get_current_user)):
    tenant_id = current_user.get("_tenant_id") or current_user.get("tenant_id")
    query = {"id": personnel_id}
    if tenant_id:
        query["tenant_id"] = tenant_id
    
    person = await db.personnel.find_one(query, {"_id": 0})
    if not person:
        raise HTTPException(status_code=404, detail="Personnel not found")
    return person


@router.post("", response_model=PersonnelBase)
async def create_personnel(
    data: PersonnelCreate,
    current_user: dict = Depends(require_role([UserRole.ADMIN]))
):
    tenant_id = current_user.get("_tenant_id") or current_user.get("tenant_id")
    
    # Check for existing payroll number within the same tenant
    existing_query = {"payroll_number": data.payroll_number}
    if tenant_id:
        existing_query["tenant_id"] = tenant_id
    
    existing = await db.personnel.find_one(existing_query)
    if existing:
        raise HTTPException(status_code=400, detail="Payroll number already exists")
    
    person_id = str(uuid.uuid4())
    person_doc = {
        "id": person_id,
        "tenant_id": tenant_id,  # Add tenant_id to new record
        **data.model_dump(),
        "is_active": True,
        "overtime_hours_worked": 0.0
    }
    
    await db.personnel.insert_one(person_doc)
    
    # Automatically create a user account for this personnel
    existing_user_query = {"payroll_number": data.payroll_number}
    if tenant_id:
        existing_user_query["tenant_id"] = tenant_id
    
    existing_user = await db.users.find_one(existing_user_query)
    if not existing_user:
        user_id = str(uuid.uuid4())
        
        # Determine role based on rank
        rank_to_role = {
            "Fire Chief": UserRole.ADMIN,
            "Asst. Chief": UserRole.ADMIN,
            "Deputy Chief": UserRole.BATTALION_CHIEF,
            "Battalion Chief": UserRole.BATTALION_CHIEF,
            "Captain": UserRole.CAPTAIN,
            "Lieutenant": UserRole.LIEUTENANT,
            "Volunteer Firefighter": UserRole.VOLUNTEER,
        }
        role = rank_to_role.get(data.rank, UserRole.FIREFIGHTER)
        
        from datetime import datetime, timezone
        user_doc = {
            "id": user_id,
            "tenant_id": tenant_id,  # Add tenant_id to new user
            "payroll_number": data.payroll_number,
            "password_hash": hash_password(DEFAULT_PASSWORD),
            "name": data.name,
            "rank": data.rank,
            "role": role,
            "station_id": data.station_id,
            "shift": data.shift,
            "is_active": True,
            "must_change_password": True,
            "email": data.contact_email,
            "phone_number": data.contact_phone,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.users.insert_one(user_doc)
    
    return PersonnelBase(**person_doc)


@router.put("/{personnel_id}", response_model=PersonnelBase)
async def update_personnel(
    personnel_id: str,
    data: PersonnelUpdate,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_role([UserRole.ADMIN]))
):
    tenant_id = current_user.get("_tenant_id") or current_user.get("tenant_id")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    # Get current personnel with tenant filter
    query = {"id": personnel_id}
    if tenant_id:
        query["tenant_id"] = tenant_id
    
    current_personnel = await db.personnel.find_one(query, {"_id": 0})
    if not current_personnel:
        raise HTTPException(status_code=404, detail="Personnel not found")
    
    result = await db.personnel.find_one_and_update(
        query,
        {"$set": update_data},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Personnel not found")
    
    # Sync relevant changes to the users collection
    user_update_fields = {}
    if "name" in update_data:
        user_update_fields["name"] = update_data["name"]
    if "rank" in update_data:
        user_update_fields["rank"] = update_data["rank"]
    if "station_id" in update_data:
        user_update_fields["station_id"] = update_data["station_id"]
    if "shift" in update_data:
        user_update_fields["shift"] = update_data["shift"]
    if "is_active" in update_data:
        user_update_fields["is_active"] = update_data["is_active"]
    if "payroll_number" in update_data:
        user_update_fields["payroll_number"] = update_data["payroll_number"]
    
    if user_update_fields:
        # Update user by the old payroll_number within the same tenant
        user_query = {"payroll_number": current_personnel["payroll_number"]}
        if tenant_id:
            user_query["tenant_id"] = tenant_id
        await db.users.update_one(user_query, {"$set": user_update_fields})
    
    # Create notification for the personnel about their profile update
    changes = []
    if "station_id" in update_data and update_data["station_id"] != current_personnel.get("station_id"):
        station_query = {"id": update_data["station_id"]}
        if tenant_id:
            station_query["tenant_id"] = tenant_id
        station = await db.stations.find_one(station_query, {"_id": 0})
        station_name = f"Station {station.get('station_number')}" if station else "New Station"
        changes.append(f"Station: {station_name}")
    if "shift" in update_data and update_data["shift"] != current_personnel.get("shift"):
        changes.append(f"Shift: {update_data['shift']}")
    if "rank" in update_data and update_data["rank"] != current_personnel.get("rank"):
        changes.append(f"Rank: {update_data['rank']}")
    
    if changes:
        background_tasks.add_task(
            create_notification_for_personnel,
            personnel_id,
            "Profile Updated",
            f"Your profile was updated by {current_user.get('name')}: {', '.join(changes)}",
            "personnel_update",
            "/on-duty",
            "View On Duty",
            {"updated_by": current_user.get("name"), "changes": changes}
        )
    
    del result["_id"]
    return PersonnelBase(**result)


@router.delete("/{personnel_id}")
async def delete_personnel(
    personnel_id: str,
    current_user: dict = Depends(require_role([UserRole.ADMIN]))
):
    tenant_id = current_user.get("_tenant_id") or current_user.get("tenant_id")
    
    # Get personnel with tenant filter
    query = {"id": personnel_id}
    if tenant_id:
        query["tenant_id"] = tenant_id
    
    personnel = await db.personnel.find_one(query, {"_id": 0})
    if not personnel:
        raise HTTPException(status_code=404, detail="Personnel not found")
    
    result = await db.personnel.update_one(query, {"$set": {"is_active": False}})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Personnel not found")
    
    # Also deactivate the corresponding user account within the same tenant
    user_query = {"payroll_number": personnel["payroll_number"]}
    if tenant_id:
        user_query["tenant_id"] = tenant_id
    await db.users.update_one(user_query, {"$set": {"is_active": False}})
    
    return {"message": "Personnel deactivated"}
