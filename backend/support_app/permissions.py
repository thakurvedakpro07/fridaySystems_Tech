"""
Custom DRF permission classes.

DRF checks these before running any view logic.
If a permission class returns False, the view returns 403 Forbidden.
"""

from rest_framework.permissions import BasePermission


class IsAdminUser(BasePermission):
    """Only allow Django staff users (is_staff=True)."""
    message = "You must be an admin to perform this action."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_staff)


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


class IsOwnerOrAdmin(BasePermission):
    """
    Object-level permission.
    The object's owner OR an admin can access it.
    Used on ticket detail views so customers can only see their own tickets.
    """
    message = "You do not have permission to access this resource."

    def has_object_permission(self, request, view, obj):
        if request.user.is_staff:
            return True
        # For tickets: compare customer id
        if hasattr(obj, "customer"):
            return obj.customer.user == request.user
        return False
