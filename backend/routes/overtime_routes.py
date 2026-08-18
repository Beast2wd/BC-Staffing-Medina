"""
Overtime and Leave routes - Multi-tenant enabled
"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from typing import List, Optional
from datetime import datetime, timezone
import uuid

from database import db
from models import (
    UserRole, OvertimeRecord, OvertimeRecordCreate,
    LeaveRecord, LeaveRecordCreate
)
from auth import get_current_user, require_role
from websocket_manager import manager
from routes.user_notifications_routes import create_notification_for_personnel
from tenant_utils import get_tenant_id, add_tenant_to_query, add_tenant_to_doc

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
    query = add_tenant_to_query(query, current_user)
    
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
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Create overtime record - any user can submit their own availability"""
    tenant_id = get_tenant_id(current_user)
    
    # Verify personnel exists within tenant
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
    record_doc = {"id": record_id, **data.model_dump()}
    record_doc = add_tenant_to_doc(record_doc, current_user)
    
    await db.overtime_records.insert_one(record_doc)
    
    # Broadcast WebSocket update (tenant-scoped)
    tenant_id = get_tenant_id(current_user)
    background_tasks.add_task(
        manager.broadcast_overtime_update,
        "created",
        {"id": record_id, "personnel_name": personnel.get("name"), "status": data.status, "modified_by": current_user.get("name")},
        data.date,
        tenant_id,
        current_user.get("name")
    )
    
    return OvertimeRecord(**record_doc)


