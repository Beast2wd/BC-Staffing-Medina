"""
Paid Time Off (PTO) Settings Routes
Handles vacation, holiday, and sick time accrual configurations based on department policy
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional, List
from pydantic import BaseModel

from database import db
from auth import get_current_user

router = APIRouter(prefix="/pto-settings", tags=["PTO Settings"])


class AccrualRate(BaseModel):
    """Accrual rate tier based on years of service"""
    minYears: int
    maxYears: int
    hoursPerYear: int
    label: str


class PTOSettings(BaseModel):
    """Complete PTO settings based on department policy P-021"""
    # Vacation Settings
    vacation_accrual_frequency: str = "monthly"  # monthly, biweekly, weekly
    vacation_accrual_day: int = 1  # Day of month/period
    vacation_rollover_cap_operations: int = 240  # Max rollover for operations staff
    vacation_rollover_cap_admin: int = 120  # Max rollover for admin staff
    vacation_new_hire_waiting_months: int = 6  # Waiting period before using
    vacation_allow_negative: bool = True  # Can use before earning
    vacation_rates_operations: List[AccrualRate] = []
    vacation_rates_admin: List[AccrualRate] = []
    
    # Holiday Settings
    holiday_hours_per_holiday_operations: int = 12  # Hours per holiday for ops
    holiday_hours_per_holiday_admin: int = 8  # Hours per holiday for admin
    holiday_count: int = 11  # Number of federal holidays
    holiday_allow_negative: bool = True  # Can go negative
    holiday_december_cashout_percent: int = 50  # % that can be cashed out
    holiday_call_off_penalty: bool = True  # No accrual if call off around holiday
    
    # Sick Settings
    sick_accrual_frequency: str = "monthly"
    sick_accrual_day: int = 1
    sick_rollover_cap: int = 1080  # Max balance
    sick_allow_negative: bool = False  # CANNOT go negative per policy
    sick_rates_operations: List[AccrualRate] = []
    sick_rates_admin: List[AccrualRate] = []


# Default rates based on Medina County ESD1 Policy P-021
DEFAULT_VACATION_RATES_OPS = [
    {"minYears": 0, "maxYears": 2, "hoursPerYear": 60, "label": "Hire - 2 years"},
    {"minYears": 3, "maxYears": 5, "hoursPerYear": 96, "label": "3 - 5 years"},
    {"minYears": 6, "maxYears": 10, "hoursPerYear": 144, "label": "6 - 10 years"},
    {"minYears": 11, "maxYears": 99, "hoursPerYear": 168, "label": "10+ years"}
]

DEFAULT_VACATION_RATES_ADMIN = [
    {"minYears": 0, "maxYears": 2, "hoursPerYear": 40, "label": "Hire - 2 years"},
    {"minYears": 3, "maxYears": 5, "hoursPerYear": 80, "label": "3 - 5 years"},
    {"minYears": 6, "maxYears": 10, "hoursPerYear": 120, "label": "6 - 10 years"},
    {"minYears": 11, "maxYears": 99, "hoursPerYear": 140, "label": "10+ years"}
]

DEFAULT_SICK_RATES_OPS = [
    {"minYears": 0, "maxYears": 5, "hoursPerYear": 48, "label": "Hire - 5 years"},
    {"minYears": 6, "maxYears": 10, "hoursPerYear": 72, "label": "6 - 10 years"},
    {"minYears": 11, "maxYears": 99, "hoursPerYear": 96, "label": "10+ years"}
]

DEFAULT_SICK_RATES_ADMIN = [
    {"minYears": 0, "maxYears": 5, "hoursPerYear": 40, "label": "Hire - 5 years"},
    {"minYears": 6, "maxYears": 10, "hoursPerYear": 64, "label": "6 - 10 years"},
    {"minYears": 11, "maxYears": 99, "hoursPerYear": 80, "label": "10+ years"}
]


def get_default_settings() -> dict:
    """Return default PTO settings based on policy P-021"""
    return {
        "vacation_accrual_frequency": "monthly",
        "vacation_accrual_day": 1,
        "vacation_rollover_cap_operations": 240,
        "vacation_rollover_cap_admin": 120,
        "vacation_new_hire_waiting_months": 6,
        "vacation_allow_negative": True,
        "vacation_rates_operations": DEFAULT_VACATION_RATES_OPS,
        "vacation_rates_admin": DEFAULT_VACATION_RATES_ADMIN,
        "holiday_hours_per_holiday_operations": 12,
        "holiday_hours_per_holiday_admin": 8,
        "holiday_count": 11,
        "holiday_allow_negative": True,
        "holiday_december_cashout_percent": 50,
        "holiday_call_off_penalty": True,
        "sick_accrual_frequency": "monthly",
        "sick_accrual_day": 1,
        "sick_rollover_cap": 1080,
        "sick_allow_negative": False,
        "sick_rates_operations": DEFAULT_SICK_RATES_OPS,
        "sick_rates_admin": DEFAULT_SICK_RATES_ADMIN
    }


@router.get("")
async def get_pto_settings(current_user: dict = Depends(get_current_user)):
    """Get PTO settings for tenant"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=400, detail="No tenant associated with user")
    
    # Check if tenant has custom PTO settings
    tenant = await db.tenants.find_one({"id": tenant_id})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    settings = tenant.get("settings", {})
    pto_settings = settings.get("pto_settings")
    
    if pto_settings:
        return pto_settings
    
    # Return defaults if no custom settings
    return get_default_settings()


