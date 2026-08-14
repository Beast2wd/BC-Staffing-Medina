"""
Personnel routes - Multi-tenant enabled
"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Request
from typing import List, Optional
import uuid

from database import db
from models import UserRole, PersonnelBase, PersonnelCreate, PersonnelUpdate
from auth import get_current_user, require_role, hash_password
from routes.user_notifications_routes import create_notification_for_personnel

router = APIRouter(prefix="/personnel", tags=["Personnel"])

# Default password for new personnel - they must change on first login
DEFAULT_PASSWORD = "changeme123"


@router.get("", response_model=List[PersonnelBase])
async def get_personnel(
    battalion_id: Optional[str] = None,
    station_id: Optional[str] = None,
    shift: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    tenant_id = current_user.get("_tenant_id") or current_user.get("tenant_id")
    query = {"is_active": True}
    
    # Add tenant filtering (skip for super admin without tenant context)
    if tenant_id:
        query["tenant_id"] = tenant_id
    
    if battalion_id:
        query["battalion_id"] = battalion_id
    if station_id:
        query["station_id"] = station_id
    if shift:
        query["shift"] = shift
    
    personnel = await db.personnel.find(query, {"_id": 0}).to_list(1000)
    return personnel


@router.get("/{personnel_id}", response_model=PersonnelBase)
async def get_personnel_by_id(personnel_id: str, current_user: dict = Depends(get_current_user)):
    tenant_id = current_user.get("_tenant_id") or current_user.get("tenant_id")
    query = {"id": personnel_id}
    if tenant_id:
        query["tenant_id"] = tenant_id
    
    person = await db.personnel.find_one(query, {"_id": 0})
    if not person:
        raise HTTPException(status_code=404, detail="Personnel not found")
    return person


@router.post("", response_model=PersonnelBase)
async def create_personnel(
    data: PersonnelCreate,
    current_user: dict = Depends(require_role([UserRole.ADMIN]))
):
    tenant_id = current_user.get("_tenant_id") or current_user.get("tenant_id")
    
    # Check for existing payroll number within the same tenant
    existing_query = {"payroll_number": data.payroll_number}
    if tenant_id:
        existing_query["tenant_id"] = tenant_id
    
    existing = await db.personnel.find_one(existing_query)
    if existing:
        raise HTTPException(status_code=400, detail="Payroll number already exists")
    
    person_id = str(uuid.uuid4())
    person_doc = {
        "id": person_id,
        "tenant_id": tenant_id,  # Add tenant_id to new record
        **data.model_dump(),
        "is_active": True,
        "overtime_hours_worked": 0.0
    }
    
    await db.personnel.insert_one(person_doc)
    
    # Automatically create a user account for this personnel
    existing_user_query = {"payroll_number": data.payroll_number}
    if tenant_id:
        existing_user_query["tenant_id"] = tenant_id
    
    existing_user = await db.users.find_one(existing_user_query)
    if not existing_user:
        user_id = str(uuid.uuid4())
        
        # Determine role based on rank
        rank_to_role = {
            "Fire Chief": UserRole.ADMIN,
            "Asst. Chief": UserRole.ADMIN,
            "Deputy Chief": UserRole.BATTALION_CHIEF,
            "Battalion Chief": UserRole.BATTALION_CHIEF,
            "Captain": UserRole.CAPTAIN,
            "Lieutenant": UserRole.LIEUTENANT,
            "Volunteer Firefighter": UserRole.VOLUNTEER,
        }
        role = rank_to_role.get(data.rank, UserRole.FIREFIGHTER)
        
        from datetime import datetime, timezone
        user_doc = {
            "id": user_id,
            "tenant_id": tenant_id,  # Add tenant_id to new user
            "payroll_number": data.payroll_number,
            "password_hash": hash_password(DEFAULT_PASSWORD),
            "name": data.name,
            "rank": data.rank,
            "role": role,
            "station_id": data.station_id,
            "shift": data.shift,
            "is_active": True,
            "must_change_password": True,
            "email": data.contact_email,
            "phone_number": data.contact_phone,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.users.insert_one(user_doc)
    
    return PersonnelBase(**person_doc)


@router.put("/{personnel_id}", response_model=PersonnelBase)
async def update_personnel(
    personnel_id: str,
    data: PersonnelUpdate,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_role([UserRole.ADMIN]))
):
    tenant_id = current_user.get("_tenant_id") or current_user.get("tenant_id")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    # Get current personnel with tenant filter
    query = {"id": personnel_id}
    if tenant_id:
        query["tenant_id"] = tenant_id
    
    current_personnel = await db.personnel.find_one(query, {"_id": 0})
    if not current_personnel:
        raise HTTPException(status_code=404, detail="Personnel not found")
    
    result = await db.personnel.find_one_and_update(
        query,
        {"$set": update_data},
        return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="Personnel not found")
    
    # Sync relevant changes to the users collection
    user_update_fields = {}
    if "name" in update_data:
        user_update_fields["name"] = update_data["name"]
    if "rank" in update_data:
        user_update_fields["rank"] = update_data["rank"]
    if "station_id" in update_data:
        user_update_fields["station_id"] = update_data["station_id"]
    if "shift" in update_data:
        user_update_fields["shift"] = update_data["shift"]
    if "is_active" in update_data:
        user_update_fields["is_active"] = update_data["is_active"]
    if "payroll_number" in update_data:
        user_update_fields["payroll_number"] = update_data["payroll_number"]
    
    if user_update_fields:
        # Update user by the old payroll_number within the same tenant
        user_query = {"payroll_number": current_personnel["payroll_number"]}
        if tenant_id:
            user_query["tenant_id"] = tenant_id
        await db.users.update_one(user_query, {"$set": user_update_fields})
    
    # Create notification for the personnel about their profile update
    changes = []
    if "station_id" in update_data and update_data["station_id"] != current_personnel.get("station_id"):
        station_query = {"id": update_data["station_id"]}
        if tenant_id:
            station_query["tenant_id"] = tenant_id
        station = await db.stations.find_one(station_query, {"_id": 0})
        station_name = f"Station {station.get('station_number')}" if station else "New Station"
        changes.append(f"Station: {station_name}")
    if "shift" in update_data and update_data["shift"] != current_personnel.get("shift"):
        changes.append(f"Shift: {update_data['shift']}")
    if "rank" in update_data and update_data["rank"] != current_personnel.get("rank"):
        changes.append(f"Rank: {update_data['rank']}")
    
    if changes:
        background_tasks.add_task(
            create_notification_for_personnel,
            personnel_id,
            "Profile Updated",
            f"Your profile was updated by {current_user.get('name')}: {', '.join(changes)}",
            "personnel_update",
            "/on-duty",
            "View On Duty",
            {"updated_by": current_user.get("name"), "changes": changes}
        )
    
    del result["_id"]
    return PersonnelBase(**result)


@router.delete("/{personnel_id}")
async def delete_personnel(
    personnel_id: str,
    current_user: dict = Depends(require_role([UserRole.ADMIN]))
):
    tenant_id = current_user.get("_tenant_id") or current_user.get("tenant_id")
    
    # Get personnel with tenant filter
    query = {"id": personnel_id}
    if tenant_id:
        query["tenant_id"] = tenant_id
    
    personnel = await db.personnel.find_one(query, {"_id": 0})
    if not personnel:
        raise HTTPException(status_code=404, detail="Personnel not found")
    
    result = await db.personnel.update_one(query, {"$set": {"is_active": False}})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Personnel not found")
    
    # Also deactivate the corresponding user account within the same tenant
    user_query = {"payroll_number": personnel["payroll_number"]}
    if tenant_id:
        user_query["tenant_id"] = tenant_id
    await db.users.update_one(user_query, {"$set": {"is_active": False}})
    
    return {"message": "Personnel deactivated"}


@router.get("/import/template")
async def get_import_template(current_user: dict = Depends(get_current_user)):
    """Download a CSV template with example data for personnel import"""
    from fastapi.responses import Response
    
    # CSV template with headers and example data
    csv_content = """payroll_number,first_name,last_name,rank,shift,station_id,email,phone,certifications,hire_date
