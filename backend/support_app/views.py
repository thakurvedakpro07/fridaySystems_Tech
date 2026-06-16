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
from django.db.models import Q as models_q
from django.shortcuts import get_object_or_404

User = get_user_model()
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes, throttle_classes as throttle_classes_dec
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView as BaseTokenObtainPairView

from .models import (
    CSATSurvey,
    Customer,
    Freelancer,
    Notification,
    Payment,
    Subscription,
    Ticket,
    TicketActivityLog,
    TicketAttachment,
    TicketComment,
)
from .permissions import IsAdminUser, IsCustomer, IsFreelancer, IsFreelancerOrAdmin, IsOwnerOrAdmin
from .serializers import (
    AdminAssignSerializer,
    AdminPaymentSerializer,
    AdminStatusSerializer,
    CSATSurveySerializer,
    CustomerSerializer,
    FreelancerCreateSerializer,
    FreelancerSerializer,
    FreelancerStatusSerializer,
    NotificationSerializer,
    PaymentSerializer,
    PaymentVerifySerializer,
    RegisterSerializer,
    SubscriptionSerializer,
    TicketActivityLogSerializer,
    TicketAttachmentSerializer,
    TicketCommentSerializer,
    TicketCreateSerializer,
    TicketDetailSerializer,
    TicketListSerializer,
    UserProfileUpdateSerializer,
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


class AnalyticsRateThrottle(UserRateThrottle):
    scope = "analytics"


# Dedicated bucket for password-change attempts — stricter than the global
# 100/minute user throttle, so a stolen/leaked session token can't be used
# to brute-force a customer's current password via change-password.
# Keyed per authenticated user (falls back to per-IP for anonymous callers).
#
# DRF's SimpleRateThrottle.parse_rate() only understands whole second/
# minute/hour/day periods, so "5 per 15 minutes" can't be expressed as a
# plain rate string — parse_rate is overridden below to enforce the exact
# 900-second window instead of approximating with "/hour".
class PasswordChangeRateThrottle(UserRateThrottle):
    scope = "password_change"

    def parse_rate(self, rate):
        return (5, 15 * 60)


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
    """GET /api/health/ — 200 OK if running, 503 if DB is unreachable."""
    from django.db import connection
    try:
        connection.ensure_connection()
        db_ok = True
    except Exception:
        db_ok = False
    payload = {"status": "ok" if db_ok else "degraded", "db": db_ok}
    code = status.HTTP_200_OK if db_ok else status.HTTP_503_SERVICE_UNAVAILABLE
    return Response(payload, status=code)


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
        from .services.email_service import send_welcome, send_verification_email
        try:
            send_welcome(user)
        except Exception:
            pass
        try:
            send_verification_email(user)
        except Exception:
            pass
        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": {
                    "id": str(user.id),
                    "email": user.email,
                    "is_staff": user.is_staff,
                    "role": user.role,
                    "is_verified": user.is_verified,
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
        "is_verified": user.is_verified,
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
        qs = TicketComment.objects.filter(ticket=ticket).select_related("author")
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

        return TicketActivityLog.objects.filter(ticket=ticket).select_related("actor").order_by("created_at")


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


# ── Payments (customer) ───────────────────────────────────────────

class PaymentListView(generics.ListAPIView):
    """GET /api/customers/me/payments/ — list own payments."""
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated, IsCustomer]

    def get_queryset(self):
        return Payment.objects.filter(
            customer=self.request.user.customer_profile
        ).select_related("ticket")


