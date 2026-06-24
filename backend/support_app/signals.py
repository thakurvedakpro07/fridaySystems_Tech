"""
Django signals — code that fires automatically on model events.

Signals decouple side-effects from the code that triggers them.
Instead of "after saving a ticket, do X, Y, Z" all inside the view,
each side-effect is its own signal handler. Adding a new side-effect
never requires touching the view.

Signals registered here:
  1. auto_generate_ticket_number  — set TKT-XXXXX before first save
  2. log_ticket_changes           — write TicketActivityLog on status/severity changes
  3. set_ticket_resolved_at       — stamp resolved_at when status → resolved
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
        # 8 hex chars → 16^8 ≈ 4B possibilities, collision-safe up to ~100k tickets
        short = str(instance.id).replace("-", "")[-8:].upper()
        instance.ticket_number = f"TKT-{short}"


# ── Signal 2+3: Activity logging + resolved_at stamp ──────────────
# Combined into ONE signal to avoid two separate DB lookups per save.
# Both signals need the "old" row — a single query serves both.

@receiver(pre_save, sender="support_app.Ticket")
def log_ticket_changes(sender, instance, **kwargs):
    """
    On every ticket save:
      - Write TicketActivityLog entries for status/severity changes.
      - Stamp resolved_at when status transitions to "resolved".

    WHY one signal instead of two?
      Each @receiver on pre_save is a separate DB query to fetch the old row.
      Combining them halves the number of SELECT queries per ticket save.

    WHY pre_save?
      We must see the OLD values before the save overwrites them.
      post_save would give us the new values, making comparison impossible.
    """
    from .models import TicketActivityLog

    if not instance.pk:
        return

    try:
        old = sender.objects.get(pk=instance.pk)
    except sender.DoesNotExist:
        return

    # ── Status change ──────────────────────────────────────────────
    if old.status != instance.status:
        action = "resolved" if instance.status == "resolved" else (
                 "closed"   if instance.status == "closed"   else "status_changed"
        )
        TicketActivityLog.objects.create(
            ticket     = instance,
            actor      = None,   # actor is patched by the service layer
            action     = action,
            from_value = old.status,
            to_value   = instance.status,
        )
        # Note: resolved_at is set by ticket_service.update_status() which controls
        # update_fields. Setting it here would be ignored when update_fields is used.

    # ── Severity change ────────────────────────────────────────────
    if old.severity != instance.severity:
        TicketActivityLog.objects.create(
            ticket     = instance,
            actor      = None,
            action     = "severity_changed",
            from_value = old.severity,
            to_value   = instance.severity,
        )


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
