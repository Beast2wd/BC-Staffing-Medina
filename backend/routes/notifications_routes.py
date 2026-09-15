"""
Notification routes - SMS and Email broadcast via Twilio and SendGrid (Multi-tenant enabled)
"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from datetime import datetime, timezone
import uuid
import logging

from twilio.rest import Client as TwilioClient
from twilio.base.exceptions import TwilioRestException
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content

from database import (
    db, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER,
    SENDGRID_API_KEY, SENDGRID_SENDER_EMAIL
)
from models import UserRole, BroadcastNotificationRequest
from auth import get_current_user, require_role
from tenant_utils import get_tenant_id, add_tenant_to_query, add_tenant_to_doc

router = APIRouter(prefix="/notifications", tags=["Notifications"])
logger = logging.getLogger(__name__)

# Initialize Twilio client
twilio_client = None
if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
    try:
        twilio_client = TwilioClient(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        logger.info("Twilio client initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize Twilio client: {e}")

# Initialize SendGrid client
sendgrid_client = None
if SENDGRID_API_KEY:
    try:
        sendgrid_client = SendGridAPIClient(SENDGRID_API_KEY)
        logger.info("SendGrid client initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize SendGrid client: {e}")


# Helper functions for sending notifications
def format_phone_number(phone: str) -> str:
    """Format phone number to E.164 format for Twilio"""
    if not phone:
        return None
    # Remove all non-digit characters
    digits = ''.join(filter(str.isdigit, phone))
    # Add +1 if it's a 10-digit US number
    if len(digits) == 10:
        return f"+1{digits}"
    elif len(digits) == 11 and digits.startswith('1'):
        return f"+{digits}"
    elif len(digits) > 10:
        return f"+{digits}"
    return None


async def send_sms_notification(phone: str, message: str, recipient_name: str) -> dict:
    """Send SMS via Twilio"""
    result = {"success": False, "phone": phone, "name": recipient_name, "error": None}
    
    if not twilio_client:
        result["error"] = "Twilio client not configured"
        return result
    
    formatted_phone = format_phone_number(phone)
    if not formatted_phone:
        result["error"] = f"Invalid phone number format: {phone}"
        return result
    
    try:
        # Truncate message if too long (SMS limit is 1600 characters for concatenated messages)
        sms_message = message[:1500] if len(message) > 1500 else message
        
        twilio_message = twilio_client.messages.create(
            body=sms_message,
            from_=TWILIO_PHONE_NUMBER,
            to=formatted_phone
        )
        result["success"] = True
        result["message_sid"] = twilio_message.sid
        result["status"] = twilio_message.status
        logger.info(f"SMS sent to {recipient_name} ({formatted_phone}): SID={twilio_message.sid}")
    except TwilioRestException as e:
        result["error"] = str(e)
        logger.error(f"Twilio error sending to {formatted_phone}: {e}")
    except Exception as e:
        result["error"] = str(e)
        logger.error(f"Error sending SMS to {formatted_phone}: {e}")
    
    return result


async def send_email_notification(email: str, subject: str, message: str, recipient_name: str) -> dict:
    """Send email via SendGrid"""
    result = {"success": False, "email": email, "name": recipient_name, "error": None}
    
    if not sendgrid_client:
        result["error"] = "SendGrid client not configured"
        return result
    
    if not email:
        result["error"] = "No email address provided"
        return result
    
    try:
        # Create HTML email content
        html_content = f"""
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #b91c1c; color: white; padding: 20px; text-align: center; }}
                .content {{ padding: 20px; background-color: #f9f9f9; }}
                .footer {{ padding: 15px; text-align: center; font-size: 12px; color: #666; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>Medina County Fire Department</h2>
                </div>
                <div class="content">
                    <p>Hello {recipient_name},</p>
                    <p>{message.replace(chr(10), '<br>')}</p>
                </div>
                <div class="footer">
                    <p>This is an automated message from Medina County BC Staffing System.</p>
                    <p>Please do not reply to this email.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        mail = Mail(
            from_email=Email(SENDGRID_SENDER_EMAIL, "Medina County Fire Staffing"),
            to_emails=To(email, recipient_name),
            subject=subject,
            html_content=Content("text/html", html_content)
        )
        
        response = sendgrid_client.send(mail)
        
        if response.status_code in [200, 201, 202]:
            result["success"] = True
            result["status_code"] = response.status_code
            logger.info(f"Email sent to {recipient_name} ({email}): Status={response.status_code}")
        else:
            result["error"] = f"SendGrid returned status {response.status_code}"
            logger.error(f"SendGrid error for {email}: Status={response.status_code}")
            
    except Exception as e:
        result["error"] = str(e)
        logger.error(f"Error sending email to {email}: {e}")
    
    return result


@router.post("/broadcast")
async def send_broadcast_notification(
    data: BroadcastNotificationRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF, UserRole.CAPTAIN, UserRole.LIEUTENANT]))
):
    """
    Send broadcast notification to selected personnel via SMS and/or Email.
    """
    tenant_id = get_tenant_id(current_user)
    if not data.recipients:
        raise HTTPException(status_code=400, detail="No recipients specified")
    
    if not data.message:
        raise HTTPException(status_code=400, detail="Message is required")
    
    if not data.send_sms and not data.send_email:
        raise HTTPException(status_code=400, detail="At least one notification method must be selected")
    
    # Count recipients by contact type
    sms_recipients = [r for r in data.recipients if r.phone]
    email_recipients = [r for r in data.recipients if r.email]
    
    # Create notification record
    notification_id = str(uuid.uuid4())
    notification_record = {
        "id": notification_id,
        "type": "overtime_broadcast",
        "subject": data.subject,
        "message": data.message,
        "send_sms": data.send_sms,
        "send_email": data.send_email,
        "recipients": [r.model_dump() for r in data.recipients],
        "sms_count": len(sms_recipients) if data.send_sms else 0,
        "email_count": len(email_recipients) if data.send_email else 0,
        "date": data.date,
        "sent_by": current_user.get("name", "Unknown"),
        "sent_by_id": current_user.get("id"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "sending",
        "sms_results": [],
        "email_results": []
    }
    if tenant_id:
        notification_record["tenant_id"] = tenant_id
    
    await db.notifications.insert_one(notification_record)
    
    # Send notifications
    sms_results = []
    email_results = []
    sms_success = 0
    sms_failed = 0
    email_success = 0
    email_failed = 0
    
    # Send SMS notifications
    if data.send_sms and twilio_client:
        for recipient in sms_recipients:
            result = await send_sms_notification(
                recipient.phone, 
                data.message, 
                recipient.name
            )
            sms_results.append(result)
            if result["success"]:
                sms_success += 1
            else:
                sms_failed += 1
    elif data.send_sms and not twilio_client:
        logger.warning("SMS requested but Twilio client not configured")
    
    # Send Email notifications
    if data.send_email and sendgrid_client:
        for recipient in email_recipients:
            result = await send_email_notification(
                recipient.email,
                data.subject,
                data.message,
                recipient.name
            )
            email_results.append(result)
            if result["success"]:
                email_success += 1
            else:
                email_failed += 1
    elif data.send_email and not sendgrid_client:
        logger.warning("Email requested but SendGrid client not configured")
    
    # Update notification record with results
    final_status = "sent"
    if (sms_failed > 0 or email_failed > 0) and (sms_success > 0 or email_success > 0):
        final_status = "partial"
    elif sms_failed > 0 or email_failed > 0:
        final_status = "failed"
    
    await db.notifications.update_one(
        {"id": notification_id},
        {"$set": {
            "status": final_status,
            "sms_results": sms_results,
            "email_results": email_results,
            "sms_sent": sms_success,
            "sms_failed": sms_failed,
            "email_sent": email_success,
            "email_failed": email_failed,
            "completed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    logger.info(f"Broadcast notification {notification_id}: SMS {sms_success}/{len(sms_recipients)}, Email {email_success}/{len(email_recipients)}")
    
    return {
        "message": "Notifications sent",
        "notification_id": notification_id,
        "status": final_status,
        "sms": {
            "sent": sms_success,
            "failed": sms_failed,
            "total": len(sms_recipients) if data.send_sms else 0
        },
        "email": {
            "sent": email_success,
            "failed": email_failed,
            "total": len(email_recipients) if data.send_email else 0
        }
    }


@router.get("")
async def get_notifications(
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF]))
):
    """Get recent notification records"""
    tenant_id = get_tenant_id(current_user)
    query = {}
    if tenant_id:
        query["tenant_id"] = tenant_id
    notifications = await db.notifications.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    return notifications


@router.get("/{notification_id}")
async def get_notification_details(
    notification_id: str,
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.BATTALION_CHIEF]))
):
    """Get details of a specific notification including delivery results"""
    tenant_id = get_tenant_id(current_user)
    query = {"id": notification_id}
    if tenant_id:
        query["tenant_id"] = tenant_id
    notification = await db.notifications.find_one(query, {"_id": 0})
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    return notification


