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
    VOLUNTEER = "volunteer"

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
    payroll_number: Optional[str] = None

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
    position_assignments: dict = {}  # personnel_id -> riding_position (A, B, C, D)
    personnel_names: dict = {}  # personnel_id -> display name (enriched by API)

class ApparatusAssignmentCreate(BaseModel):
    date: str
    station_id: str
    apparatus_name: str
    battalion_id: str
    shift: str
    personnel_ids: List[str] = []
    position_assignments: dict = {}  # personnel_id -> riding_position

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
    status: str = "assigned"  # available, assigned, declined - now defaults to assigned
    notes: str = ""
    phone_number: str = ""
    shift_type: str = "24"  # "12" or "24" hour shift
    assigned_shift: str = ""  # A, B, or C - the shift volunteer is assigning themselves to
    assigned_station_id: str = ""  # The station volunteer is assigning themselves to
    hours_worked: float = 0  # Actual hours worked (for tracking)
    check_in_time: str = ""  # When volunteer checked in
    check_out_time: str = ""  # When volunteer checked out
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class VolunteerRecordCreate(BaseModel):
    personnel_id: str
    date: str
    hours: float
    station_id: str
    battalion_id: str
    status: str = "assigned"  # Auto-assigned when submitted
    notes: str = ""
    phone_number: str = ""
    shift_type: str = "24"
    assigned_shift: str = ""
    assigned_station_id: str = ""
    hours_worked: float = 0
    check_in_time: str = ""
    check_out_time: str = ""

# ===================== VOLUNTEER FIREFIGHTER MODELS =====================

