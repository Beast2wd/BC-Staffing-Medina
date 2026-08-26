"""
Reports routes - all report endpoints and exports (Multi-tenant enabled)
"""
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from typing import Optional
from datetime import datetime, timezone
import io
import os

from database import db
from models import UserRole
from auth import get_current_user, require_role, get_shift_for_date
from tenant_utils import get_tenant_id, add_tenant_to_query, add_tenant_to_doc

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/daily-summary")
async def get_daily_summary(
    date: str,
    battalion_id: str,
    current_user: dict = Depends(get_current_user)
):
    tenant_id = get_tenant_id(current_user)
    # Get all staffing records for the date
    staffing_query = {"date": date, "battalion_id": battalion_id}
    if tenant_id:
        staffing_query["tenant_id"] = tenant_id
    staffing = await db.staffing_records.find(staffing_query, {"_id": 0}).to_list(100)
    
    # Get all stations
    stations_query = {"battalion_id": battalion_id}
    if tenant_id:
        stations_query["tenant_id"] = tenant_id
    stations = await db.stations.find(stations_query, {"_id": 0}).to_list(100)
    
    # Get all personnel for name lookups
    personnel_query = {}
    if tenant_id:
        personnel_query["tenant_id"] = tenant_id
    personnel_list = await db.personnel.find(personnel_query, {"_id": 0}).to_list(1000)
    personnel_dict = {p["id"]: p for p in personnel_list}
    
    # Get apparatus assignments for the date
    app_query = {"date": date, "battalion_id": battalion_id}
    if tenant_id:
        app_query["tenant_id"] = tenant_id
    apparatus_assignments = await db.apparatus_assignments.find(app_query, {"_id": 0}).to_list(100)
    
    current_shift = get_shift_for_date(date)
    
    # Calculate totals
    total_minimum = sum(s.get("minimum_staffing", 0) for s in stations)
    total_assigned = sum(len(r.get("personnel_assigned", [])) for r in staffing)
    
    # Aggregate categories
    category_totals = {}
    for record in staffing:
        for cat, count in record.get("categories", {}).items():
            category_totals[cat] = category_totals.get(cat, 0) + count
    
    # Build station details with personnel names and apparatus assignments
    station_details = []
    for s in stations:
        staffing_record = next((r for r in staffing if r["station_id"] == s["id"]), None)
        assigned_ids = staffing_record.get("personnel_assigned", []) if staffing_record else []
        
        # Get personnel on duty for this station and shift
        personnel_on_duty = [
            {"id": p["id"], "name": p["name"], "rank": p["rank"], "payroll_number": p.get("payroll_number", "")}
            for p in personnel_list
            if p.get("station_id") == s["id"] and p.get("shift") == current_shift and p.get("is_active", True)
        ]
        
        # Get apparatus assignments for this station
        station_apparatus = []
        for aa in apparatus_assignments:
            if aa.get("station_id") == s["id"]:
                position_assignments = aa.get("position_assignments", {})
                personnel_with_positions = []
                for pid in aa.get("personnel_ids", []):
                    person = personnel_dict.get(pid, {})
                    position = position_assignments.get(pid, "-")
                    personnel_with_positions.append({
                        "id": pid,
                        "name": person.get("name", ""),
                        "rank": person.get("rank", ""),
                        "position": position
                    })
                # Sort by position
                personnel_with_positions.sort(key=lambda x: {'A': 1, 'B': 2, 'C': 3, 'D': 4}.get(x['position'], 5))
                
                station_apparatus.append({
                    "apparatus_name": aa.get("apparatus_name"),
                    "personnel": personnel_with_positions
                })
        
        station_details.append({
            "station_id": s["id"],
            "station_number": s["station_number"],
            "minimum_staffing": s.get("minimum_staffing", 0),
            "assigned": len(assigned_ids),
            "personnel_on_duty": personnel_on_duty,
            "apparatus_assignments": station_apparatus,
            "last_modified_by": staffing_record.get("last_modified_by") if staffing_record else None
        })
    
    return {
        "date": date,
        "battalion_id": battalion_id,
        "shift": current_shift,
        "total_stations": len(stations),
        "total_minimum_staffing": total_minimum,
        "total_personnel_assigned": total_assigned,
        "staffing_variance": total_assigned - total_minimum,
        "category_totals": category_totals,
        "station_details": station_details,
        "generated_by": current_user["payroll_number"],
        "generated_by_name": current_user.get("name", ""),
        "generated_at": datetime.now(timezone.utc).isoformat()
    }


@router.get("/overtime-summary")
async def get_overtime_summary(
    start_date: str,
    end_date: str,
    battalion_id: str,
    current_user: dict = Depends(get_current_user)
):
    tenant_id = get_tenant_id(current_user)
    # Get all overtime records
    overtime_query = {
        "battalion_id": battalion_id,
        "date": {"$gte": start_date, "$lte": end_date}
    }
    if tenant_id:
        overtime_query["tenant_id"] = tenant_id
    overtime_records = await db.overtime_records.find(overtime_query, {"_id": 0}).to_list(500)
    
    # Get personnel for name lookups
    personnel_query = {}
    if tenant_id:
        personnel_query["tenant_id"] = tenant_id
    personnel_list = await db.personnel.find(personnel_query, {"_id": 0}).to_list(1000)
    personnel_dict = {p["id"]: p for p in personnel_list}
    
    # Get stations for station name lookups
    stations_query = {}
    if tenant_id:
        stations_query["tenant_id"] = tenant_id
    stations_list = await db.stations.find(stations_query, {"_id": 0}).to_list(100)
    stations_dict = {s["id"]: s for s in stations_list}
    
    # Get staffing records to find who approved (last_modified_by)
    staffing_query = {"battalion_id": battalion_id}
    if tenant_id:
        staffing_query["tenant_id"] = tenant_id
    staffing_records = await db.staffing_records.find(
        staffing_query,
        {"_id": 0, "last_modified_by": 1, "station_id": 1}
    ).to_list(100)
    
    # Aggregate by personnel
    personnel_overtime = {}
    for record in overtime_records:
        pid = record.get("personnel_id")
        if pid not in personnel_overtime:
            person = personnel_dict.get(pid, {})
            personnel_overtime[pid] = {
                "_id": pid,
                "personnel_name": f"{person.get('rank', '')} {person.get('name', '')}".strip() or pid,
                "payroll_number": person.get("payroll_number", ""),
                "total_hours": 0,
                "count": 0,
                "work_history": []
            }
        
        # Add to totals (only for assigned records)
        if record.get("status") == "assigned":
            personnel_overtime[pid]["total_hours"] += record.get("hours", 0)
            personnel_overtime[pid]["count"] += 1
        
        # Get station name for this record
        station_id = record.get("station_id") or record.get("overtime_station_id")
        station = stations_dict.get(station_id, {})
        station_name = f"Station {station.get('station_number', '')}" if station.get('station_number') else station_id or "N/A"
        
        # Add work history entry
        work_entry = {
            "date": record.get("date"),
            "shift": record.get("shift"),
            "station": station_name,
            "hours": record.get("hours", 0),
            "status": record.get("status", "unknown")
        }
        personnel_overtime[pid]["work_history"].append(work_entry)
        
        # Track approvers (who changed status to assigned)
        if record.get("status") == "assigned":
            # Find the station's staffing record to get approver
            station_record = next((s for s in staffing_records if s.get("station_id") == record.get("station_id")), None)
            if station_record and station_record.get("last_modified_by"):
                approver_payroll = station_record.get("last_modified_by")
                approver = next((p for p in personnel_list if p.get("payroll_number") == approver_payroll), None)
                personnel_overtime[pid]["approved_by"] = approver_payroll
                personnel_overtime[pid]["approved_by_name"] = f"{approver.get('rank', '')} {approver.get('name', '')}".strip() if approver else approver_payroll
    
    # Sort work history by date for each personnel
    for pid in personnel_overtime:
        personnel_overtime[pid]["work_history"].sort(key=lambda x: x["date"], reverse=True)
    
    return {
        "start_date": start_date,
        "end_date": end_date,
        "battalion_id": battalion_id,
        "personnel_overtime": list(personnel_overtime.values()),
        "generated_by": current_user["payroll_number"],
        "generated_by_name": current_user.get("name", ""),
        "generated_at": datetime.now(timezone.utc).isoformat()
    }