100001,John,Smith,Captain,A,station_1,john.smith@fire.gov,555-123-4567,"EMT-P,Firefighter II,Hazmat Ops",2015-06-15
100002,Jane,Doe,Lieutenant,B,station_2,jane.doe@fire.gov,555-234-5678,"EMT-B,Firefighter I",2018-03-20
100003,Mike,Johnson,Firefighter,C,station_1,mike.j@fire.gov,555-345-6789,"EMT-P,Firefighter II,Rescue Tech",2020-01-10
100004,Sarah,Williams,Driver Operator,A,station_3,sarah.w@fire.gov,555-456-7890,"EMT-B,Firefighter II",2017-09-01
"""
    
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=personnel_import_template.csv"}
    )


@router.post("/import")
async def import_personnel(
    current_user: dict = Depends(require_role([UserRole.ADMIN]))
):
    """
    Import personnel from CSV data.
    Expects JSON body with 'csv_data' field containing the CSV content.
    Updates existing personnel (by payroll_number) or creates new ones.
    """
    from fastapi import Request
    import csv
    import io
    from datetime import datetime, timezone
    
    # This will be called with JSON body containing csv_data
    return {"error": "Use /import/process endpoint with file upload"}


@router.post("/import/process")
async def process_personnel_import(
    request: Request,
    current_user: dict = Depends(require_role([UserRole.ADMIN]))
):
    """
    Process personnel CSV import.
    Accepts JSON with csv_data field containing CSV content as string.
    Updates existing personnel (by payroll_number) or creates new ones.
    """
    import csv
    import io
    from datetime import datetime, timezone
    
    tenant_id = current_user.get("_tenant_id") or current_user.get("tenant_id")
    
    try:
        body = await request.json()
        csv_data = body.get("csv_data", "")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid request body: {str(e)}")
    
    if not csv_data:
        raise HTTPException(status_code=400, detail="No CSV data provided")
    
    # Parse CSV
    csv_file = io.StringIO(csv_data)
    reader = csv.DictReader(csv_file)
    
    results = {
        "created": 0,
        "updated": 0,
        "errors": [],
        "processed": []
    }
    
    # Get existing stations for validation
    station_query = {}
    if tenant_id:
        station_query["tenant_id"] = tenant_id
    existing_stations = await db.stations.find(station_query, {"_id": 0}).to_list(100)
    station_ids = {s["id"] for s in existing_stations}
    station_numbers = {s.get("station_number"): s["id"] for s in existing_stations}
    
    # Get battalion from first station (or use default)
    default_battalion_id = existing_stations[0]["battalion_id"] if existing_stations else "battalion_1"
    
    row_num = 1
    for row in reader:
        row_num += 1
        try:
            # Extract and validate fields
            payroll_number = str(row.get("payroll_number", "")).strip()
            if not payroll_number:
                results["errors"].append(f"Row {row_num}: Missing payroll number")
                continue
            
            first_name = row.get("first_name", "").strip()
            last_name = row.get("last_name", "").strip()
            name = f"{first_name} {last_name}".strip()
            if not name:
                results["errors"].append(f"Row {row_num}: Missing name")
                continue
            
            rank = row.get("rank", "Firefighter").strip() or "Firefighter"
            shift = row.get("shift", "A").strip().upper()
            if shift not in ["A", "B", "C"]:
                shift = "A"
            
            # Handle station_id - can be ID or station number
            station_input = row.get("station_id", "").strip()
            station_id = None
            if station_input:
                if station_input in station_ids:
                    station_id = station_input
                elif station_input in station_numbers:
                    station_id = station_numbers[station_input]
                elif station_input.isdigit() and station_input in station_numbers:
                    station_id = station_numbers[station_input]
                else:
                    # Try to find by partial match
                    for sn, sid in station_numbers.items():
                        if str(sn) == station_input or f"station_{station_input}" == sid:
                            station_id = sid
                            break
            
            if not station_id and existing_stations:
                station_id = existing_stations[0]["id"]
            elif not station_id:
                station_id = "station_1"
            
            email = row.get("email", "").strip() or None
            phone = row.get("phone", "").strip() or None
            
            # Parse certifications (comma-separated)
            certs_str = row.get("certifications", "").strip()
            certifications = [c.strip() for c in certs_str.split(",") if c.strip()] if certs_str else []
            
            hire_date = row.get("hire_date", "").strip() or None
            
            # Check if personnel exists
            existing_query = {"payroll_number": payroll_number}
            if tenant_id:
                existing_query["tenant_id"] = tenant_id
            
            existing = await db.personnel.find_one(existing_query)
            
            if existing:
                # Update existing personnel
                update_data = {
                    "name": name,
                    "rank": rank,
                    "shift": shift,
                    "station_id": station_id,
                    "contact_email": email,
                    "contact_phone": phone,
                    "certifications": certifications,
                }
                if hire_date:
                    update_data["hire_date"] = hire_date
                
                await db.personnel.update_one(
                    {"id": existing["id"]},
                    {"$set": update_data}
                )
                
                # Also update corresponding user
                user_query = {"payroll_number": payroll_number}
                if tenant_id:
                    user_query["tenant_id"] = tenant_id
                await db.users.update_one(
                    user_query,
                    {"$set": {
                        "name": name,
                        "rank": rank,
                        "shift": shift,
                        "station_id": station_id,
                        "email": email,
                        "phone_number": phone
                    }}
                )
                
                results["updated"] += 1
                results["processed"].append({
                    "payroll_number": payroll_number,
                    "name": name,
                    "action": "updated"
                })
            else:
                # Create new personnel
                person_id = str(uuid.uuid4())
                person_doc = {
                    "id": person_id,
                    "tenant_id": tenant_id,
                    "payroll_number": payroll_number,
                    "name": name,
                    "rank": rank,
                    "station_id": station_id,
                    "shift": shift,
                    "battalion_id": default_battalion_id,
                    "certifications": certifications,
                    "contact_email": email,
                    "contact_phone": phone,
                    "is_active": True,
                    "overtime_hours_worked": 0.0
                }
                if hire_date:
                    person_doc["hire_date"] = hire_date
                
                await db.personnel.insert_one(person_doc)
                
                # Create user account
                rank_to_role = {
                    "Fire Chief": UserRole.ADMIN,
                    "Asst. Chief": UserRole.ADMIN,
                    "Deputy Chief": UserRole.BATTALION_CHIEF,
                    "Battalion Chief": UserRole.BATTALION_CHIEF,
                    "Captain": UserRole.CAPTAIN,
                    "Lieutenant": UserRole.LIEUTENANT,
                    "Volunteer Firefighter": UserRole.VOLUNTEER,
                }
                role = rank_to_role.get(rank, UserRole.FIREFIGHTER)
                
                user_id = str(uuid.uuid4())
                user_doc = {
                    "id": user_id,
                    "tenant_id": tenant_id,
                    "payroll_number": payroll_number,
                    "password_hash": hash_password(DEFAULT_PASSWORD),
                    "name": name,
                    "rank": rank,
                    "role": role,
                    "station_id": station_id,
                    "shift": shift,
                    "is_active": True,
                    "must_change_password": True,
                    "email": email,
                    "phone_number": phone,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.users.insert_one(user_doc)
                
                results["created"] += 1
                results["processed"].append({
                    "payroll_number": payroll_number,
                    "name": name,
                    "action": "created"
                })
                
        except Exception as e:
            results["errors"].append(f"Row {row_num}: {str(e)}")
    
    return {
        "success": True,
        "message": f"Import complete: {results['created']} created, {results['updated']} updated, {len(results['errors'])} errors",
        "created": results["created"],
        "updated": results["updated"],
        "errors": results["errors"],
        "processed": results["processed"]
    }
