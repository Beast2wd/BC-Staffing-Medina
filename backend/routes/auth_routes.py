"""
Authentication routes
"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
import uuid

from database import db
from models import (
    UserRole, UserCreate, UserLogin, UserResponse, TokenResponse,
    PasswordChange, SetTemporaryPassword
)
from auth import (
    get_current_user, require_role, hash_password, verify_password, create_token
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.get("/tenant-by-subdomain/{subdomain}")
async def get_tenant_by_subdomain(subdomain: str):
    """
    Lookup tenant by subdomain for pre-login tenant detection.
    Returns tenant info without requiring authentication.
    """
    # Normalize subdomain
    subdomain = subdomain.lower().strip()
    
    tenant = await db.tenants.find_one(
        {"subdomain": subdomain, "is_active": True},
        {"_id": 0, "id": 1, "name": 1, "subdomain": 1, "settings": 1}
    )
    
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    return {
        "id": tenant["id"],
        "name": tenant["name"],
        "subdomain": tenant["subdomain"],
        "settings": tenant.get("settings", {})
    }


@router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    """
    Login with optional subdomain-based tenant routing.
    
    If subdomain is provided:
    - Lookup tenant by subdomain first
    - Only search for users within that tenant
    - Provides strict tenant isolation
    
    If subdomain is not provided (legacy/super admin):
    - Search for user across all tenants
    - First match wins (existing behavior)
    """
    tenant_filter = {}
    
    # If subdomain provided, enforce tenant scoping
    if credentials.subdomain:
        subdomain = credentials.subdomain.lower().strip()
        tenant = await db.tenants.find_one(
            {"subdomain": subdomain, "is_active": True},
            {"_id": 0, "id": 1}
        )
        
        if not tenant:
            raise HTTPException(status_code=401, detail="Invalid tenant")
        
        tenant_filter = {"tenant_id": tenant["id"]}
    
    # Build user query with optional tenant filter
    user_query = {"payroll_number": credentials.payroll_number, **tenant_filter}
    user = await db.users.find_one(user_query, {"_id": 0})
    
    # If not found by payroll, try email (for volunteers)
    if not user:
        user_query = {"email": credentials.payroll_number, "role": UserRole.VOLUNTEER, **tenant_filter}
        user = await db.users.find_one(user_query, {"_id": 0})
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(credentials.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not user.get("is_active", True):
        raise HTTPException(status_code=401, detail="Account disabled")
    
    # Verify tenant is active (if user has a tenant)
    user_tenant_id = user.get("tenant_id")
    if user_tenant_id:
        tenant = await db.tenants.find_one(
            {"id": user_tenant_id},
            {"_id": 0, "is_active": 1, "status": 1}
        )
        if tenant and (not tenant.get("is_active", True) or tenant.get("status") == "suspended"):
            raise HTTPException(status_code=401, detail="Tenant account suspended")
    
    # Create token with tenant_id for multi-tenant support
    tenant_id = user.get("tenant_id")
    is_super_admin = user.get("is_super_admin", False)
    token = create_token(user["id"], user["role"], tenant_id, is_super_admin)
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
            must_change_password=must_change,
            is_super_admin=is_super_admin,
            tenant_id=tenant_id
        ),
        must_change_password=must_change
    )


@router.post("/register", response_model=UserResponse)
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
        "created_at": datetime.now(timezone.utc).isoformat(),
        "email": user_data.email,
        "phone_number": user_data.phone_number,
        "must_change_password": user_data.must_change_password
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
        is_active=True,
        email=user_data.email,
        phone_number=user_data.phone_number,
        must_change_password=user_data.must_change_password
    )


@router.get("/me", response_model=UserResponse)
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
        must_change_password=current_user.get("must_change_password", False),
        is_super_admin=current_user.get("is_super_admin", False),
        tenant_id=current_user.get("tenant_id")
    )


@router.post("/change-password")
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


@router.post("/set-temporary-password")
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
