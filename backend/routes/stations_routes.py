"""
Station and Battalion routes - Multi-tenant enabled
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
import uuid

from database import db
from models import UserRole, Station, StationCreate, Battalion
from auth import get_current_user, require_role

router = APIRouter(tags=["Stations & Battalions"])


# ===================== STATION ROUTES =====================

@router.get("/stations", response_model=List[Station])
async def get_stations(battalion_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    tenant_id = current_user.get("_tenant_id") or current_user.get("tenant_id")
    query = {}
    
    if tenant_id:
        query["tenant_id"] = tenant_id
    if battalion_id:
        query["battalion_id"] = battalion_id
    
    stations = await db.stations.find(query, {"_id": 0}).to_list(100)
    return stations


@router.post("/stations", response_model=Station)
async def create_station(data: StationCreate, current_user: dict = Depends(require_role([UserRole.ADMIN]))):
    tenant_id = current_user.get("_tenant_id") or current_user.get("tenant_id")
    
    station_id = f"sta-{data.station_number}"
    station_doc = {
        "id": station_id,
        "tenant_id": tenant_id,
        **data.model_dump()
    }
    await db.stations.insert_one(station_doc)
    return Station(**station_doc)


@router.put("/stations/{station_id}", response_model=Station)
async def update_station(
    station_id: str, 
    data: StationCreate, 
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF, UserRole.CAPTAIN, UserRole.LIEUTENANT]))
):
    tenant_id = current_user.get("_tenant_id") or current_user.get("tenant_id")
    
    query = {"id": station_id}
    if tenant_id:
        query["tenant_id"] = tenant_id
    
    result = await db.stations.find_one_and_update(
        query,
        {"$set": data.model_dump()},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Station not found")
    del result["_id"]
    return Station(**result)


@router.delete("/stations/{station_id}")
async def delete_station(station_id: str, current_user: dict = Depends(require_role([UserRole.ADMIN]))):
    """Delete a station. Only allowed if no personnel are assigned to it."""
    tenant_id = current_user.get("_tenant_id") or current_user.get("tenant_id")
    
    query = {"id": station_id}
    if tenant_id:
        query["tenant_id"] = tenant_id
    
    # Check if station exists
    station = await db.stations.find_one(query)
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")
    
    # Check if any personnel are assigned to this station
    personnel_query = {"station_id": station_id, "is_active": True}
    if tenant_id:
        personnel_query["tenant_id"] = tenant_id
    
    personnel_count = await db.personnel.count_documents(personnel_query)
    if personnel_count > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot delete station. {personnel_count} personnel are still assigned to it. Reassign personnel first."
        )
    
    # Delete the station
    result = await db.stations.delete_one(query)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Station not found")
    
    return {"message": "Station deleted successfully"}


# ===================== BATTALION ROUTES =====================

@router.get("/battalions", response_model=List[Battalion])
async def get_battalions(current_user: dict = Depends(get_current_user)):
    tenant_id = current_user.get("_tenant_id") or current_user.get("tenant_id")
    
    query = {}
    if tenant_id:
        query["tenant_id"] = tenant_id
    
    battalions = await db.battalions.find(query, {"_id": 0}).to_list(100)
    return battalions


@router.post("/battalions", response_model=Battalion)
async def create_battalion(data: Battalion, current_user: dict = Depends(require_role([UserRole.ADMIN]))):
    tenant_id = current_user.get("_tenant_id") or current_user.get("tenant_id")
    
    battalion_doc = {
        **data.model_dump(),
        "tenant_id": tenant_id
    }
    await db.battalions.insert_one(battalion_doc)
    return Battalion(**battalion_doc)


@router.put("/battalions/{battalion_id}", response_model=Battalion)
async def update_battalion(battalion_id: str, data: Battalion, current_user: dict = Depends(require_role([UserRole.ADMIN]))):
    """Update a battalion's details (name, number, chief)."""
    tenant_id = current_user.get("_tenant_id") or current_user.get("tenant_id")
    
    query = {"id": battalion_id}
    if tenant_id:
        query["tenant_id"] = tenant_id
    
    # Check if battalion exists
    existing = await db.battalions.find_one(query)
    if not existing:
        raise HTTPException(status_code=404, detail="Battalion not found")
    
    # Update the battalion
    update_data = {
        "battalion_number": data.battalion_number,
        "name": data.name,
        "chief_payroll": data.chief_payroll
    }
    
    result = await db.battalions.find_one_and_update(
        query,
        {"$set": update_data},
        return_document=True
    )
    del result["_id"]
    return Battalion(**result)


@router.delete("/battalions/{battalion_id}")
async def delete_battalion(battalion_id: str, current_user: dict = Depends(require_role([UserRole.ADMIN]))):
    """Delete a battalion. Only allowed if no stations are assigned to it."""
    tenant_id = current_user.get("_tenant_id") or current_user.get("tenant_id")
    
    query = {"id": battalion_id}
    if tenant_id:
        query["tenant_id"] = tenant_id
    
    # Check if battalion exists
    battalion = await db.battalions.find_one(query)
    if not battalion:
        raise HTTPException(status_code=404, detail="Battalion not found")
    
    # Check if any stations are assigned to this battalion
    station_query = {"battalion_id": battalion_id}
    if tenant_id:
        station_query["tenant_id"] = tenant_id
    
    station_count = await db.stations.count_documents(station_query)
    if station_count > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot delete battalion. {station_count} station(s) are still assigned to it. Reassign stations first."
        )
    
    # Delete the battalion
    result = await db.battalions.delete_one(query)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Battalion not found")
    
    return {"message": "Battalion deleted successfully"}
