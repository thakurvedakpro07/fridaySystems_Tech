"""
Ticket business logic — the service layer.

RULE: Views should be thin. They validate input and return HTTP responses.
Business logic — changing ticket state, logging, sending notifications —
lives here so it can be called from views, Celery tasks, and tests equally.

All public functions in this module follow the same contract:
  - Accept model instances (not raw IDs) as arguments
  - Return the created/modified object
  - Raise ValueError for invalid operations with a human-readable message
  - Never raise HTTP exceptions (that's the view's job)
"""

from django.db import transaction
from django.utils import timezone

from ..models import Ticket, TicketActivityLog, TicketAssignment, TicketComment


def create_ticket(customer, validated_data: dict) -> Ticket:
    """
    Create a new ticket in "pending_payment" state.

    In the full payment flow (Phase 5), tickets move from pending_payment
    to open after Razorpay confirms payment. The signal auto_generate_ticket_number
    sets the ticket_number. The signal log_ticket_created writes the first
    TicketActivityLog entry.

    Args:
        customer:       Customer model instance (the buyer)
        validated_data: dict from TicketCreateSerializer.validated_data
                        keys: title, description, service_type, severity

    Returns: saved Ticket instance
    """
    ticket = Ticket.objects.create(
        customer=customer,
        status="pending_payment",
        **validated_data,
    )
    from .email_service import send_ticket_created
    transaction.on_commit(lambda: send_ticket_created(ticket))
    return ticket


def assign_ticket(ticket: Ticket, freelancer, assigned_by) -> TicketAssignment:
    """
    Assign a ticket to a freelancer and record the full history.

    This function does FOUR things in sequence:
      1. Closes the previous TicketAssignment record (if any)
      2. Updates Ticket.assigned_to and Ticket.status
      3. Creates a new TicketAssignment record
      4. Writes a TicketActivityLog entry with the actor explicitly set

    WHY do we need both Ticket.assigned_to AND TicketAssignment?
      Ticket.assigned_to = who has it NOW (overwritten each time)
      TicketAssignment   = every assignment ever (permanent history)

    Args:
        ticket:      Ticket to assign
        freelancer:  Freelancer to assign to
        assigned_by: CustomUser who is making the assignment (usually admin)

    Returns: the new TicketAssignment record
    """
    with transaction.atomic():
        old_freelancer = ticket.assigned_to
        reason = "initial" if old_freelancer is None else "reassigned"

        # Step 1: Close any currently open assignment for this ticket
        if old_freelancer:
            TicketAssignment.objects.filter(
                ticket=ticket,
                unassigned_at__isnull=True,  # only the active (open) assignment
            ).update(unassigned_at=timezone.now())

        # Step 2: Update the ticket itself
        # update_fields avoids overwriting fields another concurrent request changed
        old_status = ticket.status
        ticket.assigned_to = freelancer
        ticket.status = "in_progress"
        ticket.save(update_fields=["assigned_to", "status", "updated_at"])

        # Patch the signal-written status_changed log so it shows the real actor
        # (signals can't know who triggered the save; the service layer can)
        TicketActivityLog.objects.filter(
            ticket=ticket,
            action="status_changed",
            from_value=old_status,
            to_value="in_progress",
            actor__isnull=True,
        ).order_by("-created_at").update(actor=assigned_by)

        # Step 3: Record the new assignment
        assignment = TicketAssignment.objects.create(
            ticket=ticket,
            freelancer=freelancer,
            assigned_by=assigned_by,
            reason=reason,
        )

        # Step 4: Log the event with the actor explicitly set
        from_label = old_freelancer.user.email if old_freelancer else ""
        TicketActivityLog.objects.create(
            ticket=ticket,
            actor=assigned_by,
            action="assigned" if reason == "initial" else "reassigned",
            from_value=from_label,
            to_value=freelancer.user.email,
        )

        from .email_service import send_ticket_assigned
        transaction.on_commit(lambda: send_ticket_assigned(ticket))

    return assignment


