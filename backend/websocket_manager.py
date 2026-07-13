"""
WebSocket connection manager for real-time updates
MULTI-TENANT SCOPED: All broadcasts are filtered by tenant_id
"""
from fastapi import WebSocket
from typing import Dict, Set, List, Optional
import json
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Manages WebSocket connections and broadcasts events to connected clients.
    All connections and broadcasts are scoped by tenant_id for multi-tenant isolation.
    """
    
    def __init__(self):
        # Store connections by user_id for targeted messages
        self.active_connections: Dict[str, WebSocket] = {}
        # Store all connections for broadcasts
        self.all_connections: Set[WebSocket] = set()
        # Track which pages/views each connection is subscribed to
        self.subscriptions: Dict[WebSocket, Set[str]] = {}
        # TENANT SCOPING: Track tenant_id for each connection
        self.connection_tenants: Dict[WebSocket, str] = {}
        # TENANT SCOPING: Map user_id to tenant_id for personal messages
        self.user_tenants: Dict[str, str] = {}
    
    async def connect(self, websocket: WebSocket, user_id: str = None, tenant_id: str = None):
        """Accept a new WebSocket connection with tenant context"""
        await websocket.accept()
        self.all_connections.add(websocket)
        self.subscriptions[websocket] = set()
        
        # Store tenant context for this connection
        if tenant_id:
            self.connection_tenants[websocket] = tenant_id
        
        if user_id:
            self.active_connections[user_id] = websocket
            if tenant_id:
                self.user_tenants[user_id] = tenant_id
        
        logger.info(f"WebSocket connected. Tenant: {tenant_id or 'anonymous'}. Total connections: {len(self.all_connections)}")
    
    def disconnect(self, websocket: WebSocket, user_id: str = None):
        """Remove a WebSocket connection"""
        self.all_connections.discard(websocket)
        self.subscriptions.pop(websocket, None)
        self.connection_tenants.pop(websocket, None)
        
        if user_id:
            if user_id in self.active_connections:
                del self.active_connections[user_id]
            if user_id in self.user_tenants:
                del self.user_tenants[user_id]
        
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
    
    async def broadcast(self, message: dict, channel: str = None, tenant_id: str = None):
        """
        Broadcast a message to connected clients.
        
        TENANT SCOPING:
        - If tenant_id is specified, only send to clients in that tenant
        - If tenant_id is None, broadcast to ALL (use with caution - only for system-wide announcements)
        - If channel is specified, only send to clients subscribed to that channel
        """
        message["timestamp"] = datetime.now(timezone.utc).isoformat()
        
        disconnected = []
        sent_count = 0
        
        for websocket in self.all_connections:
            # TENANT SCOPING: Filter by tenant_id if specified
            if tenant_id:
                connection_tenant = self.connection_tenants.get(websocket)
                # Skip if connection has no tenant (anonymous) or belongs to different tenant
                if connection_tenant != tenant_id:
                    continue
            
            # If channel specified, check subscription
            if channel and websocket in self.subscriptions:
                if channel not in self.subscriptions[websocket] and "all" not in self.subscriptions[websocket]:
                    continue
            
            try:
                await websocket.send_json(message)
                sent_count += 1
            except Exception as e:
                logger.error(f"Error broadcasting message: {e}")
                disconnected.append(websocket)
        
        # Clean up disconnected clients
        for ws in disconnected:
            self.disconnect(ws)
        
        if tenant_id:
            logger.debug(f"Broadcast to tenant {tenant_id}: {sent_count} clients received message")
    
    async def broadcast_staffing_update(self, event_type: str, data: dict, date: str = None, station_id: str = None, tenant_id: str = None, modified_by: str = None):
        """Broadcast a staffing-related update (tenant-scoped)"""
        message = {
            "type": "staffing_update",
            "event": event_type,
            "data": data,
            "date": date,
            "station_id": station_id,
            "modified_by": modified_by
        }
        await self.broadcast(message, channel="staffing", tenant_id=tenant_id)
    
    async def broadcast_apparatus_update(self, event_type: str, data: dict, date: str = None, station_id: str = None, tenant_id: str = None, modified_by: str = None):
        """Broadcast an apparatus assignment update (tenant-scoped)"""
        message = {
            "type": "apparatus_update",
            "event": event_type,
            "data": data,
            "date": date,
            "station_id": station_id,
            "modified_by": modified_by
        }
        await self.broadcast(message, channel="staffing", tenant_id=tenant_id)
    
    async def broadcast_overtime_update(self, event_type: str, data: dict, date: str = None, tenant_id: str = None, modified_by: str = None):
        """Broadcast an overtime-related update (tenant-scoped)"""
        message = {
            "type": "overtime_update",
            "event": event_type,
            "data": data,
            "date": date,
            "modified_by": modified_by
        }
        await self.broadcast(message, channel="overtime", tenant_id=tenant_id)
    
    async def broadcast_personnel_update(self, event_type: str, data: dict, tenant_id: str = None, modified_by: str = None):
        """Broadcast a personnel-related update (tenant-scoped)"""
        message = {
            "type": "personnel_update",
            "event": event_type,
            "data": data,
            "modified_by": modified_by
        }
        await self.broadcast(message, channel="personnel", tenant_id=tenant_id)
    
    async def broadcast_volunteer_update(self, event_type: str, data: dict, date: str = None, tenant_id: str = None, modified_by: str = None):
        """Broadcast a volunteer-related update (tenant-scoped)"""
        message = {
            "type": "volunteer_update",
            "event": event_type,
            "data": data,
            "date": date,
            "modified_by": modified_by
        }
        await self.broadcast(message, channel="volunteer", tenant_id=tenant_id)
    
    async def broadcast_parttime_update(self, event_type: str, data: dict, date: str = None, tenant_id: str = None, modified_by: str = None):
        """Broadcast a part-time-related update (tenant-scoped)"""
        message = {
            "type": "parttime_update",
            "event": event_type,
            "data": data,
            "date": date,
            "modified_by": modified_by
        }
        await self.broadcast(message, channel="parttime", tenant_id=tenant_id)
    
    async def broadcast_deployment_update(self, event_type: str, data: dict, tenant_id: str = None, modified_by: str = None):
        """Broadcast a deployment-related update (tenant-scoped)"""
        message = {
            "type": "deployment_update",
            "event": event_type,
            "data": data,
            "modified_by": modified_by
        }
        await self.broadcast(message, channel="deployments", tenant_id=tenant_id)
    
    async def send_user_notification(self, user_id: str, notification_data: dict):
        """Send a notification to a specific user"""
        message = {
            "type": "user_notification",
            "event": "new",
            "data": notification_data
        }
        await self.send_personal_message(message, user_id)
    
    def get_connection_count(self, tenant_id: str = None) -> int:
        """Get the number of active connections, optionally filtered by tenant"""
        if tenant_id:
            return sum(1 for ws in self.all_connections if self.connection_tenants.get(ws) == tenant_id)
        return len(self.all_connections)
    
    def get_tenant_connections(self, tenant_id: str) -> int:
        """Get the number of connections for a specific tenant"""
        return sum(1 for ws in self.all_connections if self.connection_tenants.get(ws) == tenant_id)


# Global connection manager instance
manager = ConnectionManager()
