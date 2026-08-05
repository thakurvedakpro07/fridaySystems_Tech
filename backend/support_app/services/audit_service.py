"""
System-wide audit trail — writes to the AuditLog model.

log_action() is the single function every view calls to record an important
admin action (user deactivated, service edited, payment refunded, etc.).

WHY this is separate from RoleChangeAudit / TicketActivityLog?
  Those two models are narrow, purpose-built audit trails (role changes only,
  ticket events only) with their own read UIs. AuditLog is the general-purpose
  "everything else" trail — covers actions with no dedicated model of their own.
"""

import logging

from ..models import AuditLog

logger = logging.getLogger(__name__)


def get_client_ip(request):
    """
    Behind the Nginx reverse proxy (see admin.py's note on /django-admin/ routing),
    the real client IP arrives in X-Forwarded-For, not REMOTE_ADDR. Take the first
    (client) address in that comma-separated chain; fall back to REMOTE_ADDR for
    local/dev requests where no proxy sets the header.

    Public (no leading underscore) because it also has a call site outside this
    module — RegisterSerializer/google_auth_view use it to stamp ConsentRecord.ip_address.
    """
    if request is None:
        return None
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def log_action(user, entity: str, action: str, entity_id=None, metadata=None, request=None):
    """
    Create one immutable AuditLog row.

    Never raises — this is a side effect attached to an already-successful admin
    action (e.g. a refund that already succeeded at the payment gateway). A failure
    here must not turn that success into a 500 response; log and move on instead.

    Args:
        user:      CustomUser instance who performed the action (the actor),
                   or None for a system-detected event with no real actor
                   (e.g. a brute-force lockout against a nonexistent email —
                   see account_protection_service.py). Written as
                   user_id=None, user_type="system".
        entity:    Short name of the thing acted on, e.g. "user", "service", "payment".
        action:    Short event name, e.g. "user_deactivated", "service_created".
        entity_id: UUID of the affected row, if any.
        metadata:  Optional JSON-serializable dict with extra context.
        request:   Optional DRF/Django request — used to extract the client IP.
    """
    try:
        AuditLog.objects.create(
            user_id=user.pk if user is not None else None,
            user_type=getattr(user, "role", "admin") if user is not None else "system",
            entity=entity,
            entity_id=entity_id,
            action=action,
            metadata=metadata or {},
            ip_address=get_client_ip(request),
        )
    except Exception:
        logger.exception("log_action failed for entity=%s action=%s", entity, action)
