"""
API Views — each class or function handles one URL endpoint.

ARCHITECTURE RULE:
  Views are thin. They:
    1. Parse and validate the request (via serializers)
    2. Check permissions
    3. Call the service layer for business logic
    4. Return an HTTP response

  Business logic — changing ticket state, logging, sending notifications —
  lives in services/ticket_service.py and services/notification_service.py.

URL STRUCTURE:
  /api/auth/          — authentication
  /api/customers/     — customer profile
  /api/tickets/       — customer ticket operations
  /api/freelancer/    — freelancer-specific operations
  /api/admin/         — admin-only operations
  /api/notifications/ — in-app notification inbox
  /api/payments/      — payment history
  /api/services/      — service catalogue

API VERSIONING NOTE:
  All routes currently live under /api/.
  To version: change urls.py to /api/v1/ and add /api/v2/ when needed.
  The views themselves are version-agnostic — no code changes required.
"""

from django.conf import settings
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404

User = get_user_model()
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView as BaseTokenObtainPairView

from .models import (
    Customer,
    Freelancer,
    Notification,
    Payment,
    Subscription,
    Ticket,
    TicketActivityLog,
    TicketComment,
)
from .permissions import IsAdminUser, IsCustomer, IsFreelancer, IsFreelancerOrAdmin, IsOwnerOrAdmin
from .serializers import (
    AdminAssignSerializer,
    AdminStatusSerializer,
    CSATSurveySerializer,
    CustomerSerializer,
    FreelancerSerializer,
    FreelancerStatusSerializer,
    NotificationSerializer,
    PaymentSerializer,
    RegisterSerializer,
    SubscriptionSerializer,
    TicketActivityLogSerializer,
    TicketCommentSerializer,
    TicketCreateSerializer,
    TicketDetailSerializer,
    TicketListSerializer,
)


# ── Auth-specific throttle ────────────────────────────────────────
#
# WHY a separate throttle for auth endpoints?
# The global AnonRateThrottle is 20/minute for all anonymous traffic.
# Login and register deserve a stricter separate bucket so an attacker
# trying 1,000 password guesses per minute doesn't consume the entire
# anonymous quota and affect other public endpoints.
#
# "auth" scope maps to DEFAULT_THROTTLE_RATES["auth"] in settings.py.

class AuthRateThrottle(AnonRateThrottle):
    scope = "auth"


