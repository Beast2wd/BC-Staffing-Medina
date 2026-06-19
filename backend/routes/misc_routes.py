"""
Miscellaneous routes - health check, seed, shift calendar
"""
from fastapi import APIRouter, Depends
from datetime import datetime, timezone
import uuid

from database import db
from models import UserRole
from auth import get_current_user, require_role, hash_password, get_shift_for_date

router = APIRouter(tags=["Misc"])


@router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}


@router.get("/shift-calendar")
async def get_shift_calendar(year: int, month: int):
    """Get shift assignments for a month"""
    import calendar
    
    cal = calendar.monthcalendar(year, month)
    result = []
    
    for week in cal:
        week_data = []
        for day in week:
            if day == 0:
                week_data.append(None)
            else:
                date_str = f"{year}-{month:02d}-{day:02d}"
                shift = get_shift_for_date(date_str)
                week_data.append({"day": day, "date": date_str, "shift": shift})
        result.append(week_data)
    
    return {"year": year, "month": month, "calendar": result}


@router.post("/seed")
async def seed_database():
    """Seed the database with initial data"""
    
    # Check if already seeded
    existing_battalions = await db.battalions.count_documents({})
    if existing_battalions > 0:
        return {"message": "Database already seeded"}
    
    # Create battalions
    battalions = [
        {"id": "bat-8110", "battalion_number": "8110", "name": "Battalion 8110", "chief_payroll": None},
        {"id": "bat-8114", "battalion_number": "8114", "name": "Battalion 8114", "chief_payroll": None}
    ]
    await db.battalions.insert_many(battalions)
    
    # Create stations for Battalion 8110
    stations = [
        {"id": "sta-10", "station_number": "10", "name": "Station 10", "battalion_id": "bat-8110", "minimum_staffing": 3, "apparatus": ["Engine 10", "Ladder 10"]},
        {"id": "sta-11", "station_number": "11", "name": "Station 11", "battalion_id": "bat-8110", "minimum_staffing": 3, "apparatus": ["Engine 11", "Medic 11"]},
        {"id": "sta-12", "station_number": "12", "name": "Station 12", "battalion_id": "bat-8110", "minimum_staffing": 3, "apparatus": ["Engine 12"]},
        {"id": "sta-14", "station_number": "14", "name": "Station 14", "battalion_id": "bat-8110", "minimum_staffing": 3, "apparatus": ["Engine 14", "Rescue 14"]},
        {"id": "sta-15", "station_number": "15", "name": "Station 15", "battalion_id": "bat-8110", "minimum_staffing": 3, "apparatus": ["Engine 15"]},
        {"id": "sta-20", "station_number": "20", "name": "Station 20", "battalion_id": "bat-8110", "minimum_staffing": 3, "apparatus": ["Engine 20", "Medic 20"]},
        {"id": "sta-40", "station_number": "40", "name": "Station 40", "battalion_id": "bat-8110", "minimum_staffing": 3, "apparatus": ["Engine 40"]},
        {"id": "sta-60", "station_number": "60", "name": "Station 60", "battalion_id": "bat-8110", "minimum_staffing": 3, "apparatus": ["Engine 60", "Tanker 60"]}
    ]
    await db.stations.insert_many(stations)
    
    # Create admin user
    admin_id = str(uuid.uuid4())
    admin_user = {
        "id": admin_id,
        "payroll_number": "100001",
        "password_hash": hash_password("admin123"),
        "name": "Admin User",
        "rank": "Chief",
        "role": UserRole.ADMIN,
        "station_id": None,
        "shift": None,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(admin_user)
    
    # Create Battalion Chief user
    bc_id = str(uuid.uuid4())
    bc_user = {
        "id": bc_id,
        "payroll_number": "100002",
        "password_hash": hash_password("bc123"),
        "name": "Battalion Chief Smith",
        "rank": "Battalion Chief",
        "role": UserRole.BATTALION_CHIEF,
        "station_id": None,
        "shift": "A",
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(bc_user)
    
    # Create sample personnel for each station and shift
    personnel_data = []
    ranks = ["Captain", "Lieutenant", "Firefighter", "Firefighter", "Firefighter"]
    shifts = ["A", "B", "C"]
    
    payroll_counter = 200001
    for station in stations:
        for shift in shifts:
            for i, rank in enumerate(ranks):
                person = {
                    "id": str(uuid.uuid4()),
                    "payroll_number": str(payroll_counter),
                    "name": f"{rank} {station['station_number']}-{shift}-{i+1}",
                    "rank": rank,
                    "station_id": station["id"],
                    "shift": shift,
                    "battalion_id": station["battalion_id"],
                    "is_active": True,
                    "certifications": ["EMT-B"] if rank == "Firefighter" else ["EMT-P", "FO-I"],
                    "contact_phone": None,
                    "contact_email": None
                }
                personnel_data.append(person)
                payroll_counter += 1
    
    await db.personnel.insert_many(personnel_data)
    
    return {
        "message": "Database seeded successfully",
        "battalions": len(battalions),
        "stations": len(stations),
        "personnel": len(personnel_data),
        "users": 2,
        "admin_credentials": {"payroll_number": "100001", "password": "admin123"},
        "bc_credentials": {"payroll_number": "100002", "password": "bc123"}
    }
