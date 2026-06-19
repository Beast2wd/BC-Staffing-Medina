"""
WebSocket routes for real-time updates
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from typing import Optional
import jwt
import logging

from database import db, JWT_SECRET, JWT_ALGORITHM
from websocket_manager import manager

router = APIRouter(tags=["WebSocket"])
logger = logging.getLogger(__name__)


async def get_user_from_token(token: str) -> Optional[dict]:
    """Validate JWT token and return user info"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        if user_id:
            user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
            return user
    except jwt.ExpiredSignatureError:
        logger.warning("WebSocket auth: Token expired")
    except jwt.InvalidTokenError as e:
        logger.warning(f"WebSocket auth: Invalid token - {e}")
    return None


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(None)
):
    """
    WebSocket endpoint for real-time updates.
    
    Connection: ws://host/api/ws?token=<jwt_token>
    
    Client can send messages to subscribe/unsubscribe from channels:
    - {"action": "subscribe", "channels": ["staffing", "overtime", "personnel"]}
    - {"action": "unsubscribe", "channels": ["overtime"]}
    - {"action": "ping"} -> responds with {"type": "pong"}
    
    Server broadcasts updates with types:
    - staffing_update: Changes to staffing records or apparatus assignments
    - overtime_update: Changes to overtime records
    - personnel_update: Changes to personnel records
    - volunteer_update: Changes to volunteer records
    - parttime_update: Changes to part-time records
    - deployment_update: Changes to deployment records
    """
    user = None
    user_id = None
    
    # Authenticate if token provided
    if token:
        user = await get_user_from_token(token)
        if user:
            user_id = user.get("id")
            logger.info(f"WebSocket authenticated for user: {user.get('name')} ({user_id})")
    
    # Accept connection (allow anonymous for read-only updates)
    await manager.connect(websocket, user_id)
    
    # Send connection confirmation
    await websocket.send_json({
        "type": "connected",
        "authenticated": user is not None,
        "user_name": user.get("name") if user else None,
        "message": "WebSocket connected. Send subscribe message to receive updates."
    })
    
    try:
        while True:
            # Wait for messages from client
            data = await websocket.receive_json()
            action = data.get("action")
            
            if action == "ping":
                await websocket.send_json({"type": "pong"})
            
            elif action == "subscribe":
                channels = data.get("channels", [])
                if channels:
                    manager.subscribe(websocket, channels)
                    await websocket.send_json({
                        "type": "subscribed",
                        "channels": channels
                    })
                    logger.info(f"Client subscribed to channels: {channels}")
            
            elif action == "unsubscribe":
                channels = data.get("channels", [])
                if channels:
                    manager.unsubscribe(websocket, channels)
                    await websocket.send_json({
                        "type": "unsubscribed",
                        "channels": channels
                    })
            
            elif action == "get_status":
                await websocket.send_json({
                    "type": "status",
                    "connections": manager.get_connection_count(),
                    "authenticated": user is not None
                })
    
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
        logger.info(f"WebSocket disconnected for user: {user_id or 'anonymous'}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket, user_id)