# ── Custom JWT Login ─────────────────────────────────────────────

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Extends the default SimpleJWT login serializer to include user data.
    SimpleJWT returns only {access, refresh} by default; the frontend
    needs {id, email, is_staff, role} to set up the auth store correctly.
    """
    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = {
            "id": str(self.user.id),
            "email": self.user.email,
            "is_staff": self.user.is_staff,
            "role": self.user.role,
        }
        return data


class CustomTokenObtainPairView(BaseTokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
    throttle_classes = [AuthRateThrottle]


# ── Health Check ──────────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def health_check(request):
    """GET /api/health/ — 200 OK if app is running."""
    return Response({"status": "ok"})


# ── Authentication ────────────────────────────────────────────────

class RegisterView(generics.CreateAPIView):
    """
    POST /api/auth/register/
    Creates a new customer account and returns JWT tokens.
    """
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [AuthRateThrottle]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": {
                    "id": str(user.id),
                    "email": user.email,
                    "is_staff": user.is_staff,
                    "role": user.role,
                },
            },
            status=status.HTTP_201_CREATED,
        )


# ── Logout ───────────────────────────────────────────────────────

@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def logout_view(request):
    """
    POST /api/auth/logout/
    Body: { "refresh": "<refresh_token>" }
    Blacklists the refresh token — returns 204 regardless.
    """
    try:
        token = RefreshToken(request.data.get("refresh", ""))
        token.blacklist()
    except Exception:
        pass
    return Response(status=status.HTTP_204_NO_CONTENT)


# ── Current User ─────────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def me_view(request):
    """
    GET /api/auth/me/
    Returns the authenticated user's identity and role-specific profile data.

    Works for ALL roles: customer, freelancer, admin.
    This is the correct endpoint for initializeAuth() — unlike /customers/me/,
    it does not return 403 for admins and freelancers on page refresh.

    Response shape:
      {
        "id": "uuid",
        "email": "user@example.com",
        "role": "customer" | "freelancer" | "admin",
        "is_staff": false,
        "first_name": "",
        "last_name": "",
        "profile": { ... role-specific fields ... }   // absent for plain admins
      }
    """
    user = request.user
    data = {
        "id": str(user.id),
        "email": user.email,
        "role": user.role,
        "is_staff": user.is_staff,
        "first_name": user.first_name,
        "last_name": user.last_name,
    }

    if hasattr(user, "customer_profile"):
        p = user.customer_profile
        data["profile"] = {
            "company": p.company,
            "phone": p.phone,
            "plan": p.plan,
        }
    elif hasattr(user, "freelancer_profile"):
        p = user.freelancer_profile
        data["profile"] = {
            "skills": p.skills,
            "availability": p.availability,
            "rating": str(p.rating),
            "onboarding_status": p.onboarding_status,
        }

    return Response(data)


# ── Customer Profile ──────────────────────────────────────────────

class CustomerMeView(generics.RetrieveUpdateAPIView):
    """
    GET  /api/customers/me/   — return own profile
    PATCH /api/customers/me/  — update company, phone, address, gstin
    """
    serializer_class = CustomerSerializer
    permission_classes = [permissions.IsAuthenticated, IsCustomer]

    def get_object(self):
        return self.request.user.customer_profile


# ── Services Catalog ─────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def services_list(request):
    """GET /api/services/ — all service types with resolution fees."""
    services = [
        {"key": "desktop",  "name": "Desktop / Laptop Support",  "resolution_fee": 499},
        {"key": "linux",    "name": "Linux Provisioning",         "resolution_fee": 999},
        {"key": "windows",  "name": "Windows Provisioning",       "resolution_fee": 999},
        {"key": "patching", "name": "OS Patching",                "resolution_fee": 799},
        {"key": "security", "name": "Security Hardening",         "resolution_fee": 1499},
        {"key": "vmware",   "name": "VMware / Hypervisor",        "resolution_fee": 1299},
        {"key": "sap",      "name": "SAP Basis Lite",             "resolution_fee": 1999},
    ]
    return Response(services)


# ── Tickets (Customer) ────────────────────────────────────────────

class TicketListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/tickets/  — list the logged-in customer's tickets
    POST /api/tickets/  — open a new ticket

    Query params for filtering:
      ?status=open
      ?service_type=linux
      ?severity=high
      ?search=<text>     (searches title and description)
      ?ordering=created_at,-priority
    """
    permission_classes = [permissions.IsAuthenticated, IsCustomer]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return TicketCreateSerializer
        return TicketListSerializer

    def get_queryset(self):
        qs = Ticket.objects.filter(
            customer=self.request.user.customer_profile
        ).select_related("customer__user", "assigned_to__user")

        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)

        service_filter = self.request.query_params.get("service_type")
        if service_filter:
            qs = qs.filter(service_type=service_filter)

        severity_filter = self.request.query_params.get("severity")
        if severity_filter:
            qs = qs.filter(severity=severity_filter)

        # Full-text search across title and description
        search = self.request.query_params.get("search")
        if search:
            from django.db.models import Q
            qs = qs.filter(Q(title__icontains=search) | Q(description__icontains=search))

        # Ordering: ?ordering=created_at  or  ?ordering=-priority
        ordering = self.request.query_params.get("ordering")
        allowed_orderings = {"created_at", "-created_at", "priority", "-priority", "status", "-status"}
        if ordering in allowed_orderings:
            qs = qs.order_by(ordering)

        return qs

    def create(self, request, *args, **kwargs):
        serializer = TicketCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        from .services.ticket_service import create_ticket
        ticket = create_ticket(
            customer=request.user.customer_profile,
            validated_data=serializer.validated_data,
        )
        # Return TicketListSerializer so the response includes id + ticket_number,
        # allowing the frontend to navigate directly to /tickets/{id}.
        return Response(TicketListSerializer(ticket).data, status=status.HTTP_201_CREATED)


class TicketDetailView(generics.RetrieveUpdateAPIView):
    """
    GET   /api/tickets/{id}/  — get ticket detail
    PATCH /api/tickets/{id}/  — customer updates description/notes before assignment
    """
    serializer_class = TicketDetailSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrAdmin]

    def get_queryset(self):
        qs = Ticket.objects.select_related("customer__user", "assigned_to__user")
        if self.request.user.is_staff:
            return qs
        if hasattr(self.request.user, "freelancer_profile"):
            return qs.filter(assigned_to=self.request.user.freelancer_profile)
        return qs.filter(customer=self.request.user.customer_profile)


class TicketCommentListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/tickets/{ticket_id}/comments/  — list comments
    POST /api/tickets/{ticket_id}/comments/  — add a comment
    """
    serializer_class = TicketCommentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def _get_ticket(self):
        """
        Fetch the ticket and enforce ownership, cached on the view instance
        so get_queryset() and perform_create() share the same DB lookup.
        """
        if not hasattr(self, "_cached_ticket"):
            user = self.request.user
            if user.is_staff:
                ticket = get_object_or_404(Ticket, pk=self.kwargs["ticket_id"])
            elif hasattr(user, "freelancer_profile"):
                ticket = get_object_or_404(
                    Ticket,
                    pk=self.kwargs["ticket_id"],
                    assigned_to=user.freelancer_profile,
                )
            elif hasattr(user, "customer_profile"):
                ticket = get_object_or_404(
                    Ticket,
                    pk=self.kwargs["ticket_id"],
                    customer=user.customer_profile,
                )
            else:
                raise PermissionDenied()
            self._cached_ticket = ticket
        return self._cached_ticket

    def get_queryset(self):
        ticket = self._get_ticket()
        qs = TicketComment.objects.filter(ticket=ticket)
        # Customers see only public comments; staff/freelancers see all
        if not self.request.user.is_staff and not hasattr(self.request.user, "freelancer_profile"):
            qs = qs.filter(is_internal=False)
        return qs

    def perform_create(self, serializer):
        from .services.ticket_service import add_comment
        ticket = self._get_ticket()
        is_internal = bool(
            serializer.validated_data.get("is_internal", False)
            and (self.request.user.is_staff or hasattr(self.request.user, "freelancer_profile"))
        )
        comment = add_comment(
            ticket=ticket,
            author=self.request.user,
            body=serializer.validated_data["body"],
            is_internal=is_internal,
        )
        serializer.instance = comment


# ── Activity Log ──────────────────────────────────────────────────

class TicketActivityLogListView(generics.ListAPIView):
    """
    GET /api/tickets/{ticket_id}/activity/

    Returns the chronological event timeline for a ticket.
    This is the "history" view shown in the ticket detail page.

    Visibility rules:
      - Admin: all tickets
      - Customer: only own tickets
      - Freelancer: only their currently-assigned tickets
    """
    serializer_class = TicketActivityLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        ticket_id = self.kwargs["ticket_id"]

        if user.is_staff:
            ticket = get_object_or_404(Ticket, pk=ticket_id)
        elif hasattr(user, "freelancer_profile"):
            ticket = get_object_or_404(
                Ticket, pk=ticket_id, assigned_to=user.freelancer_profile
            )
        elif hasattr(user, "customer_profile"):
            ticket = get_object_or_404(
                Ticket, pk=ticket_id, customer=user.customer_profile
            )
        else:
            raise PermissionDenied()

        return TicketActivityLog.objects.filter(ticket=ticket).order_by("created_at")


# ── CSAT ─────────────────────────────────────────────────────────

@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, IsCustomer])
def submit_csat(request, ticket_id):
    """
    POST /api/tickets/{id}/csat/
    Submit a 1–5 satisfaction score for a resolved/closed ticket.
    """
    ticket = get_object_or_404(
        Ticket,
        pk=ticket_id,
        customer=request.user.customer_profile,
    )
    if ticket.status not in ("resolved", "closed"):
        return Response(
            {"detail": "CSAT can only be submitted for resolved or closed tickets."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if hasattr(ticket, "csat_survey"):
        return Response(
            {"detail": "CSAT survey already submitted for this ticket."},
            status=status.HTTP_409_CONFLICT,
        )
    serializer = CSATSurveySerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    serializer.save(ticket=ticket, customer=request.user.customer_profile)
    return Response(serializer.data, status=status.HTTP_201_CREATED)


# ── Payments ─────────────────────────────────────────────────────

class PaymentListView(generics.ListAPIView):
    """GET /api/customers/me/payments/ — list own payments."""
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated, IsCustomer]

    def get_queryset(self):
        return Payment.objects.filter(customer=self.request.user.customer_profile)


class PaymentDetailView(generics.RetrieveAPIView):
    """GET /api/payments/{id}/ — one payment (own only)."""
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated, IsCustomer]

    def get_queryset(self):
        return Payment.objects.filter(customer=self.request.user.customer_profile)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated, IsCustomer])
def payment_invoice(request, pk):
    """GET /api/payments/{id}/invoice/ — TODO: PDF generation in Phase 5."""
    return Response(
        {"detail": "Invoice generation is not yet available."},
        status=status.HTTP_501_NOT_IMPLEMENTED,
    )


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def payment_webhook(request):
    """
    POST /api/payments/webhook/ — Razorpay webhook receiver.

    SECURITY NOTE: Before adding any real payment logic here you MUST:
      1. Verify the X-Razorpay-Signature header using HMAC-SHA256
         with RAZORPAY_WEBHOOK_SECRET from settings.
      2. Check the payment_id was not already processed (idempotency).
      3. Only then update ticket/payment state.

    Current stub — safely returns 200 with no side effects.
    """
    import hashlib
    import hmac

    webhook_secret = getattr(settings, "RAZORPAY_WEBHOOK_SECRET", "")
    if webhook_secret:
        signature = request.headers.get("X-Razorpay-Signature", "")
        body      = request.body
        expected  = hmac.new(
            webhook_secret.encode(), body, hashlib.sha256
        ).hexdigest()  # type: ignore[attr-defined]
        if not hmac.compare_digest(expected, signature):
            return Response(
                {"detail": "Invalid signature."},
                status=status.HTTP_400_BAD_REQUEST,
            )

    return Response({"received": True})


# ── Notifications ─────────────────────────────────────────────────

class NotificationListView(generics.ListAPIView):
    """
    GET /api/notifications/
    Returns all notifications for the authenticated user, newest first.

    Query params:
      ?unread=true   — filter to unread-only
    """
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Notification.objects.filter(recipient=self.request.user)
        if self.request.query_params.get("unread") == "true":
            qs = qs.filter(is_read=False)
        return qs


@api_view(["PATCH"])
@permission_classes([permissions.IsAuthenticated])
def notification_mark_read(request, pk):
    """
    PATCH /api/notifications/{id}/read/
    Marks a single notification as read. Returns the updated notification.
    """
    notification = get_object_or_404(Notification, pk=pk, recipient=request.user)
    notification.is_read = True
    notification.save(update_fields=["is_read"])
    return Response(NotificationSerializer(notification).data)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def notification_mark_all_read(request):
    """
    POST /api/notifications/mark-all-read/
    Bulk-marks all unread notifications for this user as read.
    Returns how many were updated.
    """
    updated = Notification.objects.filter(
        recipient=request.user, is_read=False
    ).update(is_read=True)
    return Response({"marked_read": updated})


# ── Freelancer APIs ───────────────────────────────────────────────

class FreelancerTicketListView(generics.ListAPIView):
    """
    GET /api/freelancer/tickets/
    Lists all tickets currently assigned to this freelancer.

    Query params:
      ?status=in_progress   — filter by status
    """
    serializer_class = TicketListSerializer
    permission_classes = [permissions.IsAuthenticated, IsFreelancer]

    def get_queryset(self):
        qs = Ticket.objects.filter(
            assigned_to=self.request.user.freelancer_profile
        ).select_related("customer__user", "assigned_to__user")
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs


class FreelancerTicketDetailView(generics.RetrieveAPIView):
    """
    GET /api/freelancer/tickets/{id}/
    Full detail of one ticket assigned to this freelancer.
    Returns 404 if the ticket is not assigned to them.
    """
    serializer_class = TicketDetailSerializer
    permission_classes = [permissions.IsAuthenticated, IsFreelancer]

    def get_queryset(self):
        return Ticket.objects.filter(
            assigned_to=self.request.user.freelancer_profile
        ).select_related("customer__user", "assigned_to__user")


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, IsFreelancer])
def freelancer_update_status(request, ticket_id):
    """
    POST /api/freelancer/tickets/{id}/status/
    Body: {"new_status": "waiting_customer", "note": "optional"}

    Freelancers can move a ticket to: in_progress, waiting_customer, resolved.
    Only admins can close a ticket.
    """
    from .services.ticket_service import update_status
    from .services.notification_service import create_notification

    ticket = get_object_or_404(
        Ticket,
        pk=ticket_id,
        assigned_to=request.user.freelancer_profile,
    )

    serializer = FreelancerStatusSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    try:
        ticket = update_status(
            ticket=ticket,
            new_status=serializer.validated_data["new_status"],
            actor=request.user,
            note=serializer.validated_data.get("note", ""),
        )
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    create_notification(
        recipient=ticket.customer.user,
        category="status_changed",
        title=f"Ticket {ticket.ticket_number} update",
        body=f"Your ticket is now: {ticket.get_status_display()}",
        ticket=ticket,
    )

    return Response(TicketDetailSerializer(ticket).data)


# ── Admin: Ticket Management ──────────────────────────────────────

class AdminTicketListView(generics.ListAPIView):
    """
    GET /api/admin/tickets/
    List ALL tickets across all customers.

    Query params:
      ?status=open
      ?service_type=linux
      ?severity=high
      ?priority=urgent
      ?search=<text>      (title / ticket_number)
      ?ordering=created_at,-priority
    """
    serializer_class = TicketListSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def get_queryset(self):
        qs = Ticket.objects.select_related("customer__user", "assigned_to__user")

        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)

        service_filter = self.request.query_params.get("service_type")
        if service_filter:
            qs = qs.filter(service_type=service_filter)

        severity_filter = self.request.query_params.get("severity")
        if severity_filter:
            qs = qs.filter(severity=severity_filter)

        priority_filter = self.request.query_params.get("priority")
        if priority_filter:
            qs = qs.filter(priority=priority_filter)

        search = self.request.query_params.get("search")
        if search:
            from django.db.models import Q
            qs = qs.filter(
                Q(title__icontains=search) | Q(ticket_number__icontains=search)
            )

        ordering = self.request.query_params.get("ordering")
        allowed = {
            "created_at", "-created_at",
            "priority", "-priority",
            "severity", "-severity",
            "status", "-status",
        }
        if ordering in allowed:
            qs = qs.order_by(ordering)

        return qs


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, IsAdminUser])
def admin_assign_ticket(request, ticket_id):
    """
    POST /api/admin/tickets/{id}/assign/
    Body: {"freelancer_id": "<uuid>"}

    Assigns a ticket to a freelancer. If the ticket was already assigned,
    this is treated as a reassignment — the old assignment is closed and
    a new one is created. Full history is preserved in TicketAssignment.
    """
    from .services.ticket_service import assign_ticket
    from .services.notification_service import create_notification

    ticket = get_object_or_404(Ticket, pk=ticket_id)

    serializer = AdminAssignSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    freelancer = get_object_or_404(
        Freelancer, pk=serializer.validated_data["freelancer_id"]
    )

    try:
        assign_ticket(ticket=ticket, freelancer=freelancer, assigned_by=request.user)
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    # Notify the freelancer
    create_notification(
        recipient=freelancer.user,
        category="ticket_assigned",
        title=f"New ticket assigned: {ticket.ticket_number}",
        body=f"{ticket.title} — {ticket.get_service_type_display()}",
        ticket=ticket,
    )
    # Notify the customer that their ticket is now in progress
    create_notification(
        recipient=ticket.customer.user,
        category="status_changed",
        title=f"Your ticket {ticket.ticket_number} is now in progress",
        body="A support engineer has been assigned to your ticket.",
        ticket=ticket,
    )

    ticket.refresh_from_db()
    return Response(TicketDetailSerializer(ticket).data, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, IsAdminUser])
def admin_status_update(request, ticket_id):
    """
    POST /api/admin/tickets/{id}/status/
    Body: {"new_status": "resolved", "note": "optional"}

    Admins can move a ticket to any valid status including "closed".
    The service layer validates the transition and logs it.
    """
    from .services.ticket_service import update_status
    from .services.notification_service import create_notification

    ticket = get_object_or_404(Ticket, pk=ticket_id)

    serializer = AdminStatusSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    try:
        ticket = update_status(
            ticket=ticket,
            new_status=serializer.validated_data["new_status"],
            actor=request.user,
            note=serializer.validated_data.get("note", ""),
        )
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    create_notification(
        recipient=ticket.customer.user,
        category="status_changed",
        title=f"Ticket {ticket.ticket_number} status updated",
        body=f"Your ticket is now: {ticket.get_status_display()}",
        ticket=ticket,
    )

    return Response(TicketDetailSerializer(ticket).data)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, IsAdminUser])
def admin_unassign_ticket(request, ticket_id):
    """
    POST /api/admin/tickets/{id}/unassign/
    Body: {"note": "optional reason"}

    Removes the current freelancer from a ticket, setting it back to "open".
    The TicketAssignment record is closed (unassigned_at is stamped).
    """
    from .services.ticket_service import unassign_ticket

    ticket = get_object_or_404(Ticket, pk=ticket_id)
    note = request.data.get("note", "")

    try:
        unassign_ticket(ticket=ticket, actor=request.user, note=note)
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    ticket.refresh_from_db()
    return Response(TicketDetailSerializer(ticket).data)


# ── Admin: Freelancer Management ─────────────────────────────────

class AdminFreelancerListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/admin/freelancers/  — list all freelancers
    POST /api/admin/freelancers/  — register a new freelancer
    """
    serializer_class = FreelancerSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]
    queryset = Freelancer.objects.all()
