"""
Holiday Accrual System Routes
Handles holiday time accrual, negative balances, and pay period calculations
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime, date, timedelta
from dateutil.relativedelta import relativedelta

from database import db
from auth import get_current_user
from tenant_utils import get_tenant_id, add_tenant_to_query

router = APIRouter(prefix="/holiday-accrual", tags=["Holiday Accrual"])


class HolidayAccrualSettings(BaseModel):
    """Tenant-level holiday accrual settings"""
    holiday_pay_period: str = "biweekly"  # weekly, biweekly, semimonthly, monthly
    holiday_accrual_mode: str = "per_period"  # per_period or yearly
    holiday_accrual_rate_per_period: float = 4.0
    holiday_accrual_rate_yearly: float = 104.0
    holiday_reset_mode: str = "none"  # none, calendar_year, fiscal_year
    holiday_allow_negative: bool = True
    holiday_pay_period_start_date: Optional[str] = None


class PersonnelHolidayUpdate(BaseModel):
    """Update personnel holiday accrual settings"""
    holiday_accrual_override: Optional[bool] = None
    holiday_accrual_rate_override: Optional[float] = None
    holiday_accrual_mode_override: Optional[str] = None
    holiday_current_balance: Optional[float] = None
    holiday_hire_date: Optional[str] = None
    holiday_personnel_type: Optional[str] = None


class HolidayBalanceResponse(BaseModel):
    """Response for holiday balance calculation"""
    personnel_id: str
    personnel_name: str
    current_balance: float
    accrued_this_period: float
    accrued_ytd: float
    used_ytd: float
    next_accrual_date: Optional[str]
    next_accrual_amount: float
    pay_period: str
    accrual_rate: float
    allows_negative: bool
    personnel_type: str
    is_override: bool


class ProcessAccrualRequest(BaseModel):
    """Request to manually process accrual"""
    personnel_ids: Optional[List[str]] = None  # None means all personnel
    accrual_date: Optional[str] = None  # None means today


class ProcessAccrualResponse(BaseModel):
    """Response after processing accrual"""
    processed_count: int
    total_hours_accrued: float
    personnel_updated: List[dict]


def get_pay_periods_per_year(pay_period: str) -> int:
    """Get number of pay periods per year"""
    periods = {
        "weekly": 52,
        "biweekly": 26,
        "semimonthly": 24,
        "monthly": 12
    }
    return periods.get(pay_period, 26)


def get_pay_period_days(pay_period: str) -> int:
    """Get approximate days per pay period"""
    days = {
        "weekly": 7,
        "biweekly": 14,
        "semimonthly": 15,
        "monthly": 30
    }
    return days.get(pay_period, 14)


def calculate_next_pay_period_date(pay_period: str, anchor_date: Optional[str], from_date: date) -> date:
    """Calculate the next pay period date from a given date"""
    if anchor_date:
        anchor = datetime.strptime(anchor_date, "%Y-%m-%d").date()
    else:
        # Default anchor: first day of current year
        anchor = date(from_date.year, 1, 1)
    
    if pay_period == "weekly":
        days_since = (from_date - anchor).days
        periods_passed = days_since // 7
        next_period = anchor + timedelta(days=(periods_passed + 1) * 7)
        return next_period
    
    elif pay_period == "biweekly":
        days_since = (from_date - anchor).days
        periods_passed = days_since // 14
        next_period = anchor + timedelta(days=(periods_passed + 1) * 14)
        return next_period
    
    elif pay_period == "semimonthly":
        # 1st and 15th of each month
        if from_date.day < 15:
            return date(from_date.year, from_date.month, 15)
        else:
            next_month = from_date + relativedelta(months=1)
            return date(next_month.year, next_month.month, 1)
    
    elif pay_period == "monthly":
        next_month = from_date + relativedelta(months=1)
        return date(next_month.year, next_month.month, 1)
    
    return from_date + timedelta(days=14)


def calculate_periods_between(pay_period: str, start_date: date, end_date: date) -> int:
    """Calculate number of complete pay periods between two dates"""
    if start_date >= end_date:
        return 0
    
    if pay_period == "weekly":
        return (end_date - start_date).days // 7
    
    elif pay_period == "biweekly":
        return (end_date - start_date).days // 14
    
    elif pay_period == "semimonthly":
        # Count semi-monthly periods (approx 2 per month)
        months_diff = (end_date.year - start_date.year) * 12 + (end_date.month - start_date.month)
        return months_diff * 2
    
    elif pay_period == "monthly":
        return (end_date.year - start_date.year) * 12 + (end_date.month - start_date.month)
    
    return 0


def get_accrual_rate(settings: dict, personnel: dict) -> float:
    """Get the effective accrual rate for a personnel member"""
    # Check for personnel override first
    if personnel.get("holiday_accrual_override") and personnel.get("holiday_accrual_rate_override") is not None:
        return personnel["holiday_accrual_rate_override"]
    
    # Use tenant settings
    accrual_mode = personnel.get("holiday_accrual_mode_override") or settings.get("holiday_accrual_mode", "per_period")
    
    if accrual_mode == "yearly":
        # Convert yearly rate to per-period rate
        yearly_rate = settings.get("holiday_accrual_rate_yearly", 104.0)
        periods = get_pay_periods_per_year(settings.get("holiday_pay_period", "biweekly"))
        return yearly_rate / periods
    else:
        return settings.get("holiday_accrual_rate_per_period", 4.0)


async def get_tenant_settings(tenant_id: str) -> dict:
    """Get tenant holiday accrual settings"""
    tenant = await db.tenants.find_one({"id": tenant_id})
    if not tenant:
        return {}
    settings = tenant.get("settings", {})
    return {
        "holiday_pay_period": settings.get("holiday_pay_period", "biweekly"),
        "holiday_accrual_mode": settings.get("holiday_accrual_mode", "per_period"),
        "holiday_accrual_rate_per_period": settings.get("holiday_accrual_rate_per_period", 4.0),
        "holiday_accrual_rate_yearly": settings.get("holiday_accrual_rate_yearly", 104.0),
        "holiday_reset_mode": settings.get("holiday_reset_mode", "none"),
        "holiday_allow_negative": settings.get("holiday_allow_negative", True),
        "holiday_pay_period_start_date": settings.get("holiday_pay_period_start_date"),
        "leave_year_start_month": settings.get("leave_year_start_month", 1),
        "leave_year_start_day": settings.get("leave_year_start_day", 1)
    }


@router.get("/settings")
async def get_holiday_accrual_settings(current_user: dict = Depends(get_current_user)):
    """Get tenant holiday accrual settings"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=400, detail="No tenant associated with user")
    
    settings = await get_tenant_settings(tenant_id)
    return settings


