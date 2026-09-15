"""
Webhook Notification Service for Make.com Integration
Sends tenant-specific webhook notifications for overtime and deployment events
"""
import asyncio
import httpx
from datetime import datetime, timezone
from uuid import uuid4
from typing import Optional, Dict, Any, Literal
from database import db


class WebhookService:
    """Service for sending webhook notifications to Make.com"""
    
    def __init__(self):
        self.timeout = httpx.Timeout(10.0, connect=5.0)
    
    async def get_tenant_webhook_config(self, tenant_id: str) -> Optional[Dict[str, Any]]:
        """Get webhook configuration for a tenant"""
        tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0, "settings": 1})
        if not tenant:
            return None
        
        settings = tenant.get("settings", {})
        return {
            "webhook_url": settings.get("webhook_url"),
            "webhook_enabled": settings.get("webhook_enabled", False),
            "webhook_api_key": settings.get("webhook_api_key")
        }
    
    async def send_webhook(
        self,
        tenant_id: str,
        event_type: Literal["overtime.assigned", "deployment.created"],
        data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Send a webhook notification to Make.com
        
        Args:
            tenant_id: The tenant identifier
            event_type: Type of event (overtime.assigned, deployment.created)
            data: Event-specific data payload
            
        Returns:
            Dict with delivery status and details
        """
        event_id = str(uuid4())
        
        # Get tenant webhook config
        config = await self.get_tenant_webhook_config(tenant_id)
        
        if not config or not config.get("webhook_enabled") or not config.get("webhook_url"):
            return {
                "event_id": event_id,
                "status": "skipped",
                "reason": "Webhook not configured or disabled for tenant"
            }
        
        webhook_url = config["webhook_url"]
        api_key = config.get("webhook_api_key")
        
        # Build the event payload
        event_payload = {
            "event_id": event_id,
            "event_type": event_type,
            "tenant_id": tenant_id,
            "occurred_at": datetime.now(timezone.utc).isoformat(),
            "data": data
        }
        
        # Record the delivery attempt
        delivery_record = {
            "event_id": event_id,
            "tenant_id": tenant_id,
            "event_type": event_type,
            "status": "sending",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "payload": event_payload
        }
        
        try:
            await db.webhook_deliveries.insert_one(delivery_record)
        except Exception:
            # If we can't record, still try to send
            pass
        
        # Build headers
        headers = {"Content-Type": "application/json"}
        if api_key:
            headers["x-make-apikey"] = api_key
        
        # Send with retry logic
        last_error = None
        for attempt in range(3):
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    response = await client.post(
                        webhook_url,
                        json=event_payload,
                        headers=headers
                    )
                    response.raise_for_status()
                    
                    # Update delivery record on success
                    await db.webhook_deliveries.update_one(
                        {"event_id": event_id},
                        {"$set": {
                            "status": "delivered",
                            "http_status": response.status_code,
                            "delivered_at": datetime.now(timezone.utc).isoformat()
                        }}
                    )
                    
                    return {
                        "event_id": event_id,
                        "status": "delivered",
                        "http_status": response.status_code
                    }
                    
            except (httpx.HTTPError, httpx.TimeoutException) as exc:
                last_error = str(exc)
                if attempt < 2:
                    await asyncio.sleep(2 ** attempt)
        
        # Update delivery record on failure
        await db.webhook_deliveries.update_one(
            {"event_id": event_id},
            {"$set": {
                "status": "failed",
                "error": last_error,
                "failed_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        return {
            "event_id": event_id,
            "status": "failed",
            "error": last_error
        }
    
    async def send_overtime_notification(
        self,
        tenant_id: str,
        personnel_id: str,
        personnel_name: str,
        personnel_email: Optional[str],
        personnel_phone: Optional[str],
        date: str,
        hours: float,
        approved_by: str,
        station: Optional[str] = None,
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """Send overtime assignment notification"""
        data = {
            "personnel_id": personnel_id,
            "personnel_name": personnel_name,
            "personnel_email": personnel_email,
            "personnel_phone": personnel_phone,
            "date": date,
            "hours": hours,
            "station": station,
            "approved_by": approved_by,
            "notes": notes
        }
        
        return await self.send_webhook(tenant_id, "overtime.assigned", data)
    
    async def send_deployment_notification(
        self,
        tenant_id: str,
        personnel_id: str,
        personnel_name: str,
        personnel_email: Optional[str],
        personnel_phone: Optional[str],
        deployment_type: str,
        start_date: str,
        end_date: Optional[str],
        location: str,
        created_by: str,
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """Send deployment assignment notification"""
        data = {
            "personnel_id": personnel_id,
            "personnel_name": personnel_name,
            "personnel_email": personnel_email,
            "personnel_phone": personnel_phone,
            "deployment_type": deployment_type,
            "start_date": start_date,
            "end_date": end_date,
            "location": location,
            "created_by": created_by,
            "notes": notes
        }
        
        return await self.send_webhook(tenant_id, "deployment.created", data)
    
    async def test_webhook(self, tenant_id: str) -> Dict[str, Any]:
        """Send a test webhook to verify configuration"""
        test_data = {
            "test": True,
            "message": "This is a test notification from BC Staffing 360",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        # Get tenant webhook config
        config = await self.get_tenant_webhook_config(tenant_id)
        
        if not config or not config.get("webhook_url"):
            return {
                "success": False,
                "error": "Webhook URL not configured for tenant"
            }
        
        webhook_url = config["webhook_url"]
        api_key = config.get("webhook_api_key")
        
        # Build the test payload
        event_payload = {
            "event_id": str(uuid4()),
            "event_type": "test",
            "tenant_id": tenant_id,
            "occurred_at": datetime.now(timezone.utc).isoformat(),
            "data": test_data
        }
        
        # Build headers
        headers = {"Content-Type": "application/json"}
        if api_key:
            headers["x-make-apikey"] = api_key
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    webhook_url,
                    json=event_payload,
                    headers=headers
                )
                response.raise_for_status()
                
                return {
                    "success": True,
                    "http_status": response.status_code,
                    "message": "Test webhook sent successfully"
                }
                
        except httpx.TimeoutException:
            return {
                "success": False,
                "error": "Connection timed out"
            }
        except httpx.HTTPStatusError as exc:
            return {
                "success": False,
                "error": f"HTTP {exc.response.status_code}: {exc.response.text[:200]}"
            }
        except Exception as exc:
            return {
                "success": False,
                "error": str(exc)
            }


# Singleton instance
webhook_service = WebhookService()
