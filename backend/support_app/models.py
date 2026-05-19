"""
Database models for SupportMitra.

Every table in the database is defined here as a Python class.
Django's ORM turns these classes into SQL tables automatically
when you run `python manage.py migrate`.

Only the schema is defined here — no business logic yet.
"""

import uuid

from django.conf import settings
from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractUser
from django.db import models


# ── Custom User System ───────────────────────────────────────────
#
# Django's built-in User model is fixed — you cannot add columns to it.
# AbstractUser gives us everything the built-in User has (password hashing,
# permissions, groups, is_staff, date_joined, last_login) PLUS the ability
# to add our own fields (uuid primary key, role).
#
# AUTH_USER_MODEL in settings.py tells Django to use this model everywhere
# instead of the default auth.User.


class CustomUserManager(BaseUserManager):
    """
    Replaces Django's default manager because we removed the username field.

    The manager is the factory that knows HOW to create a User object.
    When you call User.objects.create_user(...) anywhere in the codebase,
    this is the code that actually runs.
    """

    def create_user(self, email, password=None, **extra_fields):
        """
        Called by: RegisterSerializer, tests, and any code that creates a user.

        normalize_email() lowercases the domain part only:
          "User@GMAIL.COM" → "User@gmail.com"
        (RFC 5321: the local part before @ IS case-sensitive)

        set_password() hashes the password using PBKDF2-SHA256 — never stores plain text.
        """
        if not email:
            raise ValueError("An email address is required to create a user.")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        """
        Called by: python manage.py createsuperuser

        Must set is_staff=True (allows admin login) and
        is_superuser=True (bypasses all permission checks).
        """
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", "admin")

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")

        return self.create_user(email, password, **extra_fields)


class CustomUser(AbstractUser):
    """
    The single authentication model for ALL user types: customers, freelancers, admins.

    This replaces Django's built-in auth.User completely.
    AUTH_USER_MODEL = "support_app.CustomUser" in settings.py activates this.

    What we inherit from AbstractUser (FREE — we don't define these):
      - password         (hashed, never stored plain)
      - first_name       (optional, for future personalisation)
      - last_name        (optional)
      - is_active        (False = account disabled, can't log in)
      - is_staff         (True = can log into /admin/)
      - is_superuser     (True = bypasses all permission checks)
      - date_joined      (auto-set when account is created)
      - last_login       (auto-updated on each login)
      - groups           (ManyToMany — for future role-based permissions)
      - user_permissions (ManyToMany — granular permission flags)

    What we ADD:
      - UUID primary key  (replaces the insecure auto-increment integer id)
      - email as login    (replaces username, which is now removed)
      - role              (customer / freelancer / admin)

    What we REMOVE:
      - username          (set to None — we use email to log in instead)
    """

    ROLE_CHOICES = [
        ("customer", "Customer"),
        ("freelancer", "Freelancer"),
        ("admin", "Admin"),
    ]

    # ── Primary key ──────────────────────────────────────────────
    # Override Django's default integer auto-increment id.
    # UUIDs are non-guessable, globally unique, and safe to expose in URLs.
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # ── Remove username ──────────────────────────────────────────
    # Setting to None removes the column from the database table.
    # We must also tell Django and allauth about this (done in settings.py).
    username = None

    # ── Login field ──────────────────────────────────────────────
    # unique=True is required because no two accounts can share an email.
    # This replaces both the old username and email fields in one.
    email = models.EmailField(unique=True)

    # ── Role ─────────────────────────────────────────────────────
    # Stored on the User table (not on profiles) because role is needed
    # on every authenticated request, before any profile is loaded.
    role = models.CharField(max_length=16, choices=ROLE_CHOICES, default="customer")

    # ── Auth configuration ───────────────────────────────────────
    # USERNAME_FIELD: tells Django, SimpleJWT, and allauth: "use email to log in"
    USERNAME_FIELD = "email"

    # REQUIRED_FIELDS: extra fields prompted by `createsuperuser` command.
    # Empty because email (our USERNAME_FIELD) is already prompted automatically.
    REQUIRED_FIELDS = []

    # Use our custom manager so create_user() and create_superuser() work
    objects = CustomUserManager()

    def __str__(self):
        return self.email

    class Meta:
        ordering = ["-date_joined"]
        verbose_name = "User"
        verbose_name_plural = "Users"


