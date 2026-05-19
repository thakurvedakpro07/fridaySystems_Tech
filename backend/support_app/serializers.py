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
    Payment,
    SLALog,
    Subscription,
    Ticket,
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

class FreelancerSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = Freelancer
        fields = [
            "id", "email", "skills", "availability", "rating",
            "active", "onboarding_status", "contract_signed", "created_at",
        ]
        read_only_fields = ["id", "rating", "created_at"]


# ── Tickets ───────────────────────────────────────────────────────

class TicketListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for the ticket list view."""

    class Meta:
        model = Ticket
        fields = [
            "id", "ticket_number", "title", "service_type",
            "severity", "status", "created_at",
        ]


class TicketDetailSerializer(serializers.ModelSerializer):
    """Full serializer for the ticket detail view."""
    assigned_to = FreelancerSerializer(read_only=True)

    class Meta:
        model = Ticket
        fields = [
            "id", "ticket_number", "title", "description",
            "service_type", "severity", "status",
            "assigned_to", "remote_session_url", "notes",
            "created_at", "updated_at", "resolved_at",
        ]
        read_only_fields = [
            "id", "ticket_number", "status", "assigned_to",
            "created_at", "updated_at", "resolved_at",
        ]


class TicketCreateSerializer(serializers.ModelSerializer):
    """Validates the fields a customer sends when opening a ticket."""

    class Meta:
        model = Ticket
        fields = ["title", "description", "service_type", "severity"]


class TicketCommentSerializer(serializers.ModelSerializer):
    class Meta:
        model = TicketComment
        fields = ["id", "author_id", "author_type", "body", "created_at"]
        read_only_fields = ["id", "author_id", "author_type", "created_at"]


class TicketAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = TicketAttachment
        fields = ["id", "file_name", "storage_url", "file_size", "mime_type", "uploaded_at"]
        read_only_fields = ["id", "storage_url", "uploaded_at"]


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
