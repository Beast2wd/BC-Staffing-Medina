"""
Authentication helpers and utilities
"""
from fastapi import HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timezone, timedelta
from typing import List, Optional
import jwt
import bcrypt

from database import db, JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRATION_HOURS

security = HTTPBearer()

# Rank hierarchy for sorting (lower number = higher rank)
RANK_ORDER = {
    "Fire Chief": 1,
    "Asst. Chief": 2,
    "Deputy Chief": 3,
    "Battalion Chief": 4,
    "Captain": 5,
    "Lieutenant": 6,
    "Engineer": 7,
    "Firefighter": 8
}


def get_last_name(name: str) -> str:
    """Extract last name from 'Last, First' or 'First Last' format"""
    if not name:
        return ""
    if "," in name:
        return name.split(",")[0].strip().lower()
    parts = name.strip().split()
    return parts[-1].lower() if parts else ""


def sort_by_rank_and_name(roster: list) -> list:
    """Sort roster by rank hierarchy first, then alphabetically by last name"""
    return sorted(roster, key=lambda x: (
        RANK_ORDER.get(x.get("rank", ""), 99),
        get_last_name(x.get("name", ""))
    ))


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))


def create_token(user_id: str, role: str, tenant_id: Optional[str] = None, is_super_admin: bool = False) -> str:
    """Create JWT token with tenant_id for multi-tenant support"""
    payload = {
        "user_id": user_id,
        "role": role,
        "tenant_id": tenant_id,
        "is_super_admin": is_super_admin,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and validate JWT token"""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current user from JWT token"""
    payload = decode_token(credentials.credentials)
    user_id = payload.get("user_id")
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    # Add tenant_id from token to user dict for convenience
    user["_tenant_id"] = payload.get("tenant_id")
    user["_is_super_admin"] = payload.get("is_super_admin", False) or user.get("is_super_admin", False)
    return user


async def get_tenant_id(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """Extract tenant_id from JWT token - use this for tenant-scoped queries"""
    payload = decode_token(credentials.credentials)
    tenant_id = payload.get("tenant_id")
    if not tenant_id:
        # Check if super admin (they can access without tenant_id)
        if payload.get("is_super_admin"):
            return None
        raise HTTPException(status_code=400, detail="Tenant context required")
    return tenant_id


async def get_current_user_with_tenant(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current user and ensure they have a tenant context"""
    user = await get_current_user(credentials)
    if not user.get("_tenant_id") and not user.get("_is_super_admin"):
        raise HTTPException(status_code=400, detail="Tenant context required")
    return user


def require_role(allowed_roles: List[str]):
    """Require user to have one of the allowed roles"""
    async def role_checker(user: dict = Depends(get_current_user)):
        # Super admins can access everything
        if user.get("_is_super_admin"):
            return user
        if user["role"] not in allowed_roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return role_checker


def require_super_admin():
    """Require super admin privileges"""
    async def super_admin_checker(user: dict = Depends(get_current_user)):
        if not user.get("_is_super_admin") and not user.get("is_super_admin"):
            raise HTTPException(status_code=403, detail="Super admin privileges required")
        return user
    return super_admin_checker


async def get_tenant_from_subdomain(request: Request) -> Optional[str]:
    """Extract tenant from request subdomain (for frontend routing)"""
    host = request.headers.get("host", "")
    # Extract subdomain from host (e.g., "medina" from "medina.app.com")
    parts = host.split(".")
    if len(parts) >= 3:
        subdomain = parts[0]
        tenant = await db.tenants.find_one({"subdomain": subdomain, "is_active": True}, {"_id": 0})
        if tenant:
            return tenant.get("id")
    return None


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