@router.get("/volunteer-hours")
async def get_volunteer_hours_summary(
    start_date: str,
    end_date: str,
    battalion_id: str = "",
    current_user: dict = Depends(get_current_user)
):
    """Get volunteer hours summary report with monthly breakdown"""
    tenant_id = get_tenant_id(current_user)
    # Build query
    query = {
        "date": {"$gte": start_date, "$lte": end_date},
        "status": "assigned"  # Only count assigned shifts
    }
    if tenant_id:
        query["tenant_id"] = tenant_id
    if battalion_id:
        query["battalion_id"] = battalion_id
    
    # Get all volunteer records in date range
    volunteer_records = await db.volunteer_records.find(query, {"_id": 0}).to_list(1000)
    
    # Get volunteers for name lookups
    volunteers_query = {}
    if tenant_id:
        volunteers_query["tenant_id"] = tenant_id
    volunteers_list = await db.volunteers.find(volunteers_query, {"_id": 0}).to_list(500)
    volunteers_dict = {v["id"]: v for v in volunteers_list}
    
    # Also get regular personnel who might volunteer
    personnel_query = {}
    if tenant_id:
        personnel_query["tenant_id"] = tenant_id
    personnel_list = await db.personnel.find(personnel_query, {"_id": 0}).to_list(1000)
    personnel_dict = {p["id"]: p for p in personnel_list}
    
    # Get stations for name lookups
    stations_query = {}
    if tenant_id:
        stations_query["tenant_id"] = tenant_id
    stations_list = await db.stations.find(stations_query, {"_id": 0}).to_list(100)
    stations_dict = {s["id"]: s for s in stations_list}
    
    # Also get YTD records for year-to-date calculation
    current_year = datetime.now().year
    ytd_query = {
        "date": {"$gte": f"{current_year}-01-01", "$lte": end_date},
        "status": "assigned"
    }
    if tenant_id:
        ytd_query["tenant_id"] = tenant_id
    if battalion_id:
        ytd_query["battalion_id"] = battalion_id
    ytd_records = await db.volunteer_records.find(ytd_query, {"_id": 0}).to_list(2000)
    
    # Build YTD totals by volunteer
    ytd_by_volunteer = {}
    for record in ytd_records:
        vid = record.get("personnel_id")
        if vid not in ytd_by_volunteer:
            ytd_by_volunteer[vid] = 0
        ytd_by_volunteer[vid] += record.get("hours_worked", 0) or record.get("hours", 0)
    
    # Aggregate by volunteer with monthly breakdown
    volunteer_hours = {}
    for record in volunteer_records:
        vid = record.get("personnel_id")
        if vid not in volunteer_hours:
            # Try to get name from volunteers collection first, then personnel
            volunteer = volunteers_dict.get(vid, {})
            person = personnel_dict.get(vid, {})
            
            name = volunteer.get("name") or person.get("name") or "Unknown"
            if person.get("rank"):
                name = f"{person.get('rank')} {name}"
            
            volunteer_hours[vid] = {
                "volunteer_id": vid,
                "volunteer_name": name,
                "contact_phone": volunteer.get("contact_phone") or person.get("contact_phone", ""),
                "contact_email": volunteer.get("contact_email", ""),
                "total_hours_scheduled": 0,
                "total_hours_worked": 0,
                "ytd_hours": ytd_by_volunteer.get(vid, 0),
                "shifts_count": 0,
                "monthly_breakdown": {},
                "shifts": []
            }
        
        # Add hours - use hours_worked if available, otherwise scheduled hours
        scheduled_hours = record.get("hours", 0)
        worked_hours = record.get("hours_worked", 0) or scheduled_hours
        
        volunteer_hours[vid]["total_hours_scheduled"] += scheduled_hours
        volunteer_hours[vid]["total_hours_worked"] += worked_hours
        volunteer_hours[vid]["shifts_count"] += 1
        
        # Track monthly breakdown
        record_date = record.get("date", "")
        if record_date:
            month_key = record_date[:7]  # YYYY-MM format
            if month_key not in volunteer_hours[vid]["monthly_breakdown"]:
                volunteer_hours[vid]["monthly_breakdown"][month_key] = {
                    "hours_scheduled": 0,
                    "hours_worked": 0,
                    "shifts_count": 0
                }
            volunteer_hours[vid]["monthly_breakdown"][month_key]["hours_scheduled"] += scheduled_hours
            volunteer_hours[vid]["monthly_breakdown"][month_key]["hours_worked"] += worked_hours
            volunteer_hours[vid]["monthly_breakdown"][month_key]["shifts_count"] += 1
        
        # Track individual shifts
        station = stations_dict.get(record.get("assigned_station_id") or record.get("station_id"), {})
        volunteer_hours[vid]["shifts"].append({
            "date": record.get("date"),
            "shift": record.get("assigned_shift", ""),
            "station": f"Station {station.get('station_number', 'N/A')}",
            "hours_scheduled": scheduled_hours,
            "hours_worked": worked_hours,
            "check_in": record.get("check_in_time", ""),
            "check_out": record.get("check_out_time", "")
        })
    
    # Convert monthly_breakdown dict to sorted list for each volunteer
    for vid in volunteer_hours:
        monthly = volunteer_hours[vid]["monthly_breakdown"]
        volunteer_hours[vid]["monthly_breakdown"] = [
            {"month": k, **v} for k, v in sorted(monthly.items())
        ]
    
    # Sort volunteers by total hours worked (descending)
    sorted_volunteers = sorted(
        volunteer_hours.values(), 
        key=lambda x: x["total_hours_worked"], 
        reverse=True
    )
    
    # Calculate totals
    total_hours_scheduled = sum(v["total_hours_scheduled"] for v in sorted_volunteers)
    total_hours_worked = sum(v["total_hours_worked"] for v in sorted_volunteers)
    total_shifts = sum(v["shifts_count"] for v in sorted_volunteers)
    
    return {
        "start_date": start_date,
        "end_date": end_date,
        "battalion_id": battalion_id,
        "volunteer_count": len(sorted_volunteers),
        "total_shifts": total_shifts,
        "total_hours_scheduled": total_hours_scheduled,
        "total_hours_worked": total_hours_worked,
        "volunteer_hours": sorted_volunteers,
        "generated_by": current_user["payroll_number"],
        "generated_by_name": current_user.get("name", ""),
        "generated_at": datetime.now(timezone.utc).isoformat()
    }


@router.get("/deployment-summary")
async def get_deployment_summary(
    start_date: str,
    end_date: str,
    battalion_id: str = "",
    current_user: dict = Depends(get_current_user)
):
    """Get deployment summary report showing all deployments and personnel deployed"""
    tenant_id = get_tenant_id(current_user)
    
    # Build query for deployments within date range
    query = {
        "$or": [
            {"start_date": {"$lte": end_date}, "end_date": {"$gte": start_date}},
            {"start_date": {"$gte": start_date, "$lte": end_date}}
        ]
    }
    if tenant_id:
        query["tenant_id"] = tenant_id
    
    # Get all deployments in date range
    deployments = await db.deployments.find(query, {"_id": 0}).to_list(500)
    
    # Get deployment roster entries
    roster_query = {
        "deploy_date": {"$gte": start_date, "$lte": end_date}
    }
    if tenant_id:
        roster_query["tenant_id"] = tenant_id
    roster_entries = await db.deployment_roster.find(roster_query, {"_id": 0}).to_list(1000)
    
    # Get deployment log entries
    log_query = {
        "date": {"$gte": start_date, "$lte": end_date}
    }
    if tenant_id:
        log_query["tenant_id"] = tenant_id
    log_entries = await db.deployment_log.find(log_query, {"_id": 0}).to_list(1000)
    
    # Get personnel for name lookups
    personnel_query = {}
    if tenant_id:
        personnel_query["tenant_id"] = tenant_id
    personnel_list = await db.personnel.find(personnel_query, {"_id": 0}).to_list(1000)
    personnel_dict = {p["id"]: p for p in personnel_list}
    
    # Process deployments
    deployment_summary = []
    for deployment in deployments:
        dep_id = deployment.get("id", "")
        personnel_id = deployment.get("personnel_id", "")
        person = personnel_dict.get(personnel_id, {})
        
        deployment_summary.append({
            "id": dep_id,
            "deployment_type": deployment.get("deployment_type", ""),
            "personnel_id": personnel_id,
            "personnel_name": deployment.get("personnel_name") or f"{person.get('rank', '')} {person.get('name', '')}".strip(),
            "start_date": deployment.get("start_date", ""),
            "end_date": deployment.get("end_date", ""),
            "status": deployment.get("status", "active"),
            "notes": deployment.get("notes", ""),
            "created_at": deployment.get("created_at", "")
        })
    
    # Sort by start date (most recent first)
    deployment_summary.sort(key=lambda x: x["start_date"], reverse=True)
    
    # Calculate statistics
    tifmas_count = len([d for d in deployment_summary if "TIFMAS" in d.get("deployment_type", "").upper()])
    emtf_count = len([d for d in deployment_summary if "EMTF" in d.get("deployment_type", "").upper()])
    other_count = len(deployment_summary) - tifmas_count - emtf_count
    
    # Get unique personnel deployed
    unique_personnel = set(d["personnel_id"] for d in deployment_summary if d["personnel_id"])
    
    # Calculate total deployment days
    total_days = 0
    for dep in deployment_summary:
        if dep["start_date"] and dep["end_date"]:
            try:
                start = datetime.strptime(dep["start_date"], "%Y-%m-%d")
                end = datetime.strptime(dep["end_date"], "%Y-%m-%d")
                total_days += (end - start).days + 1
            except (ValueError, TypeError):
                pass
    
    return {
        "start_date": start_date,
        "end_date": end_date,
        "total_deployments": len(deployment_summary),
        "tifmas_deployments": tifmas_count,
        "emtf_deployments": emtf_count,
        "other_deployments": other_count,
        "unique_personnel_deployed": len(unique_personnel),
        "total_deployment_days": total_days,
        "deployments": deployment_summary,
        "roster_count": len(roster_entries),
        "log_count": len(log_entries),
        "generated_by": current_user["payroll_number"],
        "generated_by_name": current_user.get("name", ""),
        "generated_at": datetime.now(timezone.utc).isoformat()
    }


