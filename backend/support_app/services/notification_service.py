"""
Notification dispatch — email and WhatsApp.

TODO: implement in Phase 2 (email) and Phase 3 (WhatsApp).
"""


def send_email(to: str, template_name: str, context: dict) -> None:
    """
    Render an HTML email template with the given context and
    send it via SendGrid.
    """
    raise NotImplementedError


def send_whatsapp(to_phone: str, template_name: str, params: list) -> None:
    """
    Send a WhatsApp template message via Gupshup API.
    Only fires if ENABLE_WHATSAPP_NOTIFICATIONS=true in settings.
    """
    raise NotImplementedError


def notify_ticket_opened(ticket) -> None:
    """Email + WhatsApp to customer; email to admin."""
    raise NotImplementedError


def notify_ticket_assigned(ticket) -> None:
    """Email + WhatsApp to customer; Email + WhatsApp to freelancer."""
    raise NotImplementedError


def notify_sla_breach(ticket, breach_type: str) -> None:
    """Alert admin via email; alert freelancer via WhatsApp."""
    raise NotImplementedError
