"""
Authentication helpers and utilities
"""
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timezone, timedelta
from typing import List
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
