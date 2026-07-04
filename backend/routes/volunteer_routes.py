"""
Volunteer routes - volunteer records and volunteer firefighter management (Multi-tenant enabled)
"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from typing import List, Optional
from datetime import datetime, timezone
import uuid

from database import db
from models import (
    UserRole, VolunteerRecord, VolunteerRecordCreate,
    Volunteer, VolunteerCreate, VolunteerUpdate
)
from auth import get_current_user, require_role, hash_password
from websocket_manager import manager
from tenant_utils import get_tenant_id, add_tenant_to_query, add_tenant_to_doc

router = APIRouter(tags=["Volunteers"])


# ===================== VOLUNTEER RECORDS ROUTES =====================

@router.get("/volunteer", response_model=List[VolunteerRecord])
async def get_volunteer_records(
    date: Optional[str] = None,
    battalion_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    tenant_id = get_tenant_id(current_user)
    query = {}
    if tenant_id:
        query["tenant_id"] = tenant_id
    if date:
        query["date"] = date
    if battalion_id:
        query["battalion_id"] = battalion_id
    records = await db.volunteer_records.find(query, {"_id": 0}).to_list(500)
    return [VolunteerRecord(**r) for r in records]


@router.get("/volunteer/stats")
async def get_volunteer_stats(
    battalion_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get overall volunteer statistics - totals for all volunteers"""
    tenant_id = get_tenant_id(current_user)
    current_year = datetime.now().year
    current_month = datetime.now().strftime("%Y-%m")
    current_month_name = datetime.now().strftime("%B %Y")
    
    # Build query for YTD records
    query = {
        "date": {"$gte": f"{current_year}-01-01"},
        "status": "assigned"
    }
    if tenant_id:
        query["tenant_id"] = tenant_id
    if battalion_id:
        query["battalion_id"] = battalion_id
    
    # Get all volunteer records for YTD
    records = await db.volunteer_records.find(query, {"_id": 0}).to_list(2000)
    
    # Calculate totals
    total_hours_scheduled = 0
    total_hours_worked = 0
    current_month_hours = 0
    shifts_count = len(records)
    unique_volunteers = set()
    
    for record in records:
        scheduled = record.get("hours", 0)
        worked = record.get("hours_worked", 0) or scheduled
        total_hours_scheduled += scheduled
        total_hours_worked += worked
        unique_volunteers.add(record.get("personnel_id"))
        
        # Track current month hours
        record_date = record.get("date", "")
        if record_date and record_date[:7] == current_month:
            current_month_hours += worked
    
    return {
        "total_volunteers": len(unique_volunteers),
        "shifts_count": shifts_count,
        "total_hours_scheduled": total_hours_scheduled,
        "total_hours_worked": total_hours_worked,
        "current_month_hours": current_month_hours,
        "current_month_name": current_month_name
    }


