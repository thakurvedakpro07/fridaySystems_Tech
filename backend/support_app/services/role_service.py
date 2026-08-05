"""
Guarded logic for changing a CustomUser's site-wide role.

Centralized here so both the direct Super Admin promotion flow
(views.ops_change_role) and the Staff Invitation accept flow share one
authoritative implementation of the role-transition matrix, the
is_staff/is_superuser sync, and the RoleChangeAudit trail — rather than two
copies that could silently drift apart.
"""

from django.db import transaction

from ..models import RoleChangeAudit

_ROLE_DISPLAY = {
    "customer": "Customer",
    "freelancer": "Engineer",
    "admin": "Super Admin",
    "operations_manager": "Operations Manager",
    "finance_manager": "Finance Manager",
    "support_agent": "Support Agent",
}

# Transitions allowed for a Super Admin to apply. Callers are responsible for
# their own permission checks — this dict only governs which role→role moves
# are valid, not who may request them.
ALLOWED_TRANSITIONS = {
    "customer":            {"freelancer", "operations_manager", "finance_manager", "support_agent", "admin"},
    "freelancer":          {"customer", "operations_manager", "finance_manager", "support_agent", "admin"},
    "operations_manager":  {"customer", "freelancer", "finance_manager", "support_agent", "admin"},
    "finance_manager":     {"customer", "operations_manager", "support_agent"},
    "support_agent":       {"customer", "operations_manager", "finance_manager"},
    "admin":               {"operations_manager"},  # Super Admin can step down to ops_manager
}


class RoleTransitionError(Exception):
    """Raised when a requested role change is not a valid transition."""


def apply_role_change(target_user, new_role, changed_by, note=""):
    """
    Change target_user.role, syncing is_staff/is_superuser (only "admin"
    gets both) and writing an immutable RoleChangeAudit row.

    Raises RoleTransitionError if target_user already has new_role, or if
    the old_role -> new_role move isn't in ALLOWED_TRANSITIONS. Callers are
    responsible for their own permission checks and for wrapping this in a
    transaction if it needs to be atomic with other writes.
    """
    old_role = target_user.role

    if old_role == new_role:
        raise RoleTransitionError(f"User already has role '{_ROLE_DISPLAY.get(old_role, old_role)}'.")

    allowed = ALLOWED_TRANSITIONS.get(old_role, set())
    if new_role not in allowed:
        raise RoleTransitionError(
            f"Cannot change role from '{_ROLE_DISPLAY.get(old_role, old_role)}' "
            f"to '{_ROLE_DISPLAY.get(new_role, new_role)}'."
        )

    with transaction.atomic():
        target_user.role = new_role
        target_user.is_staff = (new_role == "admin")
        target_user.is_superuser = (new_role == "admin")
        target_user.save(update_fields=["role", "is_staff", "is_superuser"])

        RoleChangeAudit.objects.create(
            changed_by=changed_by,
            target_user=target_user,
            target_email=target_user.email,
            old_role=old_role,
            new_role=new_role,
            note=note,
        )

    return old_role


def can_transition(old_role, new_role):
    """True if old_role -> new_role is a valid transition (or a no-op check
    is desired by the caller — this does NOT treat old_role == new_role as
    valid; callers should check that separately if it matters to them)."""
    return new_role in ALLOWED_TRANSITIONS.get(old_role, set())
