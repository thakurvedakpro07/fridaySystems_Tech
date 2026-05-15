"""
Register models with Django's built-in admin interface.

After running the server, you can manage data at:
  http://localhost:8000/admin/

Log in with the superuser you created via:
  python manage.py createsuperuser
"""

from django.contrib import admin

from .models import (
    AuditLog,
    CSATSurvey,
    Customer,
    Freelancer,
    Payment,
    SLALog,
    SLAPolicy,
    Subscription,
    Ticket,
    TicketAttachment,
    TicketComment,
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
