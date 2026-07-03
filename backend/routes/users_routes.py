"""
User management routes (Admin)
"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from typing import List
from datetime import datetime, timezone
import uuid

from database import db
from models import UserRole, UserResponse, UserUpdate, ResetPasswordRequest, UserCreate
from auth import get_current_user, require_role, hash_password
from routes.user_notifications_routes import create_notification

router = APIRouter(prefix="/users", tags=["User Management"])


@router.get("", response_model=List[UserResponse])
async def get_users(current_user: dict = Depends(require_role([UserRole.ADMIN]))):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return [UserResponse(**u) for u in users]


@router.post("", response_model=UserResponse)
async def create_user(
    data: UserCreate,
    current_user: dict = Depends(require_role([UserRole.ADMIN]))
):
    """Create a new user and automatically create a personnel record"""
    # Check if user already exists
    existing_user = await db.users.find_one({"payroll_number": data.payroll_number})
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
    
    await db.users.insert_one(user_doc)
    
    # Automatically create a personnel record if one doesn't exist
    existing_personnel = await db.personnel.find_one({"payroll_number": data.payroll_number})
    if not existing_personnel and data.station_id:
        # Get battalion_id from station
        station = await db.stations.find_one({"id": data.station_id}, {"_id": 0})
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
        await db.personnel.insert_one(person_doc)
    
    return UserResponse(**{k: v for k, v in user_doc.items() if k != "password_hash"})


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    data: UserUpdate,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_role([UserRole.ADMIN]))
):
    # Only include non-None values in update
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    # Get current user to find their payroll_number
    current_user_record = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not current_user_record:
        raise HTTPException(status_code=404, detail="User not found")
    
    result = await db.users.find_one_and_update(
        {"id": user_id},
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
        # Update personnel by the old payroll_number (in case it changed)
        await db.personnel.update_one(
            {"payroll_number": current_user_record["payroll_number"]},
            {"$set": personnel_update_fields}
        )
    
    # Create notification for the user about their profile update (if not self-update)
    if user_id != current_user.get("id"):
        changes = []
        if "station_id" in update_data:
            station = await db.stations.find_one({"id": update_data["station_id"]}, {"_id": 0})
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
async def delete_user(user_id: str, current_user: dict = Depends(require_role([UserRole.ADMIN]))):
    # Get user to find their payroll_number
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    result = await db.users.update_one({"id": user_id}, {"$set": {"is_active": False}})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Also deactivate the corresponding personnel record
    await db.personnel.update_one(
        {"payroll_number": user["payroll_number"]},
        {"$set": {"is_active": False}}
    )
    
    return {"message": "User deactivated"}


@router.post("/{user_id}/reset-password")
async def reset_user_password(
    user_id: str,
    data: ResetPasswordRequest,
    current_user: dict = Depends(require_role([UserRole.ADMIN]))
):
    """Admin can reset any user's password"""
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    # Hash the new password using the hash_password function
    hashed_password = hash_password(data.new_password)
    
    # Update the user's password
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {"password_hash": hashed_password, "must_change_password": data.force_change}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "Password reset successfully"}
