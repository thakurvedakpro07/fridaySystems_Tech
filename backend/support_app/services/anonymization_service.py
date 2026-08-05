"""
DPDP Act 2023 right-to-erasure — actual PII scrubbing.

Called only from tasks.anonymize_pending_deletions, 30+ days after a user
self-requests deletion via views.request_account_deletion. Never a hard row
delete: Payment.customer, Payout.freelancer, Subscription.customer, and
Ticket.customer are all on_delete=PROTECT (see Ticket's own docstring —
"If a customer churns, we archive them, not delete them"), and GST law
requires retaining invoice records regardless. So "erasure" means the PII
fields on CustomUser/Customer/Freelancer get scrubbed in place while the
user row — and every financial/ticket record pointing at it — stays intact.
"""

from django.utils import timezone


def anonymize_user(user):
    """
    Idempotent — a no-op if `user` is already anonymized, since
    tasks.anonymize_pending_deletions may retry a row across multiple
    daily runs if an earlier attempt failed partway.
    """
    if user.anonymized_at:
        return

    user.email = f"deleted-{user.id}@deleted.resolvehq.invalid"
    user.first_name = ""
    user.last_name = ""
    user.is_active = False
    user.set_unusable_password()
    user.anonymized_at = timezone.now()
    user.save(update_fields=["email", "first_name", "last_name", "is_active", "password", "anonymized_at"])

    if hasattr(user, "customer_profile"):
        profile = user.customer_profile
        profile.company = ""
        profile.phone = ""
        profile.address = ""
        profile.gstin = ""
        profile.oauth_provider = None
        profile.oauth_id = None
        profile.save(update_fields=["company", "phone", "address", "gstin", "oauth_provider", "oauth_id"])
    elif hasattr(user, "freelancer_profile"):
        profile = user.freelancer_profile
        profile.skills = ""
        profile.payout_details = {}
        profile.active = False
        profile.save(update_fields=["skills", "payout_details", "active"])
