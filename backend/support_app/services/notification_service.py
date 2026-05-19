"""
Notification dispatch — in-app, email, and WhatsApp.

create_notification() is the single function all other services call
to create an in-app Notification row. Email and WhatsApp are Phase 6.
"""


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
    Render an HTML email template with the given context and
    send it via SendGrid.
    TODO: implement in Phase 6.
    """
    raise NotImplementedError


def send_whatsapp(to_phone: str, template_name: str, params: list) -> None:
    """
    Send a WhatsApp template message via Gupshup API.
    Only fires if ENABLE_WHATSAPP_NOTIFICATIONS=true in settings.
    TODO: implement in Phase 6.
    """
    raise NotImplementedError
