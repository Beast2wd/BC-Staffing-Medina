"""
Part-time employee routes (Multi-tenant enabled)
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime, timezone
import uuid

from database import db
from models import (
    UserRole, PartTimeEmployee, PartTimeEmployeeCreate, PartTimeEmployeeUpdate,
    PartTimeAvailability, PartTimeAvailabilityCreate, PartTimeAvailabilityUpdate
)
from auth import get_current_user, require_role, hash_password
from tenant_utils import get_tenant_id, add_tenant_to_query, add_tenant_to_doc

router = APIRouter(tags=["Part-Time"])


# ===================== PART-TIME EMPLOYEE ROUTES =====================

@router.get("/part-time-employees", response_model=List[PartTimeEmployee])
async def get_part_time_employees(
    current_user: dict = Depends(get_current_user)
):
    """Get all part-time employees sorted alphabetically by name"""
    tenant_id = get_tenant_id(current_user)
    query = {}
    if tenant_id:
        query["tenant_id"] = tenant_id
    employees = await db.part_time_employees.find(query, {"_id": 0}).to_list(1000)
    # Sort alphabetically by name
    employees.sort(key=lambda x: x.get("name", "").lower())
    return employees


@router.post("/part-time-employees", response_model=PartTimeEmployee)
async def create_part_time_employee(
    data: PartTimeEmployeeCreate,
    current_user: dict = Depends(require_role([UserRole.ADMIN]))
):
    """Create a new part-time employee and their user account"""
    tenant_id = get_tenant_id(current_user)
    # Check if employee number already exists (only active ones block creation)
    existing_query = {"employee_number": data.employee_number, "is_active": True}
    if tenant_id:
        existing_query["tenant_id"] = tenant_id
    existing = await db.part_time_employees.find_one(existing_query)
    if existing:
        raise HTTPException(status_code=400, detail="Employee number already exists")
    
    # Check if employee number already exists as an ACTIVE user
    existing_user_query = {"payroll_number": data.employee_number, "is_active": True}
    if tenant_id:
        existing_user_query["tenant_id"] = tenant_id
    existing_user = await db.users.find_one(existing_user_query, {"_id": 0})
    if existing_user:
        raise HTTPException(status_code=400, detail="Employee number already registered as user")
    
    # If email is provided, check if it's already in use by an ACTIVE user
    if data.contact_email:
        existing_email_query = {"email": data.contact_email, "is_active": True}
        if tenant_id:
            existing_email_query["tenant_id"] = tenant_id
        existing_email = await db.users.find_one(existing_email_query, {"_id": 0})
        if existing_email:
            raise HTTPException(status_code=400, detail="Email already registered")
    
    # Clean up any inactive records with the same employee number (allow reuse)
    cleanup_pt_query = {"employee_number": data.employee_number, "is_active": False}
    if tenant_id:
        cleanup_pt_query["tenant_id"] = tenant_id
    await db.part_time_employees.delete_many(cleanup_pt_query)
    cleanup_user_query = {"payroll_number": data.employee_number, "is_active": False}
    if tenant_id:
        cleanup_user_query["tenant_id"] = tenant_id
    await db.users.delete_many(cleanup_user_query)
    
    # If email provided, also clean up inactive users with that email
    if data.contact_email:
        cleanup_email_query = {"email": data.contact_email, "is_active": False}
        if tenant_id:
            cleanup_email_query["tenant_id"] = tenant_id
        await db.users.delete_many(cleanup_email_query)
    
    # Create part-time employee record
    employee = PartTimeEmployee(
        id=str(uuid.uuid4()),
        **data.model_dump(),
        created_at=datetime.now(timezone.utc).isoformat()
    )
    
    # Always create user account for part-time employee so they appear in User Management
    generic_password = "parttime123"
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "payroll_number": data.employee_number,
        "email": data.contact_email,
        "phone_number": data.contact_phone,
        "password_hash": hash_password(generic_password),
        "name": data.name,
        "rank": data.rank or "Part-Time Firefighter",
        "role": UserRole.FIREFIGHTER,  # Part-time employees get firefighter role (view access)
        "station_id": None,
        "shift": None,
        "is_active": True,
        "must_change_password": True,
        "part_time_employee_id": employee.id,  # Link to part-time employee record
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    # Add tenant_id
    if tenant_id:
        user_doc["tenant_id"] = tenant_id
    await db.users.insert_one(user_doc)
    
    emp_doc = employee.model_dump()
    if tenant_id:
        emp_doc["tenant_id"] = tenant_id
    await db.part_time_employees.insert_one(emp_doc)
    return employee


@router.put("/part-time-employees/{employee_id}", response_model=PartTimeEmployee)
async def update_part_time_employee(
    employee_id: str,
    data: PartTimeEmployeeUpdate,
    current_user: dict = Depends(require_role([UserRole.ADMIN]))
):
    """Update a part-time employee"""
    tenant_id = get_tenant_id(current_user)
    query = {"id": employee_id}
    if tenant_id:
        query["tenant_id"] = tenant_id
    employee = await db.part_time_employees.find_one(query, {"_id": 0})
    if not employee:
        raise HTTPException(status_code=404, detail="Part-time employee not found")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_data:
        # Check if new employee number conflicts with existing
        if "employee_number" in update_data:
            conflict_query = {"employee_number": update_data["employee_number"], "id": {"$ne": employee_id}}
            if tenant_id:
                conflict_query["tenant_id"] = tenant_id
            existing = await db.part_time_employees.find_one(conflict_query)
            if existing:
                raise HTTPException(status_code=400, detail="Employee number already exists")
        
        await db.part_time_employees.update_one(query, {"$set": update_data})
    
    updated = await db.part_time_employees.find_one(query, {"_id": 0})
    return updated


@router.delete("/part-time-employees/{employee_id}")
async def delete_part_time_employee(
    employee_id: str,
    current_user: dict = Depends(require_role([UserRole.ADMIN]))
):
    """Delete a part-time employee and their user account"""
    tenant_id = get_tenant_id(current_user)
    query = {"id": employee_id}
    if tenant_id:
        query["tenant_id"] = tenant_id
    employee = await db.part_time_employees.find_one(query)
    if not employee:
        raise HTTPException(status_code=404, detail="Part-time employee not found")
    
    # Delete part-time employee record
    await db.part_time_employees.delete_one(query)
    
    # Delete the associated user account from User Management
    user_del_query = {"part_time_employee_id": employee_id}
    if tenant_id:
        user_del_query["tenant_id"] = tenant_id
    await db.users.delete_one(user_del_query)
    
    # Also try to match by employee_number (for records created before linking was added)
    user_del_query2 = {"payroll_number": employee.get("employee_number")}
    if tenant_id:
        user_del_query2["tenant_id"] = tenant_id
    await db.users.delete_one(user_del_query2)
    
    return {"message": "Part-time employee removed"}


# ===================== PART-TIME AVAILABILITY ROUTES =====================

@router.get("/part-time-availability")
async def get_part_time_availability(
    date: Optional[str] = None,
    battalion_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get part-time availability records for a date"""
    tenant_id = get_tenant_id(current_user)
    query = {}
    if tenant_id:
        query["tenant_id"] = tenant_id
    if date:
        query["date"] = date
    if battalion_id:
        query["battalion_id"] = battalion_id
    
    records = await db.part_time_availability.find(query, {"_id": 0}).to_list(500)
    return records


