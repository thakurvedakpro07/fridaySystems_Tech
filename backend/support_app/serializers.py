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
    SLALog,
    Subscription,
    Ticket,
    TicketActivityLog,
    TicketAttachment,
    TicketComment,
)


# ── Auth ──────────────────────────────────────────────────────────

class RegisterSerializer(serializers.ModelSerializer):
    """Validates and creates a new customer user account."""
    password = serializers.CharField(write_only=True, min_length=10)
    company = serializers.CharField(required=False, allow_blank=True)
    phone = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ["email", "password", "company", "phone"]

    def validate_email(self, value):
        # Check case-insensitively: "User@Example.com" blocks when "user@example.com" exists.
        # We now check email directly (no more username field — it was removed from CustomUser).
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value

    def create(self, validated_data):
        company = validated_data.pop("company", "")
        phone = validated_data.pop("phone", "")
        # CustomUser.objects.create_user() runs CustomUserManager.create_user().
        # No username= kwarg — CustomUser has no username field.
        # role="customer" is explicit: every self-registered user is a customer.
        user = User.objects.create_user(
            email=validated_data["email"],
            password=validated_data["password"],
            role="customer",
        )
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
    email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = Freelancer
        fields = ["id", "email", "skills", "availability", "rating"]
        read_only_fields = ["id", "rating"]


class FreelancerSerializer(serializers.ModelSerializer):
    """Full serializer for admin-only list/read responses."""
    email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = Freelancer
        fields = [
            "id", "email", "skills", "availability", "rating",
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
            "severity", "priority", "status", "created_at",
        ]


class TicketDetailSerializer(serializers.ModelSerializer):
    """Full serializer for the ticket detail view (customer-facing)."""
    # Use the public subset — customers must not see contract_signed etc.
    assigned_to = FreelancerPublicSerializer(read_only=True)
    # csat_score: None if no survey submitted yet; 1-5 once submitted.
    # Used by CSATWidget to show "already rated" state after page refresh.
    csat_score = serializers.SerializerMethodField()

    def get_csat_score(self, obj):
        try:
            return obj.csat_survey.score
        except Exception:
            return None

    class Meta:
        model = Ticket
        fields = [
            "id", "ticket_number", "title", "description",
            "service_type", "severity", "priority", "status",
            "assigned_to", "remote_session_url",
            "created_at", "updated_at", "resolved_at",
            "first_response_at", "due_at", "csat_score",
        ]
        read_only_fields = [
            "id", "ticket_number", "status", "assigned_to",
            "created_at", "updated_at", "resolved_at",
            "first_response_at", "due_at", "csat_score",
        ]


class TicketCreateSerializer(serializers.ModelSerializer):
    """Validates the fields a customer sends when opening a ticket."""

    class Meta:
        model = Ticket
        fields = ["title", "description", "service_type", "severity", "priority"]


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
    class Meta:
        model = Payment
        fields = [
            "id", "amount", "gst_amount", "currency", "invoice_number",
            "payment_type", "gateway", "status", "created_at",
        ]
        read_only_fields = fields


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
