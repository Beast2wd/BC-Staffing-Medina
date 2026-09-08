"""
Voice Feedback Routes - Allows admins/personnel to submit voice feedback
for platform changes. Includes transcription via OpenAI Whisper.
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from typing import Optional, List
from datetime import datetime, timezone
from bson import ObjectId
import os
import base64
import asyncio
from dotenv import load_dotenv

load_dotenv()

from database import db
from routes.auth_routes import get_current_user

router = APIRouter(prefix="/voice-feedback", tags=["Voice Feedback"])

# Status options for feedback
FEEDBACK_STATUSES = ["new", "in_progress", "completed"]

async def transcribe_audio(audio_data: bytes, filename: str) -> str:
    """Transcribe audio using OpenAI Whisper via emergentintegrations"""
    try:
        from emergentintegrations.llm.openai import OpenAISpeechToText
        import tempfile
        
        api_key = os.getenv("EMERGENT_LLM_KEY")
        if not api_key:
            return "[Transcription unavailable - API key not configured]"
        
        stt = OpenAISpeechToText(api_key=api_key)
        
        # Write audio to temp file
        suffix = os.path.splitext(filename)[1] if filename else ".webm"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_file.write(audio_data)
            temp_path = temp_file.name
        
        try:
            with open(temp_path, "rb") as audio_file:
                response = await stt.transcribe(
                    file=audio_file,
                    model="whisper-1",
                    response_format="json",
                    language="en",
                    prompt="This is feedback about a fire department staffing application. The speaker may mention features, pages, or changes they want."
                )
            return response.text
        finally:
            # Clean up temp file
            if os.path.exists(temp_path):
                os.remove(temp_path)
                
    except Exception as e:
        print(f"Transcription error: {e}")
        return f"[Transcription failed: {str(e)}]"


@router.post("/submit")
async def submit_voice_feedback(
    audio: UploadFile = File(...),
    page_name: str = Form(...),
    page_url: str = Form(...),
    category: str = Form("other"),
    priority: str = Form("medium"),
    current_user: dict = Depends(get_current_user)
):
    """Submit voice feedback with audio recording"""
    # Using imported db directly
    
    # Get tenant_id from user
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Tenant context required")
    
    # Validate priority
    valid_priorities = ["low", "medium", "high", "urgent"]
    if priority not in valid_priorities:
        priority = "medium"
    
    # Read audio file
    audio_data = await audio.read()
    
    # Check file size (max 25MB for Whisper)
    if len(audio_data) > 25 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Audio file too large (max 25MB)")
    
    # Transcribe audio
    transcript = await transcribe_audio(audio_data, audio.filename)
    
    # Store audio as base64 (for simplicity - could use object storage for production)
    audio_base64 = base64.b64encode(audio_data).decode('utf-8')
    
    # Create feedback record
    feedback = {
        "tenant_id": tenant_id,
        "user_id": current_user.get("id"),
        "user_name": current_user.get("name", "Unknown"),
        "user_role": current_user.get("role", "unknown"),
        "page_name": page_name,
        "page_url": page_url,
        "category": category,
        "priority": priority,
        "audio_data": audio_base64,
        "audio_filename": audio.filename,
        "audio_content_type": audio.content_type,
        "transcript": transcript,
        "status": "new",
        "admin_notes": "",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    result = await db.voice_feedback.insert_one(feedback)
    
    return {
        "success": True,
        "message": "Feedback submitted successfully",
        "feedback_id": str(result.inserted_id),
        "transcript": transcript
    }


@router.get("/list")
async def list_voice_feedback(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    category: Optional[str] = None,
    page_name: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """List voice feedback - Super Admin sees all, Tenant Admin sees their tenant's"""
    # Using imported db directly
    
    # Build query based on user role
    query = {}
    
    if current_user.get("is_super_admin"):
        # Super admin sees all feedback
        pass
    else:
        # Tenant admin sees only their tenant's feedback
        tenant_id = current_user.get("tenant_id")
        if not tenant_id:
            raise HTTPException(status_code=400, detail="Tenant context required")
        query["tenant_id"] = tenant_id
        
        # Only admins can view feedback
        if current_user.get("role") not in ["admin", "deputy_chief", "battalion_chief"]:
            raise HTTPException(status_code=403, detail="Admin access required")
    
    # Apply filters
    if status and status in FEEDBACK_STATUSES:
        query["status"] = status
    if priority and priority in ["low", "medium", "high", "urgent"]:
        query["priority"] = priority
    if category and category in ["bug", "feature", "ui", "performance", "question", "other"]:
        query["category"] = category
    if page_name:
        query["page_name"] = {"$regex": page_name, "$options": "i"}
    
    # Fetch feedback, sorted by newest first
    cursor = db.voice_feedback.find(query).sort("created_at", -1)
    feedback_list = await cursor.to_list(length=100)
    
    # Get tenant names for super admin view
    tenant_names = {}
    if current_user.get("is_super_admin"):
        tenant_ids = list(set(f.get("tenant_id") for f in feedback_list if f.get("tenant_id")))
        tenants = await db.tenants.find({"subdomain": {"$in": tenant_ids}}).to_list(length=100)
        tenant_names = {t["subdomain"]: t.get("name", t["subdomain"]) for t in tenants}
    
    # Format response (exclude audio data for list view)
    result = []
    for f in feedback_list:
        result.append({
            "id": str(f["_id"]),
            "tenant_id": f.get("tenant_id"),
            "tenant_name": tenant_names.get(f.get("tenant_id"), f.get("tenant_id")),
            "user_name": f.get("user_name"),
            "user_role": f.get("user_role"),
            "page_name": f.get("page_name"),
            "page_url": f.get("page_url"),
            "category": f.get("category", "other"),
            "priority": f.get("priority", "medium"),
            "transcript": f.get("transcript"),
            "status": f.get("status"),
            "admin_notes": f.get("admin_notes", ""),
            "created_at": f.get("created_at"),
            "updated_at": f.get("updated_at")
        })
    
    return {"feedback": result}


