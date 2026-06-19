"""
Staffing and Apparatus Assignment routes
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime, timezone
import uuid

from database import db
from models import (
    UserRole, StaffingRecord, StaffingRecordCreate, StaffingRecordUpdate,
    ApparatusAssignment, ApparatusAssignmentCreate, ApparatusAssignmentUpdate,
    RemarkEntry
)
from auth import get_current_user, require_role

router = APIRouter(tags=["Staffing"])


# ===================== STAFFING ROUTES =====================

@router.get("/staffing", response_model=List[StaffingRecord])
async def get_staffing_records(
    date: Optional[str] = None,
    battalion_id: Optional[str] = None,
    station_id: Optional[str] = None,
    shift: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if date:
        query["date"] = date
    if battalion_id:
        query["battalion_id"] = battalion_id
    if station_id:
        query["station_id"] = station_id
    if shift:
        query["shift"] = shift
    
    records = await db.staffing_records.find(query, {"_id": 0}).to_list(1000)
    return records


@router.get("/staffing/{record_id}", response_model=StaffingRecord)
async def get_staffing_record(record_id: str, current_user: dict = Depends(get_current_user)):
    record = await db.staffing_records.find_one({"id": record_id}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Staffing record not found")
    return record


@router.post("/staffing", response_model=StaffingRecord)
async def create_staffing_record(
    data: StaffingRecordCreate,
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF, UserRole.CAPTAIN, UserRole.LIEUTENANT]))
):
    record_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    record_doc = {
        "id": record_id,
        **data.model_dump(),
        "created_at": now,
        "updated_at": now
    }
    await db.staffing_records.insert_one(record_doc)
    return StaffingRecord(**record_doc)


@router.put("/staffing/{record_id}", response_model=StaffingRecord)
async def update_staffing_record(
    record_id: str,
    data: StaffingRecordUpdate,
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF, UserRole.CAPTAIN, UserRole.LIEUTENANT]))
):
    # Get existing record for audit log
    existing = await db.staffing_records.find_one({"id": record_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Staffing record not found")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_data["last_modified_by"] = current_user["payroll_number"]
    
    # Create audit log entry
    change_entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "modified_by": current_user["payroll_number"],
        "modified_by_name": current_user.get("name", "Unknown"),
        "changes": {}
    }
    
    # Track what changed
    for key, new_value in update_data.items():
        if key not in ["updated_at", "last_modified_by"] and existing.get(key) != new_value:
            change_entry["changes"][key] = {
                "old": existing.get(key),
                "new": new_value
            }
    
    # Only add to history if there were actual changes
    if change_entry["changes"]:
        existing_history = existing.get("change_history", [])
        # Keep last 50 changes
        if len(existing_history) >= 50:
            existing_history = existing_history[-49:]
        existing_history.append(change_entry)
        update_data["change_history"] = existing_history
    
    result = await db.staffing_records.find_one_and_update(
        {"id": record_id},
        {"$set": update_data},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Staffing record not found")
    del result["_id"]
    return StaffingRecord(**result)


# ===================== APPARATUS ASSIGNMENT ROUTES =====================

@router.get("/apparatus-assignments", response_model=List[ApparatusAssignment])
async def get_apparatus_assignments(
    date: Optional[str] = None,
    battalion_id: Optional[str] = None,
    station_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if date:
        query["date"] = date
    if battalion_id:
        query["battalion_id"] = battalion_id
    if station_id:
        query["station_id"] = station_id
    
    assignments = await db.apparatus_assignments.find(query, {"_id": 0}).to_list(500)
    
    # Enrich assignments with personnel/volunteer/part-time names for display
    for assignment in assignments:
        personnel_names = {}
        for pid in assignment.get("personnel_ids", []):
            # Check if it's a part-time employee (prefixed with pt-)
            if pid.startswith("pt-"):
                pt_availability_id = pid[3:]  # Remove 'pt-' prefix
                pt_record = await db.part_time_availability.find_one({"id": pt_availability_id}, {"_id": 0})
                if pt_record:
                    pt_employee = await db.part_time_employees.find_one({"id": pt_record.get("employee_id")}, {"_id": 0})
                    if pt_employee:
                        personnel_names[pid] = f"PT {pt_employee.get('name', '')}"
                    else:
                        personnel_names[pid] = f"PT {pt_record.get('employee_name', '')}"
                else:
                    personnel_names[pid] = pid
            else:
                # Check personnel first
                person = await db.personnel.find_one({"id": pid}, {"_id": 0, "name": 1, "rank": 1})
                if person:
                    personnel_names[pid] = f"{person.get('rank', '')} {person.get('name', '')}"
                else:
                    # Check volunteers
                    volunteer = await db.volunteers.find_one({"id": pid}, {"_id": 0, "name": 1})
                    if volunteer:
                        personnel_names[pid] = f"Vol. {volunteer.get('name', '')}"
                    else:
                        personnel_names[pid] = pid  # Fallback to ID
        assignment["personnel_names"] = personnel_names
    
    return assignments


@router.post("/apparatus-assignments", response_model=ApparatusAssignment)
async def create_apparatus_assignment(
    data: ApparatusAssignmentCreate,
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF, UserRole.CAPTAIN, UserRole.LIEUTENANT]))
):
    assignment_id = str(uuid.uuid4())
    assignment_doc = {"id": assignment_id, **data.model_dump()}
    await db.apparatus_assignments.insert_one(assignment_doc)
    return ApparatusAssignment(**assignment_doc)


@router.put("/apparatus-assignments/{assignment_id}", response_model=ApparatusAssignment)
async def update_apparatus_assignment(
    assignment_id: str,
    data: ApparatusAssignmentUpdate,
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF, UserRole.CAPTAIN, UserRole.LIEUTENANT]))
):
    # Only update provided fields
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    result = await db.apparatus_assignments.find_one_and_update(
        {"id": assignment_id},
        {"$set": update_data},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Assignment not found")
    del result["_id"]
    return ApparatusAssignment(**result)


@router.delete("/apparatus-assignments/{assignment_id}")
async def delete_apparatus_assignment(
    assignment_id: str,
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF]))
):
    result = await db.apparatus_assignments.delete_one({"id": assignment_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return {"message": "Assignment deleted"}


# ===================== REMARKS ROUTES =====================

@router.get("/remarks", response_model=List[RemarkEntry])
async def get_remarks(
    date: Optional[str] = None,
    battalion_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if date:
        query["date"] = date
    if battalion_id:
        query["battalion_id"] = battalion_id
    
    remarks = await db.remarks.find(query, {"_id": 0}).to_list(500)
    return remarks


@router.post("/remarks", response_model=RemarkEntry)
async def create_remark(
    data: RemarkEntry,
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF, UserRole.CAPTAIN, UserRole.LIEUTENANT]))
):
    await db.remarks.insert_one(data.model_dump())
    return data
