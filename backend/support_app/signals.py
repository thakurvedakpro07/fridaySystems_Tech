"""
Django signals — code that runs automatically when a model is saved/deleted.

Signals let different parts of the app react to events without
tightly coupling them together.

Example: when a Ticket is saved with status="open", we auto-generate
the ticket number instead of doing it in the view.
"""

import uuid

from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from .models import Ticket


@receiver(pre_save, sender=Ticket)
def auto_generate_ticket_number(sender, instance, **kwargs):
    """
    Assign a TKT-NNNNN number when a ticket is first saved.
    We use the last 5 hex digits of the UUID as a short readable ID.
    Phase 2 will replace this with a proper sequential database counter.
    """
    if not instance.ticket_number:
        short = str(instance.id).replace("-", "")[-5:].upper()
        instance.ticket_number = f"TKT-{short}"