@router.get("/{feedback_id}")
async def get_voice_feedback(
    feedback_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get single feedback with audio data"""
    # Using imported db directly
    
    try:
        feedback = await db.voice_feedback.find_one({"_id": ObjectId(feedback_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid feedback ID")
    
    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback not found")
    
    # Check access
    if not current_user.get("is_super_admin"):
        tenant_id = current_user.get("tenant_id")
        if feedback.get("tenant_id") != tenant_id:
            raise HTTPException(status_code=403, detail="Access denied")
        if current_user.get("role") not in ["admin", "deputy_chief", "battalion_chief"]:
            raise HTTPException(status_code=403, detail="Admin access required")
    
    return {
        "id": str(feedback["_id"]),
        "tenant_id": feedback.get("tenant_id"),
        "user_name": feedback.get("user_name"),
        "user_role": feedback.get("user_role"),
        "page_name": feedback.get("page_name"),
        "page_url": feedback.get("page_url"),
        "audio_data": feedback.get("audio_data"),
        "audio_content_type": feedback.get("audio_content_type", "audio/webm"),
        "transcript": feedback.get("transcript"),
        "status": feedback.get("status"),
        "admin_notes": feedback.get("admin_notes", ""),
        "created_at": feedback.get("created_at"),
        "updated_at": feedback.get("updated_at")
    }


@router.put("/{feedback_id}/status")
async def update_feedback_status(
    feedback_id: str,
    status: str,
    admin_notes: Optional[str] = None,
    priority: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Update feedback status, priority, and admin notes"""
    # Using imported db directly
    
    if status not in FEEDBACK_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {FEEDBACK_STATUSES}")
    
    # Validate priority if provided
    valid_priorities = ["low", "medium", "high", "urgent"]
    if priority and priority not in valid_priorities:
        raise HTTPException(status_code=400, detail=f"Invalid priority. Must be one of: {valid_priorities}")
    
    try:
        feedback = await db.voice_feedback.find_one({"_id": ObjectId(feedback_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid feedback ID")
    
    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback not found")
    
    # Check access
    if not current_user.get("is_super_admin"):
        tenant_id = current_user.get("tenant_id")
        if feedback.get("tenant_id") != tenant_id:
            raise HTTPException(status_code=403, detail="Access denied")
        if current_user.get("role") not in ["admin", "deputy_chief", "battalion_chief"]:
            raise HTTPException(status_code=403, detail="Admin access required")
    
    # Update feedback
    update_data = {
        "status": status,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    if admin_notes is not None:
        update_data["admin_notes"] = admin_notes
    if priority is not None:
        update_data["priority"] = priority
    
    await db.voice_feedback.update_one(
        {"_id": ObjectId(feedback_id)},
        {"$set": update_data}
    )
    
    return {"success": True, "message": "Feedback updated"}


@router.delete("/{feedback_id}")
async def delete_voice_feedback(
    feedback_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete voice feedback (Super Admin or Tenant Admin only)"""
    # Using imported db directly
    
    try:
        feedback = await db.voice_feedback.find_one({"_id": ObjectId(feedback_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid feedback ID")
    
    if not feedback:
        raise HTTPException(status_code=404, detail="Feedback not found")
    
    # Check access
    if not current_user.get("is_super_admin"):
        tenant_id = current_user.get("tenant_id")
        if feedback.get("tenant_id") != tenant_id:
            raise HTTPException(status_code=403, detail="Access denied")
        if current_user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
    
    await db.voice_feedback.delete_one({"_id": ObjectId(feedback_id)})
    
    return {"success": True, "message": "Feedback deleted"}


@router.get("/stats/summary")
async def get_feedback_stats(
    current_user: dict = Depends(get_current_user)
):
    """Get feedback statistics"""
    # Using imported db directly
    
    # Build query based on user role
    query = {}
    if not current_user.get("is_super_admin"):
        tenant_id = current_user.get("tenant_id")
        if not tenant_id:
            raise HTTPException(status_code=400, detail="Tenant context required")
        query["tenant_id"] = tenant_id
    
    # Get counts by status
    pipeline = [
        {"$match": query},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    
    results = await db.voice_feedback.aggregate(pipeline).to_list(length=10)
    
    stats = {
        "new": 0,
        "in_progress": 0,
        "completed": 0,
        "total": 0
    }
    
    for r in results:
        if r["_id"] in stats:
            stats[r["_id"]] = r["count"]
        stats["total"] += r["count"]
    
    return stats
