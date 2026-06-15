"""
Notification dispatch — in-app, email, and WhatsApp.

create_notification() is the single function all other services call
to create an in-app Notification row.

send_email() delegates to email_service, which handles template rendering
and SMTP/SendGrid delivery.

send_whatsapp() is a placeholder for Phase 6 (Gupshup integration).
"""

import logging

logger = logging.getLogger(__name__)


def create_notification(recipient, category: str, title: str, body: str = "", ticket=None):
    """
    Create one in-app Notification for a single recipient.

    Called from views and services whenever a significant event occurs.
    Each call creates exactly one row — the caller is responsible for
    creating separate notifications for each person who needs to know.

    Args:
        recipient: CustomUser instance who should receive this notification
        category:  One of Notification.CATEGORY_CHOICES keys
        title:     Short headline (shown in notification bell)
        body:      Optional longer description
        ticket:    Optional Ticket instance this notification relates to

    Returns: the saved Notification instance
    """
    from ..models import Notification
    return Notification.objects.create(
        recipient=recipient,
        category=category,
        title=title,
        body=body,
        ticket=ticket,
    )


def send_email(to: str, template_name: str, context: dict) -> None:
    """
    Render an HTML email template and send it.

    Delegates to email_service._send() which handles template rendering,
    SendGrid SMTP delivery in production, and console output in development.

    Args:
        to:            Recipient email address
        template_name: Template path relative to templates/ (e.g. "email/welcome.html")
        context:       Template context dict
    """
    from .email_service import _send
    subject = context.get("subject", "Notification from SupportMitra")
    _send(to=to, subject=subject, template=template_name, context=context)


def send_whatsapp(to_phone: str, template_name: str, params: list) -> None:
    """
    Send a WhatsApp template message via Gupshup API.
    Only fires if ENABLE_WHATSAPP_NOTIFICATIONS=true in settings.
    Full implementation in Phase 6.
    """
    from django.conf import settings
    if not getattr(settings, "ENABLE_WHATSAPP_NOTIFICATIONS", False):
        return
    logger.info(
        "WhatsApp notification queued for %s (template=%s) — Gupshup integration pending (Phase 6).",
        to_phone,
        template_name,
    )
