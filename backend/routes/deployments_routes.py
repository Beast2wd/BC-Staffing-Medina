"""
Deployment routes - deployment records and deployment tracker (TIFMAS/EMTF)
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime, timezone
import uuid

from database import db
from models import (
    UserRole, DeploymentRecord, DeploymentRoster, DeploymentLog,
    TIFMASDeployRequest, EMTFDeployRequest
)
from auth import get_current_user, require_role, RANK_ORDER, get_last_name, sort_by_rank_and_name

router = APIRouter(tags=["Deployments"])


# ===================== DEPLOYMENT ROUTES =====================

@router.get("/deployments", response_model=List[DeploymentRecord])
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


@router.post("/deployments", response_model=DeploymentRecord)
async def create_deployment(
    data: DeploymentRecord,
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF]))
):
    await db.deployments.insert_one(data.model_dump())
    return data


@router.put("/deployments/{deployment_id}")
async def update_deployment(
    deployment_id: str,
    data: dict,
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF]))
):
    """Update a deployment and sync date changes to Roster and Deployment Log"""
    
    # Get the current entry
    current_entry = await db.deployments.find_one({"id": deployment_id}, {"_id": 0})
    if not current_entry:
        raise HTTPException(status_code=404, detail="Deployment not found")
    
    personnel_name = current_entry.get("personnel_name", "")
    deployment_type = current_entry.get("deployment_type", "")
    
    # Build update for deployment_log
    log_update = {}
    
    # Check if start_date changed
    if "start_date" in data:
        new_start_date = data["start_date"]
        log_update["date"] = new_start_date
        log_update["start_date"] = new_start_date
        
        # Update deployment roster with new start date
        if new_start_date and personnel_name and deployment_type in ["TIFMAS", "EMTF"]:
            if deployment_type == "TIFMAS":
                await db.deployment_roster.update_one(
                    {"name": personnel_name},
                    {"$set": {"last_tifmas_deploy": new_start_date}}
                )
            elif deployment_type == "EMTF":
                await db.deployment_roster.update_one(
                    {"name": personnel_name},
                    {"$set": {"last_emtf_deploy": new_start_date}}
                )
    
    # Check if end_date changed
    if "end_date" in data:
        log_update["end_date"] = data["end_date"]
    
    # Update deployment log if there are changes
    if log_update and personnel_name and deployment_type in ["TIFMAS", "EMTF"]:
        most_recent_log = await db.deployment_log.find_one(
            {"personnel_name": personnel_name, "incident_type": deployment_type},
            sort=[("date", -1)]
        )
        if most_recent_log:
            await db.deployment_log.update_one(
                {"id": most_recent_log["id"]},
                {"$set": log_update}
            )
    
    result = await db.deployments.find_one_and_update(
        {"id": deployment_id},
        {"$set": data},
        return_document=True
    )
    result.pop("_id", None)
    return result


# ===================== DEPLOYMENT TRACKER =====================

@router.get("/deployment-roster")
async def get_deployment_roster(
    current_user: dict = Depends(get_current_user)
):
    """Get all deployment roster entries sorted by rank then last name"""
    roster = await db.deployment_roster.find({}, {"_id": 0}).to_list(1000)
    return sort_by_rank_and_name(roster)


@router.post("/deployment-roster")
async def create_deployment_roster_entry(
    data: dict,
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF, UserRole.CAPTAIN, UserRole.LIEUTENANT]))
):
    """Create a new deployment roster entry"""
    entry = DeploymentRoster(**data)
    await db.deployment_roster.insert_one(entry.model_dump())
    return {"message": "Roster entry created", "id": entry.id}


@router.put("/deployment-roster/{entry_id}")
async def update_deployment_roster_entry(
    entry_id: str,
    data: dict,
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF, UserRole.CAPTAIN, UserRole.LIEUTENANT]))
):
    """Update a deployment roster entry and sync Last Deploy changes to Deployment Log and BC Deployments"""
    
    # Get the current entry to check for changes
    current_entry = await db.deployment_roster.find_one({"id": entry_id}, {"_id": 0})
    if not current_entry:
        raise HTTPException(status_code=404, detail="Roster entry not found")
    
    personnel_name = current_entry.get("name", "")
    
    # Check if last_tifmas_deploy changed
    if "last_tifmas_deploy" in data and data["last_tifmas_deploy"] != current_entry.get("last_tifmas_deploy", ""):
        new_date = data["last_tifmas_deploy"]
        
        if new_date:
            # Update the most recent TIFMAS deployment log entry for this person (by name)
            most_recent_log = await db.deployment_log.find_one(
                {"personnel_name": personnel_name, "incident_type": "TIFMAS"},
                sort=[("date", -1)]
            )
            if most_recent_log:
                await db.deployment_log.update_one(
                    {"id": most_recent_log["id"]},
                    {"$set": {"date": new_date, "start_date": new_date}}
                )
            
            # Update the most recent TIFMAS deployment record (BC Deployments) by name
            most_recent_deployment = await db.deployments.find_one(
                {"personnel_name": personnel_name, "deployment_type": "TIFMAS"},
                sort=[("start_date", -1)]
            )
            if most_recent_deployment:
                await db.deployments.update_one(
                    {"id": most_recent_deployment["id"]},
                    {"$set": {"start_date": new_date}}
                )
    
    # Check if last_emtf_deploy changed
    if "last_emtf_deploy" in data and data["last_emtf_deploy"] != current_entry.get("last_emtf_deploy", ""):
        new_date = data["last_emtf_deploy"]
        
        if new_date:
            # Update the most recent EMTF deployment log entry for this person (by name)
            most_recent_log = await db.deployment_log.find_one(
                {"personnel_name": personnel_name, "incident_type": "EMTF"},
                sort=[("date", -1)]
            )
            if most_recent_log:
                await db.deployment_log.update_one(
                    {"id": most_recent_log["id"]},
                    {"$set": {"date": new_date, "start_date": new_date}}
                )
            
            # Update the most recent EMTF deployment record (BC Deployments) by name
            most_recent_deployment = await db.deployments.find_one(
                {"personnel_name": personnel_name, "deployment_type": "EMTF"},
                sort=[("start_date", -1)]
            )
            if most_recent_deployment:
                await db.deployments.update_one(
                    {"id": most_recent_deployment["id"]},
                    {"$set": {"start_date": new_date}}
                )
    
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.deployment_roster.find_one_and_update(
        {"id": entry_id},
        {"$set": data},
        return_document=True
    )
    result.pop("_id", None)
    return result


@router.delete("/deployment-roster/{entry_id}")
async def delete_deployment_roster_entry(
    entry_id: str,
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF, UserRole.CAPTAIN, UserRole.LIEUTENANT]))
):
    """Delete a deployment roster entry"""
    result = await db.deployment_roster.delete_one({"id": entry_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Roster entry not found")
    return {"message": "Roster entry deleted"}


@router.post("/deployment-roster/import")
async def import_deployment_roster(
    data: List[dict],
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF, UserRole.CAPTAIN, UserRole.LIEUTENANT]))
):
    """Import multiple deployment roster entries"""
    # Clear existing roster
    await db.deployment_roster.delete_many({})
    
    entries = []
    for item in data:
        entry = DeploymentRoster(**item)
        entries.append(entry.model_dump())
    
    if entries:
        await db.deployment_roster.insert_many(entries)
    
    return {"message": f"Imported {len(entries)} roster entries"}


@router.get("/deployment-roster/tifmas-rank")
async def get_tifmas_rank(
    current_user: dict = Depends(get_current_user)
):
    """Get TIFMAS eligible roster sorted by rank then last name"""
    roster = await db.deployment_roster.find(
        {"eligible_tifmas": True}, 
        {"_id": 0}
    ).to_list(1000)
    return sort_by_rank_and_name(roster)


@router.get("/deployment-roster/emtf-rank")
async def get_emtf_rank(
    current_user: dict = Depends(get_current_user)
):
    """Get EMTF eligible roster sorted by rank then last name"""
    roster = await db.deployment_roster.find(
        {"eligible_emtf": True}, 
        {"_id": 0}
    ).to_list(1000)
    return sort_by_rank_and_name(roster)


@router.post("/deployment-roster/deploy-tifmas")
async def deploy_tifmas_personnel(
    data: TIFMASDeployRequest,
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF, UserRole.CAPTAIN, UserRole.LIEUTENANT]))
):
    """Deploy selected personnel for TIFMAS deployment"""
    deployed_personnel = []
    
    # Get personnel info from deployment_roster
    for person_id in data.personnel_ids:
        person = await db.deployment_roster.find_one({"id": person_id}, {"_id": 0})
        if person:
            # Create deployment record (for BC Deployments page)
            deployment_id = str(uuid.uuid4())
            deployment_record = {
                "id": deployment_id,
                "personnel_id": person_id,
                "personnel_name": person.get("name", ""),
                "deployment_type": "TIFMAS",
                "start_date": data.start_date,
                "end_date": data.end_date,
                "location": data.location,
                "notes": data.notes,
                "station": "",  # Will be empty for roster personnel
                "shift": "",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.deployments.insert_one(deployment_record)
            
            # Create deployment log entry
            log_entry = {
                "id": str(uuid.uuid4()),
                "date": data.start_date,
                "incident_type": "TIFMAS",
                "incident_name": data.location,
                "personnel_name": person.get("name", ""),
                "personnel_id": person_id,
                "position": "AST",
                "notes": data.notes,
                "start_date": data.start_date,
                "end_date": data.end_date,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.deployment_log.insert_one(log_entry)
            
            # Update deployment_roster with last deploy date and increment 12mo count
            await db.deployment_roster.update_one(
                {"id": person_id},
                {
                    "$set": {
                        "last_tifmas_deploy": data.start_date,
                        "last_deployment": data.start_date,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    },
                    "$inc": {"deployments_last_12mo": 1}
                }
            )
            
            deployed_personnel.append({
                "id": person_id,
                "name": person.get("name", ""),
                "deployment_id": deployment_id
            })
    
    return {
        "message": f"Successfully deployed {len(deployed_personnel)} personnel for TIFMAS",
        "deployed": deployed_personnel,
        "reminder": "TEXT AND EMAIL NOTIFICATIONS: Setup pending - please configure notification service"
    }


@router.post("/deployment-roster/deploy-emtf")
async def deploy_emtf_personnel(
    data: EMTFDeployRequest,
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF, UserRole.CAPTAIN, UserRole.LIEUTENANT]))
):
    """Deploy selected personnel for EMTF deployment"""
    deployed_personnel = []
    
    # Get personnel info from deployment_roster
    for person_id in data.personnel_ids:
        person = await db.deployment_roster.find_one({"id": person_id}, {"_id": 0})
        if person:
            # Create deployment record (for BC Deployments page)
            deployment_id = str(uuid.uuid4())
            deployment_record = {
                "id": deployment_id,
                "personnel_id": person_id,
                "personnel_name": person.get("name", ""),
                "deployment_type": "EMTF",
                "start_date": data.start_date,
                "end_date": data.end_date,
                "location": data.location,
                "notes": data.notes,
                "station": "",
                "shift": "",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.deployments.insert_one(deployment_record)
            
            # Create deployment log entry
            log_entry = {
                "id": str(uuid.uuid4()),
                "date": data.start_date,
                "incident_type": "EMTF",
                "incident_name": data.location,
                "personnel_name": person.get("name", ""),
                "personnel_id": person_id,
                "position": "MED",
                "notes": data.notes,
                "start_date": data.start_date,
                "end_date": data.end_date,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.deployment_log.insert_one(log_entry)
            
            # Update deployment_roster with last deploy date and increment 12mo count
            await db.deployment_roster.update_one(
                {"id": person_id},
                {
                    "$set": {
                        "last_emtf_deploy": data.start_date,
                        "last_deployment": data.start_date,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    },
                    "$inc": {"deployments_last_12mo": 1}
                }
            )
            
            deployed_personnel.append({
                "id": person_id,
                "name": person.get("name", ""),
                "deployment_id": deployment_id
            })
    
    return {
        "message": f"Successfully deployed {len(deployed_personnel)} personnel for EMTF",
        "deployed": deployed_personnel,
        "reminder": "TEXT AND EMAIL NOTIFICATIONS: Setup pending - please configure notification service"
    }


# ===================== DEPLOYMENT LOG =====================

@router.get("/deployment-log")
async def get_deployment_log(
    current_user: dict = Depends(get_current_user)
):
    """Get all deployment log entries sorted by rank then last name"""
    logs = await db.deployment_log.find({}, {"_id": 0}).to_list(1000)
    
    # Get roster to lookup ranks
    roster = await db.deployment_roster.find({}, {"_id": 0, "name": 1, "rank": 1}).to_list(1000)
    name_to_rank = {r.get("name", ""): r.get("rank", "") for r in roster}
    
    # Sort by rank hierarchy then last name
    logs.sort(key=lambda x: (
        RANK_ORDER.get(name_to_rank.get(x.get("personnel_name", ""), ""), 99),
        get_last_name(x.get("personnel_name", ""))
    ))
    return logs


@router.post("/deployment-log")
async def create_deployment_log_entry(
    data: dict,
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF, UserRole.CAPTAIN, UserRole.LIEUTENANT]))
):
    """Create a new deployment log entry"""
    entry = DeploymentLog(**data)
    await db.deployment_log.insert_one(entry.model_dump())
    return {"message": "Deployment log entry created", "id": entry.id}


@router.put("/deployment-log/{entry_id}")
async def update_deployment_log_entry(
    entry_id: str,
    data: dict,
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF, UserRole.CAPTAIN, UserRole.LIEUTENANT]))
):
    """Update a deployment log entry and sync date changes to Roster and BC Deployments"""
    
    # Get the current entry
    current_entry = await db.deployment_log.find_one({"id": entry_id}, {"_id": 0})
    if not current_entry:
        raise HTTPException(status_code=404, detail="Deployment log entry not found")
    
    personnel_name = current_entry.get("personnel_name", "")
    incident_type = current_entry.get("incident_type", "")
    
    # Build update for BC deployments
    deployments_update = {}
    
    # Check if start_date (date) changed
    if "date" in data or "start_date" in data:
        new_start_date = data.get("start_date") or data.get("date")
        if new_start_date:
            deployments_update["start_date"] = new_start_date
            
            # Update deployment roster
            if personnel_name and incident_type == "TIFMAS":
                await db.deployment_roster.update_one(
                    {"name": personnel_name},
                    {"$set": {"last_tifmas_deploy": new_start_date}}
                )
            elif personnel_name and incident_type == "EMTF":
                await db.deployment_roster.update_one(
                    {"name": personnel_name},
                    {"$set": {"last_emtf_deploy": new_start_date}}
                )
    
    # Check if end_date changed
    if "end_date" in data:
        deployments_update["end_date"] = data["end_date"]
    
    # Update BC deployments (most recent matching entry)
    if deployments_update and personnel_name and incident_type in ["TIFMAS", "EMTF"]:
        most_recent = await db.deployments.find_one(
            {"personnel_name": personnel_name, "deployment_type": incident_type},
            sort=[("start_date", -1)]
        )
        if most_recent:
            await db.deployments.update_one(
                {"id": most_recent["id"]},
                {"$set": deployments_update}
            )
    
    result = await db.deployment_log.find_one_and_update(
        {"id": entry_id},
        {"$set": data},
        return_document=True
    )
    result.pop("_id", None)
    return result


@router.delete("/deployment-log/{entry_id}")
async def delete_deployment_log_entry(
    entry_id: str,
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF, UserRole.CAPTAIN, UserRole.LIEUTENANT]))
):
    """Delete a deployment log entry"""
    result = await db.deployment_log.delete_one({"id": entry_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Deployment log entry not found")
    return {"message": "Deployment log entry deleted"}


@router.post("/deployment-log/import")
async def import_deployment_log(
    data: List[dict],
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF, UserRole.CAPTAIN, UserRole.LIEUTENANT]))
):
    """Import multiple deployment log entries"""
    # Clear existing log
    await db.deployment_log.delete_many({})
    
    entries = []
    for item in data:
        entry = DeploymentLog(**item)
        entries.append(entry.model_dump())
    
    if entries:
        await db.deployment_log.insert_many(entries)
    
    return {"message": f"Imported {len(entries)} log entries"}
