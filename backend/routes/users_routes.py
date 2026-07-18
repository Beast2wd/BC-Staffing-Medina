"""
User management routes (Admin) - Multi-tenant enabled
"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from typing import List
from datetime import datetime, timezone
import uuid

from database import db
from models import UserRole, UserResponse, UserUpdate, ResetPasswordRequest, UserCreate
from auth import get_current_user, require_role, hash_password
from routes.user_notifications_routes import create_notification
from tenant_utils import get_tenant_id, add_tenant_to_query, add_tenant_to_doc

router = APIRouter(prefix="/users", tags=["User Management"])


@router.get("", response_model=List[UserResponse])
async def get_users(current_user: dict = Depends(require_role([UserRole.ADMIN]))):
    query = {}
    query = add_tenant_to_query(query, current_user)
    
    users = await db.users.find(query, {"_id": 0, "password_hash": 0}).to_list(1000)
    return [UserResponse(**u) for u in users]


@router.post("", response_model=UserResponse)
async def create_user(
    data: UserCreate,
    current_user: dict = Depends(require_role([UserRole.ADMIN]))
):
    """Create a new user and automatically create a personnel record"""
    tenant_id = get_tenant_id(current_user)
    
    # Check if user already exists within tenant
    existing_query = {"payroll_number": data.payroll_number}
    if tenant_id:
        existing_query["tenant_id"] = tenant_id
    existing_user = await db.users.find_one(existing_query)
    if existing_user:
        raise HTTPException(status_code=400, detail="User with this payroll number already exists")
    
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "payroll_number": data.payroll_number,
        "password_hash": hash_password(data.password),
        "name": data.name,
        "rank": data.rank,
        "role": data.role,
        "station_id": data.station_id,
        "shift": data.shift,
        "is_active": True,
        "must_change_password": data.must_change_password,
        "email": data.email,
        "phone_number": data.phone_number,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    user_doc = add_tenant_to_doc(user_doc, current_user)
    
    await db.users.insert_one(user_doc)
    
    # Automatically create a personnel record if one doesn't exist
    personnel_query = {"payroll_number": data.payroll_number}
    if tenant_id:
        personnel_query["tenant_id"] = tenant_id
    existing_personnel = await db.personnel.find_one(personnel_query)
    
    if not existing_personnel and data.station_id:
        # Get battalion_id from station
        station_query = {"id": data.station_id}
        if tenant_id:
            station_query["tenant_id"] = tenant_id
        station = await db.stations.find_one(station_query, {"_id": 0})
        battalion_id = station.get("battalion_id") if station else "bat-8110"
        
        person_id = str(uuid.uuid4())
        person_doc = {
            "id": person_id,
            "payroll_number": data.payroll_number,
            "name": data.name,
            "rank": data.rank,
            "station_id": data.station_id,
            "shift": data.shift or "A",
            "battalion_id": battalion_id,
            "is_active": True,
            "certifications": [],
            "contact_phone": data.phone_number,
            "contact_email": data.email,
            "overtime_hours_worked": 0.0
        }
        person_doc = add_tenant_to_doc(person_doc, current_user)
        await db.personnel.insert_one(person_doc)
    
    return UserResponse(**{k: v for k, v in user_doc.items() if k != "password_hash"})


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    data: UserUpdate,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_role([UserRole.ADMIN]))
):
    tenant_id = get_tenant_id(current_user)
    
    # Only include non-None values in update
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    # Get current user record with tenant filter
    query = {"id": user_id}
    if tenant_id:
        query["tenant_id"] = tenant_id
    
    current_user_record = await db.users.find_one(query, {"_id": 0})
    if not current_user_record:
        raise HTTPException(status_code=404, detail="User not found")
    
    result = await db.users.find_one_and_update(
        query,
        {"$set": update_data},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Sync relevant changes to the personnel collection
    personnel_update_fields = {}
    if "name" in update_data:
        personnel_update_fields["name"] = update_data["name"]
    if "rank" in update_data:
        personnel_update_fields["rank"] = update_data["rank"]
    if "station_id" in update_data:
        personnel_update_fields["station_id"] = update_data["station_id"]
    if "shift" in update_data:
        personnel_update_fields["shift"] = update_data["shift"]
    if "is_active" in update_data:
        personnel_update_fields["is_active"] = update_data["is_active"]
    if "payroll_number" in update_data:
        personnel_update_fields["payroll_number"] = update_data["payroll_number"]
    if "email" in update_data:
        personnel_update_fields["contact_email"] = update_data["email"]
    if "phone_number" in update_data:
        personnel_update_fields["contact_phone"] = update_data["phone_number"]
    
    if personnel_update_fields:
        # Update personnel by the old payroll_number within tenant
        personnel_query = {"payroll_number": current_user_record["payroll_number"]}
        if tenant_id:
            personnel_query["tenant_id"] = tenant_id
        await db.personnel.update_one(personnel_query, {"$set": personnel_update_fields})
    
    # Create notification for the user about their profile update (if not self-update)
    if user_id != current_user.get("id"):
        changes = []
        if "station_id" in update_data:
            station_query = {"id": update_data["station_id"]}
            if tenant_id:
                station_query["tenant_id"] = tenant_id
            station = await db.stations.find_one(station_query, {"_id": 0})
            station_name = f"Station {station.get('station_number')}" if station else "New Station"
            changes.append(f"Station: {station_name}")
        if "shift" in update_data:
            changes.append(f"Shift: {update_data['shift']}")
        if "rank" in update_data:
            changes.append(f"Rank: {update_data['rank']}")
        if "role" in update_data:
            changes.append(f"Role: {update_data['role']}")
        
        if changes:
            background_tasks.add_task(
                create_notification,
                user_id,
                "Profile Updated",
                f"Your profile was updated by {current_user.get('name')}: {', '.join(changes)}",
                "personnel_update",
                "/on-duty",
                "View On Duty",
                {"updated_by": current_user.get("name"), "changes": changes}
            )
    
    return UserResponse(**{k: v for k, v in result.items() if k != "_id" and k != "password_hash"})


@router.delete("/{user_id}")
async def deactivate_user(user_id: str, current_user: dict = Depends(require_role([UserRole.ADMIN]))):
    """Deactivate a user (soft delete) - sets is_active to False"""
    tenant_id = get_tenant_id(current_user)
    
    query = {"id": user_id}
    if tenant_id:
        query["tenant_id"] = tenant_id
    
    # Get user to find their payroll_number
    user = await db.users.find_one(query, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent deactivating super admins
    if user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Cannot deactivate super admin users")
    
    # Prevent self-deactivation
    if user_id == current_user.get("id"):
        raise HTTPException(status_code=403, detail="Cannot deactivate your own account")
    
    result = await db.users.update_one(query, {"$set": {"is_active": False}})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Also deactivate the corresponding personnel record within tenant
    personnel_query = {"payroll_number": user["payroll_number"]}
    if tenant_id:
        personnel_query["tenant_id"] = tenant_id
    await db.personnel.update_one(personnel_query, {"$set": {"is_active": False}})
    
    return {"message": "User deactivated"}


@router.delete("/{user_id}/permanent")
async def permanently_delete_user(user_id: str, current_user: dict = Depends(require_role([UserRole.ADMIN]))):
    """Permanently delete a user from the system - cannot be undone"""
    tenant_id = get_tenant_id(current_user)
    
    query = {"id": user_id}
    if tenant_id:
        query["tenant_id"] = tenant_id
    
    # Get user to find their payroll_number
    user = await db.users.find_one(query, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent deleting super admins
    if user.get("is_super_admin"):
        raise HTTPException(status_code=403, detail="Cannot delete super admin users")
    
    # Prevent self-deletion
    if user_id == current_user.get("id"):
        raise HTTPException(status_code=403, detail="Cannot delete your own account")
    
    # Permanently delete the user
    result = await db.users.delete_one(query)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Also permanently delete the corresponding personnel record within tenant
    personnel_query = {"payroll_number": user["payroll_number"]}
    if tenant_id:
        personnel_query["tenant_id"] = tenant_id
    await db.personnel.delete_one(personnel_query)
    
    return {"message": "User permanently deleted"}


@router.post("/{user_id}/reset-password")
async def reset_user_password(
    user_id: str,
    data: ResetPasswordRequest,
    current_user: dict = Depends(require_role([UserRole.ADMIN]))
):
    """Admin can reset any user's password"""
    tenant_id = get_tenant_id(current_user)
    
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    query = {"id": user_id}
    if tenant_id:
        query["tenant_id"] = tenant_id
    
    # Hash the new password using the hash_password function
    hashed_password = hash_password(data.new_password)
    
    # Update the user's password
    result = await db.users.update_one(
        query,
        {"$set": {"password_hash": hashed_password, "must_change_password": data.force_change}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "Password reset successfully"}
