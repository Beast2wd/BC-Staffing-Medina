"""
WebSocket connection manager for real-time updates
"""
from fastapi import WebSocket
from typing import Dict, Set, List
import json
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections and broadcasts events to connected clients"""
    
    def __init__(self):
        # Store connections by user_id for targeted messages
        self.active_connections: Dict[str, WebSocket] = {}
        # Store all connections for broadcasts
        self.all_connections: Set[WebSocket] = set()
        # Track which pages/views each connection is subscribed to
        self.subscriptions: Dict[WebSocket, Set[str]] = {}
    
    async def connect(self, websocket: WebSocket, user_id: str = None):
        """Accept a new WebSocket connection"""
        await websocket.accept()
        self.all_connections.add(websocket)
        self.subscriptions[websocket] = set()
        
        if user_id:
            self.active_connections[user_id] = websocket
        
        logger.info(f"WebSocket connected. Total connections: {len(self.all_connections)}")
    
    def disconnect(self, websocket: WebSocket, user_id: str = None):
        """Remove a WebSocket connection"""
        self.all_connections.discard(websocket)
        self.subscriptions.pop(websocket, None)
        
        if user_id and user_id in self.active_connections:
            del self.active_connections[user_id]
        
        logger.info(f"WebSocket disconnected. Total connections: {len(self.all_connections)}")
    
    def subscribe(self, websocket: WebSocket, channels: List[str]):
        """Subscribe a connection to specific channels/views"""
        if websocket in self.subscriptions:
            self.subscriptions[websocket].update(channels)
    
    def unsubscribe(self, websocket: WebSocket, channels: List[str]):
        """Unsubscribe a connection from specific channels"""
        if websocket in self.subscriptions:
            self.subscriptions[websocket] -= set(channels)
    
    async def send_personal_message(self, message: dict, user_id: str):
        """Send a message to a specific user"""
        if user_id in self.active_connections:
            websocket = self.active_connections[user_id]
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.error(f"Error sending personal message to {user_id}: {e}")
                self.disconnect(websocket, user_id)
    
    async def broadcast(self, message: dict, channel: str = None):
        """
        Broadcast a message to all connected clients.
        If channel is specified, only send to clients subscribed to that channel.
        """
        message["timestamp"] = datetime.now(timezone.utc).isoformat()
        
        disconnected = []
        
        for websocket in self.all_connections:
            # If channel specified, check subscription
            if channel and websocket in self.subscriptions:
                if channel not in self.subscriptions[websocket] and "all" not in self.subscriptions[websocket]:
                    continue
            
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.error(f"Error broadcasting message: {e}")
                disconnected.append(websocket)
        
        # Clean up disconnected clients
        for ws in disconnected:
            self.disconnect(ws)
    
    async def broadcast_staffing_update(self, event_type: str, data: dict, date: str = None, station_id: str = None):
        """Broadcast a staffing-related update"""
        message = {
            "type": "staffing_update",
            "event": event_type,
            "data": data,
            "date": date,
            "station_id": station_id
        }
        await self.broadcast(message, channel="staffing")
    
    async def broadcast_apparatus_update(self, event_type: str, data: dict, date: str = None, station_id: str = None):
        """Broadcast an apparatus assignment update"""
        message = {
            "type": "apparatus_update",
            "event": event_type,
            "data": data,
            "date": date,
            "station_id": station_id
        }
        await self.broadcast(message, channel="staffing")
    
    async def broadcast_overtime_update(self, event_type: str, data: dict, date: str = None):
        """Broadcast an overtime-related update"""
        message = {
            "type": "overtime_update",
            "event": event_type,
            "data": data,
            "date": date
        }
        await self.broadcast(message, channel="overtime")
    
    async def broadcast_personnel_update(self, event_type: str, data: dict):
        """Broadcast a personnel-related update"""
        message = {
            "type": "personnel_update",
            "event": event_type,
            "data": data
        }
        await self.broadcast(message, channel="personnel")
    
    async def broadcast_volunteer_update(self, event_type: str, data: dict, date: str = None):
        """Broadcast a volunteer-related update"""
        message = {
            "type": "volunteer_update",
            "event": event_type,
            "data": data,
            "date": date
        }
        await self.broadcast(message, channel="volunteer")
    
    async def broadcast_parttime_update(self, event_type: str, data: dict, date: str = None):
        """Broadcast a part-time-related update"""
        message = {
            "type": "parttime_update",
            "event": event_type,
            "data": data,
            "date": date
        }
        await self.broadcast(message, channel="parttime")
    
    async def broadcast_deployment_update(self, event_type: str, data: dict):
        """Broadcast a deployment-related update"""
        message = {
            "type": "deployment_update",
            "event": event_type,
            "data": data
        }
        await self.broadcast(message, channel="deployments")
    
    async def send_user_notification(self, user_id: str, notification_data: dict):
        """Send a notification to a specific user"""
        message = {
            "type": "user_notification",
            "event": "new",
            "data": notification_data
        }
        await self.send_personal_message(message, user_id)
    
    def get_connection_count(self) -> int:
        """Get the number of active connections"""
        return len(self.all_connections)


# Global connection manager instance
manager = ConnectionManager()
