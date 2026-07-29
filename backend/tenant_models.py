"""
Multi-tenant SaaS Configuration and Utilities
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime, timezone
from enum import Enum
import uuid


class TenantStatus(str, Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    TRIAL = "trial"


class TenantSettings(BaseModel):
    """Tenant-specific settings"""
    max_users: int = 100
    max_stations: int = 20
    features_enabled: List[str] = ["staffing", "overtime", "volunteers", "deployments"]
    # Branding settings
    custom_branding: bool = False
    logo_url: Optional[str] = None
    login_background_url: Optional[str] = None  # Custom login page background
    primary_color: Optional[str] = "#dc2626"  # Default red
    secondary_color: Optional[str] = "#1e3a5f"  # Default navy
    accent_color: Optional[str] = "#f59e0b"  # Default amber
    # Weather location settings
    weather_latitude: Optional[float] = None
    weather_longitude: Optional[float] = None
    weather_location_name: Optional[str] = None
    # Operational settings
    shifts: List[str] = ["A", "B", "C"]
    ranks: List[str] = [
        "Fire Chief", "Deputy Chief", "Battalion Chief", "Captain",
        "Lieutenant", "Engineer", "Firefighter", "Firefighter/Paramedic", "Firefighter/EMT"
    ]
    apparatus_types: List[str] = ["Engine", "Medic", "Ladder", "Rescue", "Battalion Chief", "Brush", "Tanker"]


class TenantBrandingUpdate(BaseModel):
    """Schema for updating tenant branding"""
    logo_url: Optional[str] = None
    login_background_url: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    accent_color: Optional[str] = None
    custom_branding: bool = True


class Tenant(BaseModel):
    """Tenant model for multi-tenant SaaS"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str  # Display name (e.g., "Medina County Fire Department")
    subdomain: str  # URL subdomain (e.g., "medina" for medina.app.com)
    status: TenantStatus = TenantStatus.ACTIVE
    settings: TenantSettings = Field(default_factory=TenantSettings)
    admin_email: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: Optional[str] = None
    is_active: bool = True


class TenantCreate(BaseModel):
    """Schema for creating a new tenant"""
    name: str
    subdomain: str
    admin_email: Optional[str] = None
    admin_name: str = "Admin User"
    admin_payroll: str = "100001"
    settings: Optional[TenantSettings] = None


class TenantUpdate(BaseModel):
    """Schema for updating a tenant"""
    name: Optional[str] = None
    status: Optional[TenantStatus] = None
    settings: Optional[TenantSettings] = None
    admin_email: Optional[str] = None
    is_active: Optional[bool] = None


class TenantResponse(BaseModel):
    """Response model for tenant"""
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    subdomain: str
    status: TenantStatus
    settings: TenantSettings
    admin_email: Optional[str]
    created_at: str
    is_active: bool
    user_count: Optional[int] = 0
    station_count: Optional[int] = 0


# Super Admin role for managing tenants
class SuperAdminRole(str, Enum):
    SUPER_ADMIN = "super_admin"
