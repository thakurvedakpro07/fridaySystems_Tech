"""
Database models for ResolveHQ.

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
        ("operations_manager", "Operations Manager"),
        ("finance_manager", "Finance Manager"),
        ("support_agent", "Support Agent"),
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
    role = models.CharField(max_length=32, choices=ROLE_CHOICES, default="customer")

    # ── Email verification ────────────────────────────────────────
    # True for all existing users (default) and for superusers.
    # Set to False on self-registration; set back to True after the
    # user clicks the verification link emailed to them.
    is_verified = models.BooleanField(default=True)

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
    # H-05: payout_details is intentionally excluded from all API serializers.
    # Stored as plaintext JSON — at-rest encryption is a Phase 5 deliverable
    # (django-encrypted-fields or Vault transit). Never expose this field via API.
    payout_details = models.JSONField(default=dict, help_text="Bank/UPI payout details — exclude from all serializers until encrypted at rest")
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


# ── Ticket System ────────────────────────────────────────────────
#
# The ticket is the central object in ResolveHQ. Everything else
# (comments, attachments, activity logs, assignments) hangs off it.
#
# Design principles applied here:
#   1. UUIDs everywhere — safe to expose in URLs, non-guessable
#   2. ForeignKeys instead of raw UUIDs — database enforces relationships
#   3. Separate priority AND severity — they measure different things
#   4. Status as a string field — readable in logs, easy to add new states
#   5. Timestamps on every important event — SLA, debugging, billing


class Ticket(models.Model):
    """
    A support request raised by a customer.

    The Ticket is the single source of truth for one support incident.
    It records: who raised it, what service is needed, how urgent it is,
    who is handling it, and what state it is currently in.

    Lifecycle:
      pending_payment → open → assigned → in_progress → waiting_customer
                                                      → resolved → closed
    """

    # ── Service catalogue ─────────────────────────────────────────
    # Each service type maps to a different resolution fee and SLA target.
    # Adding a new service = add one tuple here + update SLAPolicy table.
    SERVICE_CHOICES = [
        ("desktop",      "Desktop / Laptop Support"),
        ("linux",        "Linux Provisioning"),
        ("windows",      "Windows Provisioning"),
        ("patching",     "OS Patching"),
        ("security",     "Security Hardening"),
        ("vmware",       "VMware / Hypervisor"),
        ("sap",          "SAP Basis Lite"),
        ("microsoft365", "Microsoft 365 / Exchange"),
    ]

    # ── Severity — TECHNICAL impact ───────────────────────────────
    # How badly is the system broken?
    # "critical" = complete outage, all users blocked
    # "low"      = cosmetic issue, workaround available
    # Used by SLA engine to set response/resolution time targets.
    SEVERITY_CHOICES = [
        ("low",      "Low — Minor inconvenience"),
        ("medium",   "Medium — Partial degradation"),
        ("high",     "High — Major function blocked"),
        ("critical", "Critical — Complete outage"),
    ]

    # ── Priority — BUSINESS urgency ───────────────────────────────
    # How fast does the business need this fixed?
    # "urgent" = CEO's machine, production payment system, etc.
    # A low-severity issue can still be urgent (e.g. CEO's mouse broken).
    # A high-severity issue can be medium priority (dev server, no customers affected).
    PRIORITY_CHOICES = [
        ("low",    "Low"),
        ("medium", "Medium"),
        ("high",   "High"),
        ("urgent", "Urgent"),
    ]

    # ── Status — the lifecycle state machine ──────────────────────
    # Each status represents a distinct stage in the support workflow.
    # Status transitions are logged automatically in TicketActivityLog.
    #
    # pending_payment  → customer has submitted; awaiting consulting fee payment
    # open             → payment received; ticket visible to admin queue
    # assigned         → freelancer assigned; they haven't started yet
    # in_progress      → freelancer is actively working
    # waiting_customer → freelancer needs info or action from customer
    # resolved         → freelancer marks fixed; customer can confirm or reopen
    # closed           → customer confirmed OR auto-closed after 48h
    STATUS_CHOICES = [
        ("pending_payment",  "Pending Payment"),
        ("open",             "Open"),
        ("assigned",         "Assigned"),
        ("in_progress",      "In Progress"),
        ("waiting_customer", "Waiting for Customer"),
        ("resolved",         "Resolved"),
        ("closed",           "Closed"),
    ]

    # ── Core identity fields ──────────────────────────────────────
    id            = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket_number = models.CharField(max_length=16, unique=True, blank=True)

    # ── Ownership ─────────────────────────────────────────────────
    # PROTECT means: cannot delete a Customer who has tickets.
    # This protects business records. If a customer churns, we archive them,
    # not delete them.
    customer = models.ForeignKey(
        Customer,
        on_delete=models.PROTECT,
        related_name="tickets",
    )

    # ── Problem description ───────────────────────────────────────
    title       = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    service_type = models.CharField(max_length=32, choices=SERVICE_CHOICES)

    # ── Urgency fields ────────────────────────────────────────────
    severity = models.CharField(max_length=16, choices=SEVERITY_CHOICES, default="medium")
    priority = models.CharField(max_length=16, choices=PRIORITY_CHOICES,  default="medium")

    # ── Workflow state ────────────────────────────────────────────
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default="pending_payment")

    # ── Assignment ────────────────────────────────────────────────
    # SET_NULL means: if a Freelancer account is deleted, ticket stays
    # open but becomes unassigned. The TicketAssignment table preserves
    # the history of who was previously assigned.
    assigned_to = models.ForeignKey(
        Freelancer,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="assigned_tickets",
    )

    # ── SLA tracking ──────────────────────────────────────────────
    # first_response_at: when the FIRST public comment was posted by non-customer.
    # Used to measure "first response SLA" compliance.
    first_response_at   = models.DateTimeField(null=True, blank=True)
    # due_at: SLA deadline for resolution. Set when ticket moves to "open".
    due_at              = models.DateTimeField(null=True, blank=True)
    # sla_breach_notified: prevents sending duplicate breach alerts.
    sla_breach_notified = models.BooleanField(default=False)

    # ── Tooling ───────────────────────────────────────────────────
    # remote_session_url: AnyDesk / TeamViewer link shared with customer.
    remote_session_url  = models.URLField(max_length=512, blank=True)
    # external_ticket_id: if customer also uses Jira/Freshdesk, store cross-reference.
    external_ticket_id  = models.CharField(max_length=255, blank=True)
    # notes: admin-level freeform notes. Internal comments (TicketComment with
    # is_internal=True) are preferred for structured notes, but this field
    # handles quick admin annotations without creating a comment thread entry.
    notes               = models.TextField(blank=True)

    # ── Timestamps ───────────────────────────────────────────────
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.ticket_number} — {self.title}"

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "customer"], name="idx_ticket_status_customer"),
            models.Index(fields=["assigned_to", "status"], name="idx_ticket_assigned_status"),
        ]


class TicketComment(models.Model):
    """
    One message in the conversation thread on a ticket.

    Three types of participants can comment:
      - Customer   (always sees all non-internal comments)
      - Freelancer (sees and writes public + internal)
      - Admin      (sees everything, can write internal-only notes)

    is_internal = True  → "private note" — only freelancer + admin can read it.
                           Hidden from customer.
    is_internal = False → "public message" — all parties can read it.

    WHY separate from AuditLog?
      AuditLog tracks system events (login, payment, delete).
      TicketComment is the human conversation — it has a body, can be
      edited (is_edited=True), and is surfaced in the customer-facing UI.

    WHY ForeignKey instead of author_id + author_type (old design)?
      A raw UUIDField has no database-level enforcement. If the user is
      deleted, the UUID becomes a dangling reference — nothing catches it.
      With ForeignKey + SET_NULL, the database automatically sets author=NULL
      when the user is deleted, and your code handles it cleanly.
    """

    id     = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name="comments")

    # author → who posted this comment.
    # SET_NULL: if user is deleted, comment body is preserved (important for
    # legal/audit reasons) but author becomes NULL ("Deleted User").
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="ticket_comments",
    )

    body       = models.TextField()

    # is_internal: True = admin/freelancer private note, hidden from customer.
    # This enables "thinking out loud" without alarming customers.
    is_internal = models.BooleanField(default=False)

    # is_edited: True = the body was changed after posting.
    # Displayed as "(edited)" in the UI — transparency to all parties.
    is_edited   = models.BooleanField(default=False)

    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    def __str__(self):
        author_label = self.author.email if self.author else "Deleted User"
        visibility   = "internal" if self.is_internal else "public"
        return f"[{visibility}] {author_label} on {self.ticket.ticket_number}"

    class Meta:
        ordering = ["created_at"]


class TicketAttachment(models.Model):
    """
    Metadata for a file attached to a ticket.

    The actual file lives in AWS S3 / Google Cloud Storage.
    This model stores ONLY the pointer to it (URL) and metadata
    needed for display (filename, size, type).

    WHY not store files in the database?
      Databases are optimised for structured data (rows and columns).
      Files are binary blobs — storing them in a database:
        - Balloons the database size
        - Slows down every backup
        - Makes scaling expensive
      S3/GCS is designed exactly for files — cheap, fast, infinitely scalable.

    WHY track uploaded_by as ForeignKey?
      If a malicious file is uploaded, you need to know who did it.
      A raw UUID field (old design) gives you nothing if the user is deleted.
      With FK + SET_NULL, you preserve the record even if the user is gone.
    """
    ALLOWED_MIME_TYPES = [
        "image/png", "image/jpeg", "image/gif", "image/webp",
        "application/pdf",
        "text/plain", "text/csv",
        "application/zip",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ]

    id      = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket  = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name="attachments")

    file_name   = models.CharField(max_length=255)
    file        = models.FileField(upload_to="attachments/%Y/%m/", null=True, blank=True)
    storage_url = models.URLField(max_length=1024, blank=True)
    file_size   = models.PositiveIntegerField(help_text="File size in bytes", default=0)
    mime_type   = models.CharField(max_length=128, blank=True)

    # uploaded_by: FK to user who uploaded — security audit trail.
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="ticket_attachments",
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.file_name} ({self.ticket.ticket_number})"

    class Meta:
        ordering = ["-uploaded_at"]


class TicketActivityLog(models.Model):
    """
    An immutable audit trail of every significant change on a ticket.

    IMMUTABLE means: rows are only INSERTED here, never UPDATED or DELETED.
    This makes it a reliable source of truth for:
      - Debugging ("why did this ticket take 3 days?")
      - SLA compliance reporting
      - Dispute resolution
      - Performance metrics ("average resolution time by freelancer")
      - Future ML training data

    Every meaningful action on a ticket triggers one log entry:
      - Status change
      - Priority/severity change
      - Assignment / reassignment
      - First public comment
      - Resolution / closure

    WHY different from AuditLog?
      AuditLog is system-wide: logins, payments, deletions.
      TicketActivityLog is ticket-scoped: only ticket-level events.
      It is shown in the customer-facing "ticket timeline" UI.

    WHY store from_value and to_value as strings?
      Status names, priority names, and email addresses are all short strings.
      Storing them as strings means the log is self-contained — readable even
      if the referenced records are later changed or deleted.
    """

    ACTION_CHOICES = [
        ("created",          "Ticket Created"),
        ("status_changed",   "Status Changed"),
        ("priority_changed", "Priority Changed"),
        ("severity_changed", "Severity Changed"),
        ("assigned",         "Assigned to Freelancer"),
        ("unassigned",       "Unassigned"),
        ("reassigned",       "Reassigned"),
        ("comment_added",    "Comment Added"),
        ("resolved",         "Resolved"),
        ("closed",           "Closed"),
        ("reopened",         "Reopened"),
        ("sla_breached",     "SLA Breached"),
        ("escalated",        "Escalated"),
    ]

    id     = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name="activity_logs")

    # actor: who triggered this event. NULL if triggered by the system
    # (e.g. automated SLA breach detection by Celery task).
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="ticket_activities",
    )

    action     = models.CharField(max_length=32, choices=ACTION_CHOICES)

    # from_value / to_value: human-readable record of the change.
    # Examples:
    #   status change: from_value="open"       to_value="in_progress"
    #   assignment:    from_value=""            to_value="ravi@supportmitra.in"
    #   reassignment:  from_value="ravi@..."   to_value="priya@..."
    from_value = models.CharField(max_length=255, blank=True)
    to_value   = models.CharField(max_length=255, blank=True)

    # note: optional human context. Example: "Customer escalated — reassigning to senior."
    note       = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.ticket.ticket_number} | {self.get_action_display()} at {self.created_at:%Y-%m-%d %H:%M}"

    class Meta:
        ordering = ["created_at"]
        verbose_name      = "Activity Log"
        verbose_name_plural = "Activity Logs"
        indexes = [
            # Speeds up the actor-patch query in update_status() and the timeline fetch
            models.Index(fields=["ticket", "action"], name="idx_activity_log_ticket_action"),
        ]


class TicketAssignment(models.Model):
    """
    The complete history of freelancer assignments for a ticket.

    Ticket.assigned_to shows who is handling it RIGHT NOW.
    TicketAssignment shows who handled it HISTORICALLY.

    WHY this matters:
      - If a ticket is reassigned, Ticket.assigned_to is overwritten.
        The old assignment is gone with no trace.
      - TicketAssignment preserves every row, including unassigned_at timestamp.
      - Business use: "Ravi was assigned for 2 hours before being replaced —
        do we pay him a partial fee?"
      - Future ML use: assignment duration → freelancer efficiency metrics.

    RELATIONSHIP to Ticket.assigned_to:
      When you assign a ticket, BOTH are updated:
        1. Ticket.assigned_to = freelancer  (current state)
        2. TicketAssignment row created     (permanent history)
      When you reassign, you ALSO:
        3. Set unassigned_at on the old TicketAssignment row.

    This dual-write is handled in ticket_service.assign_ticket().
    """

    REASON_CHOICES = [
        ("initial",               "Initial Assignment"),
        ("reassigned",            "Reassigned"),
        ("freelancer_unavailable","Freelancer Unavailable"),
        ("customer_request",      "Customer Request"),
        ("admin_action",          "Admin Action"),
        ("auto_assigned",         "Auto-Assigned"),
    ]

    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket     = models.ForeignKey(Ticket,     on_delete=models.CASCADE,   related_name="assignments")
    freelancer = models.ForeignKey(Freelancer, on_delete=models.SET_NULL,  null=True,  related_name="assignment_history")

    # assigned_by: the admin who made the assignment.
    # SET_NULL: if that admin account is deleted, assignment record stays.
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="assignments_made",
    )

    assigned_at   = models.DateTimeField(auto_now_add=True)
    # unassigned_at: NULL while assignment is active; set when freelancer is removed.
    unassigned_at = models.DateTimeField(null=True, blank=True)

    reason = models.CharField(max_length=32, choices=REASON_CHOICES, default="initial")
    note   = models.CharField(max_length=255, blank=True)

    def __str__(self):
        status = "active" if self.unassigned_at is None else f"ended {self.unassigned_at:%Y-%m-%d}"
        return f"{self.ticket.ticket_number} → {self.freelancer} ({status})"

    class Meta:
        ordering = ["-assigned_at"]
        verbose_name      = "Ticket Assignment"
        verbose_name_plural = "Ticket Assignments"


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


class Notification(models.Model):
    """
    In-app notification delivered to a specific user.

    Created whenever a significant ticket event occurs:
      - A ticket is assigned    → freelancer receives a notification
      - A status changes        → customer receives a notification
      - A comment is added      → ticket participants are notified
      - An SLA breach occurs    → admin is notified

    Each event creates SEPARATE rows per recipient — one notification
    for the customer, a different one for the freelancer. This allows
    each person to mark their own notification as read independently.

    Analogy: Like email — the same event sends separate emails to each
    person. One person marking their email "read" doesn't affect others.
    """

    CATEGORY_CHOICES = [
        ("ticket_assigned",   "Ticket Assigned"),
        ("ticket_resolved",   "Ticket Resolved"),
        ("comment_added",     "Comment Added"),
        ("status_changed",    "Status Changed"),
        ("sla_breach",        "SLA Breach"),
        ("payment_confirmed", "Payment Confirmed"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # recipient: who should see this notification.
    # CASCADE: when a user is deleted, their notifications are deleted too.
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )

    category   = models.CharField(max_length=32, choices=CATEGORY_CHOICES)
    title      = models.CharField(max_length=255)
    body       = models.TextField(blank=True)

    # ticket: the ticket this notification is about (optional).
    # SET_NULL: if the ticket is deleted, the notification body still makes sense.
    ticket = models.ForeignKey(
        Ticket,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="notifications",
    )

    is_read    = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        read_label = "read" if self.is_read else "unread"
        return f"→ {self.recipient.email} | {self.get_category_display()} [{read_label}]"

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            # Speeds up the unread-count query: WHERE recipient_id=? AND is_read=false
            models.Index(fields=["recipient", "is_read"], name="idx_notif_recipient_read"),
        ]


class AuditLog(models.Model):
    """
    Immutable record of every important action in the system.
    Used for security audits and compliance (DPDP Act 2023).
    """
    USER_TYPE_CHOICES = [
        ("customer", "Customer"),
        ("freelancer", "Freelancer"),
        ("admin", "Admin"),
        ("operations_manager", "Operations Manager"),
        ("finance_manager", "Finance Manager"),
        ("support_agent", "Support Agent"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user_id = models.UUIDField()
    user_type = models.CharField(max_length=32, choices=USER_TYPE_CHOICES)
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


class RoleChangeAudit(models.Model):
    """
    Immutable audit trail of every user role change made by a Super Admin.

    Written on every successful role promotion or demotion. Never updated,
    never deleted — compliance and dispute-resolution record.
    """
    ROLE_CHOICES = [
        ("customer", "Customer"),
        ("freelancer", "Engineer"),
        ("admin", "Super Admin"),
        ("operations_manager", "Operations Manager"),
        ("finance_manager", "Finance Manager"),
        ("support_agent", "Support Agent"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # changed_by: the Super Admin who made the change.
    # SET_NULL so the audit row survives even if that admin account is later deleted.
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="role_changes_made",
    )

    # target_user: the user whose role was changed.
    # SET_NULL preserves the audit row even if the target account is deleted.
    target_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="role_change_history",
    )

    # Snapshot the email at time of change — readable if the account is later deleted.
    target_email = models.EmailField(blank=True)

    old_role = models.CharField(max_length=32, choices=ROLE_CHOICES)
    new_role = models.CharField(max_length=32, choices=ROLE_CHOICES)
    note = models.TextField(blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.target_email}: {self.old_role} → {self.new_role} at {self.timestamp:%Y-%m-%d %H:%M}"

    class Meta:
        ordering = ["-timestamp"]
        verbose_name = "Role Change Audit"
        verbose_name_plural = "Role Change Audits"


class Service(models.Model):
    """
    Platform service catalogue entry.
    Operations Managers and Super Admins can create, edit, enable, or disable services.
    """
    STATUS_CHOICES = [
        ("active", "Active"),
        ("inactive", "Inactive"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, unique=True)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="active")
    required_skills = models.CharField(
        max_length=500, blank=True,
        help_text="Comma-separated skill tags, e.g. linux,sap,vmware",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.status})"

    class Meta:
        ordering = ["name"]
