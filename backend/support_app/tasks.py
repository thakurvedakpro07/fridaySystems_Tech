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


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_ticket_resolved_email(self, ticket_id: str) -> None:
    """
    Notify the customer when their ticket is marked resolved.
    Retries up to 3 times on transient failures.
    """
    from .models import Ticket
    from .services.email_service import send_ticket_resolved
    try:
        ticket = Ticket.objects.select_related("customer__user").get(pk=ticket_id)
        send_ticket_resolved(ticket)
        logger.info("Ticket resolved email sent for %s", ticket.ticket_number)
    except Ticket.DoesNotExist:
        logger.warning("send_ticket_resolved_email: ticket %s not found, skipping.", ticket_id)
    except Exception as exc:
        logger.exception("send_ticket_resolved_email failed for ticket %s", ticket_id)
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_comment_notification_email(self, ticket_id: str, comment_id: str, recipient_user_id: str) -> None:
    """
    Notify the other party in a ticket conversation of a new public comment.
    Retries up to 3 times on transient failures.
    """
    from django.contrib.auth import get_user_model
    from .models import Ticket, TicketComment
    from .services.email_service import send_comment_notification
    User = get_user_model()
    try:
        ticket = Ticket.objects.select_related("customer__user").get(pk=ticket_id)
        comment = TicketComment.objects.get(pk=comment_id)
        recipient_user = User.objects.get(pk=recipient_user_id)
        send_comment_notification(ticket, comment, recipient_user)
        logger.info("Comment notification email sent for %s", ticket.ticket_number)
    except (Ticket.DoesNotExist, TicketComment.DoesNotExist, User.DoesNotExist):
        logger.warning(
            "send_comment_notification_email: ticket %s / comment %s / recipient %s not found, skipping.",
            ticket_id, comment_id, recipient_user_id,
        )
    except Exception as exc:
        logger.exception("send_comment_notification_email failed for ticket %s", ticket_id)
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_resolution_rejected_email(self, ticket_id: str, note: str = "") -> None:
    """
    Notify the assigned engineer that the customer rejected a resolution.
    Retries up to 3 times on transient failures.
    """
    from .models import Ticket
    from .services.email_service import send_resolution_rejected
    try:
        ticket = Ticket.objects.select_related("assigned_to__user").get(pk=ticket_id)
        send_resolution_rejected(ticket, note=note)
        logger.info("Resolution rejected email sent for %s", ticket.ticket_number)
    except Ticket.DoesNotExist:
        logger.warning("send_resolution_rejected_email: ticket %s not found, skipping.", ticket_id)
    except Exception as exc:
        logger.exception("send_resolution_rejected_email failed for ticket %s", ticket_id)
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_welcome_email(self, user_id: str) -> None:
    """
    Send the welcome email to a newly registered customer.
    Retries up to 3 times on transient failures.
    """
    from django.contrib.auth import get_user_model
    from .services.email_service import send_welcome
    User = get_user_model()
    try:
        user = User.objects.get(pk=user_id)
        send_welcome(user)
        logger.info("Welcome email sent for user %s", user_id)
    except User.DoesNotExist:
        logger.warning("send_welcome_email: user %s not found, skipping.", user_id)
    except Exception as exc:
        logger.exception("send_welcome_email failed for user %s", user_id)
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_verification_email_task(self, user_id: str) -> None:
    """
    Send (or resend) the email-verification link to a user.
    Retries up to 3 times on transient failures.
    """
    from django.contrib.auth import get_user_model
    from .services.email_service import send_verification_email
    User = get_user_model()
    try:
        user = User.objects.get(pk=user_id)
        send_verification_email(user)
        logger.info("Verification email sent for user %s", user_id)
    except User.DoesNotExist:
        logger.warning("send_verification_email_task: user %s not found, skipping.", user_id)
    except Exception as exc:
        logger.exception("send_verification_email_task failed for user %s", user_id)
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_password_reset_email_task(self, user_id: str, uid: str, token: str) -> None:
    """
    Send a password reset link to a user.
    Retries up to 3 times on transient failures.
    """
    from django.contrib.auth import get_user_model
    from .services.email_service import send_password_reset_email
    User = get_user_model()
    try:
        user = User.objects.get(pk=user_id)
        send_password_reset_email(user, uid, token)
        logger.info("Password reset email sent for user %s", user_id)
    except User.DoesNotExist:
        logger.warning("send_password_reset_email_task: user %s not found, skipping.", user_id)
    except Exception as exc:
        logger.exception("send_password_reset_email_task failed for user %s", user_id)
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_organization_invitation_email(self, invitation_id: str) -> None:
    """
    Send an organization membership invitation email.
    Retries up to 3 times on transient failures.
    """
    from .models import OrganizationInvitation
    from .services.email_service import send_organization_invitation
    try:
        invitation = OrganizationInvitation.objects.select_related("organization", "invited_by").get(pk=invitation_id)
        send_organization_invitation(invitation)
        logger.info("Organization invitation email sent for invitation %s", invitation_id)
    except OrganizationInvitation.DoesNotExist:
        logger.warning("send_organization_invitation_email: invitation %s not found, skipping.", invitation_id)
    except Exception as exc:
        logger.exception("send_organization_invitation_email failed for invitation %s", invitation_id)
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_staff_invitation_email(self, invitation_id: str) -> None:
    """
    Send a staff invitation email (Engineer/Admin role).
    Retries up to 3 times on transient failures.
    """
    from .models import StaffInvitation
    from .services.email_service import send_staff_invitation
    try:
        invitation = StaffInvitation.objects.select_related("invited_by").get(pk=invitation_id)
        send_staff_invitation(invitation)
        logger.info("Staff invitation email sent for invitation %s", invitation_id)
    except StaffInvitation.DoesNotExist:
        logger.warning("send_staff_invitation_email: invitation %s not found, skipping.", invitation_id)
    except Exception as exc:
        logger.exception("send_staff_invitation_email failed for invitation %s", invitation_id)
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_deletion_requested_email(self, user_id: str) -> None:
    """
    Confirm a self-service DPDP account-deletion request and its scheduled
    grace-period deadline. Retries up to 3 times on transient failures.
    """
    from datetime import timedelta

    from django.conf import settings
    from django.contrib.auth import get_user_model

    from .services.email_service import send_deletion_requested
    User = get_user_model()
    try:
        user = User.objects.get(pk=user_id)
        scheduled_for = user.deletion_requested_at + timedelta(
            days=settings.ACCOUNT_DELETION_GRACE_PERIOD_DAYS
        )
        send_deletion_requested(user, scheduled_for)
        logger.info("Deletion requested email sent for user %s", user_id)
    except User.DoesNotExist:
        logger.warning("send_deletion_requested_email: user %s not found, skipping.", user_id)
    except Exception as exc:
        logger.exception("send_deletion_requested_email failed for user %s", user_id)
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_deletion_cancelled_email(self, user_id: str) -> None:
    """
    Confirm a self-service DPDP account-deletion request was cancelled.
    Retries up to 3 times on transient failures.
    """
    from django.contrib.auth import get_user_model

    from .services.email_service import send_deletion_cancelled
    User = get_user_model()
    try:
        user = User.objects.get(pk=user_id)
        send_deletion_cancelled(user)
        logger.info("Deletion cancelled email sent for user %s", user_id)
    except User.DoesNotExist:
        logger.warning("send_deletion_cancelled_email: user %s not found, skipping.", user_id)
    except Exception as exc:
        logger.exception("send_deletion_cancelled_email failed for user %s", user_id)
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
def anonymize_pending_deletions() -> None:
    """
    DPDP Act 2023 right to erasure — runs daily. Anonymizes any user whose
    self-service deletion grace period (ACCOUNT_DELETION_GRACE_PERIOD_DAYS,
    default 30) has elapsed. See services/anonymization_service.py for why
    this scrubs PII in place rather than deleting the row.

    Per-row try/except (unlike this module's other single-outer-try tasks):
    this task loops over multiple independent users, so one bad row must not
    abort the whole batch. A failed row simply retries on tomorrow's run,
    since anonymized_at stays null until anonymize_user() actually succeeds.
    """
    from datetime import timedelta

    from django.conf import settings
    from django.contrib.auth import get_user_model
    from django.utils import timezone

    from .services import email_service
    from .services.anonymization_service import anonymize_user
    from .services.audit_service import log_action

    User = get_user_model()
    cutoff = timezone.now() - timedelta(days=settings.ACCOUNT_DELETION_GRACE_PERIOD_DAYS)
    due_users = User.objects.filter(
        deletion_requested_at__isnull=False,
        deletion_requested_at__lte=cutoff,
        anonymized_at__isnull=True,
    )
    for user in due_users:
        try:
            email_service.send_account_anonymized(user.email, user.first_name)
            anonymize_user(user)
            log_action(
                user=None, entity="user", action="user_anonymized",
                entity_id=user.pk, request=None,
            )
            logger.info("Anonymized user %s after deletion grace period elapsed", user.pk)
        except Exception:
            logger.exception("anonymize_pending_deletions failed for user %s", user.pk)
            continue


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
