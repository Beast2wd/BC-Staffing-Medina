from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
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

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

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

class OvertimeRecordCreate(BaseModel):
    personnel_id: str
    date: str
    hours: float
    station_id: str
    battalion_id: str
    status: str = "available"
    notes: str = ""
    phone_number: str = ""

class DeploymentRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    personnel_id: str
    deployment_type: str
    start_date: str
    end_date: str
    location: str
    notes: str = ""

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
            is_active=user.get("is_active", True)
        )
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
        is_active=current_user.get("is_active", True)
    )

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
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
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

@api_router.put("/apparatus-assignments/{assignment_id}", response_model=ApparatusAssignment)
async def update_apparatus_assignment(
    assignment_id: str,
    data: ApparatusAssignmentCreate,
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF, UserRole.CAPTAIN, UserRole.LIEUTENANT]))
):
    result = await db.apparatus_assignments.find_one_and_update(
        {"id": assignment_id},
        {"$set": data.model_dump()},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Assignment not found")
    del result["_id"]
    return ApparatusAssignment(**result)

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
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF, UserRole.CAPTAIN, UserRole.LIEUTENANT]))
):
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
    result = await db.overtime_records.find_one_and_update(
        {"id": record_id},
        {"$set": data.model_dump()},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Overtime record not found")
    del result["_id"]
    return OvertimeRecord(**result)

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
    
    # Calculate totals
    total_minimum = sum(s.get("minimum_staffing", 0) for s in stations)
    total_assigned = sum(len(r.get("personnel_assigned", [])) for r in staffing)
    
    # Aggregate categories
    category_totals = {}
    for record in staffing:
        for cat, count in record.get("categories", {}).items():
            category_totals[cat] = category_totals.get(cat, 0) + count
    
    return {
        "date": date,
        "battalion_id": battalion_id,
        "total_stations": len(stations),
        "total_minimum_staffing": total_minimum,
        "total_personnel_assigned": total_assigned,
        "staffing_variance": total_assigned - total_minimum,
        "category_totals": category_totals,
        "station_details": [
            {
                "station_id": s["id"],
                "station_number": s["station_number"],
                "minimum_staffing": s.get("minimum_staffing", 0),
                "assigned": len(next((r.get("personnel_assigned", []) for r in staffing if r["station_id"] == s["id"]), []))
            }
            for s in stations
        ]
    }

@api_router.get("/reports/overtime-summary")
async def get_overtime_summary(
    start_date: str,
    end_date: str,
    battalion_id: str,
    current_user: dict = Depends(get_current_user)
):
    pipeline = [
        {
            "$match": {
                "battalion_id": battalion_id,
                "date": {"$gte": start_date, "$lte": end_date}
            }
        },
        {
            "$group": {
                "_id": "$personnel_id",
                "total_hours": {"$sum": "$hours"},
                "count": {"$sum": 1}
            }
        }
    ]
    
    results = await db.overtime_records.aggregate(pipeline).to_list(500)
    
    return {
        "start_date": start_date,
        "end_date": end_date,
        "battalion_id": battalion_id,
        "personnel_overtime": results
    }

# ===================== USERS MANAGEMENT (ADMIN) =====================

@api_router.get("/users", response_model=List[UserResponse])
async def get_users(current_user: dict = Depends(require_role([UserRole.ADMIN]))):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return [UserResponse(**u) for u in users]

@api_router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    data: UserBase,
    current_user: dict = Depends(require_role([UserRole.ADMIN]))
):
    update_data = data.model_dump()
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