def unassign_ticket(ticket: Ticket, actor, reason: str = "admin_action", note: str = "") -> None:
    """
    Remove the current freelancer assignment from a ticket.

    Sets ticket back to "open" and closes the TicketAssignment record.

    Args:
        ticket: Ticket to unassign
        actor:  CustomUser performing the unassignment
        reason: reason code from TicketAssignment.REASON_CHOICES
        note:   optional explanation shown in activity log
    """
    if ticket.assigned_to is None:
        raise ValueError("This ticket is not currently assigned to anyone.")

    with transaction.atomic():
        old_freelancer = ticket.assigned_to

        TicketAssignment.objects.filter(
            ticket=ticket,
            unassigned_at__isnull=True,
        ).update(unassigned_at=timezone.now())

        ticket.assigned_to = None
        ticket.status = "open"
        ticket.save(update_fields=["assigned_to", "status", "updated_at"])

        TicketActivityLog.objects.create(
            ticket=ticket,
            actor=actor,
            action="unassigned",
            from_value=old_freelancer.user.email,
            to_value="",
            note=note,
        )


def add_comment(
    ticket: Ticket,
    author,
    body: str,
    is_internal: bool = False,
) -> TicketComment:
    """
    Add a comment to a ticket.

    Public comments are visible to all parties.
    Internal comments (is_internal=True) are visible only to admins/freelancers.

    Also tracks first_response_at: the timestamp of the first PUBLIC comment
    posted by a non-customer. This starts the SLA "first response" clock.

    Args:
        ticket:      Ticket to comment on
        author:      CustomUser posting the comment
        body:        Comment text
        is_internal: True = admin/freelancer private note

    Returns: the saved TicketComment instance
    """
    with transaction.atomic():
        comment = TicketComment.objects.create(
            ticket=ticket,
            author=author,
            body=body,
            is_internal=is_internal,
        )

        # Track first response time for SLA
        # Condition: public comment by a non-customer who hasn't responded before
        is_responder = (
            not hasattr(author, "customer_profile")
            or author.customer_profile != ticket.customer
        )
        if not is_internal and is_responder and ticket.first_response_at is None:
            ticket.first_response_at = comment.created_at
            ticket.save(update_fields=["first_response_at", "updated_at"])

        if not is_internal:
            TicketActivityLog.objects.create(
                ticket=ticket,
                actor=author,
                action="comment_added",
            )
            # Notify the OTHER party (not the author):
            # If customer commented → notify assigned freelancer + admins
            # If freelancer/admin commented → notify customer
            from .email_service import send_comment_notification
            is_customer_comment = hasattr(author, "customer_profile") and author.customer_profile == ticket.customer
            if is_customer_comment and ticket.assigned_to:
                transaction.on_commit(
                    lambda: send_comment_notification(ticket, comment, ticket.assigned_to.user)
                )
            elif not is_customer_comment:
                transaction.on_commit(
                    lambda: send_comment_notification(ticket, comment, ticket.customer.user)
                )

    return comment


def update_status(ticket: Ticket, new_status: str, actor, note: str = "") -> Ticket:
    """
    Safely change a ticket's status with proper logging.

    The signal writes a status_changed log with actor=None (signals don't
    know the actor). This function patches that log entry with the real actor.

    Args:
        ticket:     Ticket to update
        new_status: one of Ticket.STATUS_CHOICES keys
        actor:      CustomUser making the change
        note:       optional context for the log

    Returns: the updated Ticket
    Raises:  ValueError for invalid status or closed ticket
    """
    valid_statuses = [s[0] for s in Ticket.STATUS_CHOICES]
    if new_status not in valid_statuses:
        raise ValueError(
            f"Invalid status: {new_status!r}. Must be one of {valid_statuses}"
        )
    if ticket.status == "closed":
        raise ValueError("A closed ticket cannot be updated.")

    with transaction.atomic():
        old_status = ticket.status
        ticket.status = new_status

        if new_status == "resolved" and ticket.resolved_at is None:
            ticket.resolved_at = timezone.now()
        elif new_status not in ("resolved", "closed") and old_status == "resolved":
            # Ticket reopened from resolved — clear the resolved timestamp
            ticket.resolved_at = None

        ticket.save(update_fields=["status", "resolved_at", "updated_at"])

        # Patch the signal-written log entry to include the real actor
        TicketActivityLog.objects.filter(
            ticket=ticket,
            action__in=["status_changed", "resolved", "closed"],
            from_value=old_status,
            to_value=new_status,
            actor__isnull=True,
        ).order_by("-created_at").update(actor=actor, note=note)

        if new_status == "resolved":
            from .email_service import send_ticket_resolved
            transaction.on_commit(lambda: send_ticket_resolved(ticket))

    return ticket