@router.post("/part-time-availability")
async def create_part_time_availability(
    data: PartTimeAvailabilityCreate,
    current_user: dict = Depends(get_current_user)
):
    """Submit part-time availability"""
    tenant_id = get_tenant_id(current_user)
    # Get employee details
    emp_query = {"id": data.employee_id}
    if tenant_id:
        emp_query["tenant_id"] = tenant_id
    employee = await db.part_time_employees.find_one(emp_query, {"_id": 0})
    if not employee:
        raise HTTPException(status_code=404, detail="Part-time employee not found")
    
    # Check for existing availability on same date
    existing_query = {"employee_id": data.employee_id, "date": data.date}
    if tenant_id:
        existing_query["tenant_id"] = tenant_id
    existing = await db.part_time_availability.find_one(existing_query)
    if existing:
        raise HTTPException(status_code=400, detail="Availability already submitted for this date")
    
    record = PartTimeAvailability(
        id=str(uuid.uuid4()),
        employee_id=data.employee_id,
        employee_name=employee.get("name", ""),
        employee_number=employee.get("employee_number", ""),
        date=data.date,
        shift=data.shift,
        hours=data.hours,
        status="available",  # Not auto-assigned
        notes=data.notes,
        battalion_id=data.battalion_id,
        created_at=datetime.now(timezone.utc).isoformat()
    )
    
    record_doc = record.model_dump()
    if tenant_id:
        record_doc["tenant_id"] = tenant_id
    await db.part_time_availability.insert_one(record_doc)
    return record_doc


