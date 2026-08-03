"""
Deployment routes - deployment records and deployment tracker (TIFMAS/EMTF) (Multi-tenant enabled)
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
from tenant_utils import get_tenant_id, add_tenant_to_query, add_tenant_to_doc

router = APIRouter(tags=["Deployments"])


# ===================== DEPLOYMENT ROUTES =====================

@router.get("/deployments", response_model=List[DeploymentRecord])
async def get_deployments(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    tenant_id = get_tenant_id(current_user)
    query = {}
    if tenant_id:
        query["tenant_id"] = tenant_id
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
    tenant_id = get_tenant_id(current_user)
    deploy_doc = data.model_dump()
    if tenant_id:
        deploy_doc["tenant_id"] = tenant_id
    await db.deployments.insert_one(deploy_doc)
    return data


@router.put("/deployments/{deployment_id}")
async def update_deployment(
    deployment_id: str,
    data: dict,
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF]))
):
    """Update a deployment and sync date changes to Roster and Deployment Log"""
    tenant_id = get_tenant_id(current_user)
    
    # Get the current entry
    query = {"id": deployment_id}
    if tenant_id:
        query["tenant_id"] = tenant_id
    current_entry = await db.deployments.find_one(query, {"_id": 0})
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
            roster_query = {"name": personnel_name}
            if tenant_id:
                roster_query["tenant_id"] = tenant_id
            if deployment_type == "TIFMAS":
                await db.deployment_roster.update_one(roster_query, {"$set": {"last_tifmas_deploy": new_start_date}})
            elif deployment_type == "EMTF":
                await db.deployment_roster.update_one(roster_query, {"$set": {"last_emtf_deploy": new_start_date}})
    
    # Check if end_date changed
    if "end_date" in data:
        log_update["end_date"] = data["end_date"]
    
    # Update deployment log if there are changes
    if log_update and personnel_name and deployment_type in ["TIFMAS", "EMTF"]:
        log_query = {"personnel_name": personnel_name, "incident_type": deployment_type}
        if tenant_id:
            log_query["tenant_id"] = tenant_id
        most_recent_log = await db.deployment_log.find_one(log_query, sort=[("date", -1)])
        if most_recent_log:
            await db.deployment_log.update_one({"id": most_recent_log["id"]}, {"$set": log_update})
    
    result = await db.deployments.find_one_and_update(
        query,
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
    tenant_id = get_tenant_id(current_user)
    query = {}
    if tenant_id:
        query["tenant_id"] = tenant_id
    roster = await db.deployment_roster.find(query, {"_id": 0}).to_list(1000)
    return sort_by_rank_and_name(roster)


@router.post("/deployment-roster")
async def create_deployment_roster_entry(
    data: dict,
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF, UserRole.CAPTAIN, UserRole.LIEUTENANT]))
):
    """Create a new deployment roster entry"""
    tenant_id = get_tenant_id(current_user)
    entry = DeploymentRoster(**data)
    entry_doc = entry.model_dump()
    if tenant_id:
        entry_doc["tenant_id"] = tenant_id
    await db.deployment_roster.insert_one(entry_doc)
    return {"message": "Roster entry created", "id": entry.id}


@router.put("/deployment-roster/{entry_id}")
async def update_deployment_roster_entry(
    entry_id: str,
    data: dict,
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF, UserRole.CAPTAIN, UserRole.LIEUTENANT]))
):
    """Update a deployment roster entry and sync Last Deploy changes to Deployment Log and BC Deployments"""
    tenant_id = get_tenant_id(current_user)
    
    # Get the current entry to check for changes
    query = {"id": entry_id}
    if tenant_id:
        query["tenant_id"] = tenant_id
    current_entry = await db.deployment_roster.find_one(query, {"_id": 0})
    if not current_entry:
        raise HTTPException(status_code=404, detail="Roster entry not found")
    
    personnel_name = current_entry.get("name", "")
    
    # Check if last_tifmas_deploy changed
    if "last_tifmas_deploy" in data and data["last_tifmas_deploy"] != current_entry.get("last_tifmas_deploy", ""):
        new_date = data["last_tifmas_deploy"]
        
        if new_date:
            # Update the most recent TIFMAS deployment log entry for this person (by name)
            log_query = {"personnel_name": personnel_name, "incident_type": "TIFMAS"}
            if tenant_id:
                log_query["tenant_id"] = tenant_id
            most_recent_log = await db.deployment_log.find_one(log_query, sort=[("date", -1)])
            if most_recent_log:
                await db.deployment_log.update_one({"id": most_recent_log["id"]}, {"$set": {"date": new_date, "start_date": new_date}})
            
            # Update the most recent TIFMAS deployment record (BC Deployments) by name
            deploy_query = {"personnel_name": personnel_name, "deployment_type": "TIFMAS"}
            if tenant_id:
                deploy_query["tenant_id"] = tenant_id
            most_recent_deployment = await db.deployments.find_one(deploy_query, sort=[("start_date", -1)])
            if most_recent_deployment:
                await db.deployments.update_one({"id": most_recent_deployment["id"]}, {"$set": {"start_date": new_date}})
    
    # Check if last_emtf_deploy changed
    if "last_emtf_deploy" in data and data["last_emtf_deploy"] != current_entry.get("last_emtf_deploy", ""):
        new_date = data["last_emtf_deploy"]
        
        if new_date:
            # Update the most recent EMTF deployment log entry for this person (by name)
            log_query = {"personnel_name": personnel_name, "incident_type": "EMTF"}
            if tenant_id:
                log_query["tenant_id"] = tenant_id
            most_recent_log = await db.deployment_log.find_one(log_query, sort=[("date", -1)])
            if most_recent_log:
                await db.deployment_log.update_one({"id": most_recent_log["id"]}, {"$set": {"date": new_date, "start_date": new_date}})
            
            # Update the most recent EMTF deployment record (BC Deployments) by name
            deploy_query = {"personnel_name": personnel_name, "deployment_type": "EMTF"}
            if tenant_id:
                deploy_query["tenant_id"] = tenant_id
            most_recent_deployment = await db.deployments.find_one(deploy_query, sort=[("start_date", -1)])
            if most_recent_deployment:
                await db.deployments.update_one({"id": most_recent_deployment["id"]}, {"$set": {"start_date": new_date}})
    
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.deployment_roster.find_one_and_update(
        query,
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
    tenant_id = get_tenant_id(current_user)
    query = {"id": entry_id}
    if tenant_id:
        query["tenant_id"] = tenant_id
    result = await db.deployment_roster.delete_one(query)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Roster entry not found")
    return {"message": "Roster entry deleted"}


@router.post("/deployment-roster/import")
async def import_deployment_roster(
    data: List[dict],
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF, UserRole.CAPTAIN, UserRole.LIEUTENANT]))
):
    """Import multiple deployment roster entries"""
    tenant_id = get_tenant_id(current_user)
    # Clear existing roster for this tenant
    del_query = {}
    if tenant_id:
        del_query["tenant_id"] = tenant_id
    await db.deployment_roster.delete_many(del_query)
    
    entries = []
    for item in data:
        entry = DeploymentRoster(**item)
        entry_doc = entry.model_dump()
        if tenant_id:
            entry_doc["tenant_id"] = tenant_id
        entries.append(entry_doc)
    
    if entries:
        await db.deployment_roster.insert_many(entries)
    
    return {"message": f"Imported {len(entries)} roster entries"}


@router.get("/deployment-roster/tifmas-rank")
async def get_tifmas_rank(
    current_user: dict = Depends(get_current_user)
):
    """Get TIFMAS eligible roster sorted by rank then last name"""
    tenant_id = get_tenant_id(current_user)
    query = {"eligible_tifmas": True}
    if tenant_id:
        query["tenant_id"] = tenant_id
    roster = await db.deployment_roster.find(query, {"_id": 0}).to_list(1000)
    return sort_by_rank_and_name(roster)


@router.get("/deployment-roster/emtf-rank")
async def get_emtf_rank(
    current_user: dict = Depends(get_current_user)
):
    """Get EMTF eligible roster sorted by rank then last name"""
    tenant_id = get_tenant_id(current_user)
    query = {"eligible_emtf": True}
    if tenant_id:
        query["tenant_id"] = tenant_id
    roster = await db.deployment_roster.find(query, {"_id": 0}).to_list(1000)
    return sort_by_rank_and_name(roster)


@router.post("/deployment-roster/deploy-tifmas")
async def deploy_tifmas_personnel(
    data: TIFMASDeployRequest,
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF, UserRole.CAPTAIN, UserRole.LIEUTENANT]))
):
    """Deploy selected personnel for TIFMAS deployment"""
    tenant_id = get_tenant_id(current_user)
    deployed_personnel = []
    
    # Get personnel info from deployment_roster
    for person_id in data.personnel_ids:
        person_query = {"id": person_id}
        if tenant_id:
            person_query["tenant_id"] = tenant_id
        person = await db.deployment_roster.find_one(person_query, {"_id": 0})
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
            if tenant_id:
                deployment_record["tenant_id"] = tenant_id
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
            if tenant_id:
                log_entry["tenant_id"] = tenant_id
            await db.deployment_log.insert_one(log_entry)
            
            # Update deployment_roster with last deploy date and increment 12mo count
            await db.deployment_roster.update_one(
                person_query,
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
    tenant_id = get_tenant_id(current_user)
    deployed_personnel = []
    
    # Get personnel info from deployment_roster
    for person_id in data.personnel_ids:
        person_query = {"id": person_id}
        if tenant_id:
            person_query["tenant_id"] = tenant_id
        person = await db.deployment_roster.find_one(person_query, {"_id": 0})
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
            if tenant_id:
                deployment_record["tenant_id"] = tenant_id
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
            if tenant_id:
                log_entry["tenant_id"] = tenant_id
            await db.deployment_log.insert_one(log_entry)
            
            # Update deployment_roster with last deploy date and increment 12mo count
            await db.deployment_roster.update_one(
                person_query,
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
    tenant_id = get_tenant_id(current_user)
    query = {}
    if tenant_id:
        query["tenant_id"] = tenant_id
    logs = await db.deployment_log.find(query, {"_id": 0}).to_list(1000)
    
    # Get roster to lookup ranks
    roster_query = {}
    if tenant_id:
        roster_query["tenant_id"] = tenant_id
    roster = await db.deployment_roster.find(roster_query, {"_id": 0, "name": 1, "rank": 1}).to_list(1000)
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
    tenant_id = get_tenant_id(current_user)
    entry = DeploymentLog(**data)
    entry_doc = entry.model_dump()
    if tenant_id:
        entry_doc["tenant_id"] = tenant_id
    await db.deployment_log.insert_one(entry_doc)
    return {"message": "Deployment log entry created", "id": entry.id}


@router.put("/deployment-log/{entry_id}")
async def update_deployment_log_entry(
    entry_id: str,
    data: dict,
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF, UserRole.CAPTAIN, UserRole.LIEUTENANT]))
):
    """Update a deployment log entry and sync date changes to Roster and BC Deployments"""
    tenant_id = get_tenant_id(current_user)
    
    # Get the current entry
    query = {"id": entry_id}
    if tenant_id:
        query["tenant_id"] = tenant_id
    current_entry = await db.deployment_log.find_one(query, {"_id": 0})
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
            roster_query = {"name": personnel_name}
            if tenant_id:
                roster_query["tenant_id"] = tenant_id
            if personnel_name and incident_type == "TIFMAS":
                await db.deployment_roster.update_one(roster_query, {"$set": {"last_tifmas_deploy": new_start_date}})
            elif personnel_name and incident_type == "EMTF":
                await db.deployment_roster.update_one(roster_query, {"$set": {"last_emtf_deploy": new_start_date}})
    
    # Check if end_date changed
    if "end_date" in data:
        deployments_update["end_date"] = data["end_date"]
    
    # Update BC deployments (most recent matching entry)
    if deployments_update and personnel_name and incident_type in ["TIFMAS", "EMTF"]:
        deploy_query = {"personnel_name": personnel_name, "deployment_type": incident_type}
        if tenant_id:
            deploy_query["tenant_id"] = tenant_id
        most_recent = await db.deployments.find_one(deploy_query, sort=[("start_date", -1)])
        if most_recent:
            await db.deployments.update_one({"id": most_recent["id"]}, {"$set": deployments_update})
    
    result = await db.deployment_log.find_one_and_update(
        query,
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
    tenant_id = get_tenant_id(current_user)
    query = {"id": entry_id}
    if tenant_id:
        query["tenant_id"] = tenant_id
    result = await db.deployment_log.delete_one(query)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Deployment log entry not found")
    return {"message": "Deployment log entry deleted"}


@router.post("/deployment-log/import")
async def import_deployment_log(
    data: List[dict],
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF, UserRole.CAPTAIN, UserRole.LIEUTENANT]))
):
    """Import multiple deployment log entries"""
    tenant_id = get_tenant_id(current_user)
    # Clear existing log for this tenant
    del_query = {}
    if tenant_id:
        del_query["tenant_id"] = tenant_id
    await db.deployment_log.delete_many(del_query)
    
    entries = []
    for item in data:
        entry = DeploymentLog(**item)
        entry_doc = entry.model_dump()
        if tenant_id:
            entry_doc["tenant_id"] = tenant_id
        entries.append(entry_doc)
    
    if entries:
        await db.deployment_log.insert_many(entries)
    
    return {"message": f"Imported {len(entries)} log entries"}



# ===================== CERTIFICATION MANAGEMENT =====================

CERTIFICATION_TYPES = {
    "ff1": "Firefighter I",
    "ff2": "Firefighter II",
    "crew_boss": "Crew Boss",
    "engine_boss": "Engine Boss",
    "mist": "MIST",
    "wpu": "WPU",
    "astl": "ASTL",
    "medl": "MedL",
    "tech_spec": "Tech-Spec",
    "pack_test": "Pack Test",
    "ems": "EMS Certification",
    "hazmat_awareness": "HazMat Awareness",
    "hazmat_ops": "HazMat Operations",
    "rope_rescue": "Rope Rescue",
    "swift_water": "Swift Water Rescue",
    "driver_operator": "Driver/Operator"
}


@router.get("/certifications/expiring")
async def get_expiring_certifications(
    days: int = 90,
    current_user: dict = Depends(get_current_user)
):
    """Get all certifications expiring within the specified number of days"""
    tenant_id = get_tenant_id(current_user)
    query = {}
    if tenant_id:
        query["tenant_id"] = tenant_id
    
    roster = await db.deployment_roster.find(query, {"_id": 0}).to_list(1000)
    
    today = datetime.now(timezone.utc).date()
    alerts = []
    
    for person in roster:
        certifications = person.get("certifications", {})
        for cert_key, cert_data in certifications.items():
            if not isinstance(cert_data, dict):
                continue
            
            exp_date_str = cert_data.get("expiration_date")
            if not exp_date_str:
                continue
            
            try:
                exp_date = datetime.strptime(exp_date_str, "%Y-%m-%d").date()
                days_until = (exp_date - today).days
                
                if days_until <= days:
                    # Determine alert level
                    if days_until < 0:
                        alert_level = "expired"
                    elif days_until <= 30:
                        alert_level = "critical"
                    elif days_until <= 90:
                        alert_level = "warning"
                    else:
                        alert_level = "upcoming"
                    
                    alerts.append({
                        "id": f"{person['id']}_{cert_key}",
                        "personnel_id": person["id"],
                        "personnel_name": person["name"],
                        "rank": person.get("rank", ""),
                        "certification_type": cert_key,
                        "certification_name": CERTIFICATION_TYPES.get(cert_key, cert_key),
                        "expiration_date": exp_date_str,
                        "days_until_expiry": days_until,
                        "alert_level": alert_level
                    })
            except ValueError:
                continue
    
    # Sort by days until expiry (most urgent first)
    alerts.sort(key=lambda x: x["days_until_expiry"])
    
    return {
        "alerts": alerts,
        "summary": {
            "total": len(alerts),
            "expired": len([a for a in alerts if a["alert_level"] == "expired"]),
            "critical": len([a for a in alerts if a["alert_level"] == "critical"]),
            "warning": len([a for a in alerts if a["alert_level"] == "warning"]),
            "upcoming": len([a for a in alerts if a["alert_level"] == "upcoming"])
        }
    }


@router.put("/deployment-roster/{entry_id}/certifications")
async def update_certifications(
    entry_id: str,
    certifications: dict,
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF, UserRole.CAPTAIN, UserRole.LIEUTENANT]))
):
    """Update certification details for a roster entry"""
    tenant_id = get_tenant_id(current_user)
    query = {"id": entry_id}
    if tenant_id:
        query["tenant_id"] = tenant_id
    
    entry = await db.deployment_roster.find_one(query)
    if not entry:
        raise HTTPException(status_code=404, detail="Roster entry not found")
    
    # Merge with existing certifications
    existing_certs = entry.get("certifications", {})
    for cert_key, cert_data in certifications.items():
        if cert_key in existing_certs:
            existing_certs[cert_key].update(cert_data)
        else:
            existing_certs[cert_key] = cert_data
        
        # Also update legacy boolean flags for backwards compatibility
        if cert_key in ["ff1", "crew_boss", "engine_boss", "mist", "wpu", "astl", "medl", "tech_spec"]:
            await db.deployment_roster.update_one(
                query,
                {"$set": {cert_key: cert_data.get("certified", False)}}
            )
    
    await db.deployment_roster.update_one(
        query,
        {
            "$set": {
                "certifications": existing_certs,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {"message": "Certifications updated successfully"}


# ===================== ROTATION SCHEDULER =====================

def calculate_rotation_score(person: dict, deployment_type: str) -> float:
    """
    Calculate rotation score for fair deployment selection.
    Lower score = higher priority for next deployment.
    
    Factors:
    - Days since last deployment (more days = lower score)
    - Total deployments in last 12 months (fewer = lower score)
    - Declined count (more declines = higher score penalty)
    - Seniority (optional tiebreaker)
    """
    today = datetime.now(timezone.utc).date()
    
    # Get last deployment date based on type
    if deployment_type == "TIFMAS":
        last_deploy_str = person.get("last_tifmas_deploy", "")
    else:
        last_deploy_str = person.get("last_emtf_deploy", "")
    
    # Calculate days since last deployment
    if last_deploy_str:
        try:
            last_deploy = datetime.strptime(last_deploy_str, "%Y-%m-%d").date()
            days_since = (today - last_deploy).days
        except ValueError:
            days_since = 365  # Default if no valid date
    else:
        days_since = 365  # Never deployed = high priority
    
    # Get deployment count in last 12 months
    deployments_12mo = person.get("deployments_last_12mo", 0)
    
    # Get declined count
    declined = person.get("declined_count", 0)
    
    # Calculate score (lower is better for selection)
    # Base score from days since deployment (inverted - more days = lower score)
    score = -days_since
    
    # Add penalty for recent deployments
    score += deployments_12mo * 30
    
    # Add penalty for declines
    score += declined * 50
    
    return score


@router.get("/deployment-roster/next-rotation/{deployment_type}")
async def get_next_rotation(
    deployment_type: str,
    count: int = 10,
    current_user: dict = Depends(get_current_user)
):
    """Get suggested next personnel for deployment based on fair rotation"""
    if deployment_type.upper() not in ["TIFMAS", "EMTF"]:
        raise HTTPException(status_code=400, detail="deployment_type must be TIFMAS or EMTF")
    
    deployment_type = deployment_type.upper()
    tenant_id = get_tenant_id(current_user)
    
    # Get eligible roster
    if deployment_type == "TIFMAS":
        query = {"eligible_tifmas": True}
    else:
        query = {"eligible_emtf": True}
    
    if tenant_id:
        query["tenant_id"] = tenant_id
    
    roster = await db.deployment_roster.find(query, {"_id": 0}).to_list(1000)
    
    # Calculate rotation scores
    for person in roster:
        person["rotation_score"] = calculate_rotation_score(person, deployment_type)
    
    # Sort by rotation score (lowest first = highest priority)
    roster.sort(key=lambda x: x["rotation_score"])
    
    # Return top candidates
    suggestions = []
    for i, person in enumerate(roster[:count]):
        last_deploy = person.get(f"last_{deployment_type.lower()}_deploy", "")
        if last_deploy:
            try:
                last_date = datetime.strptime(last_deploy, "%Y-%m-%d").date()
                days_since = (datetime.now(timezone.utc).date() - last_date).days
            except ValueError:
                days_since = None
        else:
            days_since = None
        
        suggestions.append({
            "rank": i + 1,
            "id": person["id"],
            "name": person["name"],
            "person_rank": person.get("rank", ""),
            "ems_level": person.get("ems_level", ""),
            "last_deployment": last_deploy or "Never",
            "days_since_deployment": days_since,
            "deployments_12mo": person.get("deployments_last_12mo", 0),
            "declined_count": person.get("declined_count", 0),
            "rotation_score": round(person["rotation_score"], 2),
            "certifications": person.get("certifications", {})
        })
    
    return {
        "deployment_type": deployment_type,
        "suggestions": suggestions,
        "total_eligible": len(roster)
    }


@router.post("/deployment-roster/{entry_id}/decline")
async def record_deployment_decline(
    entry_id: str,
    deployment_type: str,
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF, UserRole.CAPTAIN, UserRole.LIEUTENANT]))
):
    """Record that a person declined a deployment offer"""
    tenant_id = get_tenant_id(current_user)
    query = {"id": entry_id}
    if tenant_id:
        query["tenant_id"] = tenant_id
    
    result = await db.deployment_roster.find_one_and_update(
        query,
        {
            "$inc": {"declined_count": 1},
            "$set": {
                "last_offered_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        },
        return_document=True
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Roster entry not found")
    
    return {"message": "Decline recorded", "declined_count": result.get("declined_count", 0)}


# ===================== DEPLOYMENT HISTORY =====================

@router.get("/deployment-history")
async def get_deployment_history(
    deployment_type: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    personnel_name: Optional[str] = None,
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """Get deployment history with filtering options"""
    tenant_id = get_tenant_id(current_user)
    query = {}
    
    if tenant_id:
        query["tenant_id"] = tenant_id
    
    if deployment_type:
        query["deployment_type"] = deployment_type.upper()
    
    if status:
        query["status"] = status
    
    if start_date:
        query["start_date"] = {"$gte": start_date}
    
    if end_date:
        if "start_date" in query:
            query["start_date"]["$lte"] = end_date
        else:
            query["start_date"] = {"$lte": end_date}
    
    if personnel_name:
        query["personnel.name"] = {"$regex": personnel_name, "$options": "i"}
    
    history = await db.deployment_history.find(
        query, 
        {"_id": 0}
    ).sort("start_date", -1).limit(limit).to_list(limit)
    
    return history


@router.post("/deployment-history")
async def create_deployment_history(
    data: dict,
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF, UserRole.CAPTAIN, UserRole.LIEUTENANT]))
):
    """Create a new deployment history entry"""
    tenant_id = get_tenant_id(current_user)
    
    history_entry = {
        "id": str(uuid.uuid4()),
        "deployment_type": data.get("deployment_type", "").upper(),
        "incident_name": data.get("incident_name", ""),
        "location": data.get("location", ""),
        "start_date": data.get("start_date", ""),
        "end_date": data.get("end_date", ""),
        "status": data.get("status", "active"),
        "personnel": data.get("personnel", []),
        "total_personnel": len(data.get("personnel", [])),
        "notes": data.get("notes", ""),
        "created_by": f"{current_user.get('first_name', '')} {current_user.get('last_name', '')}".strip(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if tenant_id:
        history_entry["tenant_id"] = tenant_id
    
    await db.deployment_history.insert_one(history_entry)
    
    # Update rotation stats for deployed personnel
    for person in data.get("personnel", []):
        person_query = {"id": person.get("id")}
        if tenant_id:
            person_query["tenant_id"] = tenant_id
        
        deploy_type = data.get("deployment_type", "").upper()
        update_fields = {
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()},
            "$inc": {"total_deployments": 1, "deployments_last_12mo": 1}
        }
        
        if deploy_type == "TIFMAS":
            update_fields["$set"]["last_tifmas_deploy"] = data.get("start_date", "")
        elif deploy_type == "EMTF":
            update_fields["$set"]["last_emtf_deploy"] = data.get("start_date", "")
        
        await db.deployment_roster.update_one(person_query, update_fields)
    
    return {"message": "Deployment history created", "id": history_entry["id"]}


@router.put("/deployment-history/{history_id}")
async def update_deployment_history(
    history_id: str,
    data: dict,
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF, UserRole.CAPTAIN, UserRole.LIEUTENANT]))
):
    """Update a deployment history entry"""
    tenant_id = get_tenant_id(current_user)
    query = {"id": history_id}
    if tenant_id:
        query["tenant_id"] = tenant_id
    
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    if data.get("status") == "completed" and not data.get("completed_at"):
        data["completed_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.deployment_history.find_one_and_update(
        query,
        {"$set": data},
        return_document=True
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Deployment history not found")
    
    result.pop("_id", None)
    return result


@router.get("/deployment-history/stats")
async def get_deployment_stats(
    year: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get deployment statistics"""
    tenant_id = get_tenant_id(current_user)
    
    if year is None:
        year = datetime.now().year
    
    query = {
        "start_date": {
            "$gte": f"{year}-01-01",
            "$lte": f"{year}-12-31"
        }
    }
    if tenant_id:
        query["tenant_id"] = tenant_id
    
    history = await db.deployment_history.find(query, {"_id": 0}).to_list(1000)
    
    # Calculate stats
    tifmas_count = len([h for h in history if h.get("deployment_type") == "TIFMAS"])
    emtf_count = len([h for h in history if h.get("deployment_type") == "EMTF"])
    
    total_personnel = sum(h.get("total_personnel", 0) for h in history)
    
    # Personnel deployment counts
    personnel_counts = {}
    for h in history:
        for p in h.get("personnel", []):
            name = p.get("name", "Unknown")
            if name not in personnel_counts:
                personnel_counts[name] = {"tifmas": 0, "emtf": 0, "total": 0}
            personnel_counts[name]["total"] += 1
            if h.get("deployment_type") == "TIFMAS":
                personnel_counts[name]["tifmas"] += 1
            elif h.get("deployment_type") == "EMTF":
                personnel_counts[name]["emtf"] += 1
    
    # Top deployers
    top_deployers = sorted(
        [{"name": k, **v} for k, v in personnel_counts.items()],
        key=lambda x: x["total"],
        reverse=True
    )[:10]
    
    return {
        "year": year,
        "total_deployments": len(history),
        "tifmas_deployments": tifmas_count,
        "emtf_deployments": emtf_count,
        "total_personnel_deployed": total_personnel,
        "unique_personnel": len(personnel_counts),
        "top_deployers": top_deployers,
        "by_status": {
            "active": len([h for h in history if h.get("status") == "active"]),
            "completed": len([h for h in history if h.get("status") == "completed"]),
            "cancelled": len([h for h in history if h.get("status") == "cancelled"])
        }
    }
