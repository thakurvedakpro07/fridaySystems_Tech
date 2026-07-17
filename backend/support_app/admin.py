"""
Register models with Django's built-in admin interface.

After running the server, you can manage data at:
  http://localhost:8000/admin/

Log in with the superuser you created via:
  python manage.py createsuperuser

Admin optimisation principles applied here:
  - list_display: columns visible on the list page (shows without clicking in)
  - search_fields: fields searched when you type in the search box
    __ (double underscore) traverses FK relationships:
    "ticket__ticket_number" searches the related Ticket's number field
  - list_filter: sidebar filters — show a filter for each listed field
  - readonly_fields: fields shown but not editable (audit fields, timestamps)
  - date_hierarchy: breadcrumb navigation by year → month → day
  - ordering: default sort on list page
"""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.utils.html import format_html

from .models import (
    AuditLog,
    CSATSurvey,
    Customer,
    CustomUser,
    Freelancer,
    Notification,
    Payment,
    SLALog,
    SLAPolicy,
    Subscription,
    Ticket,
    TicketActivityLog,
    TicketAssignment,
    TicketAttachment,
    TicketComment,
)


# ── Custom User Admin ─────────────────────────────────────────────

@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    list_display  = ["email", "role", "is_staff", "is_active", "date_joined"]
    search_fields = ["email", "first_name", "last_name"]
    ordering      = ["-date_joined"]
    list_filter   = ["role", "is_staff", "is_active"]

    fieldsets = (
        (None,              {"fields": ("email", "password")}),
        ("Personal info",   {"fields": ("first_name", "last_name")}),
        ("Role",            {
            "fields": ("role",),
            "description": (
                "To change a user's role, use Operations → Users → Change Role "
                "in the app instead — that flow is audited (RoleChangeAudit) and "
                "enforces valid role transitions. This field is locked here to prevent "
                "silently bypassing that audit trail."
            ),
        }),
        ("Permissions",     {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Important dates", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields":  ("email", "role", "password1", "password2"),
        }),
    )

    def get_readonly_fields(self, request, obj=None):
        # `role` must only change through the audited ops_change_role endpoint
        # (writes RoleChangeAudit + enforces the transition matrix) — never
        # directly here, which would silently bypass both. `obj` is None on the
        # "add user" page (add_fieldsets), where role must stay editable; lock
        # it only once the user already exists.
        if obj is not None:
            return (*self.readonly_fields, "role")
        return self.readonly_fields


# ── Customer / Freelancer ─────────────────────────────────────────

@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display   = ["user", "company", "plan", "created_at"]
    search_fields  = ["user__email", "company"]
    list_filter    = ["plan"]
    readonly_fields = ["created_at", "updated_at"]


@admin.register(Freelancer)
class FreelancerAdmin(admin.ModelAdmin):
    list_display   = ["user", "onboarding_status", "availability", "rating", "active"]
    search_fields  = ["user__email", "skills"]
    list_filter    = ["onboarding_status", "active"]
    readonly_fields = ["created_at", "updated_at", "rating", "payout_summary"]
    exclude        = ["payout_details"]

    def payout_summary(self, obj):
        if not obj.payout_details:
            return "(not set)"
        keys = sorted(obj.payout_details.keys())
        return f"[MASKED] fields present: {', '.join(keys)}"
    payout_summary.short_description = "Payout Details (masked)"


# ── Ticket Admin — with inline activity log ───────────────────────
#
# Inlines let you see related records on the same admin page.
# When you open a ticket, you see its activity log and assignments
# without navigating to separate pages.

class TicketActivityLogInline(admin.TabularInline):
    """
    Shows the activity timeline directly on the Ticket admin page.

    TabularInline: each log entry is one row in a compact table.
    (vs StackedInline which stacks each entry vertically — more space).

    extra = 0: do not show any blank "add new" rows by default.
    can_delete = False: logs are immutable — no deleting allowed.
    """
    model       = TicketActivityLog
    extra       = 0
    can_delete  = False
    readonly_fields = ["actor", "action", "from_value", "to_value", "note", "created_at"]
    fields          = ["created_at", "actor", "action", "from_value", "to_value", "note"]
    ordering        = ["created_at"]


class TicketAssignmentInline(admin.TabularInline):
    """Shows the full assignment history on the Ticket page."""
    model       = TicketAssignment
    extra       = 0
    can_delete  = False
    readonly_fields = ["freelancer", "assigned_by", "assigned_at", "unassigned_at", "reason"]
    fields          = ["freelancer", "assigned_by", "reason", "assigned_at", "unassigned_at"]
    ordering        = ["-assigned_at"]


class TicketCommentInline(admin.TabularInline):
    """Shows all comments on the Ticket page. All fields readonly — audit trail must be immutable."""
    model   = TicketComment
    extra   = 0
    can_delete = False
    fields  = ["author", "is_internal", "is_edited", "body", "created_at"]
    readonly_fields = ["author", "is_internal", "is_edited", "body", "created_at"]


