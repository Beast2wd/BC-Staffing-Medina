"""
Station and Battalion routes
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional

from database import db
from models import UserRole, Station, StationCreate, Battalion
from auth import get_current_user, require_role

router = APIRouter(tags=["Stations & Battalions"])


# ===================== STATION ROUTES =====================

@router.get("/stations", response_model=List[Station])
async def get_stations(battalion_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {}
    if battalion_id:
        query["battalion_id"] = battalion_id
    stations = await db.stations.find(query, {"_id": 0}).to_list(100)
    return stations


@router.post("/stations", response_model=Station)
async def create_station(data: StationCreate, current_user: dict = Depends(require_role([UserRole.ADMIN]))):
    import uuid
    station_id = str(uuid.uuid4())
    station_doc = {"id": station_id, **data.model_dump()}
    await db.stations.insert_one(station_doc)
    return Station(**station_doc)


@router.put("/stations/{station_id}", response_model=Station)
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

@router.get("/battalions", response_model=List[Battalion])
async def get_battalions(current_user: dict = Depends(get_current_user)):
    battalions = await db.battalions.find({}, {"_id": 0}).to_list(100)
    return battalions


@router.post("/battalions", response_model=Battalion)
async def create_battalion(data: Battalion, current_user: dict = Depends(require_role([UserRole.ADMIN]))):
    await db.battalions.insert_one(data.model_dump())
    return data
