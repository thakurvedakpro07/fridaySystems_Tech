"""
Custom DRF permission classes.

DRF checks these before running any view logic.
If a permission class returns False, the view returns 403 Forbidden.
"""

from rest_framework.permissions import BasePermission


def _is_admin(user) -> bool:
    """True only when both is_staff=True AND role='admin' are set.

    Requiring both prevents privilege escalation if is_staff is accidentally
    granted to a non-admin role through the Django admin or a migration.
    Mirrors the AdminRoute guard in the React frontend.
    """
    return bool(user and user.is_authenticated and user.is_staff and getattr(user, "role", None) == "admin")


class IsAdminUser(BasePermission):
    """Only allow users who have is_staff=True AND role='admin'."""
    message = "You must be an admin to perform this action."

    def has_permission(self, request, view):
        return _is_admin(request.user)


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
    message = "Only approved freelancers can access this resource."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and hasattr(request.user, "freelancer_profile")
            and request.user.freelancer_profile.onboarding_status == "approved"
        )


class IsFreelancerOrAdmin(BasePermission):
    """Allow access to approved freelancers AND admin users (is_staff + role=admin)."""
    message = "Only freelancers or admins can access this resource."

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if _is_admin(request.user):
            return True
        return (
            hasattr(request.user, "freelancer_profile")
            and request.user.freelancer_profile.onboarding_status == "approved"
        )


class IsOwnerOrAdmin(BasePermission):
    """
    Object-level permission.
    The object's owner OR an admin (is_staff + role=admin) can access it.
    Used on ticket detail views so customers can only see their own tickets.
    """
    message = "You do not have permission to access this resource."

    def has_object_permission(self, request, view, obj):
        if _is_admin(request.user):
            return True
        # For tickets: compare customer id
        if hasattr(obj, "customer"):
            return obj.customer.user == request.user
        return False