@router.post("/test-email")
async def test_email_notification(
    recipient_email: str,
    current_user: dict = Depends(require_role([UserRole.ADMIN]))
):
    """Test SendGrid email configuration by sending a test email"""
    if not sendgrid_client:
        return {
            "success": False,
            "error": "SendGrid client not initialized",
            "config": {
                "api_key_set": bool(SENDGRID_API_KEY),
                "sender_email": SENDGRID_SENDER_EMAIL
            }
        }
    
    try:
        result = await send_email_notification(
            email=recipient_email,
            subject="Test Email - BC Staffing System",
            message="This is a test email from the BC Staffing notification system. If you received this, email notifications are working correctly!",
            recipient_name=current_user.get("name", "Admin")
        )
        
        return {
            "success": result.get("success", False),
            "error": result.get("error"),
            "status_code": result.get("status_code"),
            "recipient": recipient_email,
            "sender": SENDGRID_SENDER_EMAIL
        }
    except Exception as e:
        logger.error(f"Test email error: {e}")
        return {
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__
        }


@router.get("/config/status")
async def get_notification_config_status(
    current_user: dict = Depends(require_role([UserRole.ADMIN]))
):
    """Check notification service configuration status"""
    return {
        "sendgrid": {
            "configured": bool(sendgrid_client),
            "api_key_set": bool(SENDGRID_API_KEY),
            "sender_email": SENDGRID_SENDER_EMAIL if SENDGRID_API_KEY else None
        },
        "twilio": {
            "configured": bool(twilio_client),
            "account_sid_set": bool(TWILIO_ACCOUNT_SID),
            "phone_number": TWILIO_PHONE_NUMBER if TWILIO_ACCOUNT_SID else None
        }
    }