@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    # ── List view ────────────────────────────────────────────────
    list_display  = [
        "ticket_number", "customer", "service_type",
        "severity", "status_badge",
        "assigned_to", "created_at",
    ]
    search_fields = ["ticket_number", "title", "customer__user__email"]
    list_filter   = ["status", "severity", "service_type"]
    date_hierarchy = "created_at"
    ordering       = ["-created_at"]
    list_select_related = ["customer__user", "assigned_to__user"]

    # ── Detail view ──────────────────────────────────────────────
    readonly_fields = [
        "ticket_number", "id",
        "created_at", "updated_at",
        "resolved_at", "first_response_at",
        "due_at", "sla_breach_notified",
    ]
    fieldsets = (
        ("Identity", {
            "fields": ("id", "ticket_number"),
        }),
        ("Problem", {
            "fields": ("customer", "title", "description", "service_type"),
        }),
        ("Urgency", {
            "fields": ("severity",),
        }),
        ("Workflow", {
            "fields": ("status", "assigned_to"),
        }),
        ("SLA Tracking", {
            "fields": ("first_response_at", "due_at", "sla_breach_notified"),
            "classes": ("collapse",),
        }),
        ("Tooling", {
            "fields": ("remote_session_url", "external_ticket_id", "notes"),
            "classes": ("collapse",),
        }),
        ("Timestamps", {
            "fields": ("created_at", "updated_at", "resolved_at"),
            "classes": ("collapse",),
        }),
    )

    inlines = [TicketActivityLogInline, TicketAssignmentInline, TicketCommentInline]

    def status_badge(self, obj):
        colours = {
            "pending_payment": "#6c757d",
            "open":            "#007bff",
            "assigned":        "#17a2b8",
            "in_progress":     "#fd7e14",
            "resolved":        "#28a745",
            "closed":          "#343a40",
        }
        colour = colours.get(obj.status, "#6c757d")
        return format_html(
            '<span style="color:white; background:{}; padding:2px 6px; '
            'border-radius:3px; font-size:11px">{}</span>',
            colour, obj.get_status_display(),
        )
    status_badge.short_description = "Status"
    status_badge.admin_order_field = "status"


# ── Ticket sub-models ─────────────────────────────────────────────

@admin.register(TicketComment)
class TicketCommentAdmin(admin.ModelAdmin):
    list_display   = ["ticket", "author", "is_internal", "is_edited", "created_at"]
    list_filter    = ["is_internal", "is_edited"]
    search_fields  = ["ticket__ticket_number", "author__email", "body"]
    readonly_fields = ["created_at", "updated_at"]
    date_hierarchy  = "created_at"


@admin.register(TicketAttachment)
class TicketAttachmentAdmin(admin.ModelAdmin):
    list_display   = ["file_name", "ticket", "uploaded_by", "file_size", "mime_type", "uploaded_at"]
    search_fields  = ["ticket__ticket_number", "file_name"]
    readonly_fields = ["uploaded_at"]


@admin.register(TicketActivityLog)
class TicketActivityLogAdmin(admin.ModelAdmin):
    """
    Fully read-only — activity logs must never be edited or deleted.

    WHY readonly:
      If admins could delete or edit activity logs, they could cover up
      mistakes. The logs exist precisely to be tamper-resistant.
      In a compliance scenario (DPDP Act 2023), modifiable logs are worthless.
    """
    list_display   = ["ticket", "actor", "action", "from_value", "to_value", "created_at"]
    list_filter    = ["action"]
    search_fields  = ["ticket__ticket_number", "actor__email", "note"]
    date_hierarchy  = "created_at"
    ordering       = ["-created_at"]
    list_select_related = ["ticket", "actor"]

    # Everything is readonly — no modification allowed
    readonly_fields = ["ticket", "actor", "action", "from_value", "to_value", "note", "created_at"]

    def has_add_permission(self, request):
        return False  # logs are created only by the system, not manually

    def has_change_permission(self, request, obj=None):
        return False  # immutable

    def has_delete_permission(self, request, obj=None):
        return False  # immutable


@admin.register(TicketAssignment)
class TicketAssignmentAdmin(admin.ModelAdmin):
    list_display   = ["ticket", "freelancer", "assigned_by", "reason", "assigned_at", "unassigned_at"]
    list_filter    = ["reason"]
    search_fields  = ["ticket__ticket_number", "freelancer__user__email"]
    date_hierarchy  = "assigned_at"
    readonly_fields = ["assigned_at"]


# ── Payment / Subscription ────────────────────────────────────────

@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display   = ["invoice_number", "customer", "amount", "payment_type", "status", "created_at"]
    search_fields  = ["invoice_number", "gateway_payment_id"]
    list_filter    = ["status", "payment_type", "gateway"]
    readonly_fields = ["created_at", "updated_at"]


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display   = ["customer", "plan", "status", "tickets_used", "expires_at"]
    list_filter    = ["plan", "status"]


# ── SLA ───────────────────────────────────────────────────────────

@admin.register(SLAPolicy)
class SLAPolicyAdmin(admin.ModelAdmin):
    list_display  = ["service_type", "severity", "plan", "first_response_seconds", "resolution_seconds"]
    list_filter   = ["service_type", "severity"]


@admin.register(SLALog)
class SLALogAdmin(admin.ModelAdmin):
    list_display  = ["ticket", "event", "status", "timestamp"]
    list_filter   = ["event", "status"]


# ── CSAT ─────────────────────────────────────────────────────────

@admin.register(CSATSurvey)
class CSATSurveyAdmin(admin.ModelAdmin):
    list_display  = ["ticket", "customer", "score", "submitted_at"]
    list_filter   = ["score"]


# ── Audit Log ─────────────────────────────────────────────────────

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display  = ["recipient", "category", "title", "ticket", "is_read", "created_at"]
    list_filter   = ["category", "is_read"]
    search_fields = ["recipient__email", "title", "body"]
    readonly_fields = ["recipient", "category", "title", "body", "ticket", "created_at"]
    ordering      = ["-created_at"]


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display   = ["user_type", "user_id", "entity", "action", "created_at"]
    list_filter    = ["user_type", "entity", "action"]
    search_fields  = ["user_id", "entity_id", "action"]
    readonly_fields = ["created_at"]
    date_hierarchy  = "created_at"

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