@router.get("/volunteer/my-hours")
async def get_my_volunteer_hours(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get the current volunteer's hours summary"""
    tenant_id = get_tenant_id(current_user)
    # Determine the volunteer's personnel_id
    is_volunteer_ff = current_user.get("role") == UserRole.VOLUNTEER
    
    if is_volunteer_ff:
        volunteer_id = current_user.get("volunteer_id")
        if not volunteer_id:
            user_query = {"id": current_user.get("id")}
            if tenant_id:
                user_query["tenant_id"] = tenant_id
            user = await db.users.find_one(user_query, {"_id": 0})
            volunteer_id = user.get("volunteer_id") if user else None
    else:
        # Regular personnel
        personnel_query = {"payroll_number": current_user["payroll_number"]}
        if tenant_id:
            personnel_query["tenant_id"] = tenant_id
        personnel = await db.personnel.find_one(personnel_query, {"_id": 0})
        volunteer_id = personnel.get("id") if personnel else None
    
    if not volunteer_id:
        return {"total_hours_scheduled": 0, "total_hours_worked": 0, "shifts": []}
    
    # Build query for this volunteer's records
    query = {"personnel_id": volunteer_id, "status": "assigned"}
    if tenant_id:
        query["tenant_id"] = tenant_id
    
    # Default to current year if no dates provided
    if not start_date:
        start_date = f"{datetime.now().year}-01-01"
    if not end_date:
        end_date = datetime.now().strftime("%Y-%m-%d")
    
    query["date"] = {"$gte": start_date, "$lte": end_date}
    
    records = await db.volunteer_records.find(query, {"_id": 0}).to_list(500)
    
    # Get stations for name lookups
    stations_query = {}
    if tenant_id:
        stations_query["tenant_id"] = tenant_id
    stations_list = await db.stations.find(stations_query, {"_id": 0}).to_list(100)
    stations_dict = {s["id"]: s for s in stations_list}
    
    # Calculate totals and monthly breakdown
    total_hours_scheduled = 0
    total_hours_worked = 0
    current_month_hours = 0
    current_month = datetime.now().strftime("%Y-%m")
    shifts = []
    
    for record in records:
        scheduled = record.get("hours", 0)
        worked = record.get("hours_worked", 0) or scheduled
        total_hours_scheduled += scheduled
        total_hours_worked += worked
        
        # Track current month hours
        record_date = record.get("date", "")
        if record_date and record_date[:7] == current_month:
            current_month_hours += worked
        
        station = stations_dict.get(record.get("assigned_station_id") or record.get("station_id"), {})
        shifts.append({
            "id": record.get("id"),
            "date": record.get("date"),
            "shift": record.get("assigned_shift", ""),
            "station": f"Station {station.get('station_number', 'N/A')}",
            "hours_scheduled": scheduled,
            "hours_worked": worked,
            "status": record.get("status"),
            "check_in": record.get("check_in_time", ""),
            "check_out": record.get("check_out_time", "")
        })
    
    # Sort by date descending
    shifts.sort(key=lambda x: x["date"], reverse=True)
    
    # Get current month name for display
    current_month_name = datetime.now().strftime("%B %Y")
    
    return {
        "volunteer_id": volunteer_id,
        "start_date": start_date,
        "end_date": end_date,
        "total_hours_scheduled": total_hours_scheduled,
        "total_hours_worked": total_hours_worked,
        "current_month_hours": current_month_hours,
        "current_month_name": current_month_name,
        "shifts_count": len(shifts),
        "shifts": shifts
    }


@router.post("/volunteer", response_model=VolunteerRecord)
async def create_volunteer_record(
    data: VolunteerRecordCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create volunteer record - any user can submit their own availability"""
    tenant_id = get_tenant_id(current_user)
    # For volunteer firefighters, get their volunteer record ID
    is_volunteer_ff = current_user.get("role") == UserRole.VOLUNTEER
    
    if is_volunteer_ff:
        # Extract volunteer_id from payroll_number (format: VOL-{volunteer_id})
        payroll = current_user.get("payroll_number", "")
        if payroll.startswith("VOL-"):
            volunteer_id_prefix = payroll[4:].lower()  # Remove "VOL-" prefix
            # Find volunteer by matching ID prefix
            vol_query = {"id": {"$regex": f"^{volunteer_id_prefix}", "$options": "i"}}
            if tenant_id:
                vol_query["tenant_id"] = tenant_id
            volunteer = await db.volunteers.find_one(vol_query, {"_id": 0})
            if volunteer:
                data.personnel_id = volunteer.get("id")
            else:
                raise HTTPException(status_code=404, detail="Volunteer profile not found")
        else:
            raise HTTPException(status_code=400, detail="Invalid volunteer account")
    else:
        # Regular personnel
        personnel_query = {"id": data.personnel_id}
        if tenant_id:
            personnel_query["tenant_id"] = tenant_id
        personnel = await db.personnel.find_one(personnel_query, {"_id": 0})
        if not personnel:
            raise HTTPException(status_code=404, detail="Personnel not found")
        
        # Check if user is submitting for themselves or has elevated permissions
        user_personnel_query = {"payroll_number": current_user["payroll_number"]}
        if tenant_id:
            user_personnel_query["tenant_id"] = tenant_id
        user_personnel = await db.personnel.find_one(user_personnel_query, {"_id": 0})
        is_own_record = user_personnel and user_personnel.get("id") == data.personnel_id
        has_permissions = current_user["role"] in [UserRole.ADMIN, UserRole.BATTALION_CHIEF, UserRole.CAPTAIN, UserRole.LIEUTENANT]
        
        if not is_own_record and not has_permissions:
            raise HTTPException(status_code=403, detail="You can only submit availability for yourself")
    
    record_id = str(uuid.uuid4())
    # Auto-assign volunteer when they submit availability
    data.status = "assigned"
    record_doc = {
        "id": record_id, 
        **data.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    # Add tenant_id to record
    if tenant_id:
        record_doc["tenant_id"] = tenant_id
    
    await db.volunteer_records.insert_one(record_doc)
    
    # Auto-sync to daily worksheet when assigned
    station_id = data.assigned_station_id or data.station_id
    if station_id:
        staffing_query = {"date": data.date, "station_id": station_id}
        if tenant_id:
            staffing_query["tenant_id"] = tenant_id
        existing_staffing = await db.staffing_records.find_one(staffing_query, {"_id": 0})
        
        if existing_staffing:
            current_categories = existing_staffing.get("categories", {})
            current_vol = current_categories.get("volunteer", 0)
            await db.staffing_records.update_one(
                {"id": existing_staffing["id"]},
                {"$set": {"categories.volunteer": current_vol + 1}}
            )
    
    return VolunteerRecord(**record_doc)


@router.put("/volunteer/{record_id}", response_model=VolunteerRecord)
async def update_volunteer_record(
    record_id: str,
    data: VolunteerRecordCreate,
    current_user: dict = Depends(get_current_user)
):
    """Update a volunteer record. Users can update their own records, BC/Admin/Captain/Lt can update any."""
    tenant_id = get_tenant_id(current_user)
    # Get the existing record to check previous status
    existing_query = {"id": record_id}
    if tenant_id:
        existing_query["tenant_id"] = tenant_id
    existing = await db.volunteer_records.find_one(existing_query, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Volunteer record not found")
    
    # Check permissions - admin/BC/Captain/Lt can edit any, others can only edit their own
    is_privileged = current_user["role"] in [UserRole.ADMIN, UserRole.BATTALION_CHIEF, UserRole.CAPTAIN, UserRole.LIEUTENANT]
    
    # Check if user owns this record
    is_own_record = False
    if current_user.get("role") == UserRole.VOLUNTEER:
        # For volunteers, check volunteer_id
        user_query = {"id": current_user.get("id")}
        if tenant_id:
            user_query["tenant_id"] = tenant_id
        user_doc = await db.users.find_one(user_query, {"_id": 0})
        if user_doc and user_doc.get("volunteer_id") == existing.get("personnel_id"):
            is_own_record = True
    else:
        # For regular personnel
        user_personnel_query = {"payroll_number": current_user["payroll_number"]}
        if tenant_id:
            user_personnel_query["tenant_id"] = tenant_id
        user_personnel = await db.personnel.find_one(user_personnel_query, {"_id": 0})
        if user_personnel and user_personnel.get("id") == existing.get("personnel_id"):
            is_own_record = True
    
    if not is_privileged and not is_own_record:
        raise HTTPException(status_code=403, detail="Not authorized to update this record")
    
    result = await db.volunteer_records.find_one_and_update(
        existing_query,
        {"$set": data.model_dump()},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Volunteer record not found")
    del result["_id"]
    return VolunteerRecord(**result)


@router.delete("/volunteer/{record_id}")
async def delete_volunteer_record(
    record_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Delete a volunteer record. Users can delete/revoke their own records, BC/Admin/Captain/Lt can delete any.
    Also removes the volunteer from apparatus assignments and updates staffing records."""
    tenant_id = get_tenant_id(current_user)
    record_query = {"id": record_id}
    if tenant_id:
        record_query["tenant_id"] = tenant_id
    record = await db.volunteer_records.find_one(record_query, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Volunteer record not found")
    
    # Check permissions
    is_privileged = current_user["role"] in [UserRole.ADMIN, UserRole.BATTALION_CHIEF, UserRole.CAPTAIN, UserRole.LIEUTENANT]
    
    # Check if user owns this record
    is_own_record = False
    if current_user.get("role") == UserRole.VOLUNTEER:
        # For volunteers, the payroll_number is VOL-{volunteer_id}
        # Extract the volunteer_id from payroll_number
        payroll = current_user.get("payroll_number", "")
        if payroll.startswith("VOL-"):
            volunteer_id_from_payroll = payroll[4:].lower()  # Remove "VOL-" prefix
            record_personnel_id = record.get("personnel_id", "").lower()
            # Check if the volunteer_id matches the personnel_id (case insensitive)
            if volunteer_id_from_payroll and record_personnel_id.startswith(volunteer_id_from_payroll):
                is_own_record = True
    else:
        # For regular personnel
        user_personnel_query = {"payroll_number": current_user["payroll_number"]}
        if tenant_id:
            user_personnel_query["tenant_id"] = tenant_id
        user_personnel = await db.personnel.find_one(user_personnel_query, {"_id": 0})
        if user_personnel and user_personnel.get("id") == record.get("personnel_id"):
            is_own_record = True
    
    if not is_privileged and not is_own_record:
        raise HTTPException(status_code=403, detail="You can only remove your own volunteer availability")
    
    # Get the volunteer's personnel_id and date for cleanup
    volunteer_personnel_id = record.get("personnel_id")
    record_date = record.get("date")
    station_id = record.get("assigned_station_id") or record.get("station_id")
    
    # 1. Remove volunteer from ALL apparatus assignments for this date
    apparatus_assignments = []
    if volunteer_personnel_id and record_date:
        # Find all apparatus assignments for this date that include this volunteer
        app_query = {"date": record_date, "personnel_ids": volunteer_personnel_id}
        if tenant_id:
            app_query["tenant_id"] = tenant_id
        apparatus_assignments = await db.apparatus_assignments.find(app_query, {"_id": 0}).to_list(100)
        
        for assignment in apparatus_assignments:
            # Remove volunteer from personnel_ids array
            updated_personnel_ids = [pid for pid in assignment.get("personnel_ids", []) if pid != volunteer_personnel_id]
            
            # Remove from position_assignments if present
            position_assignments = assignment.get("position_assignments", {})
            if volunteer_personnel_id in position_assignments:
                del position_assignments[volunteer_personnel_id]
            
            # Update the apparatus assignment
            await db.apparatus_assignments.update_one(
                {"id": assignment["id"]},
                {"$set": {
                    "personnel_ids": updated_personnel_ids,
                    "position_assignments": position_assignments
                }}
            )
    
    # 2. Update staffing record to decrement volunteer count
    if station_id and record_date:
        staffing_query = {"date": record_date, "station_id": station_id}
        if tenant_id:
            staffing_query["tenant_id"] = tenant_id
        staffing_record = await db.staffing_records.find_one(staffing_query, {"_id": 0})
        
        if staffing_record:
            current_categories = staffing_record.get("categories", {})
            current_vol_count = current_categories.get("volunteer", 0)
            if current_vol_count > 0:
                await db.staffing_records.update_one(
                    {"id": staffing_record["id"]},
                    {"$set": {"categories.volunteer": current_vol_count - 1}}
                )
    
    # 3. Delete the volunteer record itself
    result = await db.volunteer_records.delete_one(record_query)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Volunteer record not found")
    
    # 4. Broadcast WebSocket updates for real-time sync
    apparatus_count = len(apparatus_assignments)
    
    # Notify about volunteer record deletion
    background_tasks.add_task(
        manager.broadcast_volunteer_update,
        "deleted",
        {"id": record_id, "personnel_id": volunteer_personnel_id, "rescinded_by": current_user.get("name")},
        record_date
    )
    
    # If apparatus assignments were updated, notify about those too
    if apparatus_count > 0:
        background_tasks.add_task(
            manager.broadcast_apparatus_update,
            "updated",
            {"volunteer_removed": volunteer_personnel_id, "station_id": station_id, "modified_by": current_user.get("name")},
            record_date,
            station_id
        )
    
    # If staffing was updated, notify about that
    if station_id and record_date:
        background_tasks.add_task(
            manager.broadcast_staffing_update,
            "updated",
            {"volunteer_count_decreased": True, "station_id": station_id, "modified_by": current_user.get("name")},
            record_date,
            station_id
        )
    
    return {
        "message": "Volunteer shift rescinded successfully",
        "cleanup": {
            "apparatus_assignments_updated": apparatus_count,
            "staffing_record_updated": station_id is not None and record_date is not None
        }
    }


# Get volunteer assignments for staffing grid
@router.get("/volunteer-assignments")
async def get_volunteer_assignments(
    date: str,
    shift: Optional[str] = None,
    station_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get volunteer assignments for a specific date and optionally shift/station"""
    tenant_id = get_tenant_id(current_user)
    query = {"date": date, "assigned_shift": {"$ne": ""}, "assigned_station_id": {"$ne": ""}}
    if tenant_id:
        query["tenant_id"] = tenant_id
    if shift:
        query["assigned_shift"] = shift
    if station_id:
        query["assigned_station_id"] = station_id
    
    records = await db.volunteer_records.find(query, {"_id": 0}).to_list(1000)
    
    # Enrich with volunteer/personnel info
    enriched = []
    for record in records:
        # First try to find in volunteers collection (for volunteer firefighters)
        vol_query = {"id": record.get("personnel_id")}
        if tenant_id:
            vol_query["tenant_id"] = tenant_id
        volunteer = await db.volunteers.find_one(vol_query, {"_id": 0})
        if volunteer:
            record["volunteer_name"] = volunteer.get("name", "Unknown")
            record["volunteer_phone"] = volunteer.get("contact_phone", "")
            record["is_volunteer_ff"] = True
        else:
            # Try personnel collection (for regular firefighters volunteering)
            person_query = {"id": record.get("personnel_id")}
            if tenant_id:
                person_query["tenant_id"] = tenant_id
            person = await db.personnel.find_one(person_query, {"_id": 0})
            if person:
                record["volunteer_name"] = person.get("name", "Unknown")
                record["volunteer_phone"] = person.get("contact_phone", "")
                record["is_volunteer_ff"] = False
        enriched.append(record)
    
    return enriched


# ===================== VOLUNTEER FIREFIGHTER MANAGEMENT ROUTES =====================

@router.get("/volunteers", response_model=List[Volunteer])
async def get_volunteers(
    station_id: Optional[str] = None,
    current_user: dict = Depends(require_role([UserRole.ADMIN]))
):
    """Get all volunteer firefighters"""
    tenant_id = get_tenant_id(current_user)
    query = {}
    if tenant_id:
        query["tenant_id"] = tenant_id
    if station_id:
        query["station_id"] = station_id
    
    volunteers = await db.volunteers.find(query, {"_id": 0}).to_list(1000)
    return volunteers


@router.post("/volunteers", response_model=Volunteer)
async def create_volunteer(
    data: VolunteerCreate,
    current_user: dict = Depends(require_role([UserRole.ADMIN]))
):
    """Create a new volunteer firefighter and their user account"""
    tenant_id = get_tenant_id(current_user)
    # Check if email is provided for login
    if not data.contact_email:
        raise HTTPException(status_code=400, detail="Email is required for volunteer login")
    
    # Check if email already exists for an ACTIVE user
    user_query = {"email": data.contact_email, "is_active": True}
    if tenant_id:
        user_query["tenant_id"] = tenant_id
    existing_user = await db.users.find_one(user_query, {"_id": 0})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Clean up any inactive records with the same email (allow reuse)
    cleanup_user_query = {"email": data.contact_email, "is_active": False}
    if tenant_id:
        cleanup_user_query["tenant_id"] = tenant_id
    await db.users.delete_many(cleanup_user_query)
    # Also clean up inactive volunteers with the same email
    cleanup_vol_query = {"contact_email": data.contact_email, "is_active": False}
    if tenant_id:
        cleanup_vol_query["tenant_id"] = tenant_id
    await db.volunteers.delete_many(cleanup_vol_query)
    
    volunteer = Volunteer(
        name=data.name,
        contact_phone=data.contact_phone,
        contact_email=data.contact_email,
        station_id=data.station_id,
        certifications=data.certifications,
        notes=data.notes
    )
    
    # Create user account for volunteer with generic password
    generic_password = "volunteer123"
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "payroll_number": f"VOL-{volunteer.id[:8].upper()}",  # Generate a volunteer payroll number
        "email": data.contact_email,
        "password_hash": hash_password(generic_password),
        "name": data.name,
        "rank": "Volunteer",
        "role": UserRole.VOLUNTEER,
        "station_id": data.station_id,
        "shift": None,
        "is_active": True,
        "must_change_password": True,
        "volunteer_id": volunteer.id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    # Add tenant_id
    if tenant_id:
        user_doc["tenant_id"] = tenant_id
    
    vol_doc = volunteer.model_dump()
    if tenant_id:
        vol_doc["tenant_id"] = tenant_id
    
    await db.users.insert_one(user_doc)
    await db.volunteers.insert_one(vol_doc)
    
    return volunteer


@router.put("/volunteers/{volunteer_id}", response_model=Volunteer)
async def update_volunteer(
    volunteer_id: str,
    data: VolunteerUpdate,
    current_user: dict = Depends(require_role([UserRole.ADMIN]))
):
    """Update a volunteer firefighter"""
    tenant_id = get_tenant_id(current_user)
    query = {"id": volunteer_id}
    if tenant_id:
        query["tenant_id"] = tenant_id
    volunteer = await db.volunteers.find_one(query, {"_id": 0})
    if not volunteer:
        raise HTTPException(status_code=404, detail="Volunteer not found")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_data:
        await db.volunteers.update_one(query, {"$set": update_data})
    
    updated = await db.volunteers.find_one(query, {"_id": 0})
    return Volunteer(**updated)


@router.delete("/volunteers/{volunteer_id}")
async def delete_volunteer(
    volunteer_id: str,
    current_user: dict = Depends(require_role([UserRole.ADMIN]))
):
    """Delete a volunteer firefighter and their user account"""
    tenant_id = get_tenant_id(current_user)
    # Get volunteer info first
    vol_query = {"id": volunteer_id}
    if tenant_id:
        vol_query["tenant_id"] = tenant_id
    volunteer = await db.volunteers.find_one(vol_query)
    if not volunteer:
        raise HTTPException(status_code=404, detail="Volunteer not found")
    
    # Delete volunteer record
    await db.volunteers.delete_one(vol_query)
    
    # Delete the associated user account from User Management
    user_del_query = {"volunteer_id": volunteer_id}
    if tenant_id:
        user_del_query["tenant_id"] = tenant_id
    await db.users.delete_one(user_del_query)
    
    return {"message": "Volunteer removed"}