class Customer(models.Model):
    """
    Extends Django's built-in User with customer-specific fields.
    One Customer record is linked to exactly one User account.
    """
    PLAN_CHOICES = [
        ("free", "Free"),
        ("silver", "Silver"),
        ("gold", "Gold"),
        ("platinum", "Platinum"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="customer_profile",
    )
    company = models.CharField(max_length=255, blank=True)
    phone = models.CharField(max_length=32, blank=True)
    address = models.TextField(blank=True)
    plan = models.CharField(max_length=32, choices=PLAN_CHOICES, default="free")
    gstin = models.CharField(max_length=15, blank=True, help_text="GST registration number (B2B customers)")
    oauth_provider = models.CharField(max_length=64, blank=True, null=True)
    oauth_id = models.CharField(max_length=255, blank=True, null=True)
    mfa_enabled = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.email} ({self.company})"

    class Meta:
        ordering = ["-created_at"]


class Freelancer(models.Model):
    """
    Vetted support engineers who resolve tickets.
    """
    AVAILABILITY_CHOICES = [
        ("full_time", "Full Time"),
        ("part_time", "Part Time"),
        ("ad_hoc", "Ad Hoc"),
        ("unavailable", "Unavailable"),
    ]
    PAYOUT_MODE_CHOICES = [
        ("bank_transfer", "Bank Transfer"),
        ("upi", "UPI"),
    ]
    ONBOARDING_STATUS_CHOICES = [
        ("pending", "Pending"),
        ("approved", "Approved"),
        ("suspended", "Suspended"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="freelancer_profile",
    )
    skills = models.TextField(blank=True, help_text="Comma-separated skill tags, e.g. linux,sap,vmware")
    availability = models.CharField(max_length=32, choices=AVAILABILITY_CHOICES, default="ad_hoc")
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=0.0)
    active = models.BooleanField(default=True)
    payout_mode = models.CharField(max_length=32, choices=PAYOUT_MODE_CHOICES, blank=True)
    payout_details = models.JSONField(default=dict, help_text="Encrypted bank/UPI details")
    contract_signed = models.BooleanField(default=False)
    onboarding_status = models.CharField(
        max_length=32, choices=ONBOARDING_STATUS_CHOICES, default="pending"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.user.email

    class Meta:
        ordering = ["-rating"]


class Ticket(models.Model):
    """
    A support request opened by a customer.
    """
    SERVICE_CHOICES = [
        ("desktop", "Desktop / Laptop Support"),
        ("linux", "Linux Provisioning"),
        ("windows", "Windows Provisioning"),
        ("patching", "OS Patching"),
        ("security", "Security Hardening"),
        ("vmware", "VMware / Hypervisor"),
        ("sap", "SAP Basis Lite"),
    ]
    SEVERITY_CHOICES = [
        ("low", "Low"),
        ("medium", "Medium"),
        ("high", "High"),
        ("critical", "Critical"),
    ]
    STATUS_CHOICES = [
        ("pending_payment", "Pending Payment"),
        ("open", "Open"),
        ("assigned", "Assigned"),
        ("in_progress", "In Progress"),
        ("resolved", "Resolved"),
        ("closed", "Closed"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name="tickets")
    ticket_number = models.CharField(max_length=16, unique=True, blank=True)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    service_type = models.CharField(max_length=32, choices=SERVICE_CHOICES)
    severity = models.CharField(max_length=16, choices=SEVERITY_CHOICES, default="medium")
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default="pending_payment")
    assigned_to = models.ForeignKey(
        Freelancer, on_delete=models.SET_NULL, null=True, blank=True, related_name="assigned_tickets"
    )
    remote_session_url = models.URLField(max_length=512, blank=True)
    external_ticket_id = models.CharField(max_length=255, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.ticket_number} — {self.title}"

    class Meta:
        ordering = ["-created_at"]


class TicketComment(models.Model):
    """
    A message thread on a ticket (customer, freelancer, or admin can comment).
    """
    AUTHOR_TYPE_CHOICES = [
        ("customer", "Customer"),
        ("freelancer", "Freelancer"),
        ("admin", "Admin"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name="comments")
    author_id = models.UUIDField()
    author_type = models.CharField(max_length=16, choices=AUTHOR_TYPE_CHOICES)
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Comment on {self.ticket.ticket_number} by {self.author_type}"

    class Meta:
        ordering = ["created_at"]


class TicketAttachment(models.Model):
    """
    Files uploaded to a ticket (screenshots, logs, etc.).
    Stored in object storage; this model holds the metadata.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name="attachments")
    file_name = models.CharField(max_length=255)
    storage_url = models.URLField(max_length=1024)
    file_size = models.IntegerField(help_text="File size in bytes")
    mime_type = models.CharField(max_length=128, blank=True)
    uploaded_by = models.UUIDField()
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.file_name


class Payment(models.Model):
    """
    Records every financial transaction: consulting fee, resolution fee,
    subscriptions, and refunds.
    """
    PAYMENT_TYPE_CHOICES = [
        ("consulting_fee", "Consulting Fee"),
        ("resolution_fee", "Resolution Fee"),
        ("subscription", "Subscription"),
        ("refund", "Refund"),
    ]
    GATEWAY_CHOICES = [
        ("razorpay", "Razorpay"),
        ("payu", "PayU"),
    ]
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("completed", "Completed"),
        ("failed", "Failed"),
        ("refunded", "Refunded"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name="payments")
    ticket = models.ForeignKey(
        Ticket, on_delete=models.SET_NULL, null=True, blank=True, related_name="payments"
    )
    subscription = models.ForeignKey(
        "Subscription", on_delete=models.SET_NULL, null=True, blank=True
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    gst_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    currency = models.CharField(max_length=3, default="INR")
    invoice_number = models.CharField(max_length=64, unique=True, blank=True)
    payment_type = models.CharField(max_length=32, choices=PAYMENT_TYPE_CHOICES)
    gateway = models.CharField(max_length=32, choices=GATEWAY_CHOICES, default="razorpay")
    gateway_payment_id = models.CharField(max_length=255, blank=True)
    gateway_order_id = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.invoice_number} — ₹{self.amount} ({self.status})"

    class Meta:
        ordering = ["-created_at"]


class Subscription(models.Model):
    """
    Monthly/annual support packages (Silver / Gold / Platinum).
    """
    PLAN_CHOICES = [
        ("silver", "Silver — ₹1,499/mo"),
        ("gold", "Gold — ₹3,499/mo"),
        ("platinum", "Platinum — ₹7,999/mo"),
    ]
    BILLING_CHOICES = [
        ("monthly", "Monthly"),
        ("annual", "Annual"),
    ]
    STATUS_CHOICES = [
        ("active", "Active"),
        ("cancelled", "Cancelled"),
        ("expired", "Expired"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name="subscriptions")
    plan = models.CharField(max_length=32, choices=PLAN_CHOICES)
    billing_cycle = models.CharField(max_length=16, choices=BILLING_CHOICES, default="monthly")
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="active")
    tickets_used = models.IntegerField(default=0)
    started_at = models.DateTimeField()
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.customer} — {self.plan}"


class SLAPolicy(models.Model):
    """
    Defines the response/resolution time targets for each service + severity combo.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    service_type = models.CharField(max_length=32)
    severity = models.CharField(max_length=16)
    plan = models.CharField(max_length=32, default="default")
    first_response_seconds = models.IntegerField()
    resolution_seconds = models.IntegerField()

    def __str__(self):
        return f"{self.service_type}/{self.severity} ({self.plan})"

    class Meta:
        verbose_name = "SLA Policy"
        verbose_name_plural = "SLA Policies"
        unique_together = [["service_type", "severity", "plan"]]


class SLALog(models.Model):
    """
    Records every SLA event for a ticket (creation, assignment, breach, resolution).
    """
    EVENT_CHOICES = [
        ("created", "Created"),
        ("assigned", "Assigned"),
        ("first_response", "First Response"),
        ("resolved", "Resolved"),
        ("breach", "SLA Breach"),
    ]
    STATUS_CHOICES = [
        ("met", "Met"),
        ("missed", "Missed"),
        ("pending", "Pending"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name="sla_logs")
    event = models.CharField(max_length=32, choices=EVENT_CHOICES)
    timestamp = models.DateTimeField(auto_now_add=True)
    target_seconds = models.IntegerField(null=True, blank=True)
    actual_seconds = models.IntegerField(null=True, blank=True)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="pending")
    notes = models.TextField(blank=True)

    def __str__(self):
        return f"{self.ticket.ticket_number} — {self.event}"

    class Meta:
        ordering = ["timestamp"]


class CSATSurvey(models.Model):
    """
    Customer satisfaction score submitted after a ticket is resolved.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket = models.OneToOneField(Ticket, on_delete=models.CASCADE, related_name="csat_survey")
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE)
    score = models.IntegerField(help_text="Rating from 1 (very unhappy) to 5 (very happy)")
    comment = models.TextField(blank=True)
    submitted_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"CSAT {self.score}/5 for {self.ticket.ticket_number}"

    class Meta:
        verbose_name = "CSAT Survey"
        verbose_name_plural = "CSAT Surveys"


class AuditLog(models.Model):
    """
    Immutable record of every important action in the system.
    Used for security audits and compliance (DPDP Act 2023).
    """
    USER_TYPE_CHOICES = [
        ("customer", "Customer"),
        ("freelancer", "Freelancer"),
        ("admin", "Admin"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user_id = models.UUIDField()
    user_type = models.CharField(max_length=16, choices=USER_TYPE_CHOICES)
    entity = models.CharField(max_length=64, help_text="Table name, e.g. 'tickets'")
    entity_id = models.UUIDField(null=True, blank=True)
    action = models.CharField(max_length=64)
    metadata = models.JSONField(default=dict)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user_type} {self.user_id} — {self.action} on {self.entity}"

    class Meta:
        ordering = ["-created_at"]