@router.get("/time-off-summary")
async def get_time_off_summary(
    year: int,
    battalion_id: str,
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF, UserRole.CAPTAIN]))
):
    """Get time off summary (sick, vacation, holiday) for a year"""
    tenant_id = get_tenant_id(current_user)
    
    # Get all personnel for the battalion
    personnel_query = {"battalion_id": battalion_id, "is_active": True}
    if tenant_id:
        personnel_query["tenant_id"] = tenant_id
    personnel_list = await db.personnel.find(personnel_query, {"_id": 0}).to_list(1000)
    personnel_dict = {p["id"]: p for p in personnel_list}
    
    # Get all leave records for the year
    start_date = f"{year}-01-01"
    end_date = f"{year}-12-31"
    
    leave_query = {
        "date": {"$gte": start_date, "$lte": end_date},
        "leave_type": {"$in": ["sick", "vacation", "holiday"]}
    }
    if tenant_id:
        leave_query["tenant_id"] = tenant_id
    leave_records = await db.leave_records.find(leave_query, {"_id": 0}).to_list(10000)
    
    # Also get from staffing_records for leave tracking
    staffing_query = {
        "date": {"$gte": start_date, "$lte": end_date},
        "battalion_id": battalion_id
    }
    if tenant_id:
        staffing_query["tenant_id"] = tenant_id
    staffing_leave_records = await db.staffing_records.find(staffing_query, {"_id": 0}).to_list(10000)
    
    # Initialize summary structure
    months = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"]
    month_names = ["January", "February", "March", "April", "May", "June", 
                   "July", "August", "September", "October", "November", "December"]
    
    summary = {
        "sick": {
            "ytd_total": 0,
            "monthly": {m: {"count": 0, "personnel": []} for m in months}
        },
        "vacation": {
            "ytd_total": 0,
            "monthly": {m: {"count": 0, "personnel": []} for m in months}
        },
        "holiday": {
            "ytd_total": 0,
            "monthly": {m: {"count": 0, "personnel": []} for m in months}
        }
    }
    
    # Track unique personnel per month for each leave type
    personnel_tracker = {
        "sick": {m: set() for m in months},
        "vacation": {m: set() for m in months},
        "holiday": {m: set() for m in months}
    }
    
    # Process leave records from leave_records collection
    for record in leave_records:
        leave_type = record.get("leave_type", "").lower()
        if leave_type not in summary:
            continue
            
        record_date = record.get("date", "")
        if not record_date:
            continue
            
        month = record_date[5:7]  # Extract MM from YYYY-MM-DD
        personnel_id = record.get("personnel_id")
        
        if personnel_id and personnel_id in personnel_dict:
            person = personnel_dict[personnel_id]
            person_name = f"{person.get('rank', '')} {person.get('name', '')}".strip()
            
            summary[leave_type]["ytd_total"] += 1
            summary[leave_type]["monthly"][month]["count"] += 1
            
            # Track unique personnel
            if personnel_id not in personnel_tracker[leave_type][month]:
                personnel_tracker[leave_type][month].add(personnel_id)
                summary[leave_type]["monthly"][month]["personnel"].append({
                    "id": personnel_id,
                    "name": person_name,
                    "date": record_date
                })
    
    # Also process staffing records for leave data
    for record in staffing_leave_records:
        record_date = record.get("date", "")
        if not record_date:
            continue
            
        month = record_date[5:7]
        
        # Check sick, vacation, holiday fields in staffing records
        for leave_type in ["sick", "vacation", "holiday"]:
            count = record.get(leave_type, 0)
            if count and count > 0:
                summary[leave_type]["ytd_total"] += count
                summary[leave_type]["monthly"][month]["count"] += count
    
    # Format monthly data for output
    formatted_summary = {
        "year": year,
        "battalion_id": battalion_id,
        "sick": {
            "ytd_total": summary["sick"]["ytd_total"],
            "monthly": [
                {
                    "month": month_names[int(m) - 1],
                    "month_num": m,
                    "count": summary["sick"]["monthly"][m]["count"],
                    "personnel": summary["sick"]["monthly"][m]["personnel"]
                }
                for m in months
            ]
        },
        "vacation": {
            "ytd_total": summary["vacation"]["ytd_total"],
            "monthly": [
                {
                    "month": month_names[int(m) - 1],
                    "month_num": m,
                    "count": summary["vacation"]["monthly"][m]["count"],
                    "personnel": summary["vacation"]["monthly"][m]["personnel"]
                }
                for m in months
            ]
        },
        "holiday": {
            "ytd_total": summary["holiday"]["ytd_total"],
            "monthly": [
                {
                    "month": month_names[int(m) - 1],
                    "month_num": m,
                    "count": summary["holiday"]["monthly"][m]["count"],
                    "personnel": summary["holiday"]["monthly"][m]["personnel"]
                }
                for m in months
            ]
        },
        "generated_by": current_user["payroll_number"],
        "generated_by_name": current_user.get("name", ""),
        "generated_at": datetime.now(timezone.utc).isoformat()
    }
    
    return formatted_summary


