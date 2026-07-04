"""
User Notifications routes - Personal notifications for users (Multi-tenant enabled)
"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from typing import List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel
import uuid

from database import db
from auth import get_current_user
from tenant_utils import get_tenant_id, add_tenant_to_query, add_tenant_to_doc

router = APIRouter(tags=["User Notifications"])


class NotificationCreate(BaseModel):
    user_id: str
    title: str
    message: str
    type: str  # 'info', 'overtime', 'assignment', 'personnel_update'
    link: Optional[str] = None
    link_label: Optional[str] = None
    metadata: Optional[dict] = None


class NotificationResponse(BaseModel):
    id: str
    user_id: str
    title: str
    message: str
    type: str
    link: Optional[str] = None
    link_label: Optional[str] = None
    metadata: Optional[dict] = None
    is_read: bool
    created_at: str


# ===================== NOTIFICATION ROUTES =====================

@router.get("/user-notifications", response_model=List[NotificationResponse])
async def get_user_notifications(
    limit: int = 50,
    unread_only: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """Get notifications for the current user"""
    tenant_id = get_tenant_id(current_user)
    query = {"user_id": current_user["id"]}
    if tenant_id:
        query["tenant_id"] = tenant_id
    if unread_only:
        query["is_read"] = False
    
    notifications = await db.user_notifications.find(
        query, 
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return notifications


@router.get("/user-notifications/unread-count")
async def get_unread_count(current_user: dict = Depends(get_current_user)):
    """Get count of unread notifications"""
    tenant_id = get_tenant_id(current_user)
    query = {"user_id": current_user["id"], "is_read": False}
    if tenant_id:
        query["tenant_id"] = tenant_id
    count = await db.user_notifications.count_documents(query)
    return {"count": count}


@router.put("/user-notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Mark a single notification as read"""
    tenant_id = get_tenant_id(current_user)
    query = {"id": notification_id, "user_id": current_user["id"]}
    if tenant_id:
        query["tenant_id"] = tenant_id
    result = await db.user_notifications.update_one(
        query,
        {"$set": {"is_read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"message": "Notification marked as read"}


@router.put("/user-notifications/read-all")
async def mark_all_notifications_read(current_user: dict = Depends(get_current_user)):
    """Mark all notifications as read for current user"""
    tenant_id = get_tenant_id(current_user)
    query = {"user_id": current_user["id"], "is_read": False}
    if tenant_id:
        query["tenant_id"] = tenant_id
    result = await db.user_notifications.update_many(
        query,
        {"$set": {"is_read": True, "read_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": f"Marked {result.modified_count} notifications as read"}


@router.delete("/user-notifications/{notification_id}")
async def delete_notification(
    notification_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a notification"""
    tenant_id = get_tenant_id(current_user)
    query = {"id": notification_id, "user_id": current_user["id"]}
    if tenant_id:
        query["tenant_id"] = tenant_id
    result = await db.user_notifications.delete_one(query)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"message": "Notification deleted"}


@router.delete("/user-notifications/clear-all")
async def clear_all_notifications(current_user: dict = Depends(get_current_user)):
    """Clear all notifications for current user"""
    tenant_id = get_tenant_id(current_user)
    query = {"user_id": current_user["id"]}
    if tenant_id:
        query["tenant_id"] = tenant_id
    result = await db.user_notifications.delete_many(query)
    return {"message": f"Deleted {result.deleted_count} notifications"}


# ===================== HELPER FUNCTION TO CREATE NOTIFICATIONS =====================

from websocket_manager import manager

async def create_notification(
    user_id: str,
    title: str,
    message: str,
    notification_type: str,
    link: str = None,
    link_label: str = None,
    metadata: dict = None,
    tenant_id: str = None
):
    """Helper function to create a notification for a user"""
    notification_id = str(uuid.uuid4())
    notification_doc = {
        "id": notification_id,
        "user_id": user_id,
        "title": title,
        "message": message,
        "type": notification_type,
        "link": link,
        "link_label": link_label,
        "metadata": metadata or {},
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    # Add tenant_id if provided
    if tenant_id:
        notification_doc["tenant_id"] = tenant_id
    
    await db.user_notifications.insert_one(notification_doc)
    
    # Broadcast via WebSocket for instant bell update
    try:
        await manager.send_user_notification(user_id, notification_doc)
    except Exception:
        pass  # Non-critical if WS fails
    
    return notification_id


async def create_notification_for_personnel(
    personnel_id: str,
    title: str,
    message: str,
    notification_type: str,
    link: str = None,
    link_label: str = None,
    metadata: dict = None,
    tenant_id: str = None
):
    """Create notification for a personnel member by finding their user account"""
    # Find user by personnel_id or by payroll_number
    query = {"id": personnel_id}
    if tenant_id:
        query["tenant_id"] = tenant_id
    personnel = await db.personnel.find_one(query, {"_id": 0})
    if not personnel:
        return None
    
    user_query = {"payroll_number": personnel.get("payroll_number")}
    if tenant_id:
        user_query["tenant_id"] = tenant_id
    user = await db.users.find_one(user_query, {"_id": 0})
    if not user:
        return None
    
    return await create_notification(
        user_id=user["id"],
        title=title,
        message=message,
        notification_type=notification_type,
        link=link,
        link_label=link_label,
        metadata=metadata,
        tenant_id=tenant_id
    )
