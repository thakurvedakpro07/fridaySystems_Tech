"""
Django signals — code that fires automatically on model events.

Signals decouple side-effects from the code that triggers them.
Instead of "after saving a ticket, do X, Y, Z" all inside the view,
each side-effect is its own signal handler. Adding a new side-effect
never requires touching the view.

Signals registered here:
  1. auto_generate_ticket_number  — set TKT-XXXXX before first save
  2. log_ticket_status_change     — write TicketActivityLog on status change
  3. log_ticket_priority_change   — write TicketActivityLog on priority change
  4. set_ticket_resolved_at       — stamp resolved_at when status → resolved
"""

from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from django.utils import timezone


# ── Signal 1: Ticket number generation ───────────────────────────
# pre_save fires BEFORE the row is written to the database.
# We generate the ticket number here so it's available immediately
# after the first .save() call returns.

@receiver(pre_save, sender="support_app.Ticket")
def auto_generate_ticket_number(sender, instance, **kwargs):
    """
    Generate a readable TKT-XXXXX identifier before a ticket is first saved.

    WHY pre_save, not post_save?
      post_save fires after the row is written — at that point the ticket
      number would be blank in the database and we'd need a second save().
      pre_save fires before the write, so we set it once cleanly.

    WHY use the UUID tail instead of a sequential counter?
      A sequential counter requires a database lock to be safe (two simultaneous
      saves could get the same number). UUID tail is collision-resistant without
      any locking, which is important for performance at scale.

    Future improvement: replace with an atomic database sequence for truly
    sequential numbers (TKT-00001, TKT-00002) using PostgreSQL SEQUENCE.
    """
    if not instance.ticket_number:
        short = str(instance.id).replace("-", "")[-5:].upper()
        instance.ticket_number = f"TKT-{short}"


# ── Signal 2: Activity logging on status change ───────────────────
# We use pre_save to compare old vs new value before the save happens.
# After save, the old value is gone from the database — we can't compare.

@receiver(pre_save, sender="support_app.Ticket")
def log_ticket_status_change(sender, instance, **kwargs):
    """
    Write a TicketActivityLog entry whenever a ticket's status changes.

    WHY NOT post_save?
      post_save fires after the row is written. At that point, fetching
      the "old" status from the database gives you the NEW status — Django
      already committed the change. We must compare in pre_save while
      the old row still exists.

    HOW we get the old value:
      We query the database for the current row before this save overwrites it.
      If the ticket is brand new (pk doesn't exist yet), there is no old row,
      so we log "created" instead.

    WHY use string reference "support_app.Ticket" in @receiver?
      Using the model class directly (sender=Ticket) works but creates a
      circular import risk if signals.py is imported before models.py is
      fully loaded. The string reference lets Django resolve it lazily
      after all models are loaded. Safe regardless of import order.
    """
    from .models import TicketActivityLog

    if not instance.pk:
        # Brand new ticket — log creation in post_save instead (pk exists then)
        return

    try:
        old = sender.objects.get(pk=instance.pk)
    except sender.DoesNotExist:
        return

    # Status change
    if old.status != instance.status:
        action = "resolved" if instance.status == "resolved" else (
                 "closed"   if instance.status == "closed"   else "status_changed"
        )
        TicketActivityLog.objects.create(
            ticket     = instance,
            actor      = None,   # actor is set by the service layer when possible
            action     = action,
            from_value = old.status,
            to_value   = instance.status,
        )

    # Priority change
    if old.priority != instance.priority:
        TicketActivityLog.objects.create(
            ticket     = instance,
            actor      = None,
            action     = "priority_changed",
            from_value = old.priority,
            to_value   = instance.priority,
        )

    # Severity change
    if old.severity != instance.severity:
        TicketActivityLog.objects.create(
            ticket     = instance,
            actor      = None,
            action     = "severity_changed",
            from_value = old.severity,
            to_value   = instance.severity,
        )


# ── Signal 3: Stamp resolved_at on resolution ────────────────────

@receiver(pre_save, sender="support_app.Ticket")
def set_ticket_resolved_at(sender, instance, **kwargs):
    """
    Set resolved_at timestamp the moment a ticket moves to "resolved".

    WHY not just set this in the view?
      If anyone resolves a ticket from admin panel, a Celery task, or a
      management command — they'd all need to remember to set resolved_at.
      A signal guarantees it happens regardless of who triggers the save.
    """
    if not instance.pk:
        return
    try:
        old = sender.objects.get(pk=instance.pk)
    except sender.DoesNotExist:
        return

    if old.status != "resolved" and instance.status == "resolved":
        instance.resolved_at = timezone.now()


# ── Signal 4: Log ticket creation ────────────────────────────────

@receiver(post_save, sender="support_app.Ticket")
def log_ticket_created(sender, instance, created, **kwargs):
    """
    Write the first TicketActivityLog entry when a ticket is created.

    WHY post_save (not pre_save)?
      When created=True, the ticket just got its pk for the first time.
      TicketActivityLog.ticket is a ForeignKey — it needs the pk to exist
      in the database before creating the related row.
    """
    from .models import TicketActivityLog

    if created:
        TicketActivityLog.objects.create(
            ticket     = instance,
            actor      = instance.customer.user,
            action     = "created",
            from_value = "",
            to_value   = instance.status,
        )
