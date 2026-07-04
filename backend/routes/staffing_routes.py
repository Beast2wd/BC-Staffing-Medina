"""
Staffing and Apparatus Assignment routes - Multi-tenant enabled
"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
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
from websocket_manager import manager
from routes.user_notifications_routes import create_notification_for_personnel
from tenant_utils import get_tenant_id, add_tenant_to_query, add_tenant_to_doc

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
    query = add_tenant_to_query(query, current_user)
    
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
    query = {"id": record_id}
    query = add_tenant_to_query(query, current_user)
    
    record = await db.staffing_records.find_one(query, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Staffing record not found")
    return record


@router.post("/staffing", response_model=StaffingRecord)
async def create_staffing_record(
    data: StaffingRecordCreate,
    background_tasks: BackgroundTasks,
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
    record_doc = add_tenant_to_doc(record_doc, current_user)
    
    await db.staffing_records.insert_one(record_doc)
    
    # Broadcast WebSocket update
    background_tasks.add_task(
        manager.broadcast_staffing_update,
        "created",
        {"id": record_id, "station_id": data.station_id, "modified_by": current_user.get("name")},
        data.date,
        data.station_id
    )
    
    return StaffingRecord(**record_doc)


@router.put("/staffing/{record_id}", response_model=StaffingRecord)
async def update_staffing_record(
    record_id: str,
    data: StaffingRecordUpdate,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF, UserRole.CAPTAIN, UserRole.LIEUTENANT]))
):
    query = {"id": record_id}
    query = add_tenant_to_query(query, current_user)
    
    # Get existing record for audit log
    existing = await db.staffing_records.find_one(query, {"_id": 0})
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
        query,
        {"$set": update_data},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Staffing record not found")
    del result["_id"]
    
    # Broadcast WebSocket update
    background_tasks.add_task(
        manager.broadcast_staffing_update,
        "updated",
        {"id": record_id, "station_id": existing.get("station_id"), "modified_by": current_user.get("name")},
        existing.get("date"),
        existing.get("station_id")
    )
    
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
    query = add_tenant_to_query(query, current_user)
    
    if date:
        query["date"] = date
    if battalion_id:
        query["battalion_id"] = battalion_id
    if station_id:
        query["station_id"] = station_id
    
    assignments = await db.apparatus_assignments.find(query, {"_id": 0}).to_list(500)
    
    tenant_id = get_tenant_id(current_user)
    
    # Enrich assignments with personnel/volunteer/part-time names for display
    for assignment in assignments:
        personnel_names = {}
        for pid in assignment.get("personnel_ids", []):
            # Check if it's a part-time employee (prefixed with pt-)
            if pid.startswith("pt-"):
                pt_availability_id = pid[3:]  # Remove 'pt-' prefix
                pt_query = {"id": pt_availability_id}
                if tenant_id:
                    pt_query["tenant_id"] = tenant_id
                pt_record = await db.part_time_availability.find_one(pt_query, {"_id": 0})
                if pt_record:
                    emp_query = {"id": pt_record.get("employee_id")}
                    if tenant_id:
                        emp_query["tenant_id"] = tenant_id
                    pt_employee = await db.part_time_employees.find_one(emp_query, {"_id": 0})
                    if pt_employee:
                        personnel_names[pid] = f"PT {pt_employee.get('name', '')}"
                    else:
                        personnel_names[pid] = f"PT {pt_record.get('employee_name', '')}"
                else:
                    personnel_names[pid] = pid
            else:
                # Check personnel first
                person_query = {"id": pid}
                if tenant_id:
                    person_query["tenant_id"] = tenant_id
                person = await db.personnel.find_one(person_query, {"_id": 0, "name": 1, "rank": 1})
                if person:
                    personnel_names[pid] = f"{person.get('rank', '')} {person.get('name', '')}"
                else:
                    # Check volunteers
                    vol_query = {"id": pid}
                    if tenant_id:
                        vol_query["tenant_id"] = tenant_id
                    volunteer = await db.volunteers.find_one(vol_query, {"_id": 0, "name": 1})
                    if volunteer:
                        personnel_names[pid] = f"Vol. {volunteer.get('name', '')}"
                    else:
                        personnel_names[pid] = pid  # Fallback to ID
        assignment["personnel_names"] = personnel_names
    
    return assignments


@router.post("/apparatus-assignments", response_model=ApparatusAssignment)
async def create_apparatus_assignment(
    data: ApparatusAssignmentCreate,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF, UserRole.CAPTAIN, UserRole.LIEUTENANT]))
):
    assignment_id = str(uuid.uuid4())
    assignment_doc = {"id": assignment_id, **data.model_dump()}
    assignment_doc = add_tenant_to_doc(assignment_doc, current_user)
    
    await db.apparatus_assignments.insert_one(assignment_doc)
    
    # Broadcast WebSocket update
    background_tasks.add_task(
        manager.broadcast_apparatus_update,
        "created",
        {"id": assignment_id, "apparatus_name": data.apparatus_name, "station_id": data.station_id, "modified_by": current_user.get("name")},
        data.date,
        data.station_id
    )
    
    return ApparatusAssignment(**assignment_doc)


@router.put("/apparatus-assignments/{assignment_id}", response_model=ApparatusAssignment)
async def update_apparatus_assignment(
    assignment_id: str,
    data: ApparatusAssignmentUpdate,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF, UserRole.CAPTAIN, UserRole.LIEUTENANT]))
):
    query = {"id": assignment_id}
    query = add_tenant_to_query(query, current_user)
    
    # Only update provided fields
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    # Get existing for broadcast context
    existing = await db.apparatus_assignments.find_one(query, {"_id": 0})
    
    result = await db.apparatus_assignments.find_one_and_update(
        query,
        {"$set": update_data},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Assignment not found")
    del result["_id"]
    
    # Broadcast WebSocket update
    if existing:
        background_tasks.add_task(
            manager.broadcast_apparatus_update,
            "updated",
            {"id": assignment_id, "apparatus_name": existing.get("apparatus_name"), "station_id": existing.get("station_id"), "modified_by": current_user.get("name")},
            existing.get("date"),
            existing.get("station_id")
        )
    
    # Create notifications for personnel assigned to this apparatus
    if "personnel_ids" in update_data:
        apparatus_name = existing.get("apparatus_name") if existing else result.get("apparatus_name")
        station_id = existing.get("station_id") if existing else result.get("station_id")
        assignment_date = existing.get("date") if existing else result.get("date")
        
        tenant_id = get_tenant_id(current_user)
        # Get station name for notification
        station_query = {"id": station_id}
        if tenant_id:
            station_query["tenant_id"] = tenant_id
        station = await db.stations.find_one(station_query, {"_id": 0})
        station_name = f"Station {station.get('station_number')}" if station else "Station"
        
        # Notify all personnel in the updated list
        for personnel_id in update_data["personnel_ids"]:
            # Skip part-time prefixed IDs
            if personnel_id.startswith("pt-"):
                continue
            
            background_tasks.add_task(
                create_notification_for_personnel,
                personnel_id,
                "Riding Assignment Updated",
                f"You have been assigned to {apparatus_name} at {station_name} on {assignment_date}",
                "assignment",
                "/on-duty",
                "View On Duty",
                {"apparatus": apparatus_name, "station": station_name, "date": assignment_date, "modified_by": current_user.get("name")}
            )
    
    return ApparatusAssignment(**result)


@router.delete("/apparatus-assignments/{assignment_id}")
async def delete_apparatus_assignment(
    assignment_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF]))
):
    query = {"id": assignment_id}
    query = add_tenant_to_query(query, current_user)
    
    # Get existing for broadcast context
    existing = await db.apparatus_assignments.find_one(query, {"_id": 0})
    
    result = await db.apparatus_assignments.delete_one(query)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    # Broadcast WebSocket update
    if existing:
        background_tasks.add_task(
            manager.broadcast_apparatus_update,
            "deleted",
            {"id": assignment_id, "apparatus_name": existing.get("apparatus_name"), "station_id": existing.get("station_id"), "modified_by": current_user.get("name")},
            existing.get("date"),
            existing.get("station_id")
        )
    
    return {"message": "Assignment deleted"}


# ===================== REMARKS ROUTES =====================

@router.get("/remarks", response_model=List[RemarkEntry])
async def get_remarks(
    date: Optional[str] = None,
    battalion_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    query = add_tenant_to_query(query, current_user)
    
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
    remark_doc = data.model_dump()
    remark_doc = add_tenant_to_doc(remark_doc, current_user)
    
    await db.remarks.insert_one(remark_doc)
    return RemarkEntry(**remark_doc)
