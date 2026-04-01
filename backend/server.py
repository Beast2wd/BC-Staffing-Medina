from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import io

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'medina-county-bc-staffing-secret-key-2026')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 72  # 3 days for better session persistence

app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# ===================== MODELS =====================

class UserRole:
    ADMIN = "admin"
    BATTALION_CHIEF = "battalion_chief"
    CAPTAIN = "captain"
    LIEUTENANT = "lieutenant"
    FIREFIGHTER = "firefighter"

class UserBase(BaseModel):
    model_config = ConfigDict(extra="ignore")
    payroll_number: str
    name: str
    rank: str
    role: str
    station_id: Optional[str] = None
    shift: Optional[str] = None  # A, B, or C
    is_active: bool = True

class UserCreate(BaseModel):
    payroll_number: str
    password: str
    name: str
    rank: str
    role: str = UserRole.FIREFIGHTER
    station_id: Optional[str] = None
    shift: Optional[str] = None
    must_change_password: bool = False

class UserLogin(BaseModel):
    payroll_number: str
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    payroll_number: str
    name: str
    rank: str
    role: str
    station_id: Optional[str] = None
    shift: Optional[str] = None
    is_active: bool
    must_change_password: bool = False

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
    must_change_password: bool = False

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

class SetTemporaryPassword(BaseModel):
    personnel_id: str
    temporary_password: str

class UserUpdate(BaseModel):
    name: Optional[str] = None
    rank: Optional[str] = None
    role: Optional[str] = None
    station_id: Optional[str] = None
    shift: Optional[str] = None
    is_active: Optional[bool] = None