class Volunteer(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    contact_phone: str = ""
    contact_email: str = ""
    station_id: str = ""  # Preferred station
    certifications: List[str] = []
    notes: str = ""
    is_active: bool = True
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class VolunteerCreate(BaseModel):
    name: str
    contact_phone: str = ""
    contact_email: str = ""
    station_id: str = ""
    certifications: List[str] = []
    notes: str = ""

class VolunteerUpdate(BaseModel):
    name: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    station_id: Optional[str] = None
    certifications: Optional[List[str]] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None

# Part-Time Employee Models
class PartTimeEmployee(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    employee_number: str
    name: str
    rank: str = ""
    certifications: List[str] = []
    contact_phone: str = ""
    contact_email: str = ""
    notes: str = ""
    is_active: bool = True
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class PartTimeEmployeeCreate(BaseModel):
    employee_number: str
    name: str
    rank: str = ""
    certifications: List[str] = []
    contact_phone: str = ""
    contact_email: str = ""
    notes: str = ""

class PartTimeEmployeeUpdate(BaseModel):
    employee_number: Optional[str] = None
    name: Optional[str] = None
    rank: Optional[str] = None
    certifications: Optional[List[str]] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None

# Part-Time Availability Models
class PartTimeAvailability(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    employee_id: str  # Reference to part-time employee
    employee_name: str = ""
    employee_number: str = ""
    date: str
    shift: str  # A, B, or C
    hours: int = 24
    status: str = "available"  # available, assigned, declined
    notes: str = ""
    battalion_id: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class PartTimeAvailabilityCreate(BaseModel):
    employee_id: str
    date: str
    shift: str
    hours: int = 24
    notes: str = ""
    battalion_id: str = ""

class PartTimeAvailabilityUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    hours: Optional[int] = None

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
    # First try to find user by payroll number
    user = await db.users.find_one({"payroll_number": credentials.payroll_number}, {"_id": 0})
    
    # If not found, try to find volunteer by email
    if not user:
        user = await db.users.find_one({"email": credentials.payroll_number, "role": UserRole.VOLUNTEER}, {"_id": 0})
    
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
    
    # Get current personnel to find their payroll_number
    current_personnel = await db.personnel.find_one({"id": personnel_id}, {"_id": 0})
    if not current_personnel:
        raise HTTPException(status_code=404, detail="Personnel not found")
    
    result = await db.personnel.find_one_and_update(
        {"id": personnel_id},
        {"$set": update_data},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Personnel not found")
    
    # Sync relevant changes to the users collection
    user_update_fields = {}
    if "name" in update_data:
        user_update_fields["name"] = update_data["name"]
    if "rank" in update_data:
        user_update_fields["rank"] = update_data["rank"]
    if "station_id" in update_data:
        user_update_fields["station_id"] = update_data["station_id"]
    if "shift" in update_data:
        user_update_fields["shift"] = update_data["shift"]
    if "is_active" in update_data:
        user_update_fields["is_active"] = update_data["is_active"]
    if "payroll_number" in update_data:
        user_update_fields["payroll_number"] = update_data["payroll_number"]
    
    if user_update_fields:
        # Update user by the old payroll_number (in case it changed)
        await db.users.update_one(
            {"payroll_number": current_personnel["payroll_number"]},
            {"$set": user_update_fields}
        )
    
    del result["_id"]
    return PersonnelBase(**result)

@api_router.delete("/personnel/{personnel_id}")
async def delete_personnel(
    personnel_id: str,
    current_user: dict = Depends(require_role([UserRole.ADMIN]))
):
    # Get personnel to find their payroll_number
    personnel = await db.personnel.find_one({"id": personnel_id}, {"_id": 0})
    if not personnel:
        raise HTTPException(status_code=404, detail="Personnel not found")
    
    result = await db.personnel.update_one(
        {"id": personnel_id},
        {"$set": {"is_active": False}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Personnel not found")
    
    # Also deactivate the corresponding user account
    await db.users.update_one(
        {"payroll_number": personnel["payroll_number"]},
        {"$set": {"is_active": False}}
    )
    
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
async def update_station(station_id: str, data: StationCreate, current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF, UserRole.CAPTAIN, UserRole.LIEUTENANT]))):
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
    
    # Enrich assignments with personnel/volunteer names for display
    for assignment in assignments:
        personnel_names = {}
        for pid in assignment.get("personnel_ids", []):
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

@api_router.get("/volunteer/stats")
async def get_volunteer_stats(
    battalion_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get overall volunteer statistics - totals for all volunteers"""
    current_year = datetime.now().year
    current_month = datetime.now().strftime("%Y-%m")
    current_month_name = datetime.now().strftime("%B %Y")
    
    # Build query for YTD records
    query = {
        "date": {"$gte": f"{current_year}-01-01"},
        "status": "assigned"
    }
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

@api_router.get("/volunteer/my-hours")
async def get_my_volunteer_hours(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get the current volunteer's hours summary"""
    # Determine the volunteer's personnel_id
    is_volunteer_ff = current_user.get("role") == UserRole.VOLUNTEER
    
    if is_volunteer_ff:
        volunteer_id = current_user.get("volunteer_id")
        if not volunteer_id:
            user = await db.users.find_one({"id": current_user.get("id")}, {"_id": 0})
            volunteer_id = user.get("volunteer_id") if user else None
    else:
        # Regular personnel
        personnel = await db.personnel.find_one({"payroll_number": current_user["payroll_number"]}, {"_id": 0})
        volunteer_id = personnel.get("id") if personnel else None
    
    if not volunteer_id:
        return {"total_hours_scheduled": 0, "total_hours_worked": 0, "shifts": []}
    
    # Build query for this volunteer's records
    query = {"personnel_id": volunteer_id, "status": "assigned"}
    
    # Default to current year if no dates provided
    if not start_date:
        start_date = f"{datetime.now().year}-01-01"
    if not end_date:
        end_date = datetime.now().strftime("%Y-%m-%d")
    
    query["date"] = {"$gte": start_date, "$lte": end_date}
    
    records = await db.volunteer_records.find(query, {"_id": 0}).to_list(500)
    
    # Get stations for name lookups
    stations_list = await db.stations.find({}, {"_id": 0}).to_list(100)
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

@api_router.post("/volunteer", response_model=VolunteerRecord)
async def create_volunteer_record(
    data: VolunteerRecordCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create volunteer record - any user can submit their own availability"""
    # For volunteer firefighters, get their volunteer record ID
    is_volunteer_ff = current_user.get("role") == UserRole.VOLUNTEER
    
    if is_volunteer_ff:
        # Extract volunteer_id from payroll_number (format: VOL-{volunteer_id})
        payroll = current_user.get("payroll_number", "")
        if payroll.startswith("VOL-"):
            volunteer_id_prefix = payroll[4:].lower()  # Remove "VOL-" prefix
            # Find volunteer by matching ID prefix
            volunteer = await db.volunteers.find_one(
                {"id": {"$regex": f"^{volunteer_id_prefix}", "$options": "i"}}, 
                {"_id": 0}
            )
            if volunteer:
                data.personnel_id = volunteer.get("id")
            else:
                raise HTTPException(status_code=404, detail="Volunteer profile not found")
        else:
            raise HTTPException(status_code=400, detail="Invalid volunteer account")
    else:
        # Regular personnel
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
    # Auto-assign volunteer when they submit availability
    data.status = "assigned"
    record_doc = {
        "id": record_id, 
        **data.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.volunteer_records.insert_one(record_doc)
    
    # Auto-sync to daily worksheet when assigned
    station_id = data.assigned_station_id or data.station_id
    if station_id:
        existing_staffing = await db.staffing_records.find_one({
            "date": data.date,
            "station_id": station_id
        }, {"_id": 0})
        
        if existing_staffing:
            current_categories = existing_staffing.get("categories", {})
            current_vol = current_categories.get("volunteer", 0)
            await db.staffing_records.update_one(
                {"id": existing_staffing["id"]},
                {"$set": {"categories.volunteer": current_vol + 1}}
            )
    
    return VolunteerRecord(**record_doc)

@api_router.put("/volunteer/{record_id}", response_model=VolunteerRecord)
async def update_volunteer_record(
    record_id: str,
    data: VolunteerRecordCreate,
    current_user: dict = Depends(get_current_user)
):
    """Update a volunteer record. Users can update their own records, BC/Admin/Captain/Lt can update any."""
    # Get the existing record to check previous status
    existing = await db.volunteer_records.find_one({"id": record_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Volunteer record not found")
    
    # Check permissions - admin/BC/Captain/Lt can edit any, others can only edit their own
    is_privileged = current_user["role"] in [UserRole.ADMIN, UserRole.BATTALION_CHIEF, UserRole.CAPTAIN, UserRole.LIEUTENANT]
    
    # Check if user owns this record
    is_own_record = False
    if current_user.get("role") == UserRole.VOLUNTEER:
        # For volunteers, check volunteer_id
        user_doc = await db.users.find_one({"id": current_user.get("id")}, {"_id": 0})
        if user_doc and user_doc.get("volunteer_id") == existing.get("personnel_id"):
            is_own_record = True
    else:
        # For regular personnel
        user_personnel = await db.personnel.find_one({"payroll_number": current_user["payroll_number"]}, {"_id": 0})
        if user_personnel and user_personnel.get("id") == existing.get("personnel_id"):
            is_own_record = True
    
    if not is_privileged and not is_own_record:
        raise HTTPException(status_code=403, detail="Not authorized to update this record")
    
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
    """Delete a volunteer record. Users can delete/revoke their own records, BC/Admin/Captain/Lt can delete any."""
    record = await db.volunteer_records.find_one({"id": record_id}, {"_id": 0})
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
        user_personnel = await db.personnel.find_one({"payroll_number": current_user["payroll_number"]}, {"_id": 0})
        if user_personnel and user_personnel.get("id") == record.get("personnel_id"):
            is_own_record = True
    
    if not is_privileged and not is_own_record:
        raise HTTPException(status_code=403, detail="You can only remove your own volunteer availability")
    
    result = await db.volunteer_records.delete_one({"id": record_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Volunteer record not found")
    
    return {"message": "Volunteer record deleted"}

# Get volunteer assignments for staffing grid
@api_router.get("/volunteer-assignments")
async def get_volunteer_assignments(
    date: str,
    shift: Optional[str] = None,
    station_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get volunteer assignments for a specific date and optionally shift/station"""
    query = {"date": date, "assigned_shift": {"$ne": ""}, "assigned_station_id": {"$ne": ""}}
    if shift:
        query["assigned_shift"] = shift
    if station_id:
        query["assigned_station_id"] = station_id
    
    records = await db.volunteer_records.find(query, {"_id": 0}).to_list(1000)
    
    # Enrich with volunteer/personnel info
    enriched = []
    for record in records:
        # First try to find in volunteers collection (for volunteer firefighters)
        volunteer = await db.volunteers.find_one({"id": record.get("personnel_id")}, {"_id": 0})
        if volunteer:
            record["volunteer_name"] = volunteer.get("name", "Unknown")
            record["volunteer_phone"] = volunteer.get("contact_phone", "")
            record["is_volunteer_ff"] = True
        else:
            # Try personnel collection (for regular firefighters volunteering)
            person = await db.personnel.find_one({"id": record.get("personnel_id")}, {"_id": 0})
            if person:
                record["volunteer_name"] = person.get("name", "Unknown")
                record["volunteer_phone"] = person.get("contact_phone", "")
                record["is_volunteer_ff"] = False
        enriched.append(record)
    
    return enriched

# ===================== VOLUNTEER FIREFIGHTER MANAGEMENT ROUTES =====================

@api_router.get("/volunteers", response_model=List[Volunteer])
async def get_volunteers(
    station_id: Optional[str] = None,
    current_user: dict = Depends(require_role([UserRole.ADMIN]))
):
    """Get all volunteer firefighters"""
    query = {"is_active": True}
    if station_id:
        query["station_id"] = station_id
    
    volunteers = await db.volunteers.find(query, {"_id": 0}).to_list(1000)
    return volunteers

@api_router.post("/volunteers", response_model=Volunteer)
async def create_volunteer(
    data: VolunteerCreate,
    current_user: dict = Depends(require_role([UserRole.ADMIN]))
):
    """Create a new volunteer firefighter and their user account"""
    # Check if email is provided for login
    if not data.contact_email:
        raise HTTPException(status_code=400, detail="Email is required for volunteer login")
    
    # Check if email already exists
    existing_user = await db.users.find_one({"email": data.contact_email}, {"_id": 0})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
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
    
    await db.users.insert_one(user_doc)
    await db.volunteers.insert_one(volunteer.model_dump())
    
    return volunteer

@api_router.put("/volunteers/{volunteer_id}", response_model=Volunteer)
async def update_volunteer(
    volunteer_id: str,
    data: VolunteerUpdate,
    current_user: dict = Depends(require_role([UserRole.ADMIN]))
):
    """Update a volunteer firefighter"""
    volunteer = await db.volunteers.find_one({"id": volunteer_id}, {"_id": 0})
    if not volunteer:
        raise HTTPException(status_code=404, detail="Volunteer not found")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_data:
        await db.volunteers.update_one({"id": volunteer_id}, {"$set": update_data})
    
    updated = await db.volunteers.find_one({"id": volunteer_id}, {"_id": 0})
    return Volunteer(**updated)

@api_router.delete("/volunteers/{volunteer_id}")
async def delete_volunteer(
    volunteer_id: str,
    current_user: dict = Depends(require_role([UserRole.ADMIN]))
):
    """Delete (deactivate) a volunteer firefighter and their user account"""
    # Deactivate volunteer
    result = await db.volunteers.update_one(
        {"id": volunteer_id},
        {"$set": {"is_active": False}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Volunteer not found")
    
    # Also deactivate the associated user account
    await db.users.update_one(
        {"volunteer_id": volunteer_id},
        {"$set": {"is_active": False}}
    )
    
    return {"message": "Volunteer removed"}

# ===================== PART-TIME EMPLOYEE ROUTES =====================

@api_router.get("/part-time-employees", response_model=List[PartTimeEmployee])
async def get_part_time_employees(
    current_user: dict = Depends(get_current_user)
):
    """Get all part-time employees sorted alphabetically by name"""
    employees = await db.part_time_employees.find({"is_active": True}, {"_id": 0}).to_list(1000)
    # Sort alphabetically by name
    employees.sort(key=lambda x: x.get("name", "").lower())
    return employees

@api_router.post("/part-time-employees", response_model=PartTimeEmployee)
async def create_part_time_employee(
    data: PartTimeEmployeeCreate,
    current_user: dict = Depends(require_role([UserRole.ADMIN]))
):
    """Create a new part-time employee"""
    # Check if employee number already exists
    existing = await db.part_time_employees.find_one({"employee_number": data.employee_number})
    if existing:
        raise HTTPException(status_code=400, detail="Employee number already exists")
    
    employee = PartTimeEmployee(
        id=str(uuid.uuid4()),
        **data.model_dump(),
        created_at=datetime.now(timezone.utc).isoformat()
    )
    
    await db.part_time_employees.insert_one(employee.model_dump())
    return employee

@api_router.put("/part-time-employees/{employee_id}", response_model=PartTimeEmployee)
async def update_part_time_employee(
    employee_id: str,
    data: PartTimeEmployeeUpdate,
    current_user: dict = Depends(require_role([UserRole.ADMIN]))
):
    """Update a part-time employee"""
    employee = await db.part_time_employees.find_one({"id": employee_id}, {"_id": 0})
    if not employee:
        raise HTTPException(status_code=404, detail="Part-time employee not found")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_data:
        # Check if new employee number conflicts with existing
        if "employee_number" in update_data:
            existing = await db.part_time_employees.find_one({
                "employee_number": update_data["employee_number"],
                "id": {"$ne": employee_id}
            })
            if existing:
                raise HTTPException(status_code=400, detail="Employee number already exists")
        
        await db.part_time_employees.update_one({"id": employee_id}, {"$set": update_data})
    
    updated = await db.part_time_employees.find_one({"id": employee_id}, {"_id": 0})
    return updated

@api_router.delete("/part-time-employees/{employee_id}")
async def delete_part_time_employee(
    employee_id: str,
    current_user: dict = Depends(require_role([UserRole.ADMIN]))
):
    """Delete (deactivate) a part-time employee"""
    employee = await db.part_time_employees.find_one({"id": employee_id})
    if not employee:
        raise HTTPException(status_code=404, detail="Part-time employee not found")
    
    await db.part_time_employees.update_one(
        {"id": employee_id},
        {"$set": {"is_active": False}}
    )
    
    return {"message": "Part-time employee removed"}

# ===================== PART-TIME AVAILABILITY ROUTES =====================

@api_router.get("/part-time-availability")
async def get_part_time_availability(
    date: Optional[str] = None,
    battalion_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get part-time availability records for a date"""
    query = {}
    if date:
        query["date"] = date
    if battalion_id:
        query["battalion_id"] = battalion_id
    
    records = await db.part_time_availability.find(query, {"_id": 0}).to_list(500)
    return records

@api_router.post("/part-time-availability")
async def create_part_time_availability(
    data: PartTimeAvailabilityCreate,
    current_user: dict = Depends(get_current_user)
):
    """Submit part-time availability"""
    # Get employee details
    employee = await db.part_time_employees.find_one({"id": data.employee_id}, {"_id": 0})
    if not employee:
        raise HTTPException(status_code=404, detail="Part-time employee not found")
    
    # Check for existing availability on same date
    existing = await db.part_time_availability.find_one({
        "employee_id": data.employee_id,
        "date": data.date
    })
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
    
    await db.part_time_availability.insert_one(record.model_dump())
    return record.model_dump()

@api_router.put("/part-time-availability/{record_id}")
async def update_part_time_availability(
    record_id: str,
    data: PartTimeAvailabilityUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update part-time availability record"""
    record = await db.part_time_availability.find_one({"id": record_id}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_data:
        await db.part_time_availability.update_one({"id": record_id}, {"$set": update_data})
    
    updated = await db.part_time_availability.find_one({"id": record_id}, {"_id": 0})
    return updated

@api_router.delete("/part-time-availability/{record_id}")
async def delete_part_time_availability(
    record_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete part-time availability record"""
    record = await db.part_time_availability.find_one({"id": record_id})
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    
    await db.part_time_availability.delete_one({"id": record_id})
    return {"message": "Availability removed"}

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
    
    # Get apparatus assignments for the date
    apparatus_assignments = await db.apparatus_assignments.find(
        {"date": date, "battalion_id": battalion_id},
        {"_id": 0}
    ).to_list(100)
    
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
    
    # Build station details with personnel names and apparatus assignments
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
        
        # Get apparatus assignments for this station
        station_apparatus = []
        for aa in apparatus_assignments:
            if aa.get("station_id") == s["id"]:
                position_assignments = aa.get("position_assignments", {})
                personnel_with_positions = []
                for pid in aa.get("personnel_ids", []):
                    person = personnel_dict.get(pid, {})
                    position = position_assignments.get(pid, "-")
                    personnel_with_positions.append({
                        "id": pid,
                        "name": person.get("name", ""),
                        "rank": person.get("rank", ""),
                        "position": position
                    })
                # Sort by position
                personnel_with_positions.sort(key=lambda x: {'A': 1, 'B': 2, 'C': 3, 'D': 4}.get(x['position'], 5))
                
                station_apparatus.append({
                    "apparatus_name": aa.get("apparatus_name"),
                    "personnel": personnel_with_positions
                })
        
        station_details.append({
            "station_id": s["id"],
            "station_number": s["station_number"],
            "minimum_staffing": s.get("minimum_staffing", 0),
            "assigned": len(assigned_ids),
            "personnel_on_duty": personnel_on_duty,
            "apparatus_assignments": station_apparatus,
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
    
    # Get stations for station name lookups
    stations_list = await db.stations.find({}, {"_id": 0}).to_list(100)
    stations_dict = {s["id"]: s for s in stations_list}
    
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
                "work_history": []
            }
        
        # Add to totals (only for assigned records)
        if record.get("status") == "assigned":
            personnel_overtime[pid]["total_hours"] += record.get("hours", 0)
            personnel_overtime[pid]["count"] += 1
        
        # Get station name for this record
        station_id = record.get("station_id") or record.get("overtime_station_id")
        station = stations_dict.get(station_id, {})
        station_name = f"Station {station.get('station_number', '')}" if station.get('station_number') else station_id or "N/A"
        
        # Add work history entry
        work_entry = {
            "date": record.get("date"),
            "shift": record.get("shift"),
            "station": station_name,
            "hours": record.get("hours", 0),
            "status": record.get("status", "unknown")
        }
        personnel_overtime[pid]["work_history"].append(work_entry)
        
        # Track approvers (who changed status to assigned)
        if record.get("status") == "assigned":
            # Find the station's staffing record to get approver
            station_record = next((s for s in staffing_records if s.get("station_id") == record.get("station_id")), None)
            if station_record and station_record.get("last_modified_by"):
                approver_payroll = station_record.get("last_modified_by")
                approver = next((p for p in personnel_list if p.get("payroll_number") == approver_payroll), None)
                personnel_overtime[pid]["approved_by"] = approver_payroll
                personnel_overtime[pid]["approved_by_name"] = f"{approver.get('rank', '')} {approver.get('name', '')}".strip() if approver else approver_payroll
    
    # Sort work history by date for each personnel
    for pid in personnel_overtime:
        personnel_overtime[pid]["work_history"].sort(key=lambda x: x["date"], reverse=True)
    
    return {
        "start_date": start_date,
        "end_date": end_date,
        "battalion_id": battalion_id,
        "personnel_overtime": list(personnel_overtime.values()),
        "generated_by": current_user["payroll_number"],
        "generated_by_name": current_user.get("name", ""),
        "generated_at": datetime.now(timezone.utc).isoformat()
    }

@api_router.get("/reports/volunteer-hours")
async def get_volunteer_hours_summary(
    start_date: str,
    end_date: str,
    battalion_id: str = "",
    current_user: dict = Depends(get_current_user)
):
    """Get volunteer hours summary report with monthly breakdown"""
    # Build query
    query = {
        "date": {"$gte": start_date, "$lte": end_date},
        "status": "assigned"  # Only count assigned shifts
    }
    if battalion_id:
        query["battalion_id"] = battalion_id
    
    # Get all volunteer records in date range
    volunteer_records = await db.volunteer_records.find(query, {"_id": 0}).to_list(1000)
    
    # Get volunteers for name lookups
    volunteers_list = await db.volunteers.find({}, {"_id": 0}).to_list(500)
    volunteers_dict = {v["id"]: v for v in volunteers_list}
    
    # Also get regular personnel who might volunteer
    personnel_list = await db.personnel.find({}, {"_id": 0}).to_list(1000)
    personnel_dict = {p["id"]: p for p in personnel_list}
    
    # Get stations for name lookups
    stations_list = await db.stations.find({}, {"_id": 0}).to_list(100)
    stations_dict = {s["id"]: s for s in stations_list}
    
    # Also get YTD records for year-to-date calculation
    current_year = datetime.now().year
    ytd_query = {
        "date": {"$gte": f"{current_year}-01-01", "$lte": end_date},
        "status": "assigned"
    }
    if battalion_id:
        ytd_query["battalion_id"] = battalion_id
    ytd_records = await db.volunteer_records.find(ytd_query, {"_id": 0}).to_list(2000)
    
    # Build YTD totals by volunteer
    ytd_by_volunteer = {}
    for record in ytd_records:
        vid = record.get("personnel_id")
        if vid not in ytd_by_volunteer:
            ytd_by_volunteer[vid] = 0
        ytd_by_volunteer[vid] += record.get("hours_worked", 0) or record.get("hours", 0)
    
    # Aggregate by volunteer with monthly breakdown
    volunteer_hours = {}
    for record in volunteer_records:
        vid = record.get("personnel_id")
        if vid not in volunteer_hours:
            # Try to get name from volunteers collection first, then personnel
            volunteer = volunteers_dict.get(vid, {})
            person = personnel_dict.get(vid, {})
            
            name = volunteer.get("name") or person.get("name") or "Unknown"
            if person.get("rank"):
                name = f"{person.get('rank')} {name}"
            
            volunteer_hours[vid] = {
                "volunteer_id": vid,
                "volunteer_name": name,
                "contact_phone": volunteer.get("contact_phone") or person.get("contact_phone", ""),
                "contact_email": volunteer.get("contact_email", ""),
                "total_hours_scheduled": 0,
                "total_hours_worked": 0,
                "ytd_hours": ytd_by_volunteer.get(vid, 0),
                "shifts_count": 0,
                "monthly_breakdown": {},
                "shifts": []
            }
        
        # Add hours - use hours_worked if available, otherwise scheduled hours
        scheduled_hours = record.get("hours", 0)
        worked_hours = record.get("hours_worked", 0) or scheduled_hours
        
        volunteer_hours[vid]["total_hours_scheduled"] += scheduled_hours
        volunteer_hours[vid]["total_hours_worked"] += worked_hours
        volunteer_hours[vid]["shifts_count"] += 1
        
        # Track monthly breakdown
        record_date = record.get("date", "")
        if record_date:
            month_key = record_date[:7]  # YYYY-MM format
            if month_key not in volunteer_hours[vid]["monthly_breakdown"]:
                volunteer_hours[vid]["monthly_breakdown"][month_key] = {
                    "hours_scheduled": 0,
                    "hours_worked": 0,
                    "shifts_count": 0
                }
            volunteer_hours[vid]["monthly_breakdown"][month_key]["hours_scheduled"] += scheduled_hours
            volunteer_hours[vid]["monthly_breakdown"][month_key]["hours_worked"] += worked_hours
            volunteer_hours[vid]["monthly_breakdown"][month_key]["shifts_count"] += 1
        
        # Track individual shifts
        station = stations_dict.get(record.get("assigned_station_id") or record.get("station_id"), {})
        volunteer_hours[vid]["shifts"].append({
            "date": record.get("date"),
            "shift": record.get("assigned_shift", ""),
            "station": f"Station {station.get('station_number', 'N/A')}",
            "hours_scheduled": scheduled_hours,
            "hours_worked": worked_hours,
            "check_in": record.get("check_in_time", ""),
            "check_out": record.get("check_out_time", "")
        })
    
    # Convert monthly_breakdown dict to sorted list for each volunteer
    for vid in volunteer_hours:
        monthly = volunteer_hours[vid]["monthly_breakdown"]
        volunteer_hours[vid]["monthly_breakdown"] = [
            {"month": k, **v} for k, v in sorted(monthly.items())
        ]
    
    # Sort volunteers by total hours worked (descending)
    sorted_volunteers = sorted(
        volunteer_hours.values(), 
        key=lambda x: x["total_hours_worked"], 
        reverse=True
    )
    
    # Calculate totals
    total_hours_scheduled = sum(v["total_hours_scheduled"] for v in sorted_volunteers)
    total_hours_worked = sum(v["total_hours_worked"] for v in sorted_volunteers)
    total_shifts = sum(v["shifts_count"] for v in sorted_volunteers)
    
    return {
        "start_date": start_date,
        "end_date": end_date,
        "battalion_id": battalion_id,
        "volunteer_count": len(sorted_volunteers),
        "total_shifts": total_shifts,
        "total_hours_scheduled": total_hours_scheduled,
        "total_hours_worked": total_hours_worked,
        "volunteer_hours": sorted_volunteers,
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
    
    # Get current user to find their payroll_number
    current_user_record = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not current_user_record:
        raise HTTPException(status_code=404, detail="User not found")
    
    result = await db.users.find_one_and_update(
        {"id": user_id},
        {"$set": update_data},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Sync relevant changes to the personnel collection
    personnel_update_fields = {}
    if "name" in update_data:
        personnel_update_fields["name"] = update_data["name"]
    if "rank" in update_data:
        personnel_update_fields["rank"] = update_data["rank"]
    if "station_id" in update_data:
        personnel_update_fields["station_id"] = update_data["station_id"]
    if "shift" in update_data:
        personnel_update_fields["shift"] = update_data["shift"]
    if "is_active" in update_data:
        personnel_update_fields["is_active"] = update_data["is_active"]
    if "payroll_number" in update_data:
        personnel_update_fields["payroll_number"] = update_data["payroll_number"]
    
    if personnel_update_fields:
        # Update personnel by the old payroll_number (in case it changed)
        await db.personnel.update_one(
            {"payroll_number": current_user_record["payroll_number"]},
            {"$set": personnel_update_fields}
        )
    
    return UserResponse(**{k: v for k, v in result.items() if k != "_id" and k != "password_hash"})

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(require_role([UserRole.ADMIN]))):
    # Get user to find their payroll_number
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    result = await db.users.update_one({"id": user_id}, {"$set": {"is_active": False}})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Also deactivate the corresponding personnel record
    await db.personnel.update_one(
        {"payroll_number": user["payroll_number"]},
        {"$set": {"is_active": False}}
    )
    
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
    
    # Hash the new password using the hash_password function
    hashed_password = hash_password(data.new_password)
    
    # Update the user's password
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {"password_hash": hashed_password, "must_change_password": False}}
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
    from openpyxl.drawing.image import Image as XLImage
    from openpyxl.cell.cell import MergedCell
    
    # Get data
    stations = await db.stations.find({"battalion_id": battalion_id}, {"_id": 0}).to_list(100)
    stations_dict = {s["id"]: s for s in stations}
    
    personnel_list = await db.personnel.find({}, {"_id": 0}).to_list(1000)
    personnel_dict = {p["id"]: p for p in personnel_list}
    
    # Create workbook
    wb = Workbook()
    ws = wb.active
    
    # Add logo if exists
    logo_path = os.path.join(os.path.dirname(__file__), 'medina-logo.png')
    if os.path.exists(logo_path):
        try:
            from PIL import Image as PILImage
            # Resize logo for Excel
            pil_img = PILImage.open(logo_path)
            # Calculate new size maintaining aspect ratio
            max_height = 60
            aspect_ratio = pil_img.width / pil_img.height
            new_width = int(max_height * aspect_ratio)
            pil_img_resized = pil_img.resize((new_width, max_height), PILImage.Resampling.LANCZOS)
            
            # Save to temp buffer
            temp_logo = io.BytesIO()
            pil_img_resized.save(temp_logo, format='PNG')
            temp_logo.seek(0)
            
            img = XLImage(temp_logo)
            ws.add_image(img, 'A1')
            ws.row_dimensions[1].height = 50
        except Exception as e:
            print(f"Could not add logo to Excel: {e}")
    
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
        
        # Title (starts at row 3 to leave room for logo)
        ws.merge_cells('A3:F3')
        ws['A3'] = f"Daily Staffing Report - {date} ({current_shift} Shift)"
        ws['A3'].font = Font(bold=True, size=16)
        ws['A3'].alignment = Alignment(horizontal="center")
        
        # Generated by info
        ws.merge_cells('A4:F4')
        ws['A4'] = f"Generated by: {current_user.get('name', '')} (Payroll: {current_user['payroll_number']}) on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        ws['A4'].font = Font(italic=True, size=10)
        
        # Headers
        headers = ["Station", "Personnel On Duty", "Rank", "Payroll #", "Min Required", "Last Modified By"]
        for col, header in enumerate(headers, start=1):
            cell = ws.cell(row=6, column=col, value=header)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = header_alignment
            cell.border = thin_border
        
        # Data - personnel on duty
        row = 7
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
        
        # Apparatus Assignments Sheet
        ws2 = wb.create_sheet(title="Apparatus Assignments")
        ws2.merge_cells('A1:E1')
        ws2['A1'] = f"Apparatus Assignments - {date} ({current_shift} Shift)"
        ws2['A1'].font = Font(bold=True, size=14)
        ws2['A1'].alignment = Alignment(horizontal="center")
        
        # Get apparatus assignments
        apparatus_assignments = await db.apparatus_assignments.find(
            {"date": date, "battalion_id": battalion_id},
            {"_id": 0}
        ).to_list(100)
        
        # Headers
        app_headers = ["Station", "Apparatus", "Position", "Personnel", "Rank"]
        for col, header in enumerate(app_headers, start=1):
            cell = ws2.cell(row=3, column=col, value=header)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = header_alignment
            cell.border = thin_border
        
        app_row = 4
        for station in stations:
            station_assignments = [a for a in apparatus_assignments if a.get("station_id") == station["id"]]
            
            for assignment in station_assignments:
                apparatus_name = assignment.get("apparatus_name", "")
                position_assignments = assignment.get("position_assignments", {})
                personnel_ids = assignment.get("personnel_ids", [])
                
                if personnel_ids:
                    # Sort by position
                    sorted_personnel = sorted(
                        [(pid, position_assignments.get(pid, "-")) for pid in personnel_ids],
                        key=lambda x: {'A': 1, 'B': 2, 'C': 3, 'D': 4}.get(x[1], 5)
                    )
                    
                    for i, (pid, position) in enumerate(sorted_personnel):
                        person = personnel_dict.get(pid, {})
                        ws2.cell(row=app_row, column=1, value=f"Station {station['station_number']}" if i == 0 else "").border = thin_border
                        ws2.cell(row=app_row, column=2, value=apparatus_name if i == 0 else "").border = thin_border
                        ws2.cell(row=app_row, column=3, value=position).border = thin_border
                        ws2.cell(row=app_row, column=4, value=person.get("name", "")).border = thin_border
                        ws2.cell(row=app_row, column=5, value=person.get("rank", "")).border = thin_border
                        app_row += 1
                else:
                    ws2.cell(row=app_row, column=1, value=f"Station {station['station_number']}").border = thin_border
                    ws2.cell(row=app_row, column=2, value=apparatus_name).border = thin_border
                    ws2.cell(row=app_row, column=3, value="-").border = thin_border
                    ws2.cell(row=app_row, column=4, value="Not assigned").border = thin_border
                    ws2.cell(row=app_row, column=5, value="-").border = thin_border
                    app_row += 1
        
        # Auto-fit columns for apparatus sheet
        for column in ws2.columns:
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
                ws2.column_dimensions[column_letter].width = min(max_length + 2, 50)
    else:
        # Overtime report
        ws.title = f"Overtime {date}"
        
        end = end_date or date
        overtime_records = await db.overtime_records.find(
            {"battalion_id": battalion_id, "date": {"$gte": date, "$lte": end}, "status": "assigned"},
            {"_id": 0}
        ).to_list(500)
        
        # Title (starts at row 3 to leave room for logo)
        ws.merge_cells('A3:F3')
        ws['A3'] = f"Overtime Summary Report - {date} to {end}"
        ws['A3'].font = Font(bold=True, size=16)
        ws['A3'].alignment = Alignment(horizontal="center")
        
        # Generated by info
        ws.merge_cells('A4:F4')
        ws['A4'] = f"Generated by: {current_user.get('name', '')} (Payroll: {current_user['payroll_number']}) on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        ws['A4'].font = Font(italic=True, size=10)
        
        # Headers
        headers = ["Personnel", "Payroll #", "Date", "Hours", "Station", "Approved By"]
        for col, header in enumerate(headers, start=1):
            cell = ws.cell(row=6, column=col, value=header)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = header_alignment
            cell.border = thin_border
        
        # Data
        row = 7
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
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image as RLImage
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    
    # Get data
    stations = await db.stations.find({"battalion_id": battalion_id}, {"_id": 0}).to_list(100)
    stations_dict = {s["id"]: s for s in stations}
    
    personnel_list = await db.personnel.find({}, {"_id": 0}).to_list(1000)
    personnel_dict = {p["id"]: p for p in personnel_list}
    
    # Create PDF
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=landscape(letter))
    elements = []
    
    # Add logo if exists
    logo_path = os.path.join(os.path.dirname(__file__), 'medina-logo.png')
    if os.path.exists(logo_path):
        try:
            logo = RLImage(logo_path, width=1*inch, height=1*inch)
            elements.append(logo)
            elements.append(Spacer(1, 10))
        except Exception as e:
            print(f"Could not add logo to PDF: {e}")
    
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
        
        # Build personnel table data
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
        
        # Add personnel table
        if len(table_data) > 1:
            personnel_table = Table(table_data, colWidths=[120, 150, 100, 80])
            personnel_table.setStyle(TableStyle([
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
            elements.append(personnel_table)
        
        # Add apparatus assignments section
        elements.append(Spacer(1, 20))
        app_style = ParagraphStyle(
            'ApparatusTitle',
            parent=styles['Heading2'],
            fontSize=14,
            spaceAfter=10
        )
        elements.append(Paragraph("Apparatus Assignments", app_style))
        
        # Get apparatus assignments
        apparatus_assignments = await db.apparatus_assignments.find(
            {"date": date, "battalion_id": battalion_id},
            {"_id": 0}
        ).to_list(100)
        
        app_table_data = [["Station", "Apparatus", "Position", "Personnel", "Rank"]]
        
        for station in stations:
            station_assignments = [a for a in apparatus_assignments if a.get("station_id") == station["id"]]
            
            for assignment in station_assignments:
                apparatus_name = assignment.get("apparatus_name", "")
                position_assignments = assignment.get("position_assignments", {})
                personnel_ids = assignment.get("personnel_ids", [])
                
                if personnel_ids:
                    sorted_personnel = sorted(
                        [(pid, position_assignments.get(pid, "-")) for pid in personnel_ids],
                        key=lambda x: {'A': 1, 'B': 2, 'C': 3, 'D': 4}.get(x[1], 5)
                    )
                    
                    for i, (pid, position) in enumerate(sorted_personnel):
                        person = personnel_dict.get(pid, {})
                        app_table_data.append([
                            f"Station {station['station_number']}" if i == 0 else "",
                            apparatus_name if i == 0 else "",
                            position,
                            person.get("name", ""),
                            person.get("rank", "")
                        ])
                else:
                    app_table_data.append([
                        f"Station {station['station_number']}",
                        apparatus_name,
                        "-",
                        "Not assigned",
                        "-"
                    ])
        
        if len(app_table_data) > 1:
            app_table = Table(app_table_data, colWidths=[90, 90, 50, 130, 80])
            app_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2E7D32')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 10),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
                ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
                ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 1), (-1, -1), 8),
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#E8F5E9')])
            ]))
            elements.append(app_table)
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
        
        # Add overtime table
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
