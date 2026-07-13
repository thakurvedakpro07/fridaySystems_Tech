"""
Custom DRF permission classes.

DRF checks these before running any view logic.
If a permission class returns False, the view returns 403 Forbidden.

Role hierarchy (lowest → highest privilege):
  customer < freelancer(engineer) < support_agent | finance_manager < operations_manager < admin(super_admin)
"""

from rest_framework.permissions import BasePermission


# ── Helper predicates ─────────────────────────────────────────────
# Used both by permission classes and directly in view logic.


def is_customer(user) -> bool:
    """True for authenticated users with role='customer'."""
    return bool(user and user.is_authenticated and getattr(user, "role", None) == "customer")


def is_engineer(user) -> bool:
    """True for authenticated users with role='freelancer' (displayed as 'Engineer' in UI)."""
    return bool(user and user.is_authenticated and getattr(user, "role", None) == "freelancer")


def is_operations_manager(user) -> bool:
    """True for operations managers.

    Ops managers have role='operations_manager' and is_staff=False.
    They cannot access the Django admin panel or any is_staff-gated endpoint.
    """
    return bool(
        user
        and user.is_authenticated
        and not user.is_staff
        and getattr(user, "role", None) == "operations_manager"
    )


def is_finance_manager(user) -> bool:
    """True for Finance Managers (role='finance_manager', is_staff=False)."""
    return bool(
        user
        and user.is_authenticated
        and not user.is_staff
        and getattr(user, "role", None) == "finance_manager"
    )


def is_support_agent(user) -> bool:
    """True for Support Agents (role='support_agent', is_staff=False)."""
    return bool(
        user
        and user.is_authenticated
        and not user.is_staff
        and getattr(user, "role", None) == "support_agent"
    )


def is_internal_staff(user) -> bool:
    """True for any of the four internal staff roles."""
    return bool(
        user
        and user.is_authenticated
        and getattr(user, "role", None) in (
            "admin", "operations_manager", "finance_manager", "support_agent"
        )
    )


def is_super_admin(user) -> bool:
    """True only when both is_staff=True AND role='admin' are set.

    Requiring both prevents privilege escalation if is_staff is accidentally
    granted to a non-admin role. Mirrors the AdminRoute guard in React.
    """
    return bool(user and user.is_authenticated and user.is_staff and getattr(user, "role", None) == "admin")


# ── Permission classes ────────────────────────────────────────────

class IsAdminUser(BasePermission):
    """Only allow Super Admins (is_staff=True AND role='admin')."""
    message = "You must be a Super Admin to perform this action."

    def has_permission(self, request, view):
        return is_super_admin(request.user)


class IsSuperAdmin(BasePermission):
    """Alias for IsAdminUser — clearer name for role management views."""
    message = "Only Super Admins can perform this action."

    def has_permission(self, request, view):
        return is_super_admin(request.user)


class IsCustomer(BasePermission):
    """Only allow users who have a linked Customer profile."""
    message = "Only customers can access this resource."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and hasattr(request.user, "customer_profile")
        )


class IsFreelancer(BasePermission):
    """Only allow users who have an approved Freelancer profile."""
    message = "Only approved engineers can access this resource."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and hasattr(request.user, "freelancer_profile")
            and request.user.freelancer_profile.onboarding_status == "approved"
        )


class IsFreelancerOrAdmin(BasePermission):
    """Allow access to approved engineers AND Super Admins."""
    message = "Only engineers or Super Admins can access this resource."

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if is_super_admin(request.user):
            return True
        return (
            hasattr(request.user, "freelancer_profile")
            and request.user.freelancer_profile.onboarding_status == "approved"
        )


class IsOperationsManager(BasePermission):
    """Only allow users with role='operations_manager' (is_staff=False)."""
    message = "Only Operations Managers can access this resource."

    def has_permission(self, request, view):
        return is_operations_manager(request.user)


class IsFinanceManager(BasePermission):
    """Only allow Finance Managers (role='finance_manager', is_staff=False)."""
    message = "Only Finance Managers can access this resource."

    def has_permission(self, request, view):
        return is_finance_manager(request.user)


class IsSupportAgent(BasePermission):
    """Only allow Support Agents (role='support_agent', is_staff=False)."""
    message = "Only Support Agents can access this resource."

    def has_permission(self, request, view):
        return is_support_agent(request.user)


class IsOpsManagerOrSuperAdmin(BasePermission):
    """Allow Operations Managers AND Super Admins.

    Used for ops dashboard endpoints where both roles should have access:
    - Super Admins can see everything Operations Managers can see
    - Neither role can see each other's exclusive endpoints
    """
    message = "Only Operations Managers or Super Admins can access this resource."

    def has_permission(self, request, view):
        return is_operations_manager(request.user) or is_super_admin(request.user)


class IsFinanceManagerOrSuperAdmin(BasePermission):
    """Allow Finance Managers AND Super Admins for payment write operations."""
    message = "Only Finance Managers or Super Admins can perform this action."

    def has_permission(self, request, view):
        return is_finance_manager(request.user) or is_super_admin(request.user)


class IsAnyStaffRole(BasePermission):
    """Allow any of the four internal staff roles to access this resource."""
    message = "Only internal staff can access this resource."

    def has_permission(self, request, view):
        return is_internal_staff(request.user)


class IsTicketManagementStaff(BasePermission):
    """Allow Ops Manager, Support Agent, and Super Admin to manage ticket state.

    Finance Managers are explicitly excluded: they have financial visibility
    but no ticket-management authority (cannot assign engineers, escalate
    tickets, or update ticket status).
    """
    message = "Only Operations Managers, Support Agents, or Super Admins can perform this action."

    def has_permission(self, request, view):
        return (
            is_operations_manager(request.user)
            or is_support_agent(request.user)
            or is_super_admin(request.user)
        )


class IsPaymentReader(BasePermission):
    """Allow Ops Manager, Finance Manager, and Super Admin to read payment data."""
    message = "Only staff with financial visibility can access payment records."

    def has_permission(self, request, view):
        return (
            is_operations_manager(request.user)
            or is_finance_manager(request.user)
            or is_super_admin(request.user)
        )


class IsExecutiveAnalytics(BasePermission):
    """Allow Ops Manager, Finance Manager, and Super Admin to view the executive dashboard.

    Same role set as IsPaymentReader today, but kept as its own class so
    executive-dashboard access can evolve independently of payment-read
    access later.
    """
    message = "Only Operations Managers, Finance Managers, or Super Admins can access executive analytics."

    def has_permission(self, request, view):
        return (
            is_operations_manager(request.user)
            or is_finance_manager(request.user)
            or is_super_admin(request.user)
        )


class IsOwnerOrAdmin(BasePermission):
    """
    Object-level permission.
    The object's owner OR a Super Admin can access it.
    Used on ticket detail views so customers can only see their own tickets.
    """
    message = "You do not have permission to access this resource."

    def has_object_permission(self, request, view, obj):
        if is_super_admin(request.user):
            return True
        if hasattr(obj, "customer"):
            return obj.customer.user == request.user
        return False


class IsOwnerOrStaff(BasePermission):
    """
    Object-level permission.
    The object's owner OR any internal staff role can access it.
    Finance Managers and Support Agents need read access to ticket details.
    """
    message = "You do not have permission to access this resource."

    def has_object_permission(self, request, view, obj):
        if is_internal_staff(request.user):
            return True
        if hasattr(obj, "customer"):
            return obj.customer.user == request.user
        return False
