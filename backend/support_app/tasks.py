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

import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_ticket_opened_email(self, ticket_id: str) -> None:
    """
    Send a confirmation email to the customer when a ticket is created.
    Retries up to 3 times with 60-second delays on transient failures.
    """
    from .models import Ticket
    from .services.email_service import send_ticket_created
    try:
        ticket = Ticket.objects.select_related("customer__user").get(pk=ticket_id)
        send_ticket_created(ticket)
        logger.info("Ticket created email sent for %s", ticket.ticket_number)
    except Ticket.DoesNotExist:
        logger.warning("send_ticket_opened_email: ticket %s not found, skipping.", ticket_id)
    except Exception as exc:
        logger.exception("send_ticket_opened_email failed for ticket %s", ticket_id)
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_ticket_assigned_notification(self, ticket_id: str) -> None:
    """
    Notify the customer (and freelancer) when a ticket is assigned.
    Retries up to 3 times on transient failures.
    """
    from .models import Ticket
    from .services.email_service import send_ticket_assigned
    try:
        ticket = Ticket.objects.select_related(
            "customer__user", "assigned_to__user"
        ).get(pk=ticket_id)
        if not ticket.assigned_to:
            logger.warning(
                "send_ticket_assigned_notification: ticket %s has no assignee, skipping.",
                ticket_id,
            )
            return
        send_ticket_assigned(ticket)
        logger.info(
            "Ticket assigned email sent for %s → %s",
            ticket.ticket_number,
            ticket.assigned_to.user.email,
        )
    except Ticket.DoesNotExist:
        logger.warning("send_ticket_assigned_notification: ticket %s not found, skipping.", ticket_id)
    except Exception as exc:
        logger.exception("send_ticket_assigned_notification failed for ticket %s", ticket_id)
        raise self.retry(exc=exc)


@shared_task
def check_sla_breaches() -> None:
    """
    Scan all open/assigned/in-progress tickets for SLA deadline breaches.
    Called every 5 minutes by Celery Beat.
    """
    from .services.sla_service import run_sla_check_for_all_open_tickets
    try:
        run_sla_check_for_all_open_tickets()
    except Exception:
        logger.exception("check_sla_breaches task failed")


@shared_task
def process_payout_batch() -> None:
    """
    Collect all closed tickets with unpaid freelancer payouts and
    create a payout batch for admin review.
    Called weekly (every Monday) by Celery Beat.
    Full implementation in Phase 4 (payout_service).
    """
    logger.info(
        "process_payout_batch: payout processing is scheduled for Phase 4. "
        "No action taken."
    )


@shared_task
def sync_ticket_to_osticket(ticket_id: str) -> None:
    """
    Push a new ticket to the osTicket external helpdesk.
    Full implementation in Phase 4 (osTicket/Zammad integration).
    """
    logger.info(
        "sync_ticket_to_osticket: external helpdesk sync is scheduled for Phase 4. "
        "ticket_id=%s — no action taken.",
        ticket_id,
    )