@router.get("/export/excel")
async def export_staffing_report_excel(
    date: str,
    battalion_id: str,
    report_type: str = "daily",
    end_date: Optional[str] = None,
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF, UserRole.CAPTAIN]))
):
    """Export staffing or overtime report to Excel"""
    from openpyxl import Workbook
    from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
    from openpyxl.drawing.image import Image as XLImage
    from openpyxl.cell.cell import MergedCell
    
    tenant_id = get_tenant_id(current_user)
    
    # Get data
    stations_query = {"battalion_id": battalion_id}
    if tenant_id:
        stations_query["tenant_id"] = tenant_id
    stations = await db.stations.find(stations_query, {"_id": 0}).to_list(100)
    stations_dict = {s["id"]: s for s in stations}
    
    personnel_query = {}
    if tenant_id:
        personnel_query["tenant_id"] = tenant_id
    personnel_list = await db.personnel.find(personnel_query, {"_id": 0}).to_list(1000)
    personnel_dict = {p["id"]: p for p in personnel_list}
    
    # Create workbook
    wb = Workbook()
    ws = wb.active
    
    # Add logo if exists
    logo_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'medina-logo.png')
    if os.path.exists(logo_path):
        try:
            from PIL import Image as PILImage
            # Resize logo for Excel
            pil_img = PILImage.open(logo_path)
            # Calculate new size maintaining aspect ratio
            max_height = 60
            aspect_ratio = pil_img.width / pil_img.height
            new_width = int(max_height * aspect_ratio)
            pil_img_resized = pil_img.resize((new_width, max_height), PILImage.Resampling.LANCZOS)
            
            # Save to temp buffer
            temp_logo = io.BytesIO()
            pil_img_resized.save(temp_logo, format='PNG')
            temp_logo.seek(0)
            
            img = XLImage(temp_logo)
            ws.add_image(img, 'A1')
            ws.row_dimensions[1].height = 50
        except Exception as e:
            print(f"Could not add logo to Excel: {e}")
    
    # Styles
    header_font = Font(bold=True, size=12, color="FFFFFF")
    header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
    header_alignment = Alignment(horizontal="center", vertical="center")
    thin_border = Border(
        left=Side(style='thin'), right=Side(style='thin'),
        top=Side(style='thin'), bottom=Side(style='thin')
    )
    
    if report_type == "daily":
        ws.title = f"Staffing {date}"
        
        staffing_query = {"date": date, "battalion_id": battalion_id}
        if tenant_id:
            staffing_query["tenant_id"] = tenant_id
        staffing_records = await db.staffing_records.find(staffing_query, {"_id": 0}).to_list(100)
        
        current_shift = get_shift_for_date(date)
        
        # Title (starts at row 3 to leave room for logo)
        ws.merge_cells('A3:F3')
        ws['A3'] = f"Daily Staffing Report - {date} ({current_shift} Shift)"
        ws['A3'].font = Font(bold=True, size=16)
        ws['A3'].alignment = Alignment(horizontal="center")
        
        # Generated by info
        ws.merge_cells('A4:F4')
        ws['A4'] = f"Generated by: {current_user.get('name', '')} (Payroll: {current_user['payroll_number']}) on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        ws['A4'].font = Font(italic=True, size=10)
        
        # Headers
        headers = ["Station", "Personnel On Duty", "Rank", "Payroll #", "Min Required", "Last Modified By"]
        for col, header in enumerate(headers, start=1):
            cell = ws.cell(row=6, column=col, value=header)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = header_alignment
            cell.border = thin_border
        
        # Data - personnel on duty
        row = 7
        for station in stations:
            station_personnel = [p for p in personnel_list if p.get("station_id") == station["id"] and p.get("shift") == current_shift and p.get("is_active", True)]
            staffing_record = next((r for r in staffing_records if r.get("station_id") == station["id"]), None)
            last_modified = staffing_record.get("last_modified_by", "-") if staffing_record else "-"
            
            if station_personnel:
                for i, person in enumerate(station_personnel):
                    ws.cell(row=row, column=1, value=f"Station {station['station_number']}" if i == 0 else "").border = thin_border
                    ws.cell(row=row, column=2, value=person["name"]).border = thin_border
                    ws.cell(row=row, column=3, value=person["rank"]).border = thin_border
                    ws.cell(row=row, column=4, value=person.get("payroll_number", "")).border = thin_border
                    ws.cell(row=row, column=5, value=station.get("minimum_staffing", 0) if i == 0 else "").border = thin_border
                    ws.cell(row=row, column=6, value=last_modified if i == 0 else "").border = thin_border
                    row += 1
            else:
                ws.cell(row=row, column=1, value=f"Station {station['station_number']}").border = thin_border
                ws.cell(row=row, column=2, value="No personnel on duty").border = thin_border
                ws.cell(row=row, column=3, value="-").border = thin_border
                ws.cell(row=row, column=4, value="-").border = thin_border
                ws.cell(row=row, column=5, value=station.get("minimum_staffing", 0)).border = thin_border
                ws.cell(row=row, column=6, value=last_modified).border = thin_border
                row += 1
        
        # Apparatus Assignments Sheet
        ws2 = wb.create_sheet(title="Apparatus Assignments")
        ws2.merge_cells('A1:E1')
        ws2['A1'] = f"Apparatus Assignments - {date} ({current_shift} Shift)"
        ws2['A1'].font = Font(bold=True, size=14)
        ws2['A1'].alignment = Alignment(horizontal="center")
        
        # Get apparatus assignments
        app_query_excel = {"date": date, "battalion_id": battalion_id}
        if tenant_id:
            app_query_excel["tenant_id"] = tenant_id
        apparatus_assignments = await db.apparatus_assignments.find(app_query_excel, {"_id": 0}).to_list(100)
        
        # Headers
        app_headers = ["Station", "Apparatus", "Position", "Personnel", "Rank"]
        for col, header in enumerate(app_headers, start=1):
            cell = ws2.cell(row=3, column=col, value=header)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = header_alignment
            cell.border = thin_border
        
        app_row = 4
        for station in stations:
            station_assignments = [a for a in apparatus_assignments if a.get("station_id") == station["id"]]
            
            for assignment in station_assignments:
                apparatus_name = assignment.get("apparatus_name", "")
                position_assignments = assignment.get("position_assignments", {})
                personnel_ids = assignment.get("personnel_ids", [])
                
                if personnel_ids:
                    # Sort by position
                    sorted_personnel = sorted(
                        [(pid, position_assignments.get(pid, "-")) for pid in personnel_ids],
                        key=lambda x: {'A': 1, 'B': 2, 'C': 3, 'D': 4}.get(x[1], 5)
                    )
                    
                    for i, (pid, position) in enumerate(sorted_personnel):
                        person = personnel_dict.get(pid, {})
                        ws2.cell(row=app_row, column=1, value=f"Station {station['station_number']}" if i == 0 else "").border = thin_border
                        ws2.cell(row=app_row, column=2, value=apparatus_name if i == 0 else "").border = thin_border
                        ws2.cell(row=app_row, column=3, value=position).border = thin_border
                        ws2.cell(row=app_row, column=4, value=person.get("name", "")).border = thin_border
                        ws2.cell(row=app_row, column=5, value=person.get("rank", "")).border = thin_border
                        app_row += 1
                else:
                    ws2.cell(row=app_row, column=1, value=f"Station {station['station_number']}").border = thin_border
                    ws2.cell(row=app_row, column=2, value=apparatus_name).border = thin_border
                    ws2.cell(row=app_row, column=3, value="-").border = thin_border
                    ws2.cell(row=app_row, column=4, value="Not assigned").border = thin_border
                    ws2.cell(row=app_row, column=5, value="-").border = thin_border
                    app_row += 1
        
        # Auto-fit columns for apparatus sheet
        for column in ws2.columns:
            max_length = 0
            column_letter = None
            for cell in column:
                if isinstance(cell, MergedCell):
                    continue
                if column_letter is None:
                    column_letter = cell.column_letter
                try:
                    if cell.value and len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                except (ValueError, TypeError, AttributeError):
                    pass
            if column_letter:
                ws2.column_dimensions[column_letter].width = min(max_length + 2, 50)
    else:
        # Overtime report
        ws.title = f"Overtime {date}"
        
        end = end_date or date
        overtime_query = {"battalion_id": battalion_id, "date": {"$gte": date, "$lte": end}, "status": "assigned"}
        if tenant_id:
            overtime_query["tenant_id"] = tenant_id
        overtime_records = await db.overtime_records.find(overtime_query, {"_id": 0}).to_list(500)
        
        # Title (starts at row 3 to leave room for logo)
        ws.merge_cells('A3:F3')
        ws['A3'] = f"Overtime Summary Report - {date} to {end}"
        ws['A3'].font = Font(bold=True, size=16)
        ws['A3'].alignment = Alignment(horizontal="center")
        
        # Generated by info
        ws.merge_cells('A4:F4')
        ws['A4'] = f"Generated by: {current_user.get('name', '')} (Payroll: {current_user['payroll_number']}) on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        ws['A4'].font = Font(italic=True, size=10)
        
        # Headers
        headers = ["Personnel", "Payroll #", "Date", "Hours", "Station", "Approved By"]
        for col, header in enumerate(headers, start=1):
            cell = ws.cell(row=6, column=col, value=header)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = header_alignment
            cell.border = thin_border
        
        # Data
        row = 7
        for record in overtime_records:
            person = personnel_dict.get(record.get("personnel_id"), {})
            station = stations_dict.get(record.get("station_id"), {})
            
            ws.cell(row=row, column=1, value=f"{person.get('rank', '')} {person.get('name', '')}").border = thin_border
            ws.cell(row=row, column=2, value=person.get("payroll_number", "")).border = thin_border
            ws.cell(row=row, column=3, value=record.get("date", "")).border = thin_border
            ws.cell(row=row, column=4, value=record.get("hours", 0)).border = thin_border
            ws.cell(row=row, column=5, value=f"Station {station.get('station_number', '')}").border = thin_border
            ws.cell(row=row, column=6, value=current_user.get("name", current_user["payroll_number"])).border = thin_border
            row += 1
    
    # Auto-fit columns (skip merged cells)
    for column in ws.columns:
        max_length = 0
        column_letter = None
        for cell in column:
            if isinstance(cell, MergedCell):
                continue
            if column_letter is None:
                column_letter = cell.column_letter
            try:
                if cell.value and len(str(cell.value)) > max_length:
                    max_length = len(str(cell.value))
            except (ValueError, TypeError, AttributeError):
                pass
        if column_letter:
            ws.column_dimensions[column_letter].width = min(max_length + 2, 50)
    
    # Save to buffer
    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    
    filename = f"{'staffing' if report_type == 'daily' else 'overtime'}_report_{date}.xlsx"
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/export/pdf")
async def export_staffing_report_pdf(
    date: str,
    battalion_id: str,
    report_type: str = "daily",
    end_date: Optional[str] = None,
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF, UserRole.CAPTAIN]))
):
    """Export staffing or overtime report to PDF"""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter, landscape
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image as RLImage
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    
    tenant_id = get_tenant_id(current_user)
    
    # Get data
    stations_query = {"battalion_id": battalion_id}
    if tenant_id:
        stations_query["tenant_id"] = tenant_id
    stations = await db.stations.find(stations_query, {"_id": 0}).to_list(100)
    stations_dict = {s["id"]: s for s in stations}
    
    personnel_query = {}
    if tenant_id:
        personnel_query["tenant_id"] = tenant_id
    personnel_list = await db.personnel.find(personnel_query, {"_id": 0}).to_list(1000)
    personnel_dict = {p["id"]: p for p in personnel_list}
    
    # Create PDF
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=landscape(letter))
    elements = []
    
    # Add logo if exists
    logo_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'medina-logo.png')
    if os.path.exists(logo_path):
        try:
            logo = RLImage(logo_path, width=1*inch, height=1*inch)
            elements.append(logo)
            elements.append(Spacer(1, 10))
        except Exception as e:
            print(f"Could not add logo to PDF: {e}")
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        spaceAfter=10
    )
    subtitle_style = ParagraphStyle(
        'Subtitle',
        parent=styles['Normal'],
        fontSize=10,
        textColor=colors.gray,
        spaceAfter=20
    )
    
    if report_type == "daily":
        current_shift = get_shift_for_date(date)
        
        # Title
        elements.append(Paragraph(f"Daily Staffing Report - {date} ({current_shift} Shift)", title_style))
        elements.append(Paragraph(
            f"Generated by: {current_user.get('name', '')} (Payroll: {current_user['payroll_number']}) on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            subtitle_style
        ))
        
        # Build personnel table data
        table_data = [["Station", "Personnel", "Rank", "Payroll #"]]
        
        for station in stations:
            station_personnel = [p for p in personnel_list if p.get("station_id") == station["id"] and p.get("shift") == current_shift and p.get("is_active", True)]
            
            if station_personnel:
                for i, person in enumerate(station_personnel):
                    table_data.append([
                        f"Station {station['station_number']}" if i == 0 else "",
                        person["name"],
                        person["rank"],
                        person.get("payroll_number", "")
                    ])
            else:
                table_data.append([
                    f"Station {station['station_number']}",
                    "No personnel on duty",
                    "-",
                    "-"
                ])
        
        # Add personnel table
        if len(table_data) > 1:
            personnel_table = Table(table_data, colWidths=[120, 150, 100, 80])
            personnel_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4472C4')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 11),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
                ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 1), (-1, -1), 9),
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F0F0F0')])
            ]))
            elements.append(personnel_table)
        
        # Add apparatus assignments section
        elements.append(Spacer(1, 20))
        app_style = ParagraphStyle(
            'ApparatusTitle',
            parent=styles['Heading2'],
            fontSize=14,
            spaceAfter=10
        )
        elements.append(Paragraph("Apparatus Assignments", app_style))
        
        # Get apparatus assignments
        app_query_pdf = {"date": date, "battalion_id": battalion_id}
        if tenant_id:
            app_query_pdf["tenant_id"] = tenant_id
        apparatus_assignments = await db.apparatus_assignments.find(app_query_pdf, {"_id": 0}).to_list(100)
        
        app_table_data = [["Station", "Apparatus", "Position", "Personnel", "Rank"]]
        
        for station in stations:
            station_assignments = [a for a in apparatus_assignments if a.get("station_id") == station["id"]]
            
            for assignment in station_assignments:
                apparatus_name = assignment.get("apparatus_name", "")
                position_assignments = assignment.get("position_assignments", {})
                personnel_ids = assignment.get("personnel_ids", [])
                
                if personnel_ids:
                    sorted_personnel = sorted(
                        [(pid, position_assignments.get(pid, "-")) for pid in personnel_ids],
                        key=lambda x: {'A': 1, 'B': 2, 'C': 3, 'D': 4}.get(x[1], 5)
                    )
                    
                    for i, (pid, position) in enumerate(sorted_personnel):
                        person = personnel_dict.get(pid, {})
                        app_table_data.append([
                            f"Station {station['station_number']}" if i == 0 else "",
                            apparatus_name if i == 0 else "",
                            position,
                            person.get("name", ""),
                            person.get("rank", "")
                        ])
                else:
                    app_table_data.append([
                        f"Station {station['station_number']}",
                        apparatus_name,
                        "-",
                        "Not assigned",
                        "-"
                    ])
        
        if len(app_table_data) > 1:
            app_table = Table(app_table_data, colWidths=[90, 90, 50, 130, 80])
            app_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2E7D32')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 10),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
                ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
                ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 1), (-1, -1), 8),
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#E8F5E9')])
            ]))
            elements.append(app_table)
    else:
        # Overtime report
        end = end_date or date
        overtime_query_pdf = {"battalion_id": battalion_id, "date": {"$gte": date, "$lte": end}, "status": "assigned"}
        if tenant_id:
            overtime_query_pdf["tenant_id"] = tenant_id
        overtime_records = await db.overtime_records.find(overtime_query_pdf, {"_id": 0}).to_list(500)
        
        elements.append(Paragraph(f"Overtime Summary Report - {date} to {end}", title_style))
        elements.append(Paragraph(
            f"Generated by: {current_user.get('name', '')} (Payroll: {current_user['payroll_number']}) on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            subtitle_style
        ))
        
        table_data = [["Personnel", "Payroll #", "Date", "Hours", "Station"]]
        
        for record in overtime_records:
            person = personnel_dict.get(record.get("personnel_id"), {})
            station = stations_dict.get(record.get("station_id"), {})
            table_data.append([
                f"{person.get('rank', '')} {person.get('name', '')}",
                person.get("payroll_number", ""),
                record.get("date", ""),
                str(record.get("hours", 0)),
                f"Station {station.get('station_number', '')}"
            ])
        
        # Add overtime table
        if len(table_data) > 1:
            table = Table(table_data, colWidths=[120, 150, 100, 80])
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4472C4')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 11),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
                ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 1), (-1, -1), 9),
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F0F0F0')])
            ]))
            elements.append(table)
        else:
            elements.append(Paragraph("No records found for this period.", styles['Normal']))
    
    # Build PDF
    doc.build(elements)
    buffer.seek(0)
    
    filename = f"{'staffing' if report_type == 'daily' else 'overtime'}_report_{date}.pdf"
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ===================== PART-TIME HOURS REPORT =====================