@router.put("")
async def update_pto_settings(
    pto_settings: PTOSettings,
    current_user: dict = Depends(get_current_user)
):
    """Update PTO settings for tenant (Admin only)"""
    if current_user.get("role") not in ["admin", "battalion_chief"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=400, detail="No tenant associated with user")
    
    # Convert to dict and store in tenant settings
    settings_dict = pto_settings.model_dump()
    
    await db.tenants.update_one(
        {"id": tenant_id},
        {"$set": {"settings.pto_settings": settings_dict}}
    )
    
    return {"message": "PTO settings updated", "settings": settings_dict}


@router.get("/calculate-accrual/{personnel_id}")
async def calculate_personnel_accrual(
    personnel_id: str,
    leave_type: str = "vacation",
    current_user: dict = Depends(get_current_user)
):
    """Calculate accrual rate for a specific personnel based on their years of service"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=400, detail="No tenant associated with user")
    
    # Get personnel
    personnel = await db.personnel.find_one({"id": personnel_id, "tenant_id": tenant_id})
    if not personnel:
        raise HTTPException(status_code=404, detail="Personnel not found")
    
    # Get PTO settings
    tenant = await db.tenants.find_one({"id": tenant_id})
    settings = tenant.get("settings", {}).get("pto_settings") or get_default_settings()
    
    # Determine personnel type (operations vs administrative)
    personnel_type = personnel.get("holiday_personnel_type", "shift")
    is_operations = personnel_type in ["shift", "operations"]
    
    # Calculate years of service
    from datetime import datetime, date
    hire_date_str = personnel.get("holiday_hire_date") or personnel.get("created_at", "")[:10]
    if hire_date_str:
        try:
            hire_date = datetime.strptime(hire_date_str[:10], "%Y-%m-%d").date()
            years_of_service = (date.today() - hire_date).days / 365.25
        except (ValueError, TypeError):
            years_of_service = 0
    else:
        years_of_service = 0
    
    # Get appropriate rates
    if leave_type == "vacation":
        rates = settings.get("vacation_rates_operations" if is_operations else "vacation_rates_admin", [])
    elif leave_type == "sick":
        rates = settings.get("sick_rates_operations" if is_operations else "sick_rates_admin", [])
    elif leave_type == "holiday":
        # Holiday is per-holiday, not tiered
        hours_per_holiday = settings.get(
            "holiday_hours_per_holiday_operations" if is_operations else "holiday_hours_per_holiday_admin",
            12 if is_operations else 8
        )
        return {
            "personnel_id": personnel_id,
            "personnel_name": personnel.get("name"),
            "personnel_type": "operations" if is_operations else "administrative",
            "years_of_service": round(years_of_service, 1),
            "leave_type": leave_type,
            "hours_per_holiday": hours_per_holiday,
            "holiday_count": settings.get("holiday_count", 11),
            "annual_hours": hours_per_holiday * settings.get("holiday_count", 11)
        }
    else:
        raise HTTPException(status_code=400, detail="Invalid leave type")
    
    # Find matching rate tier
    hours_per_year = 0
    rate_tier = "N/A"
    for rate in rates:
        if rate.get("minYears", 0) <= years_of_service <= rate.get("maxYears", 99):
            hours_per_year = rate.get("hoursPerYear", 0)
            rate_tier = rate.get("label", "")
            break
    
    return {
        "personnel_id": personnel_id,
        "personnel_name": personnel.get("name"),
        "personnel_type": "operations" if is_operations else "administrative",
        "years_of_service": round(years_of_service, 1),
        "leave_type": leave_type,
        "rate_tier": rate_tier,
        "hours_per_year": hours_per_year,
        "hours_per_month": round(hours_per_year / 12, 2)
    }


@router.get("/rates-summary")
async def get_rates_summary(current_user: dict = Depends(get_current_user)):
    """Get a summary of all accrual rates for display"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=400, detail="No tenant associated with user")
    
    tenant = await db.tenants.find_one({"id": tenant_id})
    settings = tenant.get("settings", {}).get("pto_settings") or get_default_settings()
    
    return {
        "vacation": {
            "operations": settings.get("vacation_rates_operations", DEFAULT_VACATION_RATES_OPS),
            "administrative": settings.get("vacation_rates_admin", DEFAULT_VACATION_RATES_ADMIN),
            "rollover_cap_operations": settings.get("vacation_rollover_cap_operations", 240),
            "rollover_cap_admin": settings.get("vacation_rollover_cap_admin", 120),
            "allow_negative": settings.get("vacation_allow_negative", True),
            "new_hire_waiting_months": settings.get("vacation_new_hire_waiting_months", 6)
        },
        "holiday": {
            "hours_per_holiday_operations": settings.get("holiday_hours_per_holiday_operations", 12),
            "hours_per_holiday_admin": settings.get("holiday_hours_per_holiday_admin", 8),
            "holiday_count": settings.get("holiday_count", 11),
            "allow_negative": settings.get("holiday_allow_negative", True),
            "december_cashout_percent": settings.get("holiday_december_cashout_percent", 50),
            "call_off_penalty": settings.get("holiday_call_off_penalty", True)
        },
        "sick": {
            "operations": settings.get("sick_rates_operations", DEFAULT_SICK_RATES_OPS),
            "administrative": settings.get("sick_rates_admin", DEFAULT_SICK_RATES_ADMIN),
            "rollover_cap": settings.get("sick_rollover_cap", 1080),
            "allow_negative": settings.get("sick_allow_negative", False)
        }
    }



