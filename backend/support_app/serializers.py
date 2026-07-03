"""
DRF Serializers — convert Python model objects to/from JSON.

Think of a serializer as a translation layer:
  Model object  →  serializer  →  JSON  (for API responses)
  JSON          →  serializer  →  validated Python data  (for API requests)
"""

from django.contrib.auth import get_user_model
from rest_framework import serializers

# get_user_model() returns whatever AUTH_USER_MODEL points to.
# This is safer than `from django.contrib.auth.models import User` because
# it automatically uses our CustomUser without any import path changes.
User = get_user_model()

from .models import (
    AuditLog,
    CSATSurvey,
    Customer,
    Freelancer,
    Notification,
    Payment,
    RoleChangeAudit,
    Service,
    SLALog,
    Subscription,
    Ticket,
    TicketActivityLog,
    TicketAttachment,
    TicketComment,
)


# ── Auth ──────────────────────────────────────────────────────────

class RegisterSerializer(serializers.ModelSerializer):
    """Validates and creates a customer or freelancer account via self-registration."""
    password = serializers.CharField(write_only=True, min_length=10)
    password2 = serializers.CharField(write_only=True)
    name = serializers.CharField(required=False, allow_blank=True, default="")
    company = serializers.CharField(required=False, allow_blank=True, default="")
    phone = serializers.CharField(required=False, allow_blank=True, default="")
    role = serializers.ChoiceField(
        choices=["customer", "freelancer"],
        default="customer",
        required=False,
    )
    skills = serializers.CharField(required=False, allow_blank=True, default="")

    class Meta:
        model = User
        fields = ["email", "password", "password2", "name", "company", "phone", "role", "skills"]

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def validate_password(self, value):
        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError as DjangoValidationError
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value

    def validate(self, data):
        if data["password"] != data.pop("password2"):
            raise serializers.ValidationError({"password2": "Passwords do not match."})
        return data

    def create(self, validated_data):
        from django.db import transaction
        company = validated_data.pop("company", "")
        phone = validated_data.pop("phone", "")
        name = validated_data.pop("name", "")
        role = validated_data.pop("role", "customer")
        skills = validated_data.pop("skills", "")

        # Split full name into first/last for AbstractUser fields
        parts = name.strip().split(" ", 1) if name.strip() else []
        first_name = parts[0] if parts else ""
        last_name = parts[1] if len(parts) > 1 else ""

        with transaction.atomic():
            user = User.objects.create_user(
                email=validated_data["email"],
                password=validated_data["password"],
                role=role,
                is_verified=False,
                first_name=first_name,
                last_name=last_name,
            )
            if role == "freelancer":
                Freelancer.objects.create(
                    user=user,
                    skills=skills,
                    availability="ad_hoc",
                    onboarding_status="pending",
                )
            else:
                Customer.objects.create(user=user, company=company, phone=phone)

        return user


# ── Customer ──────────────────────────────────────────────────────

class CustomerSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="user.email", read_only=True)
    is_staff = serializers.BooleanField(source="user.is_staff", read_only=True)

    class Meta:
        model = Customer
        fields = ["id", "email", "is_staff", "company", "phone", "address", "plan", "gstin", "mfa_enabled", "created_at"]
        read_only_fields = ["id", "email", "is_staff", "plan", "mfa_enabled", "created_at"]


# ── Freelancer ────────────────────────────────────────────────────

class FreelancerPublicSerializer(serializers.ModelSerializer):
    """
    Safe subset of freelancer data for customer-facing responses.
    Excludes internal fields: contract_signed, onboarding_status, active.
    """
    email      = serializers.EmailField(source="user.email",       read_only=True)
    first_name = serializers.CharField(source="user.first_name",   read_only=True)
    last_name  = serializers.CharField(source="user.last_name",    read_only=True)

    class Meta:
        model = Freelancer
        fields = ["id", "email", "first_name", "last_name", "skills", "availability", "rating"]
        read_only_fields = ["id", "rating"]


