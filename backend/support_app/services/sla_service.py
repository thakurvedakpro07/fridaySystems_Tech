"""
SLA monitoring logic.

SLA (Service Level Agreement) defines how fast we must respond to and
resolve each ticket. This service:
  1. Looks up the applicable SLA policy (from SLAPolicy table or defaults)
  2. Sets due_at on a ticket when it opens
  3. Checks whether active tickets have breached their deadline
  4. Is called by the check_sla_breaches Celery Beat task every 5 minutes
"""

import logging

from django.utils import timezone

logger = logging.getLogger(__name__)

# Default SLA windows (seconds) used when no matching SLAPolicy row exists.
# Keyed by severity. Values: (first_response_seconds, resolution_seconds)
# first_response_seconds: how long until the engineer first contacts the customer.
# This must match the SLA_MESSAGE / SLA_TIME constants in the frontend
# (TicketDetail.jsx) and the "consultation deadline" shown to customers.
_DEFAULTS = {
    "critical": (30 * 60,   8 * 3600),   # 30 min first contact, 8 h resolution
    "high":     (1 * 3600, 24 * 3600),   # 1 h first contact,  24 h resolution
    "medium":   (2 * 3600, 48 * 3600),   # 2 h first contact,  48 h resolution
    "low":      (4 * 3600, 72 * 3600),   # 4 h first contact,  72 h resolution
}


def get_sla_policy(service_type: str, severity: str, plan: str = "default"):
    """
    Return an SLAPolicy instance for the given ticket attributes.

    Resolution order:
      1. Exact match: (service_type, severity, plan)
      2. Default plan: (service_type, severity, "default")
      3. None — caller should use _DEFAULTS

    Returns: SLAPolicy instance or None
    """
    from ..models import SLAPolicy
    for lookup_plan in (plan, "default"):
        try:
            return SLAPolicy.objects.get(
                service_type=service_type,
                severity=severity,
                plan=lookup_plan,
            )
        except SLAPolicy.DoesNotExist:
            continue
        except Exception:
            logger.exception("Error querying SLAPolicy for %s/%s/%s", service_type, severity, lookup_plan)
            return None
    return None


def set_ticket_due_at(ticket) -> None:
    """
    Compute and save `due_at` and `first_response_due_at` for a ticket that
    just moved to 'open' status.

    Idempotent: if `due_at` is already set this is a no-op, protecting against
    accidental re-initialization on engineer reassignment or status transitions
    that pass back through 'open'.

    Called from payment_service._open_ticket_after_payment() when payment is
    confirmed and the ticket transitions from pending_payment → open.
    """
    if ticket.due_at is not None:
        return  # SLA already initialized — do not reset

    policy = get_sla_policy(ticket.service_type, ticket.severity)
    if policy:
        first_response_seconds = policy.first_response_seconds
        resolution_seconds = policy.resolution_seconds
    else:
        first_response_seconds, resolution_seconds = _DEFAULTS.get(
            ticket.severity, _DEFAULTS["medium"]
        )

    now = timezone.now()
    ticket.due_at = now + timezone.timedelta(seconds=resolution_seconds)
    ticket.first_response_due_at = now + timezone.timedelta(seconds=first_response_seconds)
    ticket.save(update_fields=["due_at", "first_response_due_at"])

    from ..models import SLALog
    SLALog.objects.create(
        ticket=ticket,
        event="created",
        status="pending",
        target_seconds=resolution_seconds,
        notes=(
            f"SLA initialized: first_response_due={ticket.first_response_due_at.isoformat()}, "
            f"resolution_due={ticket.due_at.isoformat()}"
        ),
    )


def check_ticket_sla(ticket) -> None:
    """
    Evaluate whether a single ticket has breached its resolution SLA deadline.

    If breached:
      - Sets sla_breach_notified = True to prevent duplicate alerts
      - Writes a SLALog "breach" entry
      - Creates an in-app notification for admin users
    """
    if not ticket.due_at or ticket.sla_breach_notified:
        return

    now = timezone.now()
    if now <= ticket.due_at:
        return

    elapsed_seconds = int((now - ticket.due_at).total_seconds())

    try:
        ticket.sla_breach_notified = True
        ticket.save(update_fields=["sla_breach_notified"])

        from ..models import SLALog
        SLALog.objects.create(
            ticket=ticket,
            event="breach",
            status="missed",
            actual_seconds=elapsed_seconds,
            notes=f"Deadline was {ticket.due_at.isoformat()}; now {now.isoformat()}",
        )

        _notify_admins_of_breach(ticket)

        logger.warning(
            "SLA breach: ticket %s (%s) overdue by %ds",
            ticket.ticket_number,
            ticket.severity,
            elapsed_seconds,
        )
    except Exception:
        logger.exception("Failed to process SLA breach for ticket %s", ticket.ticket_number)


def _notify_admins_of_breach(ticket) -> None:
    """Create in-app SLA breach notifications for all admin users."""
    try:
        from django.contrib.auth import get_user_model
        from .notification_service import create_notification
        User = get_user_model()
        admins = User.objects.filter(is_staff=True, is_active=True)
        for admin in admins:
            create_notification(
                recipient=admin,
                category="sla_breach",
                title=f"SLA Breach: {ticket.ticket_number}",
                body=(
                    f"Ticket {ticket.ticket_number} ({ticket.severity} severity) "
                    f"has exceeded its resolution deadline."
                ),
                ticket=ticket,
            )
    except Exception:
        logger.exception("Failed to send SLA breach notifications for ticket %s", ticket.ticket_number)


def run_sla_check_for_all_open_tickets() -> None:
    """
    Called by Celery Beat every 5 minutes.

    Queries all active tickets that have a due_at set and haven't been
    flagged as breached yet, then evaluates each one.
    """
    from ..models import Ticket
    active_statuses = ["open", "assigned", "in_progress", "waiting_customer"]
    tickets = Ticket.objects.filter(
        status__in=active_statuses,
        due_at__isnull=False,
        sla_breach_notified=False,
    ).select_related("customer__user")

    count = tickets.count()
    if count == 0:
        logger.debug("SLA check: no active tickets with deadlines to check.")
        return

    logger.info("SLA check: evaluating %d ticket(s).", count)
    breaches = 0
    for ticket in tickets.iterator():
        try:
            was_notified = ticket.sla_breach_notified
            check_ticket_sla(ticket)
            if ticket.sla_breach_notified and not was_notified:
                breaches += 1
        except Exception:
            logger.exception("SLA check error on ticket %s", getattr(ticket, "ticket_number", "?"))

    logger.info("SLA check complete: %d breach(es) detected out of %d ticket(s).", breaches, count)
