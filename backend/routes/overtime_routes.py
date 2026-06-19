"""
Overtime and Leave routes
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime, timezone
import uuid

from database import db
from models import (
    UserRole, OvertimeRecord, OvertimeRecordCreate,
    LeaveRecord, LeaveRecordCreate
)
from auth import get_current_user, require_role

router = APIRouter(tags=["Overtime & Leave"])


# ===================== OVERTIME ROUTES =====================

@router.get("/overtime", response_model=List[OvertimeRecord])
async def get_overtime_records(
    date: Optional[str] = None,
    battalion_id: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if date:
        query["date"] = date
    if battalion_id:
        query["battalion_id"] = battalion_id
    if status:
        query["status"] = status
    
    records = await db.overtime_records.find(query, {"_id": 0}).to_list(500)
    return records


@router.post("/overtime", response_model=OvertimeRecord)
async def create_overtime_record(
    data: OvertimeRecordCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create overtime record - any user can submit their own availability"""
    # Verify personnel exists
    personnel = await db.personnel.find_one({"id": data.personnel_id}, {"_id": 0})
    if not personnel:
        raise HTTPException(status_code=404, detail="Personnel not found")
    
    # Check if user is submitting for themselves or has elevated permissions
    user_personnel = await db.personnel.find_one({"payroll_number": current_user["payroll_number"]}, {"_id": 0})
    is_own_record = user_personnel and user_personnel.get("id") == data.personnel_id
    has_permissions = current_user["role"] in [UserRole.ADMIN, UserRole.BATTALION_CHIEF, UserRole.CAPTAIN, UserRole.LIEUTENANT]
    
    if not is_own_record and not has_permissions:
        raise HTTPException(status_code=403, detail="You can only submit availability for yourself")
    
    record_id = str(uuid.uuid4())
    record_doc = {"id": record_id, **data.model_dump()}
    await db.overtime_records.insert_one(record_doc)
    return OvertimeRecord(**record_doc)


@router.put("/overtime/{record_id}", response_model=OvertimeRecord)
async def update_overtime_record(
    record_id: str,
    data: OvertimeRecordCreate,
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF, UserRole.CAPTAIN, UserRole.LIEUTENANT]))
):
    # Get the existing record to check previous status
    existing = await db.overtime_records.find_one({"id": record_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Overtime record not found")
    
    prev_status = existing.get("status", "available")
    new_status = data.status
    hours = data.hours or existing.get("hours", 0)
    personnel_id = existing.get("personnel_id")
    
    # Update personnel overtime hours based on status change
    if prev_status != new_status:
        if new_status == "assigned" and prev_status != "assigned":
            # Add hours when assigned
            await db.personnel.update_one(
                {"id": personnel_id},
                {"$inc": {"overtime_hours_worked": hours}}
            )
        elif new_status == "declined" and prev_status == "assigned":
            # Deduct hours when declining from assigned
            await db.personnel.update_one(
                {"id": personnel_id},
                {"$inc": {"overtime_hours_worked": -hours}}
            )
        elif new_status == "available" and prev_status == "assigned":
            # Deduct hours when going back to available from assigned
            await db.personnel.update_one(
                {"id": personnel_id},
                {"$inc": {"overtime_hours_worked": -hours}}
            )
    
    result = await db.overtime_records.find_one_and_update(
        {"id": record_id},
        {"$set": data.model_dump()},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Overtime record not found")
    del result["_id"]
    return OvertimeRecord(**result)


@router.delete("/overtime/{record_id}")
async def delete_overtime_record(
    record_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete an overtime record from the list. Users can delete their own records, BC/Admin can delete any."""
    # Get the record first
    record = await db.overtime_records.find_one({"id": record_id}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Overtime record not found")
    
    # Check permissions - users can only delete their own non-assigned records
    is_admin_or_bc = current_user["role"] in [UserRole.ADMIN, UserRole.BATTALION_CHIEF]
    
    # Find if this is the user's own record
    user_personnel = await db.personnel.find_one({"payroll_number": current_user["payroll_number"]}, {"_id": 0})
    is_own_record = user_personnel and user_personnel.get("id") == record.get("personnel_id")
    
    if not is_admin_or_bc and not is_own_record:
        raise HTTPException(status_code=403, detail="You can only remove your own overtime availability")
    
    # Regular users cannot remove themselves if already assigned
    if not is_admin_or_bc and record.get("status") == "assigned":
        raise HTTPException(status_code=400, detail="Cannot remove yourself after being assigned. Contact your Battalion Chief.")
    
    # If the record was assigned, deduct hours from personnel
    if record.get("status") == "assigned":
        hours = record.get("hours", 0)
        personnel_id = record.get("personnel_id")
        await db.personnel.update_one(
            {"id": personnel_id},
            {"$inc": {"overtime_hours_worked": -hours}}
        )
    
    # Delete the record
    result = await db.overtime_records.delete_one({"id": record_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Overtime record not found")
    
    return {"message": "Overtime record deleted"}


# ===================== LEAVE ROUTES =====================

@router.get("/leave-records", response_model=List[LeaveRecord])
async def get_leave_records(
    personnel_id: Optional[str] = None,
    leave_type: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if personnel_id:
        query["personnel_id"] = personnel_id
    if leave_type:
        query["leave_type"] = leave_type
    if start_date and end_date:
        query["$or"] = [
            {"start_date": {"$lte": end_date}, "end_date": {"$gte": start_date}}
        ]
    
    records = await db.leave_records.find(query, {"_id": 0}).to_list(1000)
    return records


@router.post("/leave-records", response_model=LeaveRecord)
async def create_leave_record(
    data: LeaveRecordCreate,
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF, UserRole.CAPTAIN, UserRole.LIEUTENANT]))
):
    record_id = str(uuid.uuid4())
    record_doc = {
        "id": record_id,
        **data.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.leave_records.insert_one(record_doc)
    return LeaveRecord(**record_doc)


@router.put("/leave-records/{record_id}", response_model=LeaveRecord)
async def update_leave_record(
    record_id: str,
    data: LeaveRecordCreate,
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF, UserRole.CAPTAIN, UserRole.LIEUTENANT]))
):
    result = await db.leave_records.find_one_and_update(
        {"id": record_id},
        {"$set": data.model_dump()},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Leave record not found")
    del result["_id"]
    return LeaveRecord(**result)


@router.delete("/leave-records/{record_id}")
async def delete_leave_record(
    record_id: str,
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF]))
):
    result = await db.leave_records.delete_one({"id": record_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Leave record not found")
    return {"message": "Leave record deleted"}