@router.get("/part-time-hours")
async def get_part_time_hours_summary(
    start_date: str,
    end_date: str,
    battalion_id: str = "",
    current_user: dict = Depends(get_current_user)
):
    """Get part-time employee hours summary report with monthly breakdown"""
    tenant_id = get_tenant_id(current_user)
    
    # Build query for assigned part-time availability records
    query = {
        "date": {"$gte": start_date, "$lte": end_date},
        "status": "assigned"  # Only count assigned shifts (scheduled = worked)
    }
    if tenant_id:
        query["tenant_id"] = tenant_id
    if battalion_id:
        query["battalion_id"] = battalion_id
    
    # Get all part-time availability records in date range
    pt_records = await db.part_time_availability.find(query, {"_id": 0}).to_list(2000)
    
    # Get part-time employees for name lookups
    pt_query = {}
    if tenant_id:
        pt_query["tenant_id"] = tenant_id
    pt_employees_list = await db.part_time_employees.find(pt_query, {"_id": 0}).to_list(500)
    pt_employees_dict = {e["id"]: e for e in pt_employees_list}
    
    # Get stations for name lookups
    stations_query = {}
    if tenant_id:
        stations_query["tenant_id"] = tenant_id
    stations_list = await db.stations.find(stations_query, {"_id": 0}).to_list(100)
    stations_dict = {s["id"]: s for s in stations_list}
    
    # Get YTD records for year-to-date calculation
    current_year = datetime.now().year
    ytd_query = {
        "date": {"$gte": f"{current_year}-01-01", "$lte": end_date},
        "status": "assigned"
    }
    if tenant_id:
        ytd_query["tenant_id"] = tenant_id
    if battalion_id:
        ytd_query["battalion_id"] = battalion_id
    ytd_records = await db.part_time_availability.find(ytd_query, {"_id": 0}).to_list(3000)
    
    # Build YTD totals by employee
    ytd_by_employee = {}
    for record in ytd_records:
        eid = record.get("employee_id")
        if eid not in ytd_by_employee:
            ytd_by_employee[eid] = 0
        ytd_by_employee[eid] += record.get("hours", 24)  # Default 24 hours per shift
    
    # Aggregate by employee with monthly breakdown
    employee_hours = {}
    for record in pt_records:
        eid = record.get("employee_id")
        if eid not in employee_hours:
            employee = pt_employees_dict.get(eid, {})
            
            employee_hours[eid] = {
                "employee_id": eid,
                "employee_name": employee.get("name") or record.get("employee_name", "Unknown"),
                "employee_number": employee.get("employee_number") or record.get("employee_number", ""),
                "rank": employee.get("rank", "Part-Time"),
                "contact_phone": employee.get("contact_phone", ""),
                "contact_email": employee.get("contact_email", ""),
                "total_hours": 0,
                "ytd_hours": ytd_by_employee.get(eid, 0),
                "shifts_count": 0,
                "monthly_breakdown": {},
                "shifts": []
            }
        
        # Add hours (scheduled = worked per user requirement)
        hours = record.get("hours", 24)
        employee_hours[eid]["total_hours"] += hours
        employee_hours[eid]["shifts_count"] += 1
        
        # Track monthly breakdown
        record_date = record.get("date", "")
        if record_date:
            month_key = record_date[:7]  # YYYY-MM format
            if month_key not in employee_hours[eid]["monthly_breakdown"]:
                employee_hours[eid]["monthly_breakdown"][month_key] = {
                    "hours": 0,
                    "shifts_count": 0
                }
            employee_hours[eid]["monthly_breakdown"][month_key]["hours"] += hours
            employee_hours[eid]["monthly_breakdown"][month_key]["shifts_count"] += 1
        
        # Track individual shifts
        station = stations_dict.get(record.get("assigned_station_id"), {})
        employee_hours[eid]["shifts"].append({
            "date": record.get("date"),
            "shift": record.get("shift", ""),
            "station": f"Station {station.get('station_number', 'N/A')}",
            "station_id": record.get("assigned_station_id", ""),
            "hours": hours,
            "approved_by": record.get("approved_by", "")
        })
    
    # Convert monthly_breakdown dict to sorted list for each employee
    for eid in employee_hours:
        monthly = employee_hours[eid]["monthly_breakdown"]
        employee_hours[eid]["monthly_breakdown"] = [
            {"month": k, **v} for k, v in sorted(monthly.items())
        ]
        # Sort shifts by date
        employee_hours[eid]["shifts"].sort(key=lambda x: x["date"], reverse=True)
    
    # Sort employees by total hours (descending)
    sorted_employees = sorted(
        employee_hours.values(),
        key=lambda x: x["total_hours"],
        reverse=True
    )
    
    # Calculate totals
    total_hours = sum(e["total_hours"] for e in sorted_employees)
    total_shifts = sum(e["shifts_count"] for e in sorted_employees)
    
    return {
        "start_date": start_date,
        "end_date": end_date,
        "battalion_id": battalion_id,
        "employee_count": len(sorted_employees),
        "total_shifts": total_shifts,
        "total_hours": total_hours,
        "employee_hours": sorted_employees,
        "generated_by": current_user["payroll_number"],
        "generated_by_name": current_user.get("name", ""),
        "generated_at": datetime.now(timezone.utc).isoformat()
    }