@router.put("/settings")
async def update_holiday_accrual_settings(
    settings: HolidayAccrualSettings,
    current_user: dict = Depends(get_current_user)
):
    """Update tenant holiday accrual settings (Admin only)"""
    if current_user.get("role") not in ["admin", "battalion_chief"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=400, detail="No tenant associated with user")
    
    # Update tenant settings
    update_data = {
        "settings.holiday_pay_period": settings.holiday_pay_period,
        "settings.holiday_accrual_mode": settings.holiday_accrual_mode,
        "settings.holiday_accrual_rate_per_period": settings.holiday_accrual_rate_per_period,
        "settings.holiday_accrual_rate_yearly": settings.holiday_accrual_rate_yearly,
        "settings.holiday_reset_mode": settings.holiday_reset_mode,
        "settings.holiday_allow_negative": settings.holiday_allow_negative,
        "settings.holiday_pay_period_start_date": settings.holiday_pay_period_start_date
    }
    
    await db.tenants.update_one(
        {"id": tenant_id},
        {"$set": update_data}
    )
    
    return {"message": "Holiday accrual settings updated", "settings": settings.model_dump()}


@router.get("/balance/{personnel_id}")
async def get_personnel_holiday_balance(
    personnel_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get holiday balance and accrual info for a personnel member"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=400, detail="No tenant associated with user")
    
    personnel = await db.personnel.find_one({"id": personnel_id, "tenant_id": tenant_id})
    if not personnel:
        raise HTTPException(status_code=404, detail="Personnel not found")
    
    settings = await get_tenant_settings(tenant_id)
    today = date.today()
    
    # Calculate accrual rate
    accrual_rate = get_accrual_rate(settings, personnel)
    pay_period = settings.get("holiday_pay_period", "biweekly")
    
    # Calculate next accrual date
    next_accrual = calculate_next_pay_period_date(
        pay_period,
        settings.get("holiday_pay_period_start_date"),
        today
    )
    
    # Calculate accrued this year
    year_start_month = settings.get("leave_year_start_month", 1)
    year_start_day = settings.get("leave_year_start_day", 1)
    
    if today.month > year_start_month or (today.month == year_start_month and today.day >= year_start_day):
        year_start = date(today.year, year_start_month, year_start_day)
    else:
        year_start = date(today.year - 1, year_start_month, year_start_day)
    
    # Get hire date or year start as accrual start
    hire_date_str = personnel.get("holiday_hire_date")
    if hire_date_str:
        hire_date = datetime.strptime(hire_date_str, "%Y-%m-%d").date()
        accrual_start = max(hire_date, year_start)
    else:
        accrual_start = year_start
    
    # Calculate periods since year start (or hire date)
    periods_ytd = calculate_periods_between(pay_period, accrual_start, today)
    accrued_ytd = periods_ytd * accrual_rate
    
    # Calculate used holiday hours this year
    leave_records = await db.leave_records.find({
        "personnel_id": personnel_id,
        "tenant_id": tenant_id,
        "leave_type": "holiday",
        "start_date": {"$gte": year_start.isoformat()}
    }).to_list(None)
    
    used_ytd = sum(record.get("hours", 24) for record in leave_records)
    
    # Current balance from personnel record
    current_balance = personnel.get("holiday_current_balance", 0.0)
    
    return {
        "personnel_id": personnel_id,
        "personnel_name": personnel.get("name", ""),
        "current_balance": current_balance,
        "accrued_this_period": accrual_rate,
        "accrued_ytd": accrued_ytd,
        "used_ytd": used_ytd,
        "next_accrual_date": next_accrual.isoformat(),
        "next_accrual_amount": accrual_rate,
        "pay_period": pay_period,
        "accrual_rate": accrual_rate,
        "allows_negative": settings.get("holiday_allow_negative", True),
        "personnel_type": personnel.get("holiday_personnel_type", "shift"),
        "is_override": personnel.get("holiday_accrual_override", False)
    }


@router.get("/balances")
async def get_all_holiday_balances(
    current_user: dict = Depends(get_current_user)
):
    """Get holiday balances for all personnel"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=400, detail="No tenant associated with user")
    
    settings = await get_tenant_settings(tenant_id)
    personnel_list = await db.personnel.find({
        "tenant_id": tenant_id,
        "is_active": True
    }, {"_id": 0}).to_list(None)
    
    today = date.today()
    pay_period = settings.get("holiday_pay_period", "biweekly")
    
    # Year boundaries
    year_start_month = settings.get("leave_year_start_month", 1)
    year_start_day = settings.get("leave_year_start_day", 1)
    if today.month > year_start_month or (today.month == year_start_month and today.day >= year_start_day):
        year_start = date(today.year, year_start_month, year_start_day)
    else:
        year_start = date(today.year - 1, year_start_month, year_start_day)
    
    balances = []
    for personnel in personnel_list:
        accrual_rate = get_accrual_rate(settings, personnel)
        current_balance = personnel.get("holiday_current_balance", 0.0)
        
        # Calculate next accrual
        next_accrual = calculate_next_pay_period_date(
            pay_period,
            settings.get("holiday_pay_period_start_date"),
            today
        )
        
        balances.append({
            "personnel_id": personnel.get("id"),
            "personnel_name": personnel.get("name"),
            "payroll_number": personnel.get("payroll_number"),
            "current_balance": current_balance,
            "accrual_rate": accrual_rate,
            "personnel_type": personnel.get("holiday_personnel_type", "shift"),
            "is_override": personnel.get("holiday_accrual_override", False),
            "next_accrual_date": next_accrual.isoformat()
        })
    
    return {
        "balances": balances,
        "settings": settings,
        "year_start": year_start.isoformat()
    }


@router.post("/process")
async def process_accrual(
    request: ProcessAccrualRequest,
    current_user: dict = Depends(get_current_user)
):
    """Manually process accrual for personnel (Admin only)"""
    if current_user.get("role") not in ["admin", "battalion_chief"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=400, detail="No tenant associated with user")
    
    settings = await get_tenant_settings(tenant_id)
    accrual_date = date.today()
    if request.accrual_date:
        accrual_date = datetime.strptime(request.accrual_date, "%Y-%m-%d").date()
    
    # Get personnel to process
    query = {"tenant_id": tenant_id, "is_active": True}
    if request.personnel_ids:
        query["id"] = {"$in": request.personnel_ids}
    
    personnel_list = await db.personnel.find(query, {"_id": 0}).to_list(None)
    
    processed = []
    total_hours = 0.0
    
    for personnel in personnel_list:
        accrual_rate = get_accrual_rate(settings, personnel)
        current_balance = personnel.get("holiday_current_balance", 0.0)
        new_balance = current_balance + accrual_rate
        
        # Update personnel balance
        await db.personnel.update_one(
            {"id": personnel["id"]},
            {
                "$set": {
                    "holiday_current_balance": new_balance,
                    "holiday_last_accrual_date": accrual_date.isoformat()
                }
            }
        )
        
        processed.append({
            "personnel_id": personnel["id"],
            "personnel_name": personnel.get("name"),
            "previous_balance": current_balance,
            "accrued": accrual_rate,
            "new_balance": new_balance
        })
        total_hours += accrual_rate
    
    return {
        "processed_count": len(processed),
        "total_hours_accrued": total_hours,
        "personnel_updated": processed
    }


@router.post("/reset-year")
async def reset_holiday_balances(
    current_user: dict = Depends(get_current_user)
):
    """Reset holiday balances for new year (Admin only)"""
    if current_user.get("role") not in ["admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=400, detail="No tenant associated with user")
    
    settings = await get_tenant_settings(tenant_id)
    reset_mode = settings.get("holiday_reset_mode", "none")
    
    if reset_mode == "none":
        raise HTTPException(status_code=400, detail="Reset mode is set to 'none'. No reset performed.")
    
    # Reset all personnel balances to 0
    result = await db.personnel.update_many(
        {"tenant_id": tenant_id, "is_active": True},
        {
            "$set": {
                "holiday_current_balance": 0.0,
                "holiday_last_accrual_date": date.today().isoformat()
            }
        }
    )
    
    return {
        "message": f"Holiday balances reset for {result.modified_count} personnel",
        "reset_mode": reset_mode,
        "reset_date": date.today().isoformat()
    }


@router.put("/personnel/{personnel_id}/balance")
async def update_personnel_holiday_balance(
    personnel_id: str,
    balance: float,
    current_user: dict = Depends(get_current_user)
):
    """Manually update personnel holiday balance (Admin only)"""
    if current_user.get("role") not in ["admin", "battalion_chief"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=400, detail="No tenant associated with user")
    
    settings = await get_tenant_settings(tenant_id)
    
    # Check if negative balance is allowed
    if balance < 0 and not settings.get("holiday_allow_negative", True):
        raise HTTPException(status_code=400, detail="Negative holiday balance not allowed")
    
    result = await db.personnel.update_one(
        {"id": personnel_id, "tenant_id": tenant_id},
        {"$set": {"holiday_current_balance": balance}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Personnel not found")
    
    return {"message": "Balance updated", "new_balance": balance}


@router.put("/personnel/{personnel_id}/accrual-settings")
async def update_personnel_accrual_settings(
    personnel_id: str,
    settings_update: PersonnelHolidayUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update personnel-specific holiday accrual settings (Admin only)"""
    if current_user.get("role") not in ["admin", "battalion_chief"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=400, detail="No tenant associated with user")
    
    update_data = {}
    if settings_update.holiday_accrual_override is not None:
        update_data["holiday_accrual_override"] = settings_update.holiday_accrual_override
    if settings_update.holiday_accrual_rate_override is not None:
        update_data["holiday_accrual_rate_override"] = settings_update.holiday_accrual_rate_override
    if settings_update.holiday_accrual_mode_override is not None:
        update_data["holiday_accrual_mode_override"] = settings_update.holiday_accrual_mode_override
    if settings_update.holiday_current_balance is not None:
        update_data["holiday_current_balance"] = settings_update.holiday_current_balance
    if settings_update.holiday_hire_date is not None:
        update_data["holiday_hire_date"] = settings_update.holiday_hire_date
    if settings_update.holiday_personnel_type is not None:
        update_data["holiday_personnel_type"] = settings_update.holiday_personnel_type
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    result = await db.personnel.update_one(
        {"id": personnel_id, "tenant_id": tenant_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Personnel not found")
    
    return {"message": "Personnel accrual settings updated", "updated_fields": list(update_data.keys())}
