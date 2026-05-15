"""
Database models for SupportMitra.

Every table in the database is defined here as a Python class.
Django's ORM turns these classes into SQL tables automatically
when you run `python manage.py migrate`.

Only the schema is defined here — no business logic yet.
"""

import uuid

from django.contrib.auth.models import User
from django.db import models


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
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="customer_profile")
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
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="freelancer_profile")
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