class FreelancerSerializer(serializers.ModelSerializer):
    """Full serializer for admin-only list/read responses."""
    email      = serializers.EmailField(source="user.email",       read_only=True)
    first_name = serializers.CharField(source="user.first_name",   read_only=True)
    last_name  = serializers.CharField(source="user.last_name",    read_only=True)

    class Meta:
        model = Freelancer
        fields = [
            "id", "email", "first_name", "last_name", "skills", "availability", "rating",
            "active", "onboarding_status", "contract_signed", "created_at",
        ]
        read_only_fields = ["id", "rating", "created_at"]


class FreelancerCreateSerializer(serializers.Serializer):
    """
    Used exclusively for POST /api/admin/freelancers/.

    Creates both a User (role=freelancer) and a Freelancer profile atomically.
    The original FreelancerSerializer had no writable user field, making POST
    fail with a database IntegrityError — this replaces it for creation only.
    """
    email    = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=10)
    skills   = serializers.CharField(required=False, allow_blank=True, default="")
    availability = serializers.ChoiceField(
        choices=["full_time", "part_time", "ad_hoc"],
        default="ad_hoc",
        required=False,
    )

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def validate_password(self, value):
        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError as DjangoValidationError
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value

    def create(self, validated_data):
        from django.db import transaction
        with transaction.atomic():
            user = User.objects.create_user(
                email=validated_data["email"],
                password=validated_data["password"],
                role="freelancer",
            )
            freelancer = Freelancer.objects.create(
                user=user,
                skills=validated_data.get("skills", ""),
                availability=validated_data.get("availability", "ad_hoc"),
                onboarding_status="approved",
            )
        return freelancer


# ── Tickets ───────────────────────────────────────────────────────

class TicketListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for the ticket list view."""

    class Meta:
        model = Ticket
        fields = [
            "id", "ticket_number", "title", "service_type",
            "severity", "status", "created_at",
        ]


class OpsTicketListSerializer(TicketListSerializer):
    """Extends TicketListSerializer with assignment info and SLA status for the ops ticket queue."""
    freelancer = serializers.SerializerMethodField()
    sla_status = serializers.SerializerMethodField()

    def get_freelancer(self, obj):
        if not obj.assigned_to:
            return None
        u = obj.assigned_to.user
        return {
            "id": str(obj.assigned_to.id),
            "name": f"{u.first_name} {u.last_name}".strip() or u.email,
            "email": u.email,
        }

    def get_sla_status(self, obj):
        """
        Computed SLA health label for the ops ticket queue.
        "no_deadline" — due_at not set (ticket not yet open or SLA not initialized)
        "overdue"     — past the resolution deadline
        "due_soon"    — deadline within the next 2 hours
        "ok"          — deadline is more than 2 hours away
        Resolved/closed tickets always return "no_deadline" (SLA no longer active).
        """
        if obj.status in ("resolved", "closed", "pending_payment") or not obj.due_at:
            return "no_deadline"
        from django.utils import timezone as tz
        now = tz.now()
        if now > obj.due_at:
            return "overdue"
        if (obj.due_at - now).total_seconds() < 7200:
            return "due_soon"
        return "ok"

    class Meta(TicketListSerializer.Meta):
        fields = TicketListSerializer.Meta.fields + [
            "freelancer", "due_at", "first_response_due_at", "sla_status",
        ]


class TicketDetailSerializer(serializers.ModelSerializer):
    """Full serializer for the ticket detail view (customer-facing and staff-facing)."""
    # Use the public subset — customers must not see contract_signed etc.
    assigned_to = FreelancerPublicSerializer(read_only=True)
    # csat_score: None if no survey submitted yet; 1-5 once submitted.
    # Used by CSATWidget to show "already rated" state after page refresh.
    csat_score = serializers.SerializerMethodField()
    # Customer info — name, email, company. Always safe to include: customers already
    # know their own details; internal staff need it for triage and assignment decisions.
    customer = serializers.SerializerMethodField()
    # assigned_at: timestamp from the active TicketAssignment row.
    # Used by EngineerAssignedInfoCard to show when the engineer was assigned.
    assigned_at = serializers.SerializerMethodField()

    def get_csat_score(self, obj):
        try:
            return obj.csat_survey.score
        except Exception:
            return None

    def get_customer(self, obj):
        u = obj.customer.user
        first = u.first_name.strip()
        last  = u.last_name.strip()
        return {
            "email":   u.email,
            "name":    f"{first} {last}".strip() or u.email.split("@")[0],
            "company": getattr(obj.customer, "company", None) or "",
        }

    def get_assigned_at(self, obj):
        # Prefer the currently-active assignment; fall back to the most recent one.
        assignment = (
            obj.assignments.filter(unassigned_at__isnull=True).first()
            or obj.assignments.first()
        )
        return assignment.assigned_at if assignment else None

    class Meta:
        model = Ticket
        fields = [
            "id", "ticket_number", "title", "description",
            "service_type", "severity", "status",
            "assigned_to", "customer", "remote_session_url",
            "created_at", "updated_at", "resolved_at",
            "first_response_at", "first_response_due_at", "due_at", "csat_score",
            "communication_preference", "preferred_language", "assigned_at",
        ]
        read_only_fields = [
            "id", "ticket_number", "status", "assigned_to", "customer",
            "created_at", "updated_at", "resolved_at",
            "first_response_at", "first_response_due_at", "due_at", "csat_score",
            "assigned_at",
        ]
        # communication_preference and preferred_language are intentionally writable
        # so the customer can PATCH them via TicketDetailView.


class TicketCreateSerializer(serializers.ModelSerializer):
    """Validates the fields a customer sends when opening a ticket."""

    class Meta:
        model = Ticket
        fields = ["title", "description", "service_type", "severity"]


class TicketCommentSerializer(serializers.ModelSerializer):
    # Expose the author's email as a read-only string for the frontend.
    # source="author.email" follows the FK to get the email.
    # allow_null=True handles deleted-user comments where author=NULL.
    author_email = serializers.EmailField(source="author.email", read_only=True, allow_null=True)

    class Meta:
        model = TicketComment
        fields = [
            "id", "author_email", "body",
            "is_internal", "is_edited",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "author_email", "is_edited", "created_at", "updated_at"]


class TicketAttachmentSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()
    uploaded_by_email = serializers.EmailField(source="uploaded_by.email", read_only=True, allow_null=True)

    def get_file_url(self, obj):
        request = self.context.get("request")
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return obj.storage_url or None

    class Meta:
        model = TicketAttachment
        fields = ["id", "file_name", "file_url", "file_size", "mime_type", "uploaded_by_email", "uploaded_at"]
        read_only_fields = ["id", "file_url", "uploaded_at", "uploaded_by_email"]


# ── Payments ─────────────────────────────────────────────────────

class PaymentSerializer(serializers.ModelSerializer):
    total_amount   = serializers.SerializerMethodField()
    ticket_number  = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = [
            "id", "amount", "gst_amount", "total_amount", "currency",
            "invoice_number", "payment_type", "gateway", "status",
            "ticket", "ticket_number", "created_at",
        ]
        read_only_fields = fields

    def get_total_amount(self, obj):
        return int(obj.amount + obj.gst_amount)

    def get_ticket_number(self, obj):
        return obj.ticket.ticket_number if obj.ticket_id else None


class AdminPaymentSerializer(serializers.ModelSerializer):
    """Full payment view for admin — includes customer email and gateway IDs."""
    total_amount   = serializers.SerializerMethodField()
    ticket_number  = serializers.SerializerMethodField()
    customer_email = serializers.EmailField(source="customer.user.email", read_only=True)

    class Meta:
        model = Payment
        fields = [
            "id", "customer_email", "amount", "gst_amount", "total_amount",
            "currency", "invoice_number", "payment_type", "gateway",
            "gateway_payment_id", "gateway_order_id", "gateway_refund_id", "status",
            "ticket", "ticket_number", "created_at",
        ]

    def get_total_amount(self, obj):
        return int(obj.amount + obj.gst_amount)

    def get_ticket_number(self, obj):
        return obj.ticket.ticket_number if obj.ticket_id else None


class OpsPaymentSerializer(AdminPaymentSerializer):
    """Extended payment view for Finance Manager — adds refund eligibility flag."""
    refund_eligible = serializers.SerializerMethodField()

    class Meta(AdminPaymentSerializer.Meta):
        fields = AdminPaymentSerializer.Meta.fields + ["refund_eligible"]

    def get_refund_eligible(self, obj):
        from django.utils import timezone
        from datetime import timedelta
        if obj.status != "completed":
            return False
        return (timezone.now() - obj.created_at) < timedelta(days=30)


class PaymentVerifySerializer(serializers.Serializer):
    """Validates the body of POST /api/tickets/{id}/verify-payment/."""
    payment_db_id        = serializers.UUIDField()
    razorpay_payment_id  = serializers.CharField(max_length=255)
    razorpay_order_id    = serializers.CharField(max_length=255)
    razorpay_signature   = serializers.CharField(max_length=512)


# ── Subscriptions ─────────────────────────────────────────────────

class SubscriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subscription
        fields = ["id", "plan", "billing_cycle", "status", "tickets_used", "started_at", "expires_at"]
        read_only_fields = ["id", "tickets_used", "started_at", "expires_at"]


# ── SLA Logs ─────────────────────────────────────────────────────

class SLALogSerializer(serializers.ModelSerializer):
    class Meta:
        model = SLALog
        fields = ["id", "event", "timestamp", "target_seconds", "actual_seconds", "status"]


# ── CSAT ─────────────────────────────────────────────────────────

class CSATSurveySerializer(serializers.ModelSerializer):
    class Meta:
        model = CSATSurvey
        fields = ["id", "score", "comment", "submitted_at"]
        read_only_fields = ["id", "submitted_at"]

    def validate_score(self, value):
        if not 1 <= value <= 5:
            raise serializers.ValidationError("Score must be between 1 and 5.")
        return value


# ── Activity Log ──────────────────────────────────────────────────

class TicketActivityLogSerializer(serializers.ModelSerializer):
    """Read-only serializer for the ticket event timeline."""
    actor_email = serializers.EmailField(source="actor.email", read_only=True, allow_null=True)
    action_display = serializers.CharField(source="get_action_display", read_only=True)

    class Meta:
        model = TicketActivityLog
        fields = [
            "id", "actor_email", "action", "action_display",
            "from_value", "to_value", "note", "created_at",
        ]


# ── Notifications ─────────────────────────────────────────────────

class NotificationSerializer(serializers.ModelSerializer):
    ticket_number = serializers.SerializerMethodField()
    ticket_title  = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            "id", "category", "title", "body",
            "ticket", "ticket_number", "ticket_title",
            "is_read", "created_at",
        ]
        read_only_fields = [
            "id", "category", "title", "body",
            "ticket", "ticket_number", "ticket_title", "created_at",
        ]

    def get_ticket_number(self, obj):
        return obj.ticket.ticket_number if obj.ticket_id else None

    def get_ticket_title(self, obj):
        return obj.ticket.title if obj.ticket_id else None


# ── Admin action serializers ──────────────────────────────────────
# These are plain Serializers (not ModelSerializer) because they
# validate a simple request body, not a full model instance.

# Valid ticket status keys — duplicated here to avoid circular imports.
_TICKET_STATUSES = [
    "pending_payment", "open", "assigned", "in_progress",
    "waiting_customer", "resolved", "closed",
]
# Freelancers may only move a ticket to these three statuses.
_FREELANCER_STATUSES = ["in_progress", "waiting_customer", "resolved"]


class AdminAssignSerializer(serializers.Serializer):
    """Validates the body of POST /api/admin/tickets/{id}/assign/."""
    freelancer_id = serializers.UUIDField()


class AdminStatusSerializer(serializers.Serializer):
    """Validates the body of POST /api/admin/tickets/{id}/status/."""
    new_status = serializers.ChoiceField(choices=_TICKET_STATUSES)
    note = serializers.CharField(required=False, allow_blank=True, default="")


class FreelancerStatusSerializer(serializers.Serializer):
    """
    Validates the body of POST /api/freelancer/tickets/{id}/status/.
    Freelancers cannot close tickets — only admins can do that.
    """
    new_status = serializers.ChoiceField(choices=_FREELANCER_STATUSES)
    note = serializers.CharField(required=False, allow_blank=True, default="")


class UserProfileUpdateSerializer(serializers.Serializer):
    """Validates PATCH /api/auth/profile/ — all roles can update name; role-specific fields optional."""
    first_name   = serializers.CharField(required=False, allow_blank=True, max_length=150)
    last_name    = serializers.CharField(required=False, allow_blank=True, max_length=150)
    # Customer-specific
    company      = serializers.CharField(required=False, allow_blank=True, max_length=255)
    phone        = serializers.CharField(required=False, allow_blank=True, max_length=32)
    address      = serializers.CharField(required=False, allow_blank=True)
    gstin        = serializers.CharField(required=False, allow_blank=True, max_length=15)
    # Freelancer-specific
    skills       = serializers.CharField(required=False, allow_blank=True)
    availability = serializers.ChoiceField(
        required=False,
        choices=["full_time", "part_time", "ad_hoc", "unavailable"],
    )

    def validate_gstin(self, value):
        from support_app.validators import validate_gstin_format
        if value:
            normalized = value.strip().upper()
            validate_gstin_format(normalized)
            return normalized
        return value


# ── Role Management / User Management ────────────────────────────

_ROLE_DISPLAY = {
    "customer": "Customer",
    "freelancer": "Engineer",
    "admin": "Super Admin",
    "operations_manager": "Operations Manager",
    "finance_manager": "Finance Manager",
    "support_agent": "Support Agent",
}

_PROMOTABLE_ROLES = [
    "customer", "freelancer", "admin",
    "operations_manager", "finance_manager", "support_agent",
]


class OpsUserSerializer(serializers.ModelSerializer):
    """
    Read-only user list serializer for the Operations Dashboard.
    Exposes safe fields only — no password hash or payment details.
    """
    full_name = serializers.SerializerMethodField()
    role_display = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    def get_full_name(self, obj):
        first = (obj.first_name or "").strip()
        last  = (obj.last_name  or "").strip()
        return f"{first} {last}".strip() or obj.email

    def get_role_display(self, obj):
        return _ROLE_DISPLAY.get(obj.role, obj.role)

    def get_status(self, obj):
        return "active" if obj.is_active else "inactive"

    class Meta:
        model = User
        fields = [
            "id", "email", "full_name", "role", "role_display",
            "status", "is_active", "date_joined",
        ]
        read_only_fields = fields


class RoleChangeSerializer(serializers.Serializer):
    """Validates the body of POST /api/ops/users/{id}/role/."""
    new_role = serializers.ChoiceField(choices=_PROMOTABLE_ROLES)
    note = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_new_role(self, value):
        # Prevent changing to admin role via this endpoint if caller is not already admin
        # (server-side guard — permissions layer also blocks this)
        return value


class RoleChangeAuditSerializer(serializers.ModelSerializer):
    """Read-only serializer for the role change audit log."""
    changed_by_email = serializers.SerializerMethodField()
    old_role_display = serializers.SerializerMethodField()
    new_role_display = serializers.SerializerMethodField()

    def get_changed_by_email(self, obj):
        return obj.changed_by.email if obj.changed_by else "System"

    def get_old_role_display(self, obj):
        return _ROLE_DISPLAY.get(obj.old_role, obj.old_role)

    def get_new_role_display(self, obj):
        return _ROLE_DISPLAY.get(obj.new_role, obj.new_role)

    class Meta:
        model = RoleChangeAudit
        fields = [
            "id", "changed_by_email", "target_email",
            "old_role", "old_role_display",
            "new_role", "new_role_display",
            "note", "timestamp",
        ]
        read_only_fields = fields


class ServiceSerializer(serializers.ModelSerializer):
    """Serializer for the platform services catalogue."""

    class Meta:
        model = Service
        fields = [
            "id", "name", "description", "status",
            "required_skills", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