@router.put("/overtime/{record_id}", response_model=OvertimeRecord)
async def update_overtime_record(
    record_id: str,
    data: OvertimeRecordCreate,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF, UserRole.CAPTAIN, UserRole.LIEUTENANT]))
):
    tenant_id = get_tenant_id(current_user)
    
    query = {"id": record_id}
    query = add_tenant_to_query(query, current_user)
    
    # Get the existing record to check previous status
    existing = await db.overtime_records.find_one(query, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Overtime record not found")
    
    prev_status = existing.get("status", "available")
    new_status = data.status
    hours = data.hours or existing.get("hours", 0)
    personnel_id = existing.get("personnel_id")
    
    # Build personnel query with tenant filter
    personnel_query = {"id": personnel_id}
    if tenant_id:
        personnel_query["tenant_id"] = tenant_id
    
    # Update personnel overtime hours based on status change
    if prev_status != new_status:
        if new_status == "assigned" and prev_status != "assigned":
            # Add hours when assigned
            await db.personnel.update_one(
                personnel_query,
                {"$inc": {"overtime_hours_worked": hours}}
            )
            # Create notification for the personnel
            personnel = await db.personnel.find_one(personnel_query, {"_id": 0})
            if personnel:
                background_tasks.add_task(
                    create_notification_for_personnel,
                    personnel_id,
                    "Overtime Approved",
                    f"You have been assigned {hours} hours of overtime on {existing.get('date')}",
                    "overtime",
                    "/overtime",
                    "View Overtime",
                    {"date": existing.get("date"), "hours": hours, "approved_by": current_user.get("name")}
                )
        elif new_status == "declined" and prev_status == "assigned":
            # Deduct hours when declining from assigned
            await db.personnel.update_one(
                personnel_query,
                {"$inc": {"overtime_hours_worked": -hours}}
            )
        elif new_status == "available" and prev_status == "assigned":
            # Deduct hours when going back to available from assigned
            await db.personnel.update_one(
                personnel_query,
                {"$inc": {"overtime_hours_worked": -hours}}
            )
    
    result = await db.overtime_records.find_one_and_update(
        query,
        {"$set": data.model_dump()},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Overtime record not found")
    del result["_id"]
    
    # Broadcast WebSocket update (tenant-scoped)
    background_tasks.add_task(
        manager.broadcast_overtime_update,
        "updated",
        {"id": record_id, "status": new_status, "prev_status": prev_status, "modified_by": current_user.get("name")},
        existing.get("date"),
        tenant_id,
        current_user.get("name")
    )
    
    return OvertimeRecord(**result)


@router.delete("/overtime/{record_id}")
async def delete_overtime_record(
    record_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Delete an overtime record from the list. Users can delete their own records, BC/Admin can delete any."""
    tenant_id = get_tenant_id(current_user)
    
    query = {"id": record_id}
    query = add_tenant_to_query(query, current_user)
    
    # Get the record first
    record = await db.overtime_records.find_one(query, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Overtime record not found")
    
    # Check permissions - users can only delete their own non-assigned records
    is_admin_or_bc = current_user["role"] in [UserRole.ADMIN, UserRole.BATTALION_CHIEF]
    
    # Find if this is the user's own record
    user_personnel_query = {"payroll_number": current_user["payroll_number"]}
    if tenant_id:
        user_personnel_query["tenant_id"] = tenant_id
    user_personnel = await db.personnel.find_one(user_personnel_query, {"_id": 0})
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
        personnel_query = {"id": personnel_id}
        if tenant_id:
            personnel_query["tenant_id"] = tenant_id
        await db.personnel.update_one(
            personnel_query,
            {"$inc": {"overtime_hours_worked": -hours}}
        )
    
    # Delete the record
    result = await db.overtime_records.delete_one(query)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Overtime record not found")
    
    # Broadcast WebSocket update (tenant-scoped)
    background_tasks.add_task(
        manager.broadcast_overtime_update,
        "deleted",
        {"id": record_id, "modified_by": current_user.get("name")},
        record.get("date"),
        tenant_id,
        current_user.get("name")
    )
    
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
    query = add_tenant_to_query(query, current_user)
    
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
    record_doc = add_tenant_to_doc(record_doc, current_user)
    
    await db.leave_records.insert_one(record_doc)
    
    # Deduct hours from personnel's leave balance
    tenant_id = get_tenant_id(current_user)
    leave_type = data.leave_type
    hours_used = data.hours if data.hours else 24  # Default to 24 hours if not specified
    
    if leave_type and data.personnel_id:
        balance_field = f"{leave_type}_current_balance"
        
        # Get current balance to check if sick can go negative (with tenant isolation)
        personnel_query = {"id": data.personnel_id}
        if tenant_id:
            personnel_query["tenant_id"] = tenant_id
        personnel = await db.personnel.find_one(personnel_query)
        if personnel:
            current_balance = personnel.get(balance_field, 0)
            new_balance = current_balance - hours_used
            
            # Sick time cannot go negative per P-021
            if leave_type == "sick" and new_balance < 0:
                # Still create the record but don't let balance go below 0
                new_balance = 0
            
            await db.personnel.update_one(
                personnel_query,
                {"$set": {balance_field: round(new_balance, 2)}}
            )
    
    return LeaveRecord(**record_doc)


@router.put("/leave-records/{record_id}", response_model=LeaveRecord)
async def update_leave_record(
    record_id: str,
    data: LeaveRecordCreate,
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF, UserRole.CAPTAIN, UserRole.LIEUTENANT]))
):
    query = {"id": record_id}
    query = add_tenant_to_query(query, current_user)
    
    # Get the original record to calculate balance difference
    original_record = await db.leave_records.find_one(query)
    if not original_record:
        raise HTTPException(status_code=404, detail="Leave record not found")
    
    original_hours = original_record.get("hours", 24)
    new_hours = data.hours if data.hours else 24
    hours_difference = new_hours - original_hours
    
    # Update the leave record
    result = await db.leave_records.find_one_and_update(
        query,
        {"$set": data.model_dump()},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Leave record not found")
    
    # Adjust balance if hours changed
    tenant_id = get_tenant_id(current_user)
    if hours_difference != 0 and data.personnel_id:
        leave_type = data.leave_type
        balance_field = f"{leave_type}_current_balance"
        
        # Query with tenant isolation
        personnel_query = {"id": data.personnel_id}
        if tenant_id:
            personnel_query["tenant_id"] = tenant_id
        personnel = await db.personnel.find_one(personnel_query)
        if personnel:
            current_balance = personnel.get(balance_field, 0)
            # Negative difference means more hours used, positive means less
            new_balance = current_balance - hours_difference
            
            # Sick time cannot go negative per P-021
            if leave_type == "sick" and new_balance < 0:
                new_balance = 0
            
            await db.personnel.update_one(
                personnel_query,
                {"$set": {balance_field: round(new_balance, 2)}}
            )
    
    del result["_id"]
    return LeaveRecord(**result)


@router.delete("/leave-records/{record_id}")
async def delete_leave_record(
    record_id: str,
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF]))
):
    query = {"id": record_id}
    query = add_tenant_to_query(query, current_user)
    
    # Get the record first to credit back hours
    record = await db.leave_records.find_one(query)
    if not record:
        raise HTTPException(status_code=404, detail="Leave record not found")
    
    # Credit hours back to personnel's leave balance
    leave_type = record.get("leave_type")
    hours_used = record.get("hours", 24)  # Default to 24 if not specified
    personnel_id = record.get("personnel_id")
    
    if leave_type and personnel_id:
        balance_field = f"{leave_type}_current_balance"
        
        # Get current balance with tenant isolation
        personnel_query = {"id": personnel_id}
        tenant_id = record.get("tenant_id")
        if tenant_id:
            personnel_query["tenant_id"] = tenant_id
        personnel = await db.personnel.find_one(personnel_query)
        if personnel:
            current_balance = personnel.get(balance_field, 0)
            new_balance = current_balance + hours_used
            
            # Respect rollover caps when crediting back
            # Get tenant settings for caps
            tenant_id = record.get("tenant_id")
            if tenant_id:
                tenant = await db.tenants.find_one({"id": tenant_id})
                if tenant:
                    pto_settings = tenant.get("settings", {}).get("pto_settings", {})
                    personnel_type = personnel.get("personnel_type", "operations")
                    is_operations = personnel_type in ["shift", "operations"]
                    
                    if leave_type == "vacation":
                        cap = pto_settings.get(
                            "vacation_rollover_cap_operations" if is_operations else "vacation_rollover_cap_admin",
                            240 if is_operations else 120
                        )
                        new_balance = min(new_balance, cap)
                    elif leave_type == "sick":
                        cap = pto_settings.get("sick_rollover_cap", 1080)
                        new_balance = min(new_balance, cap)
                    # Holiday has no cap
            
            await db.personnel.update_one(
                personnel_query,
                {"$set": {balance_field: round(new_balance, 2)}}
            )
    
    # Now delete the record
    result = await db.leave_records.delete_one(query)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Leave record not found")
    
    return {"message": "Leave record deleted", "hours_credited": hours_used}


@router.get("/leave-balances")
async def get_leave_balances(
    personnel_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Get leave balances for personnel showing annual allocation vs used days.
    For 24-hour shifts, each leave record day counts as 1 shift day used.
    Uses tenant's configured leave year (fiscal year) settings.
    """
    from datetime import datetime
    from dateutil.relativedelta import relativedelta
    
    today = datetime.now()
    
    # Get tenant settings for leave year configuration
    tenant_id = current_user.get("tenant_id")
    leave_year_start_month = 1  # Default to January
    leave_year_start_day = 1    # Default to 1st
    
    if tenant_id:
        tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0})
        if tenant and tenant.get("settings"):
            leave_year_start_month = tenant["settings"].get("leave_year_start_month", 1)
            leave_year_start_day = tenant["settings"].get("leave_year_start_day", 1)
    
    # Calculate the current leave year period based on fiscal year settings
    # If today is before the fiscal year start in current calendar year, 
    # then we're in the previous fiscal year
    fiscal_year_start_this_year = datetime(today.year, leave_year_start_month, leave_year_start_day)
    
    if today >= fiscal_year_start_this_year:
        # Current fiscal year started this calendar year
        year_start_date = fiscal_year_start_this_year
        year_end_date = year_start_date + relativedelta(years=1) - relativedelta(days=1)
        fiscal_year_label = today.year if leave_year_start_month == 1 else f"{today.year}-{today.year + 1}"
    else:
        # Current fiscal year started last calendar year
        year_start_date = datetime(today.year - 1, leave_year_start_month, leave_year_start_day)
        year_end_date = fiscal_year_start_this_year - relativedelta(days=1)
        fiscal_year_label = today.year - 1 if leave_year_start_month == 1 else f"{today.year - 1}-{today.year}"
    
    year_start = year_start_date.strftime("%Y-%m-%d")
    year_end = year_end_date.strftime("%Y-%m-%d")
    
    # Get personnel
    personnel_query = {}
    personnel_query = add_tenant_to_query(personnel_query, current_user)
    if personnel_id:
        personnel_query["id"] = personnel_id
    
    personnel_list = await db.personnel.find(personnel_query, {"_id": 0}).to_list(1000)
    
    # Get all approved leave records for the current leave year
    leave_query = {
        "status": "approved",
        "$or": [
            {"start_date": {"$lte": year_end}, "end_date": {"$gte": year_start}}
        ]
    }
    leave_query = add_tenant_to_query(leave_query, current_user)
    
    leave_records = await db.leave_records.find(leave_query, {"_id": 0}).to_list(5000)
    
    # Calculate used days per person
    # For 24-hour shifts, we count the number of shift START dates (end_date - 1 day for each shift)
    balances = []
    
    for person in personnel_list:
        person_leaves = [l for l in leave_records if l.get("personnel_id") == person.get("id")]
        
        vacation_used = 0
        sick_used = 0
        holiday_used = 0
        
        for leave in person_leaves:
            start = datetime.strptime(leave["start_date"], "%Y-%m-%d")
            end = datetime.strptime(leave["end_date"], "%Y-%m-%d")
            # For 24-hour shifts: number of shift days = (end - start).days
            # Because end_date is when shift ends, not a separate day
            shift_days = (end - start).days
            if shift_days < 1:
                shift_days = 1  # Minimum 1 day
            
            leave_type = leave.get("leave_type", "")
            if leave_type == "vacation":
                vacation_used += shift_days
            elif leave_type == "sick":
                sick_used += shift_days
            elif leave_type == "holiday":
                holiday_used += shift_days
        
        # Get allocations with defaults
        annual_vacation = person.get("annual_vacation_days", 15)
        annual_sick = person.get("annual_sick_days", 12)
        annual_holiday = person.get("annual_holiday_days", 11)
        
        balances.append({
            "personnel_id": person.get("id"),
            "payroll_number": person.get("payroll_number"),
            "name": person.get("name"),
            "rank": person.get("rank"),
            "shift": person.get("shift"),
            "station_id": person.get("station_id"),
            "vacation": {
                "annual": annual_vacation,
                "used": vacation_used,
                "remaining": annual_vacation - vacation_used
            },
            "sick": {
                "annual": annual_sick,
                "used": sick_used,
                "remaining": annual_sick - sick_used
            },
            "holiday": {
                "annual": annual_holiday,
                "used": holiday_used,
                "remaining": annual_holiday - holiday_used
            },
            "year": fiscal_year_label,
            "year_start": year_start,
            "year_end": year_end
        })
    
    return balances



@router.get("/leave-balances-by-type/{leave_type}")
async def get_leave_balances_by_type(
    leave_type: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get current leave balances for all personnel filtered by leave type (vacation, sick, holiday).
    Returns real-time balances from personnel records.
    """
    if leave_type not in ["vacation", "sick", "holiday"]:
        raise HTTPException(status_code=400, detail="Invalid leave type. Must be vacation, sick, or holiday.")
    
    query = {"is_active": True}
    query = add_tenant_to_query(query, current_user)
    
    personnel_list = await db.personnel.find(query, {"_id": 0}).to_list(None)
    
    # Get tenant settings for caps
    tenant_id = current_user.get("tenant_id")
    pto_settings = {}
    if tenant_id:
        tenant = await db.tenants.find_one({"id": tenant_id})
        if tenant:
            pto_settings = tenant.get("settings", {}).get("pto_settings", {})
    
    balance_field = f"{leave_type}_current_balance"
    
    balances = []
    for person in personnel_list:
        personnel_type = person.get("personnel_type", "operations")
        is_operations = personnel_type in ["shift", "operations"]
        
        current_balance = person.get(balance_field, 0)
        
        # Get caps and rates based on leave type
        if leave_type == "vacation":
            cap = pto_settings.get(
                "vacation_rollover_cap_operations" if is_operations else "vacation_rollover_cap_admin",
                240 if is_operations else 120
            )
            allow_negative = pto_settings.get("vacation_allow_negative", True)
        elif leave_type == "sick":
            cap = pto_settings.get("sick_rollover_cap", 1080)
            allow_negative = False  # Per P-021
        else:  # holiday
            cap = None  # No cap for holiday
            allow_negative = pto_settings.get("holiday_allow_negative", True)
        
        # Determine status
        if current_balance < 0:
            status = "negative"
        elif cap and current_balance >= cap:
            status = "at_cap"
        elif cap and current_balance >= cap * 0.9:
            status = "near_cap"
        elif current_balance <= 8:  # Less than one shift
            status = "low"
        else:
            status = "normal"
        
        balances.append({
            "personnel_id": person.get("id"),
            "payroll_number": person.get("payroll_number"),
            "name": person.get("name"),
            "rank": person.get("rank"),
            "shift": person.get("shift"),
            "station_id": person.get("station_id"),
            "personnel_type": "operations" if is_operations else "administrative",
            "current_balance": current_balance,
            "cap": cap,
            "allow_negative": allow_negative,
            "status": status
        })
    
    # Sort by name
    balances.sort(key=lambda x: x["name"])
    
    return {
        "leave_type": leave_type,
        "balances": balances,
        "summary": {
            "total_personnel": len(balances),
            "negative_count": len([b for b in balances if b["status"] == "negative"]),
            "low_count": len([b for b in balances if b["status"] == "low"]),
            "at_cap_count": len([b for b in balances if b["status"] == "at_cap"]),
            "total_hours": sum(b["current_balance"] for b in balances)
        }
    }
