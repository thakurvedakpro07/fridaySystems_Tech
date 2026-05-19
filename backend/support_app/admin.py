"""
Register models with Django's built-in admin interface.

After running the server, you can manage data at:
  http://localhost:8000/admin/

Log in with the superuser you created via:
  python manage.py createsuperuser
"""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import (
    AuditLog,
    CSATSurvey,
    Customer,
    CustomUser,
    Freelancer,
    Payment,
    SLALog,
    SLAPolicy,
    Subscription,
    Ticket,
    TicketAttachment,
    TicketComment,
)


# ── Custom User Admin ─────────────────────────────────────────────
# We extend UserAdmin (not ModelAdmin) so we get:
#   - Password change form  ("Change password" link in admin)
#   - Group management      (assign groups to users)
#   - Permission management (granular per-user permissions)
#
# We MUST override fieldsets and add_fieldsets because Django's default
# UserAdmin references the "username" field that we removed. Without
# overriding, opening any user in admin would raise FieldError.

@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    list_display  = ["email", "role", "is_staff", "is_active", "date_joined"]
    search_fields = ["email", "first_name", "last_name"]
    ordering      = ["-date_joined"]
    list_filter   = ["role", "is_staff", "is_active"]

    # fieldsets controls which fields appear when EDITING an existing user
    fieldsets = (
        (None,             {"fields": ("email", "password")}),
        ("Personal info",  {"fields": ("first_name", "last_name")}),
        ("Role",           {"fields": ("role",)}),
        ("Permissions",    {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Important dates",{"fields": ("last_login", "date_joined")}),
    )

    # add_fieldsets controls which fields appear when CREATING a new user
    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields":  ("email", "role", "password1", "password2"),
        }),
    )


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ["user", "company", "plan", "created_at"]
    search_fields = ["user__email", "company"]
    list_filter = ["plan"]


@admin.register(Freelancer)
class FreelancerAdmin(admin.ModelAdmin):
    list_display = ["user", "onboarding_status", "availability", "rating", "active"]
    search_fields = ["user__email", "skills"]
    list_filter = ["onboarding_status", "active"]


@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    list_display = ["ticket_number", "customer", "service_type", "severity", "status", "assigned_to", "created_at"]
    search_fields = ["ticket_number", "title"]
    list_filter = ["status", "service_type", "severity"]
    readonly_fields = ["ticket_number", "created_at", "updated_at"]


@admin.register(TicketComment)
class TicketCommentAdmin(admin.ModelAdmin):
    list_display = ["ticket", "author_type", "created_at"]
    list_filter = ["author_type"]


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ["invoice_number", "customer", "amount", "payment_type", "status", "created_at"]
    search_fields = ["invoice_number", "gateway_payment_id"]
    list_filter = ["status", "payment_type", "gateway"]
    readonly_fields = ["created_at", "updated_at"]


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ["customer", "plan", "status", "tickets_used", "expires_at"]
    list_filter = ["plan", "status"]


@admin.register(SLAPolicy)
class SLAPolicyAdmin(admin.ModelAdmin):
    list_display = ["service_type", "severity", "plan", "first_response_seconds", "resolution_seconds"]
    list_filter = ["service_type", "severity"]


@admin.register(SLALog)
class SLALogAdmin(admin.ModelAdmin):
    list_display = ["ticket", "event", "status", "timestamp"]
    list_filter = ["event", "status"]


@admin.register(CSATSurvey)
class CSATSurveyAdmin(admin.ModelAdmin):
    list_display = ["ticket", "customer", "score", "submitted_at"]
    list_filter = ["score"]


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ["user_type", "user_id", "entity", "action", "created_at"]
    list_filter = ["user_type", "action"]
    readonly_fields = ["created_at"]