# ===================== INDIVIDUAL PERSONNEL REPORT =====================

@router.get("/personnel/{personnel_id}")
async def get_individual_personnel_report(
    personnel_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get comprehensive individual personnel report with all data"""
    tenant_id = get_tenant_id(current_user)
    
    # Default date range to current year if not specified
    if not start_date:
        start_date = f"{datetime.now().year}-01-01"
    if not end_date:
        end_date = datetime.now().strftime("%Y-%m-%d")
    
    # Get personnel record
    personnel_query = {"id": personnel_id}
    if tenant_id:
        personnel_query["tenant_id"] = tenant_id
    
    person = await db.personnel.find_one(personnel_query, {"_id": 0})
    if not person:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Personnel not found")
    
    # Get station info
    station_query = {"id": person.get("station_id")}
    if tenant_id:
        station_query["tenant_id"] = tenant_id
    station = await db.stations.find_one(station_query, {"_id": 0}) or {}
    
    # Get battalion info
    battalion_query = {"id": person.get("battalion_id")}
    if tenant_id:
        battalion_query["tenant_id"] = tenant_id
    battalion = await db.battalions.find_one(battalion_query, {"_id": 0}) or {}
    
    # Get all stations for apparatus lookup
    stations_query = {}
    if tenant_id:
        stations_query["tenant_id"] = tenant_id
    stations_list = await db.stations.find(stations_query, {"_id": 0}).to_list(100)
    stations_dict = {s["id"]: s for s in stations_list}
    
    # ===== APPARATUS/RIDING ASSIGNMENTS =====
    apparatus_query = {
        "date": {"$gte": start_date, "$lte": end_date},
        "personnel_ids": personnel_id
    }
    if tenant_id:
        apparatus_query["tenant_id"] = tenant_id
    
    apparatus_records = await db.apparatus_assignments.find(apparatus_query, {"_id": 0}).to_list(500)
    
    riding_assignments = []
    for aa in apparatus_records:
        position = aa.get("position_assignments", {}).get(personnel_id, "-")
        station = stations_dict.get(aa.get("station_id"), {})
        riding_assignments.append({
            "date": aa.get("date"),
            "apparatus_name": aa.get("apparatus_name"),
            "station": f"Station {station.get('station_number', 'N/A')}",
            "shift": aa.get("shift", ""),
            "riding_position": position
        })
    riding_assignments.sort(key=lambda x: x["date"], reverse=True)
    
    # ===== LEAVE RECORDS =====
    leave_query = {
        "personnel_id": personnel_id,
        "start_date": {"$gte": start_date, "$lte": end_date}
    }
    if tenant_id:
        leave_query["tenant_id"] = tenant_id
    
    leave_records = await db.leave_records.find(leave_query, {"_id": 0}).to_list(500)
    leave_records.sort(key=lambda x: x.get("start_date", ""), reverse=True)
    
    # Calculate leave usage
    vacation_hours = sum(r.get("hours", 24) for r in leave_records if r.get("leave_type") == "vacation")
    sick_hours = sum(r.get("hours", 24) for r in leave_records if r.get("leave_type") == "sick")
    holiday_hours = sum(r.get("hours", 24) for r in leave_records if r.get("leave_type") == "holiday")
    
    # ===== OVERTIME RECORDS =====
    overtime_query = {
        "personnel_id": personnel_id,
        "date": {"$gte": start_date, "$lte": end_date}
    }
    if tenant_id:
        overtime_query["tenant_id"] = tenant_id
    
    overtime_records = await db.overtime_records.find(overtime_query, {"_id": 0}).to_list(500)
    overtime_records.sort(key=lambda x: x.get("date", ""), reverse=True)
    
    # Calculate overtime totals
    ot_assigned = [r for r in overtime_records if r.get("status") == "assigned"]
    total_ot_hours = sum(r.get("hours", 0) for r in ot_assigned)
    
    # Enrich overtime records with station names
    for record in overtime_records:
        station_id = record.get("station_id") or record.get("overtime_station_id")
        station = stations_dict.get(station_id, {})
        record["station_name"] = f"Station {station.get('station_number', '')}" if station.get('station_number') else "N/A"
    
    # ===== DEPLOYMENT RECORDS =====
    deployment_query = {
        "personnel_id": personnel_id,
        "start_date": {"$gte": start_date, "$lte": end_date}
    }
    if tenant_id:
        deployment_query["tenant_id"] = tenant_id
    
    deployments = await db.deployments.find(deployment_query, {"_id": 0}).to_list(100)
    deployments.sort(key=lambda x: x.get("start_date", ""), reverse=True)
    
    # Calculate deployment days
    total_deployment_days = 0
    for dep in deployments:
        try:
            start = datetime.strptime(dep.get("start_date", ""), "%Y-%m-%d")
            end = datetime.strptime(dep.get("end_date", ""), "%Y-%m-%d")
            days = (end - start).days + 1
            total_deployment_days += days
            dep["days"] = days
        except (ValueError, TypeError):
            dep["days"] = 0
    
    # ===== CERTIFICATIONS FROM DEPLOYMENT ROSTER =====
    roster_query = {"name": person.get("name")}
    if tenant_id:
        roster_query["tenant_id"] = tenant_id
    
    roster_entry = await db.deployment_roster.find_one(roster_query, {"_id": 0})
    certifications = {}
    if roster_entry:
        certifications = roster_entry.get("certifications", {})
    
    # Also include basic certifications from personnel record
    personnel_certs = person.get("certifications", [])
    
    # ===== BUILD REPORT =====
    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "generated_by": current_user.get("name", ""),
        "generated_by_payroll": current_user["payroll_number"],
        "report_period": {
            "start_date": start_date,
            "end_date": end_date
        },
        "personnel": {
            "id": person.get("id"),
            "payroll_number": person.get("payroll_number"),
            "name": person.get("name"),
            "rank": person.get("rank"),
            "station": f"Station {station.get('station_number', 'N/A')}",
            "station_id": person.get("station_id"),
            "battalion": f"Battalion {battalion.get('battalion_number', 'N/A')}",
            "battalion_id": person.get("battalion_id"),
            "shift": person.get("shift"),
            "contact_phone": person.get("contact_phone", ""),
            "contact_email": person.get("contact_email", ""),
            "hire_date": person.get("hire_date", ""),
            "personnel_type": person.get("personnel_type", "operations"),
            "is_active": person.get("is_active", True)
        },
        "leave_balances": {
            "vacation": {
                "annual_allocation_hours": person.get("annual_vacation_hours", 360),
                "annual_allocation_days": person.get("annual_vacation_days", 15),
                "current_balance": person.get("vacation_current_balance", 0),
                "hours_used_period": vacation_hours
            },
            "sick": {
                "annual_allocation_hours": person.get("annual_sick_hours", 288),
                "annual_allocation_days": person.get("annual_sick_days", 12),
                "current_balance": person.get("sick_current_balance", 0),
                "hours_used_period": sick_hours
            },
            "holiday": {
                "annual_allocation_hours": person.get("annual_holiday_hours", 264),
                "annual_allocation_days": person.get("annual_holiday_days", 11),
                "current_balance": person.get("holiday_current_balance", 0),
                "hours_used_period": holiday_hours
            }
        },
        "leave_records": leave_records,
        "overtime": {
            "total_hours": total_ot_hours,
            "total_entries": len(ot_assigned),
            "records": overtime_records
        },
        "riding_assignments": riding_assignments,
        "riding_assignment_count": len(riding_assignments),
        "deployments": {
            "total_days": total_deployment_days,
            "records": deployments
        },
        "certifications": {
            "deployment_roster": certifications,
            "personnel_certs": personnel_certs
        }
    }
    
    return report


@router.get("/personnel-list")
async def get_personnel_list_for_reports(
    battalion_id: str = "",
    current_user: dict = Depends(get_current_user)
):
    """Get list of personnel for report selection dropdown"""
    tenant_id = get_tenant_id(current_user)
    
    query = {"is_active": True}
    if tenant_id:
        query["tenant_id"] = tenant_id
    if battalion_id:
        query["battalion_id"] = battalion_id
    
    personnel = await db.personnel.find(
        query, 
        {"_id": 0, "id": 1, "name": 1, "rank": 1, "payroll_number": 1, "station_id": 1, "shift": 1}
    ).to_list(1000)
    
    # Sort by rank hierarchy then name
    rank_order = {
        "Fire Chief": 1, "Asst. Chief": 2, "Deputy Chief": 3,
        "Battalion Chief": 4, "Captain": 5, "Lieutenant": 6,
        "Driver Operator": 7, "Paramedic": 8, "Firefighter": 9,
        "Part-Time Firefighter": 10, "Volunteer Firefighter": 11
    }
    
    personnel.sort(key=lambda x: (rank_order.get(x.get("rank", ""), 99), x.get("name", "").lower()))
    
    return personnel



# ===================== LEAVE ACCRUAL AUDIT REPORT =====================

@router.get("/leave-accrual-audit")
async def get_leave_accrual_audit(
    start_date: str,
    end_date: str,
    personnel_id: Optional[str] = None,
    leave_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Get leave accrual audit report showing balance changes, accrual history, and adjustments.
    - If personnel_id is provided: detailed report for single personnel
    - If personnel_id is None: summary report for all personnel
    """
    tenant_id = get_tenant_id(current_user)
    
    # Get personnel list
    personnel_query = {"is_active": True}
    if tenant_id:
        personnel_query["tenant_id"] = tenant_id
    if personnel_id:
        personnel_query["id"] = personnel_id
    
    personnel_list = await db.personnel.find(personnel_query, {"_id": 0}).to_list(1000)
    
    if personnel_id and not personnel_list:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Personnel not found")
    
    # Get stations for lookups
    stations_query = {}
    if tenant_id:
        stations_query["tenant_id"] = tenant_id
    stations_list = await db.stations.find(stations_query, {"_id": 0}).to_list(100)
    stations_dict = {s["id"]: s for s in stations_list}
    
    # Get leave records in date range
    leave_query = {
        "start_date": {"$gte": start_date, "$lte": end_date}
    }
    if tenant_id:
        leave_query["tenant_id"] = tenant_id
    if personnel_id:
        leave_query["personnel_id"] = personnel_id
    if leave_type:
        leave_query["leave_type"] = leave_type
    
    leave_records = await db.leave_records.find(leave_query, {"_id": 0}).to_list(5000)
    
    # Get accrual history if it exists
    accrual_query = {
        "date": {"$gte": start_date, "$lte": end_date}
    }
    if tenant_id:
        accrual_query["tenant_id"] = tenant_id
    if personnel_id:
        accrual_query["personnel_id"] = personnel_id
    
    accrual_history = await db.leave_accrual_history.find(accrual_query, {"_id": 0}).to_list(5000)
    
    # Get manual adjustments if they exist
    adjustment_query = {
        "date": {"$gte": start_date, "$lte": end_date}
    }
    if tenant_id:
        adjustment_query["tenant_id"] = tenant_id
    if personnel_id:
        adjustment_query["personnel_id"] = personnel_id
    
    manual_adjustments = await db.leave_balance_adjustments.find(adjustment_query, {"_id": 0}).to_list(5000)
    
    # Build audit report per personnel
    audit_data = {}
    
    for person in personnel_list:
        pid = person["id"]
        station = stations_dict.get(person.get("station_id"), {})
        
        audit_data[pid] = {
            "personnel_id": pid,
            "name": person.get("name", "Unknown"),
            "payroll_number": person.get("payroll_number", ""),
            "rank": person.get("rank", ""),
            "station": f"Station {station.get('station_number', 'N/A')}",
            "shift": person.get("shift", ""),
            "current_balances": {
                "vacation": person.get("vacation_current_balance", 0),
                "sick": person.get("sick_current_balance", 0),
                "holiday": person.get("holiday_current_balance", 0)
            },
            "annual_allocations": {
                "vacation": person.get("annual_vacation_hours", 360),
                "sick": person.get("annual_sick_hours", 288),
                "holiday": person.get("annual_holiday_hours", 264)
            },
            "leave_usage": {"vacation": 0, "sick": 0, "holiday": 0},
            "accruals": {"vacation": 0, "sick": 0, "holiday": 0},
            "adjustments": {"vacation": 0, "sick": 0, "holiday": 0},
            "transactions": []
        }
    
    # Process leave records (debits)
    for record in leave_records:
        pid = record.get("personnel_id")
        if pid not in audit_data:
            continue
        
        lt = record.get("leave_type", "")
        hours = record.get("hours", 24)
        
        if lt in ["vacation", "sick", "holiday"]:
            audit_data[pid]["leave_usage"][lt] += hours
            audit_data[pid]["transactions"].append({
                "date": record.get("start_date"),
                "type": "usage",
                "leave_type": lt,
                "hours": -hours,
                "description": f"{lt.capitalize()} leave used",
                "notes": record.get("notes", "")
            })
    
    # Process accrual history (credits)
    for record in accrual_history:
        pid = record.get("personnel_id")
        if pid not in audit_data:
            continue
        
        lt = record.get("leave_type", "")
        hours = record.get("hours", 0)
        
        if lt in ["vacation", "sick", "holiday"]:
            audit_data[pid]["accruals"][lt] += hours
            audit_data[pid]["transactions"].append({
                "date": record.get("date"),
                "type": "accrual",
                "leave_type": lt,
                "hours": hours,
                "description": f"{lt.capitalize()} accrual",
                "notes": record.get("notes", "")
            })
    
    # Process manual adjustments
    for record in manual_adjustments:
        pid = record.get("personnel_id")
        if pid not in audit_data:
            continue
        
        lt = record.get("leave_type", "")
        hours = record.get("hours", 0)
        
        if lt in ["vacation", "sick", "holiday"]:
            audit_data[pid]["adjustments"][lt] += hours
            audit_data[pid]["transactions"].append({
                "date": record.get("date"),
                "type": "adjustment",
                "leave_type": lt,
                "hours": hours,
                "description": f"Manual adjustment by {record.get('adjusted_by', 'Admin')}",
                "notes": record.get("reason", "")
            })
    
    # Sort transactions by date for each personnel
    for pid in audit_data:
        audit_data[pid]["transactions"].sort(key=lambda x: x["date"], reverse=True)
    
    # Calculate summary totals
    total_vacation_usage = sum(a["leave_usage"]["vacation"] for a in audit_data.values())
    total_sick_usage = sum(a["leave_usage"]["sick"] for a in audit_data.values())
    total_holiday_usage = sum(a["leave_usage"]["holiday"] for a in audit_data.values())
    
    total_vacation_accruals = sum(a["accruals"]["vacation"] for a in audit_data.values())
    total_sick_accruals = sum(a["accruals"]["sick"] for a in audit_data.values())
    total_holiday_accruals = sum(a["accruals"]["holiday"] for a in audit_data.values())
    
    total_vacation_adjustments = sum(a["adjustments"]["vacation"] for a in audit_data.values())
    total_sick_adjustments = sum(a["adjustments"]["sick"] for a in audit_data.values())
    total_holiday_adjustments = sum(a["adjustments"]["holiday"] for a in audit_data.values())
    
    # Sort personnel by name
    sorted_audit = sorted(audit_data.values(), key=lambda x: x["name"].lower())
    
    return {
        "start_date": start_date,
        "end_date": end_date,
        "personnel_id": personnel_id,
        "leave_type_filter": leave_type,
        "personnel_count": len(sorted_audit),
        "summary": {
            "total_usage": {
                "vacation": total_vacation_usage,
                "sick": total_sick_usage,
                "holiday": total_holiday_usage
            },
            "total_accruals": {
                "vacation": total_vacation_accruals,
                "sick": total_sick_accruals,
                "holiday": total_holiday_accruals
            },
            "total_adjustments": {
                "vacation": total_vacation_adjustments,
                "sick": total_sick_adjustments,
                "holiday": total_holiday_adjustments
            }
        },
        "audit_data": sorted_audit,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "generated_by": current_user.get("name", "")
    }


# ===================== SHIFT COVERAGE HEATMAP =====================

@router.get("/shift-coverage-heatmap")
async def get_shift_coverage_heatmap(
    start_date: str,
    end_date: str,
    view_mode: str = "monthly",
    battalion_id: str = "",
    current_user: dict = Depends(get_current_user)
):
    """
    Get overtime coverage heatmap data showing patterns by station and date.
    view_mode: 'monthly' or 'weekly'
    """
    tenant_id = get_tenant_id(current_user)
    
    # Get stations
    stations_query = {}
    if tenant_id:
        stations_query["tenant_id"] = tenant_id
    if battalion_id:
        stations_query["battalion_id"] = battalion_id
    
    stations = await db.stations.find(stations_query, {"_id": 0}).to_list(100)
    stations.sort(key=lambda x: x.get("station_number", 0))
    stations_dict = {s["id"]: s for s in stations}
    
    # Get overtime records in date range
    ot_query = {
        "date": {"$gte": start_date, "$lte": end_date}
    }
    if tenant_id:
        ot_query["tenant_id"] = tenant_id
    if battalion_id:
        ot_query["battalion_id"] = battalion_id
    
    overtime_records = await db.overtime_records.find(ot_query, {"_id": 0}).to_list(5000)
    
    # Build date list based on view mode
    from datetime import timedelta
    start = datetime.strptime(start_date, "%Y-%m-%d")
    end = datetime.strptime(end_date, "%Y-%m-%d")
    
    dates = []
    current = start
    while current <= end:
        dates.append(current.strftime("%Y-%m-%d"))
        current += timedelta(days=1)
    
    # Initialize heatmap data structure
    # station_id -> date -> {available, assigned, declined, total_hours}
    heatmap_data = {}
    
    for station in stations:
        sid = station["id"]
        heatmap_data[sid] = {
            "station_id": sid,
            "station_number": station.get("station_number", "N/A"),
            "station_name": f"Station {station.get('station_number', 'N/A')}",
            "dates": {}
        }
        for date in dates:
            heatmap_data[sid]["dates"][date] = {
                "available": 0,
                "assigned": 0,
                "declined": 0,
                "total_hours": 0,
                "records": []
            }
    
    # Aggregate overtime data
    for record in overtime_records:
        sid = record.get("station_id") or record.get("overtime_station_id")
        date = record.get("date")
        status = record.get("status", "available")
        hours = record.get("hours", 24)
        
        if sid and sid in heatmap_data and date in heatmap_data[sid]["dates"]:
            day_data = heatmap_data[sid]["dates"][date]
            
            if status == "available":
                day_data["available"] += 1
            elif status == "assigned":
                day_data["assigned"] += 1
                day_data["total_hours"] += hours
            elif status == "declined":
                day_data["declined"] += 1
            
            day_data["records"].append({
                "personnel_name": record.get("personnel_name", "Unknown"),
                "status": status,
                "hours": hours
            })
    
    # Calculate station summaries
    station_summaries = []
    for sid, station_data in heatmap_data.items():
        total_available = sum(d["available"] for d in station_data["dates"].values())
        total_assigned = sum(d["assigned"] for d in station_data["dates"].values())
        total_declined = sum(d["declined"] for d in station_data["dates"].values())
        total_hours = sum(d["total_hours"] for d in station_data["dates"].values())
        
        # Calculate coverage rate (assigned / (available + assigned + declined))
        total_records = total_available + total_assigned + total_declined
        coverage_rate = (total_assigned / total_records * 100) if total_records > 0 else 0
        
        station_summaries.append({
            "station_id": sid,
            "station_name": station_data["station_name"],
            "station_number": station_data["station_number"],
            "total_available": total_available,
            "total_assigned": total_assigned,
            "total_declined": total_declined,
            "total_hours": total_hours,
            "coverage_rate": round(coverage_rate, 1)
        })
    
    # Sort summaries by station number
    station_summaries.sort(key=lambda x: x.get("station_number", 0))
    
    # Calculate overall summary
    overall_available = sum(s["total_available"] for s in station_summaries)
    overall_assigned = sum(s["total_assigned"] for s in station_summaries)
    overall_declined = sum(s["total_declined"] for s in station_summaries)
    overall_hours = sum(s["total_hours"] for s in station_summaries)
    overall_total = overall_available + overall_assigned + overall_declined
    overall_coverage = (overall_assigned / overall_total * 100) if overall_total > 0 else 0
    
    # Build grid data for heatmap visualization
    grid_data = []
    for sid, station_data in heatmap_data.items():
        row = {
            "station_id": sid,
            "station_name": station_data["station_name"],
            "station_number": station_data["station_number"],
            "cells": []
        }
        for date in dates:
            day_data = station_data["dates"][date]
            # Calculate intensity (0-4 scale based on activity)
            activity = day_data["available"] + day_data["assigned"] + day_data["declined"]
            intensity = min(4, activity)  # Cap at 4 for visualization
            
            row["cells"].append({
                "date": date,
                "available": day_data["available"],
                "assigned": day_data["assigned"],
                "declined": day_data["declined"],
                "total_hours": day_data["total_hours"],
                "intensity": intensity,
                "records": day_data["records"]
            })
        grid_data.append(row)
    
    # Sort grid by station number
    grid_data.sort(key=lambda x: x.get("station_number", 0))
    
    return {
        "start_date": start_date,
        "end_date": end_date,
        "view_mode": view_mode,
        "battalion_id": battalion_id,
        "dates": dates,
        "station_count": len(stations),
        "overall_summary": {
            "total_available": overall_available,
            "total_assigned": overall_assigned,
            "total_declined": overall_declined,
            "total_hours": overall_hours,
            "coverage_rate": round(overall_coverage, 1)
        },
        "station_summaries": station_summaries,
        "grid_data": grid_data,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "generated_by": current_user.get("name", "")
    }

