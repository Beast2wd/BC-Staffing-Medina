"""
User management routes (Admin)
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List

from database import db
from models import UserRole, UserResponse, UserUpdate, ResetPasswordRequest
from auth import get_current_user, require_role, hash_password

router = APIRouter(prefix="/users", tags=["User Management"])


@router.get("", response_model=List[UserResponse])
async def get_users(current_user: dict = Depends(require_role([UserRole.ADMIN]))):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return [UserResponse(**u) for u in users]


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    data: UserUpdate,
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