@router.get("/personnel/{personnel_id}/all-rates")
async def get_personnel_all_accrual_rates(
    personnel_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all accrual rates (vacation, sick, holiday) for a specific personnel member"""
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=400, detail="No tenant associated with user")
    
    # Get personnel
    personnel = await db.personnel.find_one({"id": personnel_id, "tenant_id": tenant_id}, {"_id": 0})
    if not personnel:
        raise HTTPException(status_code=404, detail="Personnel not found")
    
    # Get PTO settings
    tenant = await db.tenants.find_one({"id": tenant_id})
    settings = tenant.get("settings", {}).get("pto_settings") or get_default_settings()
    
    # Determine personnel type - check new field first, fall back to legacy
    personnel_type = personnel.get("personnel_type") or personnel.get("holiday_personnel_type", "operations")
    is_operations = personnel_type in ["shift", "operations"]
    type_label = "operations" if is_operations else "administrative"
    
    # Calculate years of service
    from datetime import datetime, date
    hire_date_str = personnel.get("hire_date") or personnel.get("holiday_hire_date") or personnel.get("created_at", "")[:10]
    hire_date = None
    years_of_service = 0
    
    if hire_date_str:
        try:
            hire_date = datetime.strptime(hire_date_str[:10], "%Y-%m-%d").date()
            years_of_service = (date.today() - hire_date).days / 365.25
        except (ValueError, TypeError):
            pass
    
    # Helper to find rate tier
    def find_rate_tier(rates, yos):
        for rate in rates:
            if rate.get("minYears", 0) <= yos <= rate.get("maxYears", 99):
                return rate.get("hoursPerYear", 0), rate.get("label", "")
        return 0, "N/A"
    
    # Get vacation rate
    vacation_rates = settings.get("vacation_rates_operations" if is_operations else "vacation_rates_admin", [])
    vacation_hours_year, vacation_tier = find_rate_tier(vacation_rates, years_of_service)
    
    # Get sick rate
    sick_rates = settings.get("sick_rates_operations" if is_operations else "sick_rates_admin", [])
    sick_hours_year, sick_tier = find_rate_tier(sick_rates, years_of_service)
    
    # Get holiday rate (per-holiday based, not tiered)
    holiday_hours_per = settings.get(
        "holiday_hours_per_holiday_operations" if is_operations else "holiday_hours_per_holiday_admin",
        12 if is_operations else 8
    )
    holiday_count = settings.get("holiday_count", 11)
    holiday_hours_year = holiday_hours_per * holiday_count
    
    # Current balances
    vacation_balance = personnel.get("vacation_current_balance", 0)
    sick_balance = personnel.get("sick_current_balance", 0)
    holiday_balance = personnel.get("holiday_current_balance", 0)
    
    # Rollover caps
    vacation_cap = settings.get("vacation_rollover_cap_operations" if is_operations else "vacation_rollover_cap_admin", 240 if is_operations else 120)
    sick_cap = settings.get("sick_rollover_cap", 1080)
    
    return {
        "personnel_id": personnel_id,
        "personnel_name": personnel.get("name", ""),
        "payroll_number": personnel.get("payroll_number", ""),
        "personnel_type": type_label,
        "hire_date": hire_date_str if hire_date else None,
        "years_of_service": round(years_of_service, 2),
        "vacation": {
            "tier": vacation_tier,
            "hours_per_year": vacation_hours_year,
            "hours_per_month": round(vacation_hours_year / 12, 2),
            "current_balance": vacation_balance,
            "rollover_cap": vacation_cap,
            "allow_negative": settings.get("vacation_allow_negative", True)
        },
        "sick": {
            "tier": sick_tier,
            "hours_per_year": sick_hours_year,
            "hours_per_month": round(sick_hours_year / 12, 2),
            "current_balance": sick_balance,
            "rollover_cap": sick_cap,
            "allow_negative": False  # Per P-021, sick cannot go negative
        },
        "holiday": {
            "hours_per_holiday": holiday_hours_per,
            "holiday_count": holiday_count,
            "hours_per_year": holiday_hours_year,
            "current_balance": holiday_balance,
            "allow_negative": settings.get("holiday_allow_negative", True)
        }
    }


@router.post("/process-monthly-accrual")
async def process_monthly_accrual(
    current_user: dict = Depends(get_current_user)
):
    """Process monthly accrual for all active personnel based on P-021 rates (Admin only)"""
    if current_user.get("role") not in ["admin", "battalion_chief"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=400, detail="No tenant associated with user")
    
    from datetime import datetime, date
    
    # Get PTO settings
    tenant = await db.tenants.find_one({"id": tenant_id})
    settings = tenant.get("settings", {}).get("pto_settings") or get_default_settings()
    
    # Get all active personnel
    personnel_list = await db.personnel.find({
        "tenant_id": tenant_id,
        "is_active": True
    }, {"_id": 0}).to_list(None)
    
    # Helper to find rate tier
    def find_rate_tier(rates, yos):
        for rate in rates:
            if rate.get("minYears", 0) <= yos <= rate.get("maxYears", 99):
                return rate.get("hoursPerYear", 0)
        return 0
    
    processed = []
    today = date.today()
    
    for person in personnel_list:
        # Determine personnel type
        personnel_type = person.get("personnel_type") or person.get("holiday_personnel_type", "operations")
        is_operations = personnel_type in ["shift", "operations"]
        
        # Calculate years of service
        hire_date_str = person.get("hire_date") or person.get("holiday_hire_date") or person.get("created_at", "")[:10]
        years_of_service = 0
        if hire_date_str:
            try:
                hire_date = datetime.strptime(hire_date_str[:10], "%Y-%m-%d").date()
                years_of_service = (today - hire_date).days / 365.25
            except (ValueError, TypeError):
                pass
        
        # Check new hire waiting period for vacation
        waiting_months = settings.get("vacation_new_hire_waiting_months", 6)
        months_employed = years_of_service * 12
        vacation_eligible = months_employed >= waiting_months
        
        # Get vacation accrual rate
        vacation_rates = settings.get("vacation_rates_operations" if is_operations else "vacation_rates_admin", [])
        vacation_monthly = find_rate_tier(vacation_rates, years_of_service) / 12 if vacation_eligible else 0
        
        # Get sick accrual rate
        sick_rates = settings.get("sick_rates_operations" if is_operations else "sick_rates_admin", [])
        sick_monthly = find_rate_tier(sick_rates, years_of_service) / 12
        
        # Current balances
        current_vacation = person.get("vacation_current_balance", 0)
        current_sick = person.get("sick_current_balance", 0)
        current_holiday = person.get("holiday_current_balance", 0)
        
        # Calculate new balances (respecting caps)
        vacation_cap = settings.get("vacation_rollover_cap_operations" if is_operations else "vacation_rollover_cap_admin", 240 if is_operations else 120)
        sick_cap = settings.get("sick_rollover_cap", 1080)
        
        new_vacation = min(current_vacation + vacation_monthly, vacation_cap)
        new_sick = min(current_sick + sick_monthly, sick_cap)
        # Holiday doesn't accrue monthly - it accrues per holiday occurrence
        
        # Update personnel record
        await db.personnel.update_one(
            {"id": person["id"]},
            {
                "$set": {
                    "vacation_current_balance": round(new_vacation, 2),
                    "sick_current_balance": round(new_sick, 2),
                    "last_accrual_date": today.isoformat()
                }
            }
        )
        
        processed.append({
            "personnel_id": person["id"],
            "name": person.get("name", ""),
            "payroll_number": person.get("payroll_number", ""),
            "personnel_type": "operations" if is_operations else "administrative",
            "years_of_service": round(years_of_service, 1),
            "vacation_accrued": round(vacation_monthly, 2),
            "vacation_new_balance": round(new_vacation, 2),
            "vacation_eligible": vacation_eligible,
            "sick_accrued": round(sick_monthly, 2),
            "sick_new_balance": round(new_sick, 2)
        })
    
    return {
        "message": f"Monthly accrual processed for {len(processed)} personnel",
        "process_date": today.isoformat(),
        "personnel_processed": processed,
        "summary": {
            "total_personnel": len(processed),
            "total_vacation_accrued": round(sum(p["vacation_accrued"] for p in processed), 2),
            "total_sick_accrued": round(sum(p["sick_accrued"] for p in processed), 2)
        }
    }


@router.post("/process-holiday-accrual")
async def process_holiday_accrual(
    holiday_name: str,
    current_user: dict = Depends(get_current_user)
):
    """Process holiday accrual for all active personnel for a specific holiday (Admin only)"""
    if current_user.get("role") not in ["admin", "battalion_chief"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=400, detail="No tenant associated with user")
    
    from datetime import date
    
    # Get PTO settings
    tenant = await db.tenants.find_one({"id": tenant_id})
    settings = tenant.get("settings", {}).get("pto_settings") or get_default_settings()
    
    # Get all active personnel
    personnel_list = await db.personnel.find({
        "tenant_id": tenant_id,
        "is_active": True
    }, {"_id": 0}).to_list(None)
    
    processed = []
    today = date.today()
    
    for person in personnel_list:
        # Determine personnel type
        personnel_type = person.get("personnel_type") or person.get("holiday_personnel_type", "operations")
        is_operations = personnel_type in ["shift", "operations"]
        
        # Get holiday hours per holiday based on type
        holiday_hours = settings.get(
            "holiday_hours_per_holiday_operations" if is_operations else "holiday_hours_per_holiday_admin",
            12 if is_operations else 8
        )
        
        # Current balance
        current_holiday = person.get("holiday_current_balance", 0)
        new_holiday = current_holiday + holiday_hours
        
        # Update personnel record
        await db.personnel.update_one(
            {"id": person["id"]},
            {
                "$set": {
                    "holiday_current_balance": round(new_holiday, 2),
                    "last_holiday_accrual_date": today.isoformat(),
                    "last_holiday_accrued": holiday_name
                }
            }
        )
        
        processed.append({
            "personnel_id": person["id"],
            "name": person.get("name", ""),
            "payroll_number": person.get("payroll_number", ""),
            "personnel_type": "operations" if is_operations else "administrative",
            "holiday_accrued": holiday_hours,
            "holiday_new_balance": round(new_holiday, 2)
        })
    
    return {
        "message": f"Holiday accrual processed for {len(processed)} personnel",
        "holiday_name": holiday_name,
        "process_date": today.isoformat(),
        "personnel_processed": processed,
        "summary": {
            "total_personnel": len(processed),
            "total_holiday_hours_accrued": sum(p["holiday_accrued"] for p in processed)
        }
    }