class PaymentDetailView(generics.RetrieveAPIView):
    """GET /api/payments/{id}/ — one payment (own only)."""
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated, IsCustomer]

    def get_queryset(self):
        return Payment.objects.filter(
            customer=self.request.user.customer_profile
        ).select_related("ticket")


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, IsCustomer])
def ticket_initiate_payment(request, ticket_id):
    """
    POST /api/tickets/{id}/initiate-payment/
    Creates (or retrieves) the pending Payment for this ticket and returns a
    Razorpay order dict — or a sandbox mock dict when keys are not configured.
    """
    from .services.payment_service import create_order_for_ticket

    ticket = get_object_or_404(
        Ticket, pk=ticket_id, customer=request.user.customer_profile
    )
    if ticket.status != "pending_payment":
        return Response(
            {"detail": "This ticket does not require payment."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        order = create_order_for_ticket(ticket)
    except Exception:
        return Response(
            {"detail": "Could not initiate payment. Please try again."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    return Response(order)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, IsCustomer])
def ticket_verify_payment(request, ticket_id):
    """
    POST /api/tickets/{id}/verify-payment/
    Body: {payment_db_id, razorpay_payment_id, razorpay_order_id, razorpay_signature}

    Verifies the Razorpay signature (skipped in sandbox mode), marks the
    Payment completed, and moves the ticket from pending_payment → open.
    Returns the updated ticket detail.
    """
    from .services.payment_service import verify_and_complete_payment

    ticket = get_object_or_404(
        Ticket, pk=ticket_id, customer=request.user.customer_profile
    )

    serializer = PaymentVerifySerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    vd = serializer.validated_data

    try:
        verify_and_complete_payment(
            payment_db_id=str(vd["payment_db_id"]),
            razorpay_payment_id=vd["razorpay_payment_id"],
            razorpay_order_id=vd["razorpay_order_id"],
            razorpay_signature=vd["razorpay_signature"],
        )
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    except Payment.DoesNotExist:
        return Response({"detail": "Payment record not found."}, status=status.HTTP_404_NOT_FOUND)

    ticket.refresh_from_db()
    return Response(TicketDetailSerializer(ticket).data)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def payment_invoice(request, pk):
    """
    GET /api/payments/{id}/invoice/

    Returns a downloadable PDF tax invoice for the given payment.
    Accessible by the customer who owns the payment, or any staff user.
    """
    payment = get_object_or_404(
        Payment.objects.select_related("customer__user", "ticket"),
        pk=pk,
    )

    # Customer can only download their own invoices; staff can download any.
    if not request.user.is_staff:
        if not hasattr(request.user, "customer_profile") or payment.customer != request.user.customer_profile:
            raise PermissionDenied("You do not have permission to view this invoice.")

    from django.http import HttpResponse
    from .invoice_pdf import generate_invoice_pdf

    pdf_bytes = generate_invoice_pdf(payment)
    filename = f"invoice_{payment.invoice_number or str(payment.id)[:8]}.pdf"
    response = HttpResponse(pdf_bytes, content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def payment_webhook(request):
    """
    POST /api/payments/webhook/ — Razorpay webhook receiver.

    Verifies the X-Razorpay-Signature header, then delegates to
    process_payment_webhook() to handle payment.captured events.
    """
    from .services.payment_service import verify_webhook_signature, process_payment_webhook

    signature = request.headers.get("X-Razorpay-Signature", "")
    if not verify_webhook_signature(request.body, signature):
        return Response({"detail": "Invalid signature."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        event = request.data
        process_payment_webhook(event)
    except Exception:
        pass  # never return non-200 to Razorpay on processing errors

    return Response({"received": True})


# ── Payments (admin) ──────────────────────────────────────────────

class AdminPaymentListView(generics.ListAPIView):
    """
    GET /api/admin/payments/
    All payments across all customers.

    Query params:
      ?status=pending|completed|failed|refunded
      ?payment_type=consulting_fee|resolution_fee
    """
    serializer_class = AdminPaymentSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def get_queryset(self):
        qs = Payment.objects.select_related("customer__user", "ticket").order_by("-created_at")
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        type_filter = self.request.query_params.get("payment_type")
        if type_filter:
            qs = qs.filter(payment_type=type_filter)
        return qs


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, IsAdminUser])
def admin_payment_confirm(request, pk):
    """
    POST /api/admin/payments/{id}/confirm/
    Manually confirm a pending payment — useful when webhook delivery fails.
    Marks payment completed and moves the associated ticket to open.
    """
    from .services.notification_service import create_notification

    payment = get_object_or_404(
        Payment.objects.select_related("ticket", "customer__user"), pk=pk
    )

    if payment.status != "pending":
        return Response(
            {"detail": f"Payment is already {payment.status}."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    payment.gateway_payment_id = f"manual_{payment.invoice_number}"
    payment.status = "completed"
    payment.save(update_fields=["gateway_payment_id", "status"])

    ticket = payment.ticket
    if ticket and ticket.status == "pending_payment":
        old_status = ticket.status
        ticket.status = "open"
        ticket.save(update_fields=["status"])
        TicketActivityLog.objects.create(
            ticket=ticket,
            actor=request.user,
            action="status_changed",
            from_value=old_status,
            to_value="open",
            note=f"Payment {payment.invoice_number} manually confirmed by admin",
        )
        create_notification(
            recipient=payment.customer.user,
            category="payment_confirmed",
            title=f"Payment confirmed — #{ticket.ticket_number}",
            body=f"₹{int(payment.amount + payment.gst_amount)} received. Your ticket is now open.",
            ticket=ticket,
        )

    return Response(AdminPaymentSerializer(payment).data)


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
        qs = Notification.objects.filter(recipient=self.request.user).select_related("ticket")
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


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def notification_unread_count(request):
    """
    GET /api/notifications/unread-count/
    Lightweight count-only endpoint used by the frontend badge poller.
    Returns a single integer — far cheaper than fetching all notifications.
    """
    count = Notification.objects.filter(recipient=request.user, is_read=False).count()
    return Response({"count": count})


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
        search = self.request.query_params.get("search")
        if search:
            from django.db.models import Q
            qs = qs.filter(Q(title__icontains=search) | Q(ticket_number__icontains=search))
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
    POST /api/admin/freelancers/  — create a new freelancer (user + profile atomically)

    Body for POST: { email, password, skills?, availability? }
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]
    queryset = Freelancer.objects.select_related("user").all()

    def get_serializer_class(self):
        if self.request.method == "POST":
            return FreelancerCreateSerializer
        return FreelancerSerializer

    def create(self, request, *args, **kwargs):
        serializer = FreelancerCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        freelancer = serializer.save()
        return Response(FreelancerSerializer(freelancer).data, status=status.HTTP_201_CREATED)


# ── Password Change ───────────────────────────────────────────────

@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
@throttle_classes_dec([PasswordChangeRateThrottle])
def change_password(request):
    """
    POST /api/auth/change-password/
    Body: { "current_password": "...", "new_password": "..." }
    """
    current = request.data.get("current_password", "")
    new_pw  = request.data.get("new_password", "")

    if not current or not new_pw:
        return Response(
            {"detail": "Both current_password and new_password are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if not request.user.check_password(current):
        return Response(
            {"detail": "Current password is incorrect."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    from django.contrib.auth.password_validation import validate_password
    from django.core.exceptions import ValidationError as DjangoValidationError
    try:
        validate_password(new_pw, request.user)
    except DjangoValidationError as exc:
        return Response(
            {"detail": list(exc.messages)},
            status=status.HTTP_400_BAD_REQUEST,
        )
    request.user.set_password(new_pw)
    request.user.save(update_fields=["password"])
    return Response({"detail": "Password updated successfully."})


# ── User Profile Update (all roles) ──────────────────────────────

@api_view(["GET", "PATCH"])
@permission_classes([permissions.IsAuthenticated])
def user_profile(request):
    """
    GET  /api/auth/profile/   — current user profile (all roles)
    PATCH /api/auth/profile/  — update first_name, last_name; plus role-specific fields
    """
    user = request.user
    if request.method == "GET":
        data = {
            "id": str(user.id),
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "role": user.role,
            "is_staff": user.is_staff,
        }
        if hasattr(user, "customer_profile"):
            p = user.customer_profile
            data["company"] = p.company
            data["phone"] = p.phone
            data["address"] = p.address
            data["gstin"] = p.gstin
            data["plan"] = p.plan
        elif hasattr(user, "freelancer_profile"):
            p = user.freelancer_profile
            data["skills"] = p.skills
            data["availability"] = p.availability
        return Response(data)

    # PATCH
    serializer = UserProfileUpdateSerializer(data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    vd = serializer.validated_data

    if "first_name" in vd:
        user.first_name = vd["first_name"]
    if "last_name" in vd:
        user.last_name = vd["last_name"]
    user.save(update_fields=["first_name", "last_name"])

    if hasattr(user, "customer_profile"):
        p = user.customer_profile
        for field in ("company", "phone", "address", "gstin"):
            if field in vd:
                setattr(p, field, vd[field])
        p.save()
    elif hasattr(user, "freelancer_profile"):
        p = user.freelancer_profile
        for field in ("skills", "availability"):
            if field in vd:
                setattr(p, field, vd[field])
        p.save()

    return Response({"detail": "Profile updated."})


# ── Analytics ────────────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
@throttle_classes_dec([AnalyticsRateThrottle])
def analytics_view(request):
    """
    GET /api/analytics/
    Role-aware analytics:
      admin     → all tickets in the system
      customer  → own tickets only
      freelancer → assigned tickets only
    """
    from django.db.models import Avg, Count, F, ExpressionWrapper, DurationField
    from django.utils import timezone
    from datetime import timedelta

    user = request.user
    today = timezone.now()
    thirty_days_ago = today - timedelta(days=30)

    # Base queryset by role
    if user.is_staff:
        qs = Ticket.objects.all()
    elif hasattr(user, "freelancer_profile"):
        qs = Ticket.objects.filter(assigned_to=user.freelancer_profile)
    elif hasattr(user, "customer_profile"):
        qs = Ticket.objects.filter(customer=user.customer_profile)
    else:
        return Response({"detail": "Unknown role."}, status=status.HTTP_403_FORBIDDEN)

    total = qs.count()
    by_status = dict(qs.values_list("status").annotate(n=Count("id")).values_list("status", "n"))
    open_count     = by_status.get("open", 0)
    in_progress    = by_status.get("in_progress", 0) + by_status.get("assigned", 0)
    resolved_count = by_status.get("resolved", 0) + by_status.get("closed", 0)
    pending_count  = by_status.get("pending_payment", 0)

    # Average resolution time — single DB aggregation (no Python loops over rows)
    resolved_qs = qs.filter(resolved_at__isnull=False)
    avg_hours = None
    if resolved_qs.exists():
        avg_result = resolved_qs.aggregate(
            avg=Avg(ExpressionWrapper(F("resolved_at") - F("created_at"), output_field=DurationField()))
        )["avg"]
        if avg_result:
            avg_hours = round(avg_result.total_seconds() / 3600, 1)

    # CSAT average (admin/customer only)
    csat_avg = None
    csat_count = 0
    if not hasattr(user, "freelancer_profile"):
        csat_filter = {} if user.is_staff else {"ticket__customer": user.customer_profile}
        surveys = CSATSurvey.objects.filter(**csat_filter)
        csat_count = surveys.count()
        if csat_count:
            csat_avg = round(float(surveys.aggregate(avg=Avg("score"))["avg"]), 1)

    # Tickets over last 30 days — single query, then Python bucketing (was 7 COUNT queries)
    recent_qs = qs.filter(created_at__gte=thirty_days_ago)
    recent_dates = list(recent_qs.values_list("created_at", flat=True))
    timeline = []
    for i in range(6, -1, -1):
        bucket_end   = today - timedelta(days=i * 4)
        bucket_start = today - timedelta(days=(i + 1) * 4)
        count = sum(1 for d in recent_dates if bucket_start <= d < bucket_end)
        timeline.append({"label": bucket_end.strftime("%d %b"), "count": count})

    # Tickets by service type (top 5)
    service_breakdown = list(
        qs.values("service_type").annotate(n=Count("id")).order_by("-n")[:5]
    )

    # Admin-only: freelancer performance
    freelancer_stats = []
    if user.is_staff:
        for fl in Freelancer.objects.annotate(
            assigned=Count("assigned_tickets"),
            resolved=Count("assigned_tickets", filter=models_q(assigned_tickets__status__in=["resolved", "closed"])),
        ).order_by("-assigned")[:5]:
            freelancer_stats.append({
                "email": fl.user.email,
                "assigned": fl.assigned,
                "resolved": fl.resolved,
                "rating": str(fl.rating),
            })

    return Response({
        "total": total,
        "open": open_count,
        "in_progress": in_progress,
        "resolved": resolved_count,
        "pending_payment": pending_count,
        "avg_resolution_hours": avg_hours,
        "csat_avg": csat_avg,
        "csat_count": csat_count,
        "timeline": timeline,
        "service_breakdown": service_breakdown,
        "freelancer_stats": freelancer_stats,
    })


# ── Attachments ───────────────────────────────────────────────────

MAX_UPLOAD_SIZE = 5 * 1024 * 1024  # 5 MB

ALLOWED_MIME_TYPES = {
    "image/png", "image/jpeg", "image/gif", "image/webp",
    "application/pdf",
    "text/plain", "text/csv",
    "application/zip",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

# Map of allowed MIME types → expected file extensions.
# Used to catch mismatches (e.g. an .exe renamed to .pdf).
_MIME_EXTENSION_MAP = {
    "image/png":     {".png"},
    "image/jpeg":    {".jpg", ".jpeg"},
    "image/gif":     {".gif"},
    "image/webp":    {".webp"},
    "application/pdf": {".pdf"},
    "text/plain":    {".txt", ".log"},
    "text/csv":      {".csv"},
    "application/zip": {".zip"},
    "application/vnd.ms-excel": {".xls"},
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {".xlsx"},
}

# Extensions that are always blocked regardless of reported MIME type.
_BLOCKED_EXTENSIONS = {
    ".exe", ".dll", ".so", ".bat", ".cmd", ".com", ".msi",
    ".sh", ".bash", ".zsh", ".fish",
    ".ps1", ".psm1", ".psd1",
    ".php", ".php3", ".php4", ".php5", ".phtml",
    ".py", ".rb", ".pl", ".lua",
    ".js", ".jsx", ".ts", ".tsx",   # scripts, not data files
    ".jsp", ".jspx", ".asp", ".aspx",
    ".jar", ".class", ".war", ".ear",
    ".vbs", ".vbe", ".wsf", ".wsh",
    ".htaccess", ".env", ".config",
    ".svg",   # can embed inline JS/CSS
}


def _get_ticket_for_user(user, ticket_id):
    """Return the ticket if the user is allowed to access it, or raise 404."""
    if user.is_staff:
        return get_object_or_404(Ticket, pk=ticket_id)
    if hasattr(user, "freelancer_profile"):
        return get_object_or_404(Ticket, pk=ticket_id, assigned_to=user.freelancer_profile)
    if hasattr(user, "customer_profile"):
        return get_object_or_404(Ticket, pk=ticket_id, customer=user.customer_profile)
    raise PermissionDenied()


@api_view(["GET", "POST"])
@permission_classes([permissions.IsAuthenticated])
def ticket_attachments(request, ticket_id):
    """
    GET  /api/tickets/{id}/attachments/  — list all attachments
    POST /api/tickets/{id}/attachments/  — upload a new attachment (multipart)
    """
    ticket = _get_ticket_for_user(request.user, ticket_id)

    if request.method == "GET":
        qs = TicketAttachment.objects.filter(ticket=ticket).select_related("uploaded_by")
        return Response(TicketAttachmentSerializer(qs, many=True, context={"request": request}).data)

    # POST — file upload
    uploaded_file = request.FILES.get("file")
    if not uploaded_file:
        return Response({"detail": "No file provided."}, status=status.HTTP_400_BAD_REQUEST)

    if uploaded_file.size > MAX_UPLOAD_SIZE:
        return Response(
            {"detail": "File exceeds maximum size of 5 MB."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    import os
    safe_name = os.path.basename(uploaded_file.name or "")
    _, ext = os.path.splitext(safe_name.lower())

    # 1. Block dangerous extensions unconditionally — before checking MIME type.
    if ext in _BLOCKED_EXTENSIONS:
        return Response(
            {"detail": "File type not permitted for security reasons."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # 2. Check the client-supplied MIME type is in the allow-list.
    mime = uploaded_file.content_type or ""
    if mime not in ALLOWED_MIME_TYPES:
        return Response(
            {"detail": "File type not permitted. Allowed: images, PDF, CSV, Excel, ZIP, plain text."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # 3. Verify the file extension matches the declared MIME type.
    #    This catches renames like "malware.exe" → "invoice.pdf" if the client
    #    also forges the Content-Type to "application/pdf".
    if ext and mime in _MIME_EXTENSION_MAP and ext not in _MIME_EXTENSION_MAP[mime]:
        return Response(
            {"detail": "File extension does not match the declared file type."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    attachment = TicketAttachment.objects.create(
        ticket=ticket,
        file=uploaded_file,
        file_name=safe_name,
        file_size=uploaded_file.size,
        mime_type=mime,
        uploaded_by=request.user,
    )
    return Response(
        TicketAttachmentSerializer(attachment, context={"request": request}).data,
        status=status.HTTP_201_CREATED,
    )


@api_view(["DELETE"])
@permission_classes([permissions.IsAuthenticated])
def ticket_attachment_delete(request, ticket_id, attachment_id):
    """
    DELETE /api/tickets/{ticket_id}/attachments/{attachment_id}/
    Only the uploader or an admin can delete an attachment.
    """
    ticket = _get_ticket_for_user(request.user, ticket_id)
    attachment = get_object_or_404(TicketAttachment, pk=attachment_id, ticket=ticket)

    if not request.user.is_staff and attachment.uploaded_by != request.user:
        raise PermissionDenied("You can only delete your own attachments.")

    if attachment.file:
        attachment.file.delete(save=False)
    attachment.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


# ── Email Verification ────────────────────────────────────────────

@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def verify_email(request):
    """
    POST /api/auth/verify-email/
    Body: { "uid": "...", "token": "..." }

    Marks the user's email as verified. The uid/token pair is sent in the
    verification link emailed after registration.
    """
    from django.contrib.auth.tokens import default_token_generator
    from django.utils.http import urlsafe_base64_decode

    uid_b64 = request.data.get("uid", "")
    token = request.data.get("token", "")

    if not uid_b64 or not token:
        return Response(
            {"detail": "uid and token are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        uid = urlsafe_base64_decode(uid_b64).decode()
        user = User.objects.get(pk=uid)
    except (TypeError, ValueError, User.DoesNotExist):
        return Response(
            {"detail": "Invalid or expired verification link."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not default_token_generator.check_token(user, token):
        return Response(
            {"detail": "Invalid or expired verification link."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if user.is_verified:
        return Response({"detail": "Email already verified."})

    user.is_verified = True
    user.save(update_fields=["is_verified"])
    return Response({"detail": "Email verified successfully."})


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def resend_verification_email(request):
    """
    POST /api/auth/verify-email/resend/
    Re-sends the verification email to the current user.
    """
    user = request.user
    if user.is_verified:
        return Response({"detail": "Email is already verified."})

    from .services.email_service import send_verification_email
    try:
        send_verification_email(user)
    except Exception:
        pass
    return Response({"detail": "Verification email sent."})


# ── Password Reset ────────────────────────────────────────────────

@api_view(["POST"])
@permission_classes([permissions.AllowAny])
@throttle_classes_dec([AuthRateThrottle])
def password_reset_request(request):
    """
    POST /api/auth/password/reset/
    Body: { "email": "..." }

    Sends a password reset link. Always returns 200 to prevent user enumeration.
    """
    from django.contrib.auth.tokens import default_token_generator
    from django.utils.http import urlsafe_base64_encode
    from django.utils.encoding import force_bytes
    from .services.email_service import send_password_reset_email

    email = request.data.get("email", "").strip().lower()
    if not email:
        return Response(
            {"detail": "email is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        user = User.objects.get(email__iexact=email, is_active=True)
        uid = urlsafe_base64_encode(force_bytes(str(user.pk)))
        token = default_token_generator.make_token(user)
        try:
            send_password_reset_email(user, uid, token)
        except Exception:
            pass
    except User.DoesNotExist:
        pass  # always return 200 — never reveal whether email exists

    return Response(
        {"detail": "If an account with that email exists, a reset link has been sent."}
    )


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def password_reset_confirm(request):
    """
    POST /api/auth/password/reset/confirm/
    Body: { "uid": "...", "token": "...", "new_password": "..." }

    Validates the token and sets the new password.
    """
    from django.contrib.auth.tokens import default_token_generator
    from django.utils.http import urlsafe_base64_decode
    from django.contrib.auth.password_validation import validate_password
    from django.core.exceptions import ValidationError as DjangoValidationError

    uid_b64 = request.data.get("uid", "")
    token = request.data.get("token", "")
    new_password = request.data.get("new_password", "")

    if not uid_b64 or not token or not new_password:
        return Response(
            {"detail": "uid, token, and new_password are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        uid = urlsafe_base64_decode(uid_b64).decode()
        user = User.objects.get(pk=uid)
    except (TypeError, ValueError, User.DoesNotExist):
        return Response(
            {"detail": "Invalid or expired reset link."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not default_token_generator.check_token(user, token):
        return Response(
            {"detail": "Invalid or expired reset link."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        validate_password(new_password, user)
    except DjangoValidationError as exc:
        return Response(
            {"detail": list(exc.messages)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user.set_password(new_password)
    user.save(update_fields=["password"])
    return Response({"detail": "Password reset successfully. You can now log in."})