class PersonnelBase(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    payroll_number: str
    name: str
    rank: str
    station_id: str
    shift: str  # A, B, or C
    battalion_id: str
    is_active: bool = True
    certifications: List[str] = []
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    overtime_hours_worked: float = 0.0  # Running total of overtime hours worked

class PersonnelCreate(BaseModel):
    payroll_number: str
    name: str
    rank: str
    station_id: str
    shift: str
    battalion_id: str
    certifications: List[str] = []
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None

class PersonnelUpdate(BaseModel):
    payroll_number: Optional[str] = None
    name: Optional[str] = None
    rank: Optional[str] = None
    station_id: Optional[str] = None
    shift: Optional[str] = None
    battalion_id: Optional[str] = None
    is_active: Optional[bool] = None
    certifications: Optional[List[str]] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None

class Station(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    station_number: str
    name: str
    battalion_id: str
    address: Optional[str] = None
    minimum_staffing: int = 3
    apparatus: List[str] = []

class StationCreate(BaseModel):
    station_number: str
    name: str
    battalion_id: str
    address: Optional[str] = None
    minimum_staffing: int = 3
    apparatus: List[str] = []

class Battalion(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    battalion_number: str
    name: str
    chief_payroll: Optional[str] = None

class StaffingCategory:
    MINIMUM_STAFFING = "minimum_staffing"
    PERSONNEL_ASSIGNED = "personnel_assigned"
    DEBIT_DAY = "debit_day"
    OVERTIME_CR = "overtime_cr"
    HOLD_OVER = "hold_over"
    OUT_OF_DISTRICT_FILL_IN_PLUS = "out_of_district_fill_in_plus"
    OUT_OF_DISTRICT_FILL_IN_MINUS = "out_of_district_fill_in_minus"
    PRESCHEDULED_HOLIDAYS = "prescheduled_holidays"
    GUARANTEED_HOLIDAY = "guaranteed_holiday"
    DAY_OF_HOLIDAYS = "day_of_holidays"
    FMLA = "fmla"
    VAC_EMERGENCY = "vac_emergency"
    VAC_SCHEDULED = "vac_scheduled"
    VAC_SCHEDULED_DEBIT = "vac_scheduled_debit"
    SICK_MEMBER = "sick_member"
    SICK_FAMILY = "sick_family"
    INJURED_ON_DUTY = "injured_on_duty"
    SCHEDULED_OTHER = "scheduled_other"
    UNSCHEDULED_OTHER = "unscheduled_other"
    EMS_ADJUSTED = "ems_adjusted"
    SAP_ADJUSTED = "sap_adjusted"
    IN_DISTRICT_FILL_IN_MINUS = "in_district_fill_in_minus"
    IN_DISTRICT_FILL_IN_PLUS = "in_district_fill_in_plus"

class StaffingRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str  # ISO date string YYYY-MM-DD
    station_id: str
    battalion_id: str
    shift: str  # A, B, or C
    personnel_assigned: List[str] = []  # List of personnel IDs
    categories: dict = {}  # Category name -> count
    remarks: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    last_modified_by: Optional[str] = None  # Payroll number of who made last change
    change_history: List[dict] = []  # Audit log of changes

class StaffingRecordCreate(BaseModel):
    date: str
    station_id: str
    battalion_id: str
    shift: str
    personnel_assigned: List[str] = []
    categories: dict = {}
    remarks: str = ""

class StaffingRecordUpdate(BaseModel):
    personnel_assigned: Optional[List[str]] = None
    categories: Optional[dict] = None
    remarks: Optional[str] = None

class ApparatusAssignment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str
    station_id: str
    apparatus_name: str
    battalion_id: str
    shift: str
    personnel_ids: List[str] = []
    position_assignments: dict = {}  # position -> personnel_id

class ApparatusAssignmentCreate(BaseModel):
    date: str
    station_id: str
    apparatus_name: str
    battalion_id: str
    shift: str
    personnel_ids: List[str] = []
    position_assignments: dict = {}

class LeaveRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    personnel_id: str
    leave_type: str  # sick, vacation, holiday, fmla, etc.
    start_date: str
    end_date: str
    status: str = "approved"  # pending, approved, denied
    notes: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class LeaveRecordCreate(BaseModel):
    personnel_id: str
    leave_type: str
    start_date: str
    end_date: str
    status: str = "approved"
    notes: str = ""

class OvertimeRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    personnel_id: str
    date: str
    hours: float
    station_id: str
    battalion_id: str
    status: str = "available"  # available, assigned, declined
    notes: str = ""
    phone_number: str = ""
    shift_type: str = "24"  # "12" or "24" hour shift

class OvertimeRecordCreate(BaseModel):
    personnel_id: str
    date: str
    hours: float
    station_id: str
    battalion_id: str
    status: str = "available"
    notes: str = ""
    phone_number: str = ""
    shift_type: str = "24"  # "12" or "24" hour shift

class DeploymentRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    personnel_id: str
    deployment_type: str
    start_date: str
    end_date: str
    location: str
    notes: str = ""

# ===================== VOLUNTEER MODELS =====================

class VolunteerRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    personnel_id: str
    date: str
    hours: float
    station_id: str
    battalion_id: str
    status: str = "available"  # available, assigned, declined
    notes: str = ""
    phone_number: str = ""
    shift_type: str = "24"  # "12" or "24" hour shift

class VolunteerRecordCreate(BaseModel):
    personnel_id: str
    date: str
    hours: float
    station_id: str
    battalion_id: str
    status: str = "available"
    notes: str = ""
    phone_number: str = ""
    shift_type: str = "24"

class RemarkEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str
    battalion_id: str
    content: str
    created_by: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

# ===================== AUTH HELPERS =====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, role: str) -> str:
    payload = {
        "user_id": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def require_role(allowed_roles: List[str]):
    async def role_checker(user: dict = Depends(get_current_user)):
        if user["role"] not in allowed_roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return role_checker

# ===================== AUTH ROUTES =====================

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"payroll_number": credentials.payroll_number}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(credentials.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not user.get("is_active", True):
        raise HTTPException(status_code=401, detail="Account disabled")
    
    token = create_token(user["id"], user["role"])
    must_change = user.get("must_change_password", False)
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user["id"],
            payroll_number=user["payroll_number"],
            name=user["name"],
            rank=user["rank"],
            role=user["role"],
            station_id=user.get("station_id"),
            shift=user.get("shift"),
            is_active=user.get("is_active", True),
            must_change_password=must_change
        ),
        must_change_password=must_change
    )

@api_router.post("/auth/register", response_model=UserResponse)
async def register(user_data: UserCreate, current_user: dict = Depends(require_role([UserRole.ADMIN]))):
    existing = await db.users.find_one({"payroll_number": user_data.payroll_number})
    if existing:
        raise HTTPException(status_code=400, detail="Payroll number already registered")
    
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "payroll_number": user_data.payroll_number,
        "password_hash": hash_password(user_data.password),
        "name": user_data.name,
        "rank": user_data.rank,
        "role": user_data.role,
        "station_id": user_data.station_id,
        "shift": user_data.shift,
        "is_active": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    
    return UserResponse(
        id=user_id,
        payroll_number=user_data.payroll_number,
        name=user_data.name,
        rank=user_data.rank,
        role=user_data.role,
        station_id=user_data.station_id,
        shift=user_data.shift,
        is_active=True
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(
        id=current_user["id"],
        payroll_number=current_user["payroll_number"],
        name=current_user["name"],
        rank=current_user["rank"],
        role=current_user["role"],
        station_id=current_user.get("station_id"),
        shift=current_user.get("shift"),
        is_active=current_user.get("is_active", True),
        must_change_password=current_user.get("must_change_password", False)
    )

@api_router.post("/auth/change-password")
async def change_password(data: PasswordChange, current_user: dict = Depends(get_current_user)):
    """Change password for current user"""
    # Verify current password
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not verify_password(data.current_password, user.get("password_hash", "")):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    # Update password and clear must_change_password flag
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {
            "password_hash": hash_password(data.new_password),
            "must_change_password": False
        }}
    )
    
    return {"message": "Password changed successfully"}

@api_router.post("/auth/set-temporary-password")
async def set_temporary_password(
    data: SetTemporaryPassword,
    current_user: dict = Depends(require_role([UserRole.ADMIN]))
):
    """Set a temporary password for a personnel member and create/update their user account"""
    # Get the personnel record
    person = await db.personnel.find_one({"id": data.personnel_id}, {"_id": 0})
    if not person:
        raise HTTPException(status_code=404, detail="Personnel not found")
    
    # Check if user already exists
    existing_user = await db.users.find_one({"payroll_number": person["payroll_number"]})
    
    if existing_user:
        # Update existing user's password
        await db.users.update_one(
            {"payroll_number": person["payroll_number"]},
            {"$set": {
                "password_hash": hash_password(data.temporary_password),
                "must_change_password": True
            }}
        )
        return {"message": "Temporary password set. User will be prompted to change on next login.", "user_exists": True}
    else:
        # Create new user account
        user_id = str(uuid.uuid4())
        
        # Determine role based on rank
        rank_to_role = {
            "Fire Chief": UserRole.ADMIN,
            "Asst. Chief": UserRole.ADMIN,
            "Deputy Chief": UserRole.BATTALION_CHIEF,
            "Battalion Chief": UserRole.BATTALION_CHIEF,
            "Captain": UserRole.CAPTAIN,
            "Lieutenant": UserRole.LIEUTENANT,
        }
        role = rank_to_role.get(person.get("rank"), UserRole.FIREFIGHTER)
        
        user_doc = {
            "id": user_id,
            "payroll_number": person["payroll_number"],
            "password_hash": hash_password(data.temporary_password),
            "name": person["name"],
            "rank": person.get("rank", "Firefighter"),
            "role": role,
            "station_id": person.get("station_id"),
            "shift": person.get("shift"),
            "is_active": True,
            "must_change_password": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.users.insert_one(user_doc)
        return {"message": "User account created with temporary password. User will be prompted to change on first login.", "user_exists": False}

# ===================== PERSONNEL ROUTES =====================

@api_router.get("/personnel", response_model=List[PersonnelBase])
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

@api_router.get("/personnel/{personnel_id}", response_model=PersonnelBase)
async def get_personnel_by_id(personnel_id: str, current_user: dict = Depends(get_current_user)):
    person = await db.personnel.find_one({"id": personnel_id}, {"_id": 0})
    if not person:
        raise HTTPException(status_code=404, detail="Personnel not found")
    return person

@api_router.post("/personnel", response_model=PersonnelBase)
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

@api_router.put("/personnel/{personnel_id}", response_model=PersonnelBase)
async def update_personnel(
    personnel_id: str,
    data: PersonnelUpdate,
    current_user: dict = Depends(require_role([UserRole.ADMIN]))
):
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    result = await db.personnel.find_one_and_update(
        {"id": personnel_id},
        {"$set": update_data},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Personnel not found")
    
    del result["_id"]
    return PersonnelBase(**result)

@api_router.delete("/personnel/{personnel_id}")
async def delete_personnel(
    personnel_id: str,
    current_user: dict = Depends(require_role([UserRole.ADMIN]))
):
    result = await db.personnel.update_one(
        {"id": personnel_id},
        {"$set": {"is_active": False}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Personnel not found")
    return {"message": "Personnel deactivated"}

# ===================== STATION ROUTES =====================

@api_router.get("/stations", response_model=List[Station])
async def get_stations(battalion_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {}
    if battalion_id:
        query["battalion_id"] = battalion_id
    stations = await db.stations.find(query, {"_id": 0}).to_list(100)
    return stations

@api_router.post("/stations", response_model=Station)
async def create_station(data: StationCreate, current_user: dict = Depends(require_role([UserRole.ADMIN]))):
    station_id = str(uuid.uuid4())
    station_doc = {"id": station_id, **data.model_dump()}
    await db.stations.insert_one(station_doc)
    return Station(**station_doc)

@api_router.put("/stations/{station_id}", response_model=Station)
async def update_station(station_id: str, data: StationCreate, current_user: dict = Depends(require_role([UserRole.ADMIN]))):
    result = await db.stations.find_one_and_update(
        {"id": station_id},
        {"$set": data.model_dump()},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Station not found")
    del result["_id"]
    return Station(**result)

# ===================== BATTALION ROUTES =====================

@api_router.get("/battalions", response_model=List[Battalion])
async def get_battalions(current_user: dict = Depends(get_current_user)):
    battalions = await db.battalions.find({}, {"_id": 0}).to_list(100)
    return battalions

@api_router.post("/battalions", response_model=Battalion)
async def create_battalion(data: Battalion, current_user: dict = Depends(require_role([UserRole.ADMIN]))):
    await db.battalions.insert_one(data.model_dump())
    return data

# ===================== STAFFING ROUTES =====================

@api_router.get("/staffing", response_model=List[StaffingRecord])
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

@api_router.get("/staffing/{record_id}", response_model=StaffingRecord)
async def get_staffing_record(record_id: str, current_user: dict = Depends(get_current_user)):
    record = await db.staffing_records.find_one({"id": record_id}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Staffing record not found")
    return record

@api_router.post("/staffing", response_model=StaffingRecord)
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

@api_router.put("/staffing/{record_id}", response_model=StaffingRecord)
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

@api_router.get("/apparatus-assignments", response_model=List[ApparatusAssignment])
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
    return assignments

@api_router.post("/apparatus-assignments", response_model=ApparatusAssignment)
async def create_apparatus_assignment(
    data: ApparatusAssignmentCreate,
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF, UserRole.CAPTAIN, UserRole.LIEUTENANT]))
):
    assignment_id = str(uuid.uuid4())
    assignment_doc = {"id": assignment_id, **data.model_dump()}
    await db.apparatus_assignments.insert_one(assignment_doc)
    return ApparatusAssignment(**assignment_doc)

class ApparatusAssignmentUpdate(BaseModel):
    personnel_ids: Optional[List[str]] = None
    position_assignments: Optional[dict] = None

@api_router.put("/apparatus-assignments/{assignment_id}", response_model=ApparatusAssignment)
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

@api_router.delete("/apparatus-assignments/{assignment_id}")
async def delete_apparatus_assignment(
    assignment_id: str,
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF]))
):
    result = await db.apparatus_assignments.delete_one({"id": assignment_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return {"message": "Assignment deleted"}

# ===================== VOLUNTEER ROUTES =====================

@api_router.get("/volunteer", response_model=List[VolunteerRecord])
async def get_volunteer_records(
    date: Optional[str] = None,
    battalion_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if date:
        query["date"] = date
    if battalion_id:
        query["battalion_id"] = battalion_id
    records = await db.volunteer_records.find(query, {"_id": 0}).to_list(500)
    return [VolunteerRecord(**r) for r in records]

@api_router.post("/volunteer", response_model=VolunteerRecord)
async def create_volunteer_record(
    data: VolunteerRecordCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create volunteer record - any user can submit their own availability"""
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
    await db.volunteer_records.insert_one(record_doc)
    return VolunteerRecord(**record_doc)

@api_router.put("/volunteer/{record_id}", response_model=VolunteerRecord)
async def update_volunteer_record(
    record_id: str,
    data: VolunteerRecordCreate,
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF, UserRole.CAPTAIN, UserRole.LIEUTENANT]))
):
    # Get the existing record to check previous status
    existing = await db.volunteer_records.find_one({"id": record_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Volunteer record not found")
    
    result = await db.volunteer_records.find_one_and_update(
        {"id": record_id},
        {"$set": data.model_dump()},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Volunteer record not found")
    del result["_id"]
    return VolunteerRecord(**result)

@api_router.delete("/volunteer/{record_id}")
async def delete_volunteer_record(
    record_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a volunteer record. Users can delete their own records, BC/Admin can delete any."""
    record = await db.volunteer_records.find_one({"id": record_id}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Volunteer record not found")
    
    # Check permissions
    is_admin_or_bc = current_user["role"] in [UserRole.ADMIN, UserRole.BATTALION_CHIEF]
    user_personnel = await db.personnel.find_one({"payroll_number": current_user["payroll_number"]}, {"_id": 0})
    is_own_record = user_personnel and user_personnel.get("id") == record.get("personnel_id")
    
    if not is_admin_or_bc and not is_own_record:
        raise HTTPException(status_code=403, detail="You can only remove your own volunteer availability")
    
    if not is_admin_or_bc and record.get("status") == "assigned":
        raise HTTPException(status_code=400, detail="Cannot remove yourself after being assigned. Contact your Battalion Chief.")
    
    result = await db.volunteer_records.delete_one({"id": record_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Volunteer record not found")
    
    return {"message": "Volunteer record deleted"}

# ===================== LEAVE ROUTES =====================

@api_router.get("/leave-records", response_model=List[LeaveRecord])
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

@api_router.post("/leave-records", response_model=LeaveRecord)
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

@api_router.put("/leave-records/{record_id}", response_model=LeaveRecord)
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

@api_router.delete("/leave-records/{record_id}")
async def delete_leave_record(
    record_id: str,
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF]))
):
    result = await db.leave_records.delete_one({"id": record_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Leave record not found")
    return {"message": "Leave record deleted"}

# ===================== OVERTIME ROUTES =====================

@api_router.get("/overtime", response_model=List[OvertimeRecord])
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

@api_router.post("/overtime", response_model=OvertimeRecord)
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

@api_router.put("/overtime/{record_id}", response_model=OvertimeRecord)
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

@api_router.delete("/overtime/{record_id}")
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

# ===================== DEPLOYMENT ROUTES =====================

@api_router.get("/deployments", response_model=List[DeploymentRecord])
async def get_deployments(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if start_date and end_date:
        query["$or"] = [
            {"start_date": {"$lte": end_date}, "end_date": {"$gte": start_date}}
        ]
    
    records = await db.deployments.find(query, {"_id": 0}).to_list(500)
    return records

@api_router.post("/deployments", response_model=DeploymentRecord)
async def create_deployment(
    data: DeploymentRecord,
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF]))
):
    await db.deployments.insert_one(data.model_dump())
    return data

# ===================== REMARKS ROUTES =====================

@api_router.get("/remarks", response_model=List[RemarkEntry])
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

@api_router.post("/remarks", response_model=RemarkEntry)
async def create_remark(
    data: RemarkEntry,
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF, UserRole.CAPTAIN, UserRole.LIEUTENANT]))
):
    await db.remarks.insert_one(data.model_dump())
    return data

# ===================== REPORTS ROUTES =====================

@api_router.get("/reports/daily-summary")
async def get_daily_summary(
    date: str,
    battalion_id: str,
    current_user: dict = Depends(get_current_user)
):
    # Get all staffing records for the date
    staffing = await db.staffing_records.find(
        {"date": date, "battalion_id": battalion_id},
        {"_id": 0}
    ).to_list(100)
    
    # Get all stations
    stations = await db.stations.find({"battalion_id": battalion_id}, {"_id": 0}).to_list(100)
    
    # Get all personnel for name lookups
    personnel_list = await db.personnel.find({}, {"_id": 0}).to_list(1000)
    personnel_dict = {p["id"]: p for p in personnel_list}
    
    # Get current shift for the date
    def get_shift_for_date(date_str):
        ref_date = datetime(2026, 1, 1)
        target_date = datetime.strptime(date_str, "%Y-%m-%d")
        days_diff = (target_date - ref_date).days
        cycle_position = days_diff % 6
        if cycle_position in [0, 1]:
            return "A"
        elif cycle_position in [2, 3]:
            return "B"
        else:
            return "C"
    
    current_shift = get_shift_for_date(date)
    
    # Calculate totals
    total_minimum = sum(s.get("minimum_staffing", 0) for s in stations)
    total_assigned = sum(len(r.get("personnel_assigned", [])) for r in staffing)
    
    # Aggregate categories
    category_totals = {}
    for record in staffing:
        for cat, count in record.get("categories", {}).items():
            category_totals[cat] = category_totals.get(cat, 0) + count
    
    # Build station details with personnel names
    station_details = []
    for s in stations:
        staffing_record = next((r for r in staffing if r["station_id"] == s["id"]), None)
        assigned_ids = staffing_record.get("personnel_assigned", []) if staffing_record else []
        
        # Get personnel on duty for this station and shift
        personnel_on_duty = [
            {"id": p["id"], "name": p["name"], "rank": p["rank"], "payroll_number": p.get("payroll_number", "")}
            for p in personnel_list
            if p.get("station_id") == s["id"] and p.get("shift") == current_shift and p.get("is_active", True)
        ]
        
        station_details.append({
            "station_id": s["id"],
            "station_number": s["station_number"],
            "minimum_staffing": s.get("minimum_staffing", 0),
            "assigned": len(assigned_ids),
            "personnel_on_duty": personnel_on_duty,
            "last_modified_by": staffing_record.get("last_modified_by") if staffing_record else None
        })
    
    return {
        "date": date,
        "battalion_id": battalion_id,
        "shift": current_shift,
        "total_stations": len(stations),
        "total_minimum_staffing": total_minimum,
        "total_personnel_assigned": total_assigned,
        "staffing_variance": total_assigned - total_minimum,
        "category_totals": category_totals,
        "station_details": station_details,
        "generated_by": current_user["payroll_number"],
        "generated_by_name": current_user.get("name", ""),
        "generated_at": datetime.now(timezone.utc).isoformat()
    }

@api_router.get("/reports/overtime-summary")
async def get_overtime_summary(
    start_date: str,
    end_date: str,
    battalion_id: str,
    current_user: dict = Depends(get_current_user)
):
    # Get all overtime records
    overtime_records = await db.overtime_records.find(
        {
            "battalion_id": battalion_id,
            "date": {"$gte": start_date, "$lte": end_date}
        },
        {"_id": 0}
    ).to_list(500)
    
    # Get personnel for name lookups
    personnel_list = await db.personnel.find({}, {"_id": 0}).to_list(1000)
    personnel_dict = {p["id"]: p for p in personnel_list}
    
    # Get staffing records to find who approved (last_modified_by)
    staffing_records = await db.staffing_records.find(
        {"battalion_id": battalion_id},
        {"_id": 0, "last_modified_by": 1, "station_id": 1}
    ).to_list(100)
    
    # Aggregate by personnel
    personnel_overtime = {}
    for record in overtime_records:
        pid = record.get("personnel_id")
        if pid not in personnel_overtime:
            person = personnel_dict.get(pid, {})
            personnel_overtime[pid] = {
                "_id": pid,
                "personnel_name": f"{person.get('rank', '')} {person.get('name', '')}".strip() or pid,
                "payroll_number": person.get("payroll_number", ""),
                "total_hours": 0,
                "count": 0,
                "records": []
            }
        personnel_overtime[pid]["total_hours"] += record.get("hours", 0)
        personnel_overtime[pid]["count"] += 1
        
        # Track approvers (who changed status to assigned)
        if record.get("status") == "assigned":
            # Find the station's staffing record to get approver
            station_record = next((s for s in staffing_records if s.get("station_id") == record.get("station_id")), None)
            if station_record and station_record.get("last_modified_by"):
                approver_payroll = station_record.get("last_modified_by")
                approver = next((p for p in personnel_list if p.get("payroll_number") == approver_payroll), None)
                personnel_overtime[pid]["approved_by"] = approver_payroll
                personnel_overtime[pid]["approved_by_name"] = f"{approver.get('rank', '')} {approver.get('name', '')}".strip() if approver else approver_payroll
    
    return {
        "start_date": start_date,
        "end_date": end_date,
        "battalion_id": battalion_id,
        "personnel_overtime": list(personnel_overtime.values()),
        "generated_by": current_user["payroll_number"],
        "generated_by_name": current_user.get("name", ""),
        "generated_at": datetime.now(timezone.utc).isoformat()
    }

# ===================== USERS MANAGEMENT (ADMIN) =====================

@api_router.get("/users", response_model=List[UserResponse])
async def get_users(current_user: dict = Depends(require_role([UserRole.ADMIN]))):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return [UserResponse(**u) for u in users]

@api_router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    data: UserUpdate,
    current_user: dict = Depends(require_role([UserRole.ADMIN]))
):
    # Only include non-None values in update
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    result = await db.users.find_one_and_update(
        {"id": user_id},
        {"$set": update_data},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse(**{k: v for k, v in result.items() if k != "_id" and k != "password_hash"})

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(require_role([UserRole.ADMIN]))):
    result = await db.users.update_one({"id": user_id}, {"$set": {"is_active": False}})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deactivated"}

class ResetPasswordRequest(BaseModel):
    new_password: str

@api_router.post("/users/{user_id}/reset-password")
async def reset_user_password(
    user_id: str,
    data: ResetPasswordRequest,
    current_user: dict = Depends(require_role([UserRole.ADMIN]))
):
    """Admin can reset any user's password"""
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    # Hash the new password
    password_hash = pwd_context.hash(data.new_password)
    
    # Update the user's password
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {"password_hash": password_hash, "must_change_password": False}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "Password reset successfully"}

# ===================== SHIFT CALCULATION =====================

def get_shift_for_date(date_str: str) -> str:
    """Calculate which shift (A, B, or C) is working on a given date
    Shift rotation: 48 hours on, 96 hours off (2 days on, 4 days off)
    Reference: C shift on 3/24/2026 and 3/25/2026
    """
    reference_date = datetime(2026, 3, 24)
    target_date = datetime.strptime(date_str, "%Y-%m-%d")
    days_diff = (target_date - reference_date).days
    
    # Pattern repeats every 6 days: C,C,A,A,B,B,C,C,A,A,B,B...
    normalized_day = days_diff % 6
    
    if normalized_day < 2:
        return "C"
    elif normalized_day < 4:
        return "A"
    else:
        return "B"

@api_router.get("/shift-calendar")
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

# ===================== SEED DATA =====================

@api_router.post("/seed")
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

# ===================== HEALTH CHECK =====================

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# ===================== REPORT EXPORT ROUTES =====================

@api_router.get("/reports/export/excel")
async def export_staffing_report_excel(
    date: str,
    battalion_id: str,
    report_type: str = "daily",
    end_date: Optional[str] = None,
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF, UserRole.CAPTAIN]))
):
    """Export staffing or overtime report to Excel"""
    from openpyxl import Workbook
    from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
    
    # Get data
    stations = await db.stations.find({"battalion_id": battalion_id}, {"_id": 0}).to_list(100)
    stations_dict = {s["id"]: s for s in stations}
    
    personnel_list = await db.personnel.find({}, {"_id": 0}).to_list(1000)
    personnel_dict = {p["id"]: p for p in personnel_list}
    
    # Create workbook
    wb = Workbook()
    ws = wb.active
    
    # Styles
    header_font = Font(bold=True, size=12, color="FFFFFF")
    header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
    header_alignment = Alignment(horizontal="center", vertical="center")
    thin_border = Border(
        left=Side(style='thin'), right=Side(style='thin'),
        top=Side(style='thin'), bottom=Side(style='thin')
    )
    
    if report_type == "daily":
        ws.title = f"Staffing {date}"
        
        staffing_records = await db.staffing_records.find(
            {"date": date, "battalion_id": battalion_id}, {"_id": 0}
        ).to_list(100)
        
        # Get shift for date
        def get_shift_for_date(date_str):
            ref_date = datetime(2026, 1, 1)
            target_date = datetime.strptime(date_str, "%Y-%m-%d")
            days_diff = (target_date - ref_date).days
            cycle_position = days_diff % 6
            if cycle_position in [0, 1]:
                return "A"
            elif cycle_position in [2, 3]:
                return "B"
            else:
                return "C"
        
        current_shift = get_shift_for_date(date)
        
        # Title
        ws.merge_cells('A1:F1')
        ws['A1'] = f"Daily Staffing Report - {date} ({current_shift} Shift)"
        ws['A1'].font = Font(bold=True, size=16)
        ws['A1'].alignment = Alignment(horizontal="center")
        
        # Generated by info
        ws.merge_cells('A2:F2')
        ws['A2'] = f"Generated by: {current_user.get('name', '')} (Payroll: {current_user['payroll_number']}) on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        ws['A2'].font = Font(italic=True, size=10)
        
        # Headers
        headers = ["Station", "Personnel On Duty", "Rank", "Payroll #", "Min Required", "Last Modified By"]
        for col, header in enumerate(headers, start=1):
            cell = ws.cell(row=4, column=col, value=header)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = header_alignment
            cell.border = thin_border
        
        # Data - personnel on duty
        row = 5
        for station in stations:
            station_personnel = [p for p in personnel_list if p.get("station_id") == station["id"] and p.get("shift") == current_shift and p.get("is_active", True)]
            staffing_record = next((r for r in staffing_records if r.get("station_id") == station["id"]), None)
            last_modified = staffing_record.get("last_modified_by", "-") if staffing_record else "-"
            
            if station_personnel:
                for i, person in enumerate(station_personnel):
                    ws.cell(row=row, column=1, value=f"Station {station['station_number']}" if i == 0 else "").border = thin_border
                    ws.cell(row=row, column=2, value=person["name"]).border = thin_border
                    ws.cell(row=row, column=3, value=person["rank"]).border = thin_border
                    ws.cell(row=row, column=4, value=person.get("payroll_number", "")).border = thin_border
                    ws.cell(row=row, column=5, value=station.get("minimum_staffing", 0) if i == 0 else "").border = thin_border
                    ws.cell(row=row, column=6, value=last_modified if i == 0 else "").border = thin_border
                    row += 1
            else:
                ws.cell(row=row, column=1, value=f"Station {station['station_number']}").border = thin_border
                ws.cell(row=row, column=2, value="No personnel on duty").border = thin_border
                ws.cell(row=row, column=3, value="-").border = thin_border
                ws.cell(row=row, column=4, value="-").border = thin_border
                ws.cell(row=row, column=5, value=station.get("minimum_staffing", 0)).border = thin_border
                ws.cell(row=row, column=6, value=last_modified).border = thin_border
                row += 1
    else:
        # Overtime report
        ws.title = f"Overtime {date}"
        
        end = end_date or date
        overtime_records = await db.overtime_records.find(
            {"battalion_id": battalion_id, "date": {"$gte": date, "$lte": end}, "status": "assigned"},
            {"_id": 0}
        ).to_list(500)
        
        # Title
        ws.merge_cells('A1:F1')
        ws['A1'] = f"Overtime Summary Report - {date} to {end}"
        ws['A1'].font = Font(bold=True, size=16)
        ws['A1'].alignment = Alignment(horizontal="center")
        
        # Generated by info
        ws.merge_cells('A2:F2')
        ws['A2'] = f"Generated by: {current_user.get('name', '')} (Payroll: {current_user['payroll_number']}) on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        ws['A2'].font = Font(italic=True, size=10)
        
        # Headers
        headers = ["Personnel", "Payroll #", "Date", "Hours", "Station", "Approved By"]
        for col, header in enumerate(headers, start=1):
            cell = ws.cell(row=4, column=col, value=header)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = header_alignment
            cell.border = thin_border
        
        # Data
        row = 5
        for record in overtime_records:
            person = personnel_dict.get(record.get("personnel_id"), {})
            station = stations_dict.get(record.get("station_id"), {})
            
            ws.cell(row=row, column=1, value=f"{person.get('rank', '')} {person.get('name', '')}").border = thin_border
            ws.cell(row=row, column=2, value=person.get("payroll_number", "")).border = thin_border
            ws.cell(row=row, column=3, value=record.get("date", "")).border = thin_border
            ws.cell(row=row, column=4, value=record.get("hours", 0)).border = thin_border
            ws.cell(row=row, column=5, value=f"Station {station.get('station_number', '')}").border = thin_border
            ws.cell(row=row, column=6, value=current_user.get("name", current_user["payroll_number"])).border = thin_border
            row += 1
    
    # Auto-fit columns (skip merged cells)
    from openpyxl.cell.cell import MergedCell
    for column in ws.columns:
        max_length = 0
        column_letter = None
        for cell in column:
            if isinstance(cell, MergedCell):
                continue
            if column_letter is None:
                column_letter = cell.column_letter
            try:
                if cell.value and len(str(cell.value)) > max_length:
                    max_length = len(str(cell.value))
            except:
                pass
        if column_letter:
            ws.column_dimensions[column_letter].width = min(max_length + 2, 50)
    
    # Save to buffer
    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    
    filename = f"{'staffing' if report_type == 'daily' else 'overtime'}_report_{date}.xlsx"
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@api_router.get("/reports/export/pdf")
async def export_staffing_report_pdf(
    date: str,
    battalion_id: str,
    report_type: str = "daily",
    end_date: Optional[str] = None,
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF, UserRole.CAPTAIN]))
):
    """Export staffing or overtime report to PDF"""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter, landscape
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    
    # Get data
    stations = await db.stations.find({"battalion_id": battalion_id}, {"_id": 0}).to_list(100)
    stations_dict = {s["id"]: s for s in stations}
    
    personnel_list = await db.personnel.find({}, {"_id": 0}).to_list(1000)
    personnel_dict = {p["id"]: p for p in personnel_list}
    
    # Create PDF
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=landscape(letter))
    elements = []
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        spaceAfter=10
    )
    subtitle_style = ParagraphStyle(
        'Subtitle',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.gray,
        spaceAfter=20
    )
    
    if report_type == "daily":
        # Get shift for date
        def get_shift_for_date(date_str):
            ref_date = datetime(2026, 1, 1)
            target_date = datetime.strptime(date_str, "%Y-%m-%d")
            days_diff = (target_date - ref_date).days
            cycle_position = days_diff % 6
            if cycle_position in [0, 1]:
                return "A"
            elif cycle_position in [2, 3]:
                return "B"
            else:
                return "C"
        
        current_shift = get_shift_for_date(date)
        
        # Title
        elements.append(Paragraph(f"Daily Staffing Report - {date} ({current_shift} Shift)", title_style))
        elements.append(Paragraph(
            f"Generated by: {current_user.get('name', '')} (Payroll: {current_user['payroll_number']}) on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            subtitle_style
        ))
        
        # Build table data
        table_data = [["Station", "Personnel", "Rank", "Payroll #"]]
        
        for station in stations:
            station_personnel = [p for p in personnel_list if p.get("station_id") == station["id"] and p.get("shift") == current_shift and p.get("is_active", True)]
            
            if station_personnel:
                for i, person in enumerate(station_personnel):
                    table_data.append([
                        f"Station {station['station_number']}" if i == 0 else "",
                        person["name"],
                        person["rank"],
                        person.get("payroll_number", "")
                    ])
            else:
                table_data.append([
                    f"Station {station['station_number']}",
                    "No personnel on duty",
                    "-",
                    "-"
                ])
    else:
        # Overtime report
        end = end_date or date
        overtime_records = await db.overtime_records.find(
            {"battalion_id": battalion_id, "date": {"$gte": date, "$lte": end}, "status": "assigned"},
            {"_id": 0}
        ).to_list(500)
        
        elements.append(Paragraph(f"Overtime Summary Report - {date} to {end}", title_style))
        elements.append(Paragraph(
            f"Generated by: {current_user.get('name', '')} (Payroll: {current_user['payroll_number']}) on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            subtitle_style
        ))
        
        table_data = [["Personnel", "Payroll #", "Date", "Hours", "Station"]]
        
        for record in overtime_records:
            person = personnel_dict.get(record.get("personnel_id"), {})
            station = stations_dict.get(record.get("station_id"), {})
            table_data.append([
                f"{person.get('rank', '')} {person.get('name', '')}",
                person.get("payroll_number", ""),
                record.get("date", ""),
                str(record.get("hours", 0)),
                f"Station {station.get('station_number', '')}"
            ])
    
    if len(table_data) > 1:
        table = Table(table_data, colWidths=[120, 150, 100, 80])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4472C4')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 11),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F0F0F0')])
        ]))
        elements.append(table)
    else:
        elements.append(Paragraph("No records found for this period.", styles['Normal']))
    
    # Build PDF
    doc.build(elements)
    buffer.seek(0)
    
    filename = f"{'staffing' if report_type == 'daily' else 'overtime'}_report_{date}.pdf"
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# Include the router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
