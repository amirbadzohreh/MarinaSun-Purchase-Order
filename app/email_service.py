"""
Email service for sending notifications.
Supports SMTP with TLS/SSL and EWS (Exchange Web Services).
"""
import os
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, List
import logging

logger = logging.getLogger(__name__)

# SMTP Configuration from environment
SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USERNAME = os.environ.get("SMTP_USERNAME", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
SMTP_USE_TLS = os.environ.get("SMTP_USE_TLS", "true").lower() == "true"
SMTP_FROM_EMAIL = os.environ.get("SMTP_FROM_EMAIL", "")
SMTP_FROM_NAME = os.environ.get("SMTP_FROM_NAME", "سیستم درخواست خرید ماریناسان")

# EWS (Exchange Web Services) Configuration
EWS_ENABLED = os.environ.get("EWS_ENABLED", "false").lower() == "true"
EWS_URL = os.environ.get("EWS_URL", "")
EWS_USERNAME = os.environ.get("EWS_USERNAME", "")
EWS_PASSWORD = os.environ.get("EWS_PASSWORD", "")
EWS_PRIMARY_SMTP = os.environ.get("EWS_PRIMARY_SMTP", "")
EWS_DOMAIN = os.environ.get("EWS_DOMAIN", "")

EMAIL_ENABLED = os.environ.get("EMAIL_ENABLED", "false").lower() == "true"
EMAIL_BACKEND = os.environ.get("EMAIL_BACKEND", "smtp")  # "smtp" or "ews"


def _get_email_backend():
    """Get the appropriate email backend based on config."""
    backend = os.environ.get("EMAIL_BACKEND", "smtp").lower()
    if backend == "ews" and EWS_ENABLED:
        return "ews"
    return "smtp"


def _send_email_smtp(
    to_emails: List[str],
    subject: str,
    body_html: str,
    body_text: Optional[str] = None
) -> bool:
    """Internal function to send email via SMTP."""
    if not EMAIL_ENABLED:
        logger.info("Email disabled, skipping send")
        return True
    
    if not to_emails:
        logger.warning("No recipients specified")
        return False
    
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{SMTP_FROM_NAME} <{SMTP_FROM_EMAIL}>"
    msg["To"] = ", ".join(to_emails)
    
    if body_text:
        msg.attach(MIMEText(body_text, "plain", "utf-8"))
    msg.attach(MIMEText(body_html, "html", "utf-8"))
    
    try:
        context = ssl.create_default_context()
        
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            if SMTP_USE_TLS:
                server.starttls(context=context)
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.sendmail(SMTP_FROM_EMAIL, to_emails, msg.as_string())
        
        logger.info(f"Email sent successfully to {to_emails}")
        return True
        
    except smtplib.SMTPAuthenticationError as e:
        logger.error(f"SMTP authentication failed: {e}")
        return False
    except smtplib.SMTPRecipientsRefused as e:
        logger.error(f"Recipients refused: {e}")
        return False
    except smtplib.SMTPServerDisconnected as e:
        logger.error(f"Server disconnected: {e}")
        return False
    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        return False


def _send_email_ews(
    to_emails: List[str],
    subject: str,
    body_html: str,
    body_text: Optional[str] = None
) -> bool:
    """Internal function to send email via EWS (Exchange Web Services)."""
    if not EMAIL_ENABLED:
        logger.info("Email disabled, skipping send")
        return True
    
    if not to_emails:
        logger.warning("No recipients specified")
        return False
    
    try:
        from exchangelib import Account, Credentials, Configuration, Message, Mailbox, HTMLBody, DELEGATE
        from exchangelib.protocol import Protocol
        
        # Disable SSL verification for internal Exchange
        Protocol.verify_ssl = False
        
        credentials = Credentials(username=EWS_USERNAME, password=EWS_PASSWORD)
        config = Configuration(server=EWS_URL, credentials=credentials)
        
        account = Account(
            primary_smtp_address=EWS_PRIMARY_SMTP,
            config=Configuration(server=EWS_URL, credentials=Credentials(username=EWS_USERNAME, password=EWS_PASSWORD)),
            autodiscover=False,
            access_type=DELEGATE
        )
        
        # Create message
        recipients = [Mailbox(email_address=email) for email in to_emails]
        
        message = Message(
            account=account,
            subject=subject,
            body=HTMLBody(body_html),
            to_recipients=recipients
        )
        
        if body_text:
            message.body = body_text
        
        message.send()
        
        logger.info(f"Email sent successfully via EWS to {to_emails}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send email via EWS: {e}")
        return False


def _send_email(
    to_emails: List[str],
    subject: str,
    body_html: str,
    body_text: Optional[str] = None
) -> bool:
    """Dispatch email using configured backend."""
    backend = _get_email_backend()
    
    if not EMAIL_ENABLED:
        logger.info("Email disabled, skipping send")
        return True
    
    if not to_emails:
        logger.warning("No recipients specified")
        return False
    
    backend = os.environ.get("EMAIL_BACKEND", "smtp").lower()
    
    if backend == "ews":
        try:
            return _send_email_ews(to_emails, subject, body_html, body_text)
        except Exception as e:
            logger.error(f"EWS failed, falling back to SMTP: {e}")
            # Fallback to SMTP
            return _send_email_smtp(to_emails, subject, body_html, body_text)
    else:
        return _send_email_smtp(to_emails, subject, body_html, body_text)


def send_purchase_request_notification(
    purchase_request_id: int,
    event_type: str,
    requester_id: int,
    request_number: str,
    total_amount: float,
    action_url: Optional[str] = None,
    approver_id: Optional[int] = None,
    comment: Optional[str] = None
) -> bool:
    """
    Send notification for purchase request events.
    
    event_type: 'created', 'approved', 'rejected', 'returned_for_documents', 'resubmitted'
    
    Flow:
    - created: Email to current step approver (step 1)
    - approved: Email to next step approver (if exists), else requester (final approval)
    - rejected/returned_for_documents: Email to requester with reason
    - resubmitted: Email to current step approver
    """
    if not EMAIL_ENABLED:
        return True
    
    # Get recipients and request details from database
    from database import get_connection
    
    try:
        conn = get_connection()
        cur = conn.cursor()
        
        # Get requester info
        requester = cur.execute(
            "SELECT full_name, email FROM employees WHERE id = ?", (requester_id,)
        ).fetchone()
        
        requester_name = requester["full_name"] if requester else "نامشخص"
        requester_email = requester["email"] if requester else None
        
        recipients = set()
        
        if event_type == "created":
            # New request: Email to current step approver (step 1)
            pr = cur.execute(
                "SELECT current_step_order FROM purchase_requests WHERE id = ?", 
                (purchase_request_id,)
            ).fetchone()
            
            if pr:
                step = cur.execute(
                    """SELECT s.approver_id, e.email 
                       FROM approval_steps s
                       JOIN employees e ON e.id = s.approver_id
                       WHERE s.purchase_request_id = ? AND s.step_order = ?""",
                    (purchase_request_id, pr["current_step_order"])
                ).fetchone()
                
                if step and step["email"]:
                    recipients.add(step["email"])
        
        elif event_type == "approved":
            # Approved: Check if there's a next step
            pr = cur.execute(
                "SELECT current_step_order FROM purchase_requests WHERE id = ?", 
                (purchase_request_id,)
            ).fetchone()
            
            if pr:
                current_step = pr["current_step_order"]
                next_step = cur.execute(
                    """SELECT s.approver_id, e.email 
                       FROM approval_steps s
                       JOIN employees e ON e.id = s.approver_id
                       WHERE s.purchase_request_id = ? AND s.step_order = ?""",
                    (purchase_request_id, current_step + 1)
                ).fetchone()
                
                if next_step and next_step["email"]:
                    # Has next step: email to next approver
                    recipients.add(next_step["email"])
                else:
                    # Final approval: email to requester
                    if requester_email:
                        recipients.add(requester_email)
        
        elif event_type in ("rejected", "returned_for_documents"):
            # Rejected or returned for docs: Email to requester
            if requester_email:
                recipients.add(requester_email)
        
        elif event_type == "resubmitted":
            # Resubmitted: Email to current step approver
            pr = cur.execute(
                "SELECT current_step_order FROM purchase_requests WHERE id = ?", 
                (purchase_request_id,)
            ).fetchone()
            
            if pr:
                step = cur.execute(
                    """SELECT s.approver_id, e.email 
                       FROM approval_steps s
                       JOIN employees e ON e.id = s.approver_id
                       WHERE s.purchase_request_id = ? AND s.step_order = ?""",
                    (purchase_request_id, pr["current_step_order"])
                ).fetchone()
                
                if step and step["email"]:
                    recipients.add(step["email"])
        
        conn.close()
        
        if not recipients:
            logger.warning(f"No email recipients found for event {event_type} on PR {purchase_request_id}")
            return True
        
        # Build action URL
        if action_url is None:
            frontend_url = os.environ.get("FRONTEND_URL", "http://localhost")
            action_url = f"{frontend_url}/purchase-requests/{purchase_request_id}"
        
        # Get request details
        conn = get_connection()
        pr = conn.execute(
            "SELECT title, total_amount FROM purchase_requests WHERE id = ?", 
            (purchase_request_id,)
        ).fetchone()
        conn.close()
        
        if not pr:
            logger.warning(f"Purchase request {purchase_request_id} not found")
            return False
        
        requester_name = requester_name
        title = pr["title"]
        total_amount = pr["total_amount"]
        
        # Build email
        subject, body_html, body_text = _build_notification_email(
            request_number=request_number,
            title=title,
            requester_name=requester_name,
            total_amount=total_amount,
            action_url=action_url,
            event_type=event_type
        )
        
        return _send_email(list(recipients), subject, body_html, body_text)
        
    except Exception as e:
        logger.error(f"Failed to send notification: {e}")
        return False


def _build_notification_email(
    request_number: str,
    title: str,
    requester_name: str,
    total_amount: float,
    action_url: str,
    event_type: str
) -> tuple[str, str, str]:
    """Build email subject, HTML and text body for notification."""
    event_config = {
        "new_request": {
            "subject": f"درخواست خرید جدید: {request_number}",
            "title": "درخواست خرید جدید",
            "message": "درخواست خرید جدیدی ثبت شده است که نیاز به تایید شما دارد.",
        },
        "created": {
            "subject": f"درخواست خرید جدید: {request_number}",
            "title": "درخواست خرید جدید",
            "message": "درخواست خرید جدیدی ثبت شده است که نیاز به تایید شما دارد.",
        },
        "approved": {
            "subject": f"درخواست تایید شد: {request_number}",
            "title": "درخواست تایید شد",
            "message": "درخواست خرید شما تایید گردید.",
        },
        "rejected": {
            "subject": f"درخواست رد شد: {request_number}",
            "title": "درخواست رد شد",
            "message": "درخواست خرید شما رد گردید.",
        },
        "returned_for_documents": {
            "subject": f"نیاز به تکمیل مدارک: {request_number}",
            "title": "نیاز به تکمیل مدارک",
            "message": "درخواست خرید برای تکمیل مدارک به شما برگردانده شده است.",
        },
        "resubmitted": {
            "subject": f"درخواست مجدداً ارسال شد: {request_number}",
            "title": "درخواست مجدداً ارسال شد",
            "message": "درخواست خرید پس از تکمیل مدارک مجدداً ارسال گردید.",
        },
    }
    
    config = event_config.get(event_type, event_config["new_request"])
    
    body_html = f"""
    <!DOCTYPE html>
    <html dir="rtl" lang="fa">
    <head>
        <meta charset="UTF-8">
        <style>
            body {{ font-family: 'Vazirmatn', Tahoma, Arial, sans-serif; direction: rtl; margin: 0; padding: 20px; background: #f3f4f6; }}
            .container {{ max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }}
            .header {{ background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; padding: 24px; text-align: center; }}
            .content {{ padding: 24px; }}
            .title {{ font-size: 20px; font-weight: bold; color: #1e293b; margin-bottom: 16px; }}
            .details {{ background: #f8fafc; border-radius: 8px; padding: 16px; margin: 16px 0; }}
            .detail-row {{ display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }}
            .detail-row:last-child {{ border-bottom: none; }}
            .detail-label {{ color: #64748b; }}
            .detail-value {{ font-weight: 600; color: #1e293b; }}
            .btn {{ display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin-top: 16px; }}
            .footer {{ text-align: center; padding: 16px; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>سیستم درخواست خرید ماریناسان</h1>
            </div>
            <div class="content">
                <div class="title">{config['title']}</div>
                <p>{config['message']}</p>
                
                <div class="details">
                    <div class="detail-row">
                        <span class="detail-label">شماره درخواست</span>
                        <span class="detail-value">{request_number}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">عنوان</span>
                        <span class="detail-value">{title}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">درخواست‌دهنده</span>
                        <span class="detail-value">{requester_name}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">مبلغ کل</span>
                        <span class="detail-value">{total_amount:,.0f} تومان</span>
                    </div>
                </div>
                
                <div style="text-align: center;">
                    <a href="{action_url}" class="btn">مشاهده درخواست</a>
                </div>
            </div>
            <div class="footer">
                <p>این ایمیل به صورت خودکار ارسال شده است. لطفاً به آن پاسخ ندهید.</p>
                <p>ماریناسان | سیستم درخواست خرید</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    body_text = f"""
{config['title']}

{config['message']}

شماره درخواست: {request_number}
عنوان: {title}
درخواست‌دهنده: {requester_name}
مبلغ کل: {total_amount:,.0f} تومان

مشاهده درخواست: {action_url}

---
سیستم درخواست خرید ماریناسان
    """
    
    return config["subject"], body_html, body_text


def test_smtp_connection() -> tuple[bool, str]:
    """Test SMTP connection."""
    if not EMAIL_ENABLED:
        return True, "Email disabled"
    
    try:
        context = ssl.create_default_context()
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            if SMTP_USE_TLS:
                server.starttls(context=context)
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
        return True, "Connection successful"
    except smtplib.SMTPAuthenticationError as e:
        return False, f"Authentication failed: {e}"
    except Exception as e:
        return False, f"Connection failed: {e}"