@router.put("/part-time-availability/{record_id}")
async def update_part_time_availability(
    record_id: str,
    data: PartTimeAvailabilityUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update part-time availability record"""
    tenant_id = get_tenant_id(current_user)
    query = {"id": record_id}
    if tenant_id:
        query["tenant_id"] = tenant_id
    record = await db.part_time_availability.find_one(query, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_data:
        await db.part_time_availability.update_one(query, {"$set": update_data})
    
    updated = await db.part_time_availability.find_one(query, {"_id": 0})
    return updated


@router.delete("/part-time-availability/{record_id}")
async def delete_part_time_availability(
    record_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete part-time availability record"""
    tenant_id = get_tenant_id(current_user)
    query = {"id": record_id}
    if tenant_id:
        query["tenant_id"] = tenant_id
    record = await db.part_time_availability.find_one(query)
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    
    await db.part_time_availability.delete_one(query)
    return {"message": "Availability removed"}


@router.get("/part-time-availability/all")
async def get_all_part_time_availability(
    battalion_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all part-time availability records (for BC view)"""
    tenant_id = get_tenant_id(current_user)
    query = {}
    if tenant_id:
        query["tenant_id"] = tenant_id
    if battalion_id:
        query["battalion_id"] = battalion_id
    
    records = await db.part_time_availability.find(query, {"_id": 0}).to_list(1000)
    # Sort by date descending
    records.sort(key=lambda x: x.get("date", ""), reverse=True)
    return records


@router.get("/part-time/stats/{employee_id}")
async def get_part_time_employee_stats(
    employee_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get part-time employee statistics (hours scheduled, worked YTD, monthly)"""
    tenant_id = get_tenant_id(current_user)
    # Get all records for this employee
    query = {"employee_id": employee_id}
    if tenant_id:
        query["tenant_id"] = tenant_id
    records = await db.part_time_availability.find(query, {"_id": 0}).to_list(500)
    
    # Get stations for lookup
    stations_query = {}
    if tenant_id:
        stations_query["tenant_id"] = tenant_id
    stations_list = await db.stations.find(stations_query, {"_id": 0}).to_list(100)
    stations_dict = {s["id"]: s for s in stations_list}
    
    # Get current date info
    now = datetime.now(timezone.utc)
    current_year = now.year
    current_month = now.month
    current_month_name = now.strftime("%B")
    
    # Calculate stats
    hours_scheduled = 0
    hours_worked_ytd = 0
    hours_worked_monthly = 0
    shifts_assigned = 0
    work_history = []
    
    for record in records:
        record_date = record.get("date", "")
        record_status = record.get("status", "")
        record_hours = record.get("hours", 24)
        station_id = record.get("assigned_station_id", "")
        
        # Get station name
        station_name = ""
        if station_id and station_id in stations_dict:
            station_name = f"Station {stations_dict[station_id].get('station_number', '')}"
        
        # Parse date
        try:
            record_year = int(record_date[:4])
            record_month = int(record_date[5:7])
        except:
            continue
        
        if record_status == "assigned":
            shifts_assigned += 1
            hours_scheduled += record_hours
            
            # Check if date is in the past (worked)
            if record_date <= now.strftime("%Y-%m-%d"):
                hours_worked_ytd += record_hours
                
                if record_year == current_year and record_month == current_month:
                    hours_worked_monthly += record_hours
            
            # Add to work history
            work_history.append({
                "date": record_date,
                "shift": record.get("shift", ""),
                "hours": record_hours,
                "status": record_status,
                "station_id": station_id,
                "station_name": station_name,
                "notes": record.get("notes", "")
            })
    
    # Sort work history by date descending
    work_history.sort(key=lambda x: x["date"], reverse=True)
    
    return {
        "employee_id": employee_id,
        "hours_scheduled": hours_scheduled,
        "hours_worked_ytd": hours_worked_ytd,
        "hours_worked_monthly": hours_worked_monthly,
        "current_month_name": current_month_name,
        "shifts_assigned": shifts_assigned,
        "work_history": work_history[:10]  # Last 10 entries
    }


@router.put("/part-time-availability/{record_id}/approve")
async def approve_part_time_availability(
    record_id: str,
    station_id: str,
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF]))
):
    """Approve part-time availability (BC+ only) with station assignment"""
    tenant_id = get_tenant_id(current_user)
    query = {"id": record_id}
    if tenant_id:
        query["tenant_id"] = tenant_id
    record = await db.part_time_availability.find_one(query, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    
    if not station_id:
        raise HTTPException(status_code=400, detail="Station must be selected")
    
    await db.part_time_availability.update_one(
        query,
        {"$set": {
            "status": "assigned", 
            "approved_by": current_user["payroll_number"],
            "assigned_station_id": station_id
        }}
    )
    
    updated = await db.part_time_availability.find_one(query, {"_id": 0})
    return updated


@router.get("/part-time-availability/assigned")
async def get_assigned_part_time(
    date: str,
    battalion_id: Optional[str] = None,
    station_id: Optional[str] = None,
    shift: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get assigned part-time employees for a specific date"""
    tenant_id = get_tenant_id(current_user)
    query = {
        "date": date,
        "status": "assigned"
    }
    if tenant_id:
        query["tenant_id"] = tenant_id
    if battalion_id:
        query["battalion_id"] = battalion_id
    if station_id:
        query["assigned_station_id"] = station_id
    if shift:
        query["shift"] = shift
    
    records = await db.part_time_availability.find(query, {"_id": 0}).to_list(100)
    
    # Get station info for each record
    stations_query = {}
    if tenant_id:
        stations_query["tenant_id"] = tenant_id
    stations_list = await db.stations.find(stations_query, {"_id": 0}).to_list(100)
    stations_dict = {s["id"]: s for s in stations_list}
    
    # Get part-time employee info for each record
    pt_query = {}
    if tenant_id:
        pt_query["tenant_id"] = tenant_id
    pt_employees = await db.part_time_employees.find(pt_query, {"_id": 0}).to_list(100)
    pt_employees_dict = {e["id"]: e for e in pt_employees}
    
    for record in records:
        station_id_val = record.get("assigned_station_id")
        if station_id_val and station_id_val in stations_dict:
            record["station_number"] = stations_dict[station_id_val].get("station_number", "")
            record["station_name"] = f"Station {stations_dict[station_id_val].get('station_number', '')}"
        
        # Add part-time employee details
        emp_id = record.get("employee_id")
        if emp_id and emp_id in pt_employees_dict:
            pt_emp = pt_employees_dict[emp_id]
            record["pt_employee_name"] = pt_emp.get("name", "")
            record["pt_employee_number"] = pt_emp.get("employee_number", "")
            record["pt_employee_rank"] = pt_emp.get("rank", "Part-Time")
            record["pt_employee_phone"] = pt_emp.get("contact_phone", "")
    
    return records
