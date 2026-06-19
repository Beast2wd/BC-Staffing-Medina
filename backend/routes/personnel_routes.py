"""
Personnel routes
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
import uuid

from database import db
from models import UserRole, PersonnelBase, PersonnelCreate, PersonnelUpdate
from auth import get_current_user, require_role

router = APIRouter(prefix="/personnel", tags=["Personnel"])


@router.get("", response_model=List[PersonnelBase])
async def get_personnel(
    battalion_id: Optional[str] = None,
    station_id: Optional[str] = None,
    shift: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {"is_active": True}
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
    person = await db.personnel.find_one({"id": personnel_id}, {"_id": 0})
    if not person:
        raise HTTPException(status_code=404, detail="Personnel not found")
    return person


@router.post("", response_model=PersonnelBase)
async def create_personnel(
    data: PersonnelCreate,
    current_user: dict = Depends(require_role([UserRole.ADMIN]))
):
    existing = await db.personnel.find_one({"payroll_number": data.payroll_number})
    if existing:
        raise HTTPException(status_code=400, detail="Payroll number already exists")
    
    person_id = str(uuid.uuid4())
    person_doc = {
        "id": person_id,
        **data.model_dump(),
        "is_active": True
    }
    
    await db.personnel.insert_one(person_doc)
    return PersonnelBase(**person_doc)


@router.put("/{personnel_id}", response_model=PersonnelBase)
async def update_personnel(
    personnel_id: str,
    data: PersonnelUpdate,
    current_user: dict = Depends(require_role([UserRole.ADMIN]))
):
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    # Get current personnel to find their payroll_number
    current_personnel = await db.personnel.find_one({"id": personnel_id}, {"_id": 0})
    if not current_personnel:
        raise HTTPException(status_code=404, detail="Personnel not found")
    
    result = await db.personnel.find_one_and_update(
        {"id": personnel_id},
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
        # Update user by the old payroll_number (in case it changed)
        await db.users.update_one(
            {"payroll_number": current_personnel["payroll_number"]},
            {"$set": user_update_fields}
        )
    
    del result["_id"]
    return PersonnelBase(**result)


@router.delete("/{personnel_id}")
async def delete_personnel(
    personnel_id: str,
    current_user: dict = Depends(require_role([UserRole.ADMIN]))
):
    # Get personnel to find their payroll_number
    personnel = await db.personnel.find_one({"id": personnel_id}, {"_id": 0})
    if not personnel:
        raise HTTPException(status_code=404, detail="Personnel not found")
    
    result = await db.personnel.update_one(
        {"id": personnel_id},
        {"$set": {"is_active": False}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Personnel not found")
    
    # Also deactivate the corresponding user account
    await db.users.update_one(
        {"payroll_number": personnel["payroll_number"]},
        {"$set": {"is_active": False}}
    )
    
    return {"message": "Personnel deactivated"}
