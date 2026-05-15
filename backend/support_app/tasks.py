"""
Celery tasks — code that runs in the background, off the web request.

Tasks defined here are discovered automatically because celery.py
calls app.autodiscover_tasks().

Each task is a plain Python function decorated with @shared_task.
To run a task from anywhere in the codebase:
    from .tasks import send_ticket_opened_email
    send_ticket_opened_email.delay(ticket_id)   # queues it immediately
    send_ticket_opened_email.apply_async(...)    # more options
"""

from celery import shared_task


@shared_task
def send_ticket_opened_email(ticket_id: str) -> None:
    """
    Send a confirmation email to the customer when a ticket is created.
    TODO: implement email template rendering and SendGrid send (Phase 2).
    """
    pass


@shared_task
def send_ticket_assigned_notification(ticket_id: str) -> None:
    """
    Notify the customer and freelancer when a ticket is assigned.
    TODO: implement (Phase 3).
    """
    pass


@shared_task
def check_sla_breaches() -> None:
    """
    Scan all open/assigned/in-progress tickets for SLA breaches.
    Called every 5 minutes by Celery Beat.
    TODO: implement SLA breach detection logic (Phase 3).
    """
    pass


@shared_task
def process_payout_batch() -> None:
    """
    Collect all closed tickets with unpaid freelancer payouts and
    create a payout batch for admin review.
    Called weekly (every Monday) by Celery Beat.
    TODO: implement (Phase 4).
    """
    pass


@shared_task
def sync_ticket_to_osticket(ticket_id: str) -> None:
    """
    Push a new ticket to the osTicket external helpdesk.
    TODO: implement (Phase 4).
    """
    pass
