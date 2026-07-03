"""
Pydantic models for the Medina County BC Staffing application
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone


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
    email: Optional[str] = None
    phone_number: Optional[str] = None


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
    email: Optional[str] = None
    phone_number: Optional[str] = None


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
    email: Optional[str] = None
    phone_number: Optional[str] = None


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


class ApparatusAssignmentUpdate(BaseModel):
    personnel_ids: Optional[List[str]] = None
    position_assignments: Optional[dict] = None


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


# Deployment Tracker Models
class DeploymentRoster(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    rank: str
    ems_level: str
    seniority_date: str = ""
    eligible_tifmas: bool = False
    eligible_emtf: bool = False
    last_deployment: str = ""
    deployments_last_12mo: int = 0
    tifmas_score: float = 0
    emtf_score: float = 0
    last_tifmas_deploy: str = ""
    last_emtf_deploy: str = ""
    ff1: bool = False
    crew_boss: bool = False
    engine_boss: bool = False
    mist: bool = False
    wpu: bool = False
    astl: bool = False
    medl: bool = False
    tech_spec: bool = False
    pack_test_level: str = ""  # Arduous, Moderate, Light
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class DeploymentLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str
    incident_type: str  # TIFMAS, EMTF
    incident_name: str
    personnel_name: str
    personnel_id: str = ""
    position: str  # AST, FFT1, CRWB, ENGB, etc.
    notes: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


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
    email: str = ""
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
    email: str = ""
    shift_type: str = "24"  # "12" or "24" hour shift


class DeploymentRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    personnel_id: str
    personnel_name: str = ""
    deployment_type: str
    start_date: str
    end_date: str
    location: str
    notes: str = ""
    station: str = ""
    shift: str = ""


# Volunteer Models
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


# Volunteer Firefighter Models
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
    assigned_station_id: str = ""  # Station assigned when approved
    notes: str = ""
    battalion_id: str = ""
    approved_by: str = ""
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
    assigned_station_id: Optional[str] = None


class RemarkEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str
    battalion_id: str
    content: str
    created_by: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# Deployment Request Models
class TIFMASDeployRequest(BaseModel):
    personnel_ids: List[str]
    start_date: str
    end_date: str
    location: str
    notes: str = ""


class EMTFDeployRequest(BaseModel):
    personnel_ids: List[str]
    start_date: str
    end_date: str
    location: str
    notes: str = ""


# Notification Models
class NotificationRecipient(BaseModel):
    id: str
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None


class BroadcastNotificationRequest(BaseModel):
    recipients: List[NotificationRecipient]
    subject: str
    message: str
    send_sms: bool = True
    send_email: bool = True
    date: Optional[str] = None


# Password Reset Model
class ResetPasswordRequest(BaseModel):
    new_password: str
    force_change: bool = False  # If true, user must change password on first login
