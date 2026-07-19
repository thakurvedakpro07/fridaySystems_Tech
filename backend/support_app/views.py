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

import logging

import django_filters
from django_filters.rest_framework import DjangoFilterBackend

from .pagination import OpsPageNumberPagination

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q as models_q
from django.shortcuts import get_object_or_404

_logger = logging.getLogger(__name__)

User = get_user_model()
from rest_framework import filters, generics, permissions, status
from rest_framework.decorators import api_view, permission_classes, throttle_classes as throttle_classes_dec
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView as BaseTokenObtainPairView

from .models import (
    AuditLog,
    CSATSurvey,
    Customer,
    Freelancer,
    KBArticle,
    KBArticleTicketLink,
    Notification,
    Payment,
    Payout,
    RoleChangeAudit,
    Service,
    SLAPolicy,
    Subscription,
    Ticket,
    TicketActivityLog,
    TicketAttachment,
    TicketComment,
)
from .permissions import (
    IsAdminUser,
    IsAnyStaffRole,
    IsCustomer,
    IsExecutiveAnalytics,
    IsFinanceManager,
    IsFinanceManagerOrSuperAdmin,
    IsFreelancer,
    IsFreelancerOrAdmin,
    IsOpsManagerOrSuperAdmin,
    IsOperationsManager,
    IsOwnerOrAdmin,
    IsOwnerOrStaff,
    IsPaymentReader,
    IsSupportAgent,
    IsSuperAdmin,
    IsTicketManagementStaff,
    is_finance_manager,
    is_internal_staff,
    is_super_admin,
    is_support_agent,
)
from .serializers import (
    AdminAssignSerializer,
    AdminPaymentSerializer,
    AdminStatusSerializer,
    AuditLogSerializer,
    CSATSurveySerializer,
    CustomerSerializer,
    CustomerTicketListSerializer,
    FreelancerCreateSerializer,
    FreelancerSerializer,
    FreelancerStatusSerializer,
    FreelancerTicketListSerializer,
    KBArticleDetailSerializer,
    KBArticleListSerializer,
    KBArticleWriteSerializer,
    NotificationSerializer,
    OpsActivityLogSerializer,
    OpsPaymentSerializer,
    OpsUserSerializer,
    PaymentSerializer,
    PaymentVerifySerializer,
    RegisterSerializer,
    RemoteSessionSerializer,
    RoleChangeAuditSerializer,
    RoleChangeSerializer,
    ServiceSerializer,
    SLAPolicySerializer,
    SubscriptionSerializer,
    TicketActivityLogSerializer,
    TicketAttachmentSerializer,
    TicketCommentSerializer,
    TicketCreateSerializer,
    TicketDetailSerializer,
    TicketListSerializer,
    OpsTicketListSerializer,
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


# Dedicated bucket for the AI Assistant panel — each GET recomputes 5
# suggestion types, so it's throttled tighter than the general user rate
# even though the mock provider itself is cheap (a future real-LLM-backed
# provider would make this limit matter for cost control too).
class AIAssistantRateThrottle(UserRateThrottle):
    scope = "ai_assistant"


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
            "first_name": self.user.first_name,
            "last_name": self.user.last_name,
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
                    "first_name": user.first_name,
                    "last_name": user.last_name,
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


# ── Google OAuth Login ────────────────────────────────────────────

@api_view(["POST"])
@permission_classes([permissions.AllowAny])
@throttle_classes_dec([AuthRateThrottle])
def google_auth_view(request):
    """
    POST /api/auth/google/
    Body: { "access_token": "<Google OAuth2 access token>" }

    Verifies the token with Google's userinfo endpoint, then gets-or-creates
    a customer account. Returns the same JWT response shape as /auth/login/.

    Additional field:
      needs_company: true  — new user, Customer profile has no company yet
      needs_company: false — existing user or company already on file
    """
    import requests as _http
    from django.conf import settings as _settings

    access_token = request.data.get("access_token")
    if not access_token:
        return Response({"detail": "access_token is required."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        # Step 1 — verify the token belongs to our app by checking its azp
        # (authorized party). This prevents a valid Google token issued to a
        # different OAuth app from being replayed here.
        tokeninfo_resp = _http.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"access_token": access_token},
            timeout=10,
        )
        tokeninfo_resp.raise_for_status()
        tokeninfo = tokeninfo_resp.json()
    except Exception:
        return Response({"detail": "Could not verify Google token."}, status=status.HTTP_401_UNAUTHORIZED)

    expected_client_id = _settings.GOOGLE_OAUTH_CLIENT_ID
    if expected_client_id and tokeninfo.get("azp") != expected_client_id:
        return Response(
            {"detail": "Google token was not issued for this application."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    try:
        # Step 2 — fetch the full user profile (name, email, email_verified)
        userinfo_resp = _http.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10,
        )
        userinfo_resp.raise_for_status()
        google_data = userinfo_resp.json()
    except Exception:
        return Response({"detail": "Could not retrieve Google profile."}, status=status.HTTP_401_UNAUTHORIZED)

    email = google_data.get("email")
    if not email:
        return Response({"detail": "No email in Google profile."}, status=status.HTTP_400_BAD_REQUEST)

    if not google_data.get("email_verified"):
        return Response({"detail": "Google email address is not verified."}, status=status.HTTP_400_BAD_REQUEST)

    first_name = google_data.get("given_name", "")
    last_name = google_data.get("family_name", "")

    with transaction.atomic():
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                "first_name": first_name,
                "last_name": last_name,
                "role": "customer",
                "is_active": True,
                "is_verified": True,
            },
        )
        if created:
            user.set_unusable_password()
            user.save(update_fields=["password"])
            Customer.objects.get_or_create(user=user)

    profile = getattr(user, "customer_profile", None)
    needs_company = not (profile and profile.company)

    refresh = RefreshToken.for_user(user)
    return Response(
        {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "needs_company": needs_company,
            "user": {
                "id": str(user.id),
                "email": user.email,
                "is_staff": user.is_staff,
                "role": user.role,
                "is_verified": user.is_verified,
                "first_name": user.first_name,
                "last_name": user.last_name,
            },
        },
        status=status.HTTP_200_OK,
    )


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
    """GET /api/services/ — approved service types with resolution fees and severity surcharges."""
    from .services.service_catalog import SERVICE_CATALOG, SEVERITY_CONFIG, CONSULTING_FEE
    severity_surcharges = {k: v["surcharge"] for k, v in SEVERITY_CONFIG.items()}
    return Response({
        "consulting_fee": CONSULTING_FEE,
        "severity_surcharges": severity_surcharges,
        "services": [
            {
                "key":               s["key"],
                "name":              s["name"],
                "resolution_fee":    s["resolution_fee"],
                "scope":             s["scope"],
            }
            for s in SERVICE_CATALOG
        ],
    })


# ── Tickets (Customer) ────────────────────────────────────────────

class TicketListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/tickets/  — list the logged-in customer's tickets
    POST /api/tickets/  — open a new ticket

    Query params for filtering:
      ?status=open
      ?exclude_status=closed  (used by the Customer Workspace to fetch all
                                active tickets in one page via ?page_size=)
      ?service_type=linux
      ?severity=high
      ?search=<text>     (searches title and description)
      ?ordering=created_at,-severity
      ?page_size=<n>     (up to 100 — default 20)
    """
    permission_classes = [permissions.IsAuthenticated, IsCustomer]
    pagination_class = OpsPageNumberPagination  # adds ?page_size= (max 100), matches freelancer

    def get_serializer_class(self):
        if self.request.method == "POST":
            return TicketCreateSerializer
        return CustomerTicketListSerializer

    def get_queryset(self):
        qs = Ticket.objects.filter(
            customer=self.request.user.customer_profile
        ).select_related("customer__user", "assigned_to__user")

        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)

        exclude_status = self.request.query_params.get("exclude_status")
        if exclude_status:
            qs = qs.exclude(status=exclude_status)

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

        ordering = self.request.query_params.get("ordering")
        allowed_orderings = {"created_at", "-created_at", "severity", "-severity", "status", "-status"}
        if ordering in allowed_orderings:
            qs = qs.order_by(ordering)

        from .services.ticket_signals import annotate_reply_ownership_signals
        qs = annotate_reply_ownership_signals(qs)
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

    Read access: ticket owner, any internal staff role (support_agent, ops, finance, admin).
    Write access (PATCH): ticket owner and super admin only.
    """
    serializer_class = TicketDetailSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrStaff]

    def get_queryset(self):
        from .services.ticket_signals import annotate_reply_ownership_signals
        qs = annotate_reply_ownership_signals(
            Ticket.objects.select_related("customer__user", "assigned_to__user")
        )
        user = self.request.user
        if user.is_staff or is_internal_staff(user):
            return qs
        if hasattr(user, "freelancer_profile"):
            return qs.filter(assigned_to=user.freelancer_profile)
        if hasattr(user, "customer_profile"):
            return qs.filter(customer=user.customer_profile)
        raise PermissionDenied()

    def update(self, request, *args, **kwargs):
        user = request.user
        # PATCH is for customers editing their own ticket fields (title/description/severity).
        # Super Admin can also edit any ticket. Ops Managers and Support Agents manage
        # tickets through the /api/ops/ endpoints, not this customer-facing one.
        if not (is_super_admin(user) or hasattr(user, "customer_profile")):
            return Response(
                {"detail": "Only the ticket owner can update this ticket."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().update(request, *args, **kwargs)

    def perform_update(self, serializer):
        # Set _actor so log_ticket_changes signal writes the correct actor
        # for any status or severity change triggered via this PATCH endpoint.
        serializer.instance._actor = self.request.user
        serializer.save()


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
            if user.is_staff or is_internal_staff(user):
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
        # Internal staff and freelancers see all comments (including internal notes); customers see only public ones.
        is_staff_or_internal = self.request.user.is_staff or is_internal_staff(self.request.user)
        if not is_staff_or_internal and not hasattr(self.request.user, "freelancer_profile"):
            qs = qs.filter(is_internal=False)
        return qs

    def perform_create(self, serializer):
        from .services.ticket_service import add_comment
        ticket = self._get_ticket()
        is_internal = bool(
            serializer.validated_data.get("is_internal", False)
            and (
                self.request.user.is_staff
                or is_internal_staff(self.request.user)
                or hasattr(self.request.user, "freelancer_profile")
            )
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
      - Super Admin / internal staff (ops, finance, support): all tickets
      - Customer: only own tickets
      - Freelancer: only their currently-assigned tickets
    """
    serializer_class = TicketActivityLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        ticket_id = self.kwargs["ticket_id"]

        if user.is_staff or is_internal_staff(user):
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
    if ticket.status != "closed":
        return Response(
            {"detail": "CSAT can only be submitted for closed tickets."},
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


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, IsCustomer])
def accept_resolution(request, ticket_id):
    """
    POST /api/tickets/{id}/accept-resolution/
    Customer accepts the engineer's resolution, submits a star rating (1-5),
    and closes the ticket atomically.
    Body: {score: int (required), comment: str (optional)}

    Idempotent: calling this endpoint on an already-accepted ticket returns
    the current closed state (200) rather than an error, so stale-state
    retries and concurrent requests always converge to the correct UI.
    """
    from django.db import transaction
    from .services.ticket_service import update_status

    ticket = get_object_or_404(
        Ticket,
        pk=ticket_id,
        customer=request.user.customer_profile,
    )

    # ── Already fully closed — return current state (idempotent) ──
    if ticket.status == "closed":
        ticket.refresh_from_db()
        return Response(
            TicketDetailSerializer(ticket, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )

    # ── Wrong lifecycle state ──────────────────────────────────────
    if ticket.status != "resolved":
        return Response(
            {"detail": "Only resolved tickets can be accepted."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # ── Orphaned state: CSAT exists but ticket was never closed ───
    # Created by pre-migration testing against the old submit_csat endpoint
    # (which allowed resolved tickets).  Heal by closing the ticket; the
    # existing CSAT score is preserved as-is.
    if hasattr(ticket, "csat_survey"):
        with transaction.atomic():
            update_status(ticket, "closed", actor=request.user)
        ticket.refresh_from_db()
        return Response(
            TicketDetailSerializer(ticket, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )

    # ── Normal path: validate rating, save CSAT, close atomically ─
    serializer = CSATSurveySerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    with transaction.atomic():
        serializer.save(ticket=ticket, customer=request.user.customer_profile)
        update_status(ticket, "closed", actor=request.user)

    ticket.refresh_from_db()
    return Response(
        TicketDetailSerializer(ticket, context={"request": request}).data,
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, IsCustomer])
def reject_resolution(request, ticket_id):
    """
    POST /api/tickets/{id}/reject-resolution/
    Customer reports the issue is not fixed, returning the ticket to in_progress.
    The assigned engineer is notified by email.
    Body: {note: str (optional)}
    """
    ticket = get_object_or_404(
        Ticket,
        pk=ticket_id,
        customer=request.user.customer_profile,
    )
    if ticket.status != "resolved":
        return Response(
            {"detail": "Only resolved tickets can be rejected."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    note = request.data.get("note", "").strip()
    from .services.ticket_service import update_status
    from .services.email_service import send_resolution_rejected
    update_status(ticket, "in_progress", actor=request.user, note=note)
    ticket.refresh_from_db()
    send_resolution_rejected(ticket, note=note)
    return Response(
        TicketDetailSerializer(ticket, context={"request": request}).data,
        status=status.HTTP_200_OK,
    )


# ── Resolution payment flow (customer) ───────────────────────────

@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated, IsCustomer])
def resolution_quote(request, ticket_id):
    """
    GET /api/tickets/{id}/resolution-quote/
    Returns the fee breakdown for the resolution payment:
      base_fee, severity_surcharge, subtotal, gst_amount, total
    No side effects — safe to call as many times as needed.
    """
    from .services.service_catalog import get_resolution_fee, SEVERITY_CONFIG

    ticket = get_object_or_404(
        Ticket,
        pk=ticket_id,
        customer=request.user.customer_profile,
    )
    if ticket.status != "resolved":
        return Response(
            {"detail": "Resolution quote is only available for resolved tickets."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    fee = get_resolution_fee(ticket.service_type, ticket.severity)
    sla = SEVERITY_CONFIG.get(ticket.severity, {})
    return Response({
        **fee,
        "severity": ticket.severity,
        "severity_label": sla.get("label", ticket.severity.capitalize()),
        "service_type": ticket.service_type,
    })


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, IsCustomer])
def initiate_resolution_payment(request, ticket_id):
    """
    POST /api/tickets/{id}/initiate-resolution-payment/
    Creates a Razorpay order (or sandbox mock) for the resolution fee.
    Returns the same shape as initiate_payment: order_id, payment_db_id, etc.
    """
    from .services.payment_service import create_resolution_order_for_ticket

    ticket = get_object_or_404(
        Ticket,
        pk=ticket_id,
        customer=request.user.customer_profile,
    )
    try:
        order_data = create_resolution_order_for_ticket(ticket)
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    return Response(order_data)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, IsCustomer])
def verify_resolution_payment(request, ticket_id):
    """
    POST /api/tickets/{id}/verify-resolution-payment/
    Verifies the Razorpay signature, closes the ticket, saves CSAT, and
    creates the engineer payout.

    Body:
      payment_db_id          (str, required)
      razorpay_payment_id    (str, required in live mode)
      razorpay_order_id      (str, required in live mode)
      razorpay_signature     (str, required in live mode)
      score                  (int 1-5, required)
      comment                (str, optional)
    """
    from .services.payment_service import verify_resolution_payment_service

    ticket = get_object_or_404(
        Ticket,
        pk=ticket_id,
        customer=request.user.customer_profile,
    )

    payment_db_id       = request.data.get("payment_db_id", "")
    razorpay_payment_id = request.data.get("razorpay_payment_id", "")
    razorpay_order_id   = request.data.get("razorpay_order_id", "")
    razorpay_signature  = request.data.get("razorpay_signature", "")
    score               = request.data.get("score")
    comment             = request.data.get("comment", "")

    if not payment_db_id:
        return Response({"detail": "payment_db_id is required."}, status=status.HTTP_400_BAD_REQUEST)
    if not razorpay_payment_id:
        return Response({"detail": "razorpay_payment_id is required."}, status=status.HTTP_400_BAD_REQUEST)
    if not razorpay_order_id:
        return Response({"detail": "razorpay_order_id is required."}, status=status.HTTP_400_BAD_REQUEST)
    if not razorpay_signature:
        return Response({"detail": "razorpay_signature is required."}, status=status.HTTP_400_BAD_REQUEST)
    if score is None:
        return Response({"detail": "score is required."}, status=status.HTTP_400_BAD_REQUEST)
    try:
        score = int(score)
        if not (1 <= score <= 5):
            raise ValueError
    except (TypeError, ValueError):
        return Response({"detail": "score must be an integer between 1 and 5."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        verify_resolution_payment_service(
            ticket=ticket,
            payment_db_id=payment_db_id,
            razorpay_payment_id=razorpay_payment_id,
            razorpay_order_id=razorpay_order_id,
            razorpay_signature=razorpay_signature,
            score=score,
            comment=comment,
            actor=request.user,
        )
    except (ValueError, Payment.DoesNotExist) as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    ticket.refresh_from_db()
    return Response(
        TicketDetailSerializer(ticket, context={"request": request}).data,
        status=status.HTTP_200_OK,
    )


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

    # Customer can only download their own invoices; Super Admin and all internal staff roles can download any.
    if not request.user.is_staff and not is_internal_staff(request.user):
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

    payment = get_object_or_404(Payment, pk=pk)

    if payment.status != "pending":
        return Response(
            {"detail": f"Payment is already {payment.status}."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    with transaction.atomic():
        payment = (
            Payment.objects.select_related("ticket", "customer__user")
            .select_for_update(of=("self",))
            .get(pk=payment.pk)
        )
        # Re-check under lock: guard against concurrent confirm calls
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
            ticket._actor = request.user
            ticket._actor_note = f"Payment {payment.invoice_number} manually confirmed by admin"
            ticket.status = "open"
            ticket.save(update_fields=["status"])
            # log_ticket_changes signal writes TicketActivityLog(actor=request.user).
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
      ?status=in_progress    — filter by status
      ?exclude_status=closed — exclude a status (used by the Engineer
                                Workspace to fetch all active tickets in
                                one page via ?page_size=)
    """
    serializer_class = FreelancerTicketListSerializer
    permission_classes = [permissions.IsAuthenticated, IsFreelancer]
    pagination_class = OpsPageNumberPagination  # reuse: gives ?page_size= up to 100

    def get_queryset(self):
        qs = Ticket.objects.filter(
            assigned_to=self.request.user.freelancer_profile
        ).select_related("customer__user", "assigned_to__user")
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        exclude_status = self.request.query_params.get("exclude_status")
        if exclude_status:
            qs = qs.exclude(status=exclude_status)
        search = self.request.query_params.get("search")
        if search:
            from django.db.models import Q
            qs = qs.filter(Q(title__icontains=search) | Q(ticket_number__icontains=search))

        from .services.ticket_signals import annotate_reply_ownership_signals
        qs = annotate_reply_ownership_signals(qs)
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
        from .services.ticket_signals import annotate_reply_ownership_signals
        qs = Ticket.objects.filter(
            assigned_to=self.request.user.freelancer_profile
        ).select_related("customer__user", "assigned_to__user")
        return annotate_reply_ownership_signals(qs)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, IsFreelancer])
def freelancer_update_status(request, ticket_id):
    """
    POST /api/freelancer/tickets/{id}/status/
    Body: {"new_status": "resolved", "note": "optional"}

    Freelancers can move a ticket to: in_progress, resolved.
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


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, IsFreelancer])
def freelancer_start_remote_session(request, ticket_id):
    """
    POST /api/freelancer/tickets/{id}/remote-session/
    Body: {"remote_session_url": "https://anydesk.com/..."}

    Lets the assigned freelancer share a remote-session link without
    changing ticket status — the link and an announcement both appear
    in the conversation thread.
    """
    from .services.ticket_service import add_comment

    ticket = get_object_or_404(
        Ticket,
        pk=ticket_id,
        assigned_to=request.user.freelancer_profile,
    )

    serializer = RemoteSessionSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    url = serializer.validated_data["remote_session_url"]

    ticket.remote_session_url = url
    ticket.save(update_fields=["remote_session_url", "updated_at"])

    add_comment(
        ticket=ticket,
        author=request.user,
        body=f"Started a remote session: {url}",
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
      ?search=<text>      (title / ticket_number)
      ?ordering=created_at,-severity
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

        search = self.request.query_params.get("search")
        if search:
            from django.db.models import Q
            qs = qs.filter(
                Q(title__icontains=search) | Q(ticket_number__icontains=search)
            )

        ordering = self.request.query_params.get("ordering")
        allowed = {
            "created_at", "-created_at",
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
    if user.is_staff or user.role in ("operations_manager", "finance_manager", "support_agent"):
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

    # Tickets by severity — counts for donut/bar chart
    severity_breakdown = list(
        qs.values("severity").annotate(n=Count("id")).order_by("severity")
    )

    # Revenue by severity (admin only, from completed resolution_fee payments)
    severity_revenue = []
    if user.is_staff:
        from django.db.models import Sum as _SumSev
        sev_rev = list(
            Payment.objects.filter(
                status="completed", payment_type="resolution_fee",
                ticket__isnull=False,
            )
            .values("ticket__severity")
            .annotate(revenue=_SumSev(F("amount") + F("gst_amount")))
            .order_by("ticket__severity")
        )
        severity_revenue = [
            {"severity": r["ticket__severity"], "revenue": float(r["revenue"] or 0)}
            for r in sev_rev
        ]

    # Admin-only: user counts and freelancer performance
    active_customers = active_freelancers = total_revenue = None
    freelancer_stats = []
    if user.is_staff:
        from django.contrib.auth import get_user_model
        _User = get_user_model()
        active_customers   = _User.objects.filter(role="customer",   is_active=True).count()
        active_freelancers = _User.objects.filter(role="freelancer",  is_active=True).count()
        from django.db.models import Sum as _Sum
        total_revenue = Payment.objects.filter(status="completed").aggregate(
            total=_Sum(F("amount") + F("gst_amount"))
        )["total"] or 0
    if user.is_staff:
        for fl in Freelancer.objects.annotate(
            assigned=Count("assigned_tickets"),
            resolved=Count("assigned_tickets", filter=models_q(assigned_tickets__status__in=["resolved", "closed"])),
        ).order_by("-assigned")[:5]:
            freelancer_stats.append({
                "email":      fl.user.email,
                "first_name": fl.user.first_name,
                "last_name":  fl.user.last_name,
                "assigned":   fl.assigned,
                "resolved":   fl.resolved,
                "rating":     str(fl.rating),
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
        "severity_breakdown": severity_breakdown,
        "severity_revenue": severity_revenue,
        "freelancer_stats": freelancer_stats,
        "active_customers": active_customers,
        "active_freelancers": active_freelancers,
        "total_revenue": total_revenue,
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
    if user.is_staff or is_internal_staff(user):
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


# ── Related Tickets ─────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def ticket_related(request, ticket_id):
    """
    GET /api/tickets/{id}/related/
    Returns up to 5 other tickets belonging to the same customer as this
    ticket, most recent first. Access follows the same rule as the ticket
    itself — see _get_ticket_for_user.

    Deliberately "same customer", not "same service_type across customers"
    — the latter is the existing staff-only AI panel's find_similar_tickets
    and is out of scope here.
    """
    ticket = _get_ticket_for_user(request.user, ticket_id)

    related_qs = (
        Ticket.objects.filter(customer=ticket.customer)
        .exclude(id=ticket.id)
        .order_by("-created_at")[:5]
    )
    return Response(TicketListSerializer(related_qs, many=True).data)


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


# ══════════════════════════════════════════════════════════════════
# OPERATIONS DASHBOARD VIEWS
# /api/ops/ — accessible to role="operations_manager" AND role="admin" (Super Admin)
# Operations Managers: can assign tickets, view users/engineers, manage services.
# Super Admins: everything above PLUS promote/demote users.
# Neither role can access payments or Django admin through these endpoints.
# ══════════════════════════════════════════════════════════════════

@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated, IsAnyStaffRole])
def ops_dashboard(request):
    """
    GET /api/ops/dashboard/
    Aggregated metrics for the Operations dashboard overview.
    """
    from decimal import Decimal
    from django.db.models import Count, DecimalField, Sum, Value
    from django.db.models.functions import Coalesce

    by_status = dict(
        Ticket.objects.values_list("status")
        .annotate(n=Count("id"))
        .values_list("status", "n")
    )

    open_count       = by_status.get("open", 0)
    assigned_count   = by_status.get("assigned", 0)
    in_progress_count = by_status.get("in_progress", 0)
    resolved_count   = by_status.get("resolved", 0)
    closed_count     = by_status.get("closed", 0)
    pending_count    = by_status.get("pending_payment", 0)

    # Coalesce requires matching types: Sum("amount") returns DecimalField,
    # so the fallback must also be Decimal with output_field set explicitly.
    revenue = Payment.objects.filter(status="completed").aggregate(
        total=Coalesce(Sum("amount"), Value(Decimal("0.00")), output_field=DecimalField())
    )["total"]

    active_freelancers = Freelancer.objects.filter(
        active=True, onboarding_status="approved"
    ).count()

    unassigned_count = open_count  # "open" = paid, unassigned

    # SLA counts — only active (non-terminal) tickets with a deadline set
    from django.utils import timezone as _tz
    _now = _tz.now()
    _active_sla_statuses = ["open", "assigned", "in_progress"]
    sla_overdue = Ticket.objects.filter(
        status__in=_active_sla_statuses,
        due_at__lt=_now,
    ).count()
    sla_due_soon = Ticket.objects.filter(
        status__in=_active_sla_statuses,
        due_at__gte=_now,
        due_at__lt=_now + _tz.timedelta(hours=2),
    ).count()

    data = {
        "open": open_count,
        "assigned": assigned_count,
        "in_progress": in_progress_count,
        "resolved": resolved_count,
        "closed": closed_count,
        "pending_payment": pending_count,
        "total_active": open_count + assigned_count + in_progress_count,
        "total_resolved": resolved_count + closed_count,
        "unassigned": unassigned_count,
        "active_freelancers": active_freelancers,
        "sla_overdue": sla_overdue,
        "sla_due_soon": sla_due_soon,
    }
    # Revenue is financial data — Support Agents have no visibility into it.
    if not is_support_agent(request.user):
        data["revenue"] = float(revenue)
    return Response(data)


class OpsTicketFilterSet(django_filters.FilterSet):
    """
    Ops ticket queue filters — status/service_type/assigned_to are exact-match
    on their model fields; `priority` is an alias for `severity` (the product
    calls it "priority", the schema calls it "severity").
    """
    priority = django_filters.CharFilter(field_name="severity")

    class Meta:
        model = Ticket
        fields = ["status", "service_type", "assigned_to"]


class OpsTicketListView(generics.ListAPIView):
    """
    GET /api/ops/tickets/
    All tickets — status, severity, service, assigned engineer, search,
    ordering filters. Support Agents and Finance Managers get read access
    alongside Ops Manager and Super Admin.
    """
    serializer_class = OpsTicketListSerializer
    permission_classes = [permissions.IsAuthenticated, IsAnyStaffRole]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_class = OpsTicketFilterSet
    pagination_class = OpsPageNumberPagination
    # Allow-listed order_by targets. "ticket_number" is the closest thing to
    # a ticket_id (the UUID pk isn't meaningfully sortable); "severity" is
    # this model's field for what the product calls "priority"; "service_type"
    # is what the product calls "service"; assigned-engineer sorts by the
    # freelancer's first name since there's no single "assigned engineer" field.
    ordering_fields = [
        "ticket_number", "title", "status", "severity",
        "service_type", "created_at", "assigned_to__user__first_name",
    ]
    ordering = ["-created_at"]  # unchanged default — matches prior manual behavior

    def get_queryset(self):
        from .services.ticket_signals import annotate_reply_ownership_signals

        qs = Ticket.objects.select_related("customer__user", "assigned_to__user")
        qs = annotate_reply_ownership_signals(qs)

        search = self.request.query_params.get("search")
        if search:
            from django.db.models import Q
            qs = qs.filter(
                Q(title__icontains=search)
                | Q(ticket_number__icontains=search)
                | Q(customer__user__email__icontains=search)
            )

        return qs


class OpsFreelancerListView(generics.ListAPIView):
    """
    GET /api/ops/freelancers/
    All approved freelancers with active ticket counts, skills, availability, rating.
    """
    permission_classes = [permissions.IsAuthenticated, IsAnyStaffRole]

    def get(self, request, *args, **kwargs):
        from django.db.models import Count, Q as DQ

        availability_filter = request.query_params.get("availability")
        skill_search = request.query_params.get("skills")

        qs = Freelancer.objects.filter(onboarding_status="approved", active=True).select_related("user").annotate(
            active_ticket_count=Count(
                "assigned_tickets",
                filter=DQ(assigned_tickets__status__in=["assigned", "in_progress"]),
            )
        ).order_by("active_ticket_count", "-rating")

        if availability_filter:
            qs = qs.filter(availability=availability_filter)

        if skill_search:
            qs = qs.filter(skills__icontains=skill_search)

        data = []
        for f in qs:
            first = f.user.first_name.strip()
            last  = f.user.last_name.strip()
            data.append({
                "id": str(f.id),
                "name": f"{first} {last}".strip() or f.user.email,
                "email": f.user.email,
                "skills": f.skills,
                "availability": f.availability,
                "rating": str(f.rating),
                "active_tickets": f.active_ticket_count,
                "onboarding_status": f.onboarding_status,
                "active": f.active,
            })

        return Response(data)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, IsTicketManagementStaff])
def ops_assign_ticket(request, ticket_id):
    """
    POST /api/ops/tickets/{id}/assign/
    Body: {"freelancer_id": "<uuid>"}
    Assign or reassign a freelancer to a ticket.
    Accessible to Ops Manager, Support Agent, and Super Admin.
    Finance Managers are blocked — they have no ticket-management authority.
    """
    from .services.ticket_service import assign_ticket
    from .services.notification_service import create_notification

    ticket = get_object_or_404(Ticket, pk=ticket_id)

    if ticket.status == "pending_payment":
        return Response(
            {"detail": "Cannot assign a ticket awaiting payment."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    serializer = AdminAssignSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    freelancer = get_object_or_404(
        Freelancer, pk=serializer.validated_data["freelancer_id"]
    )

    try:
        assign_ticket(ticket=ticket, freelancer=freelancer, assigned_by=request.user)
    except ValueError as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    create_notification(
        recipient=freelancer.user,
        category="ticket_assigned",
        title=f"New ticket assigned: {ticket.ticket_number}",
        body=f"{ticket.title} — {ticket.get_service_type_display()}",
        ticket=ticket,
    )
    create_notification(
        recipient=ticket.customer.user,
        category="status_changed",
        title=f"Your ticket {ticket.ticket_number} is being handled",
        body="A verified support engineer has been assigned to your ticket.",
        ticket=ticket,
    )
    for staff in User.objects.filter(
        role__in=["support_agent", "operations_manager"],
        is_active=True,
    ).exclude(pk=request.user.pk):
        create_notification(
            recipient=staff,
            category="ticket_assigned",
            title=f"Engineer assigned: {ticket.ticket_number}",
            body=f"{ticket.title} → {freelancer.user.get_full_name() or freelancer.user.email}",
            ticket=ticket,
        )

    ticket.refresh_from_db()
    return Response(TicketDetailSerializer(ticket).data, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, IsTicketManagementStaff])
def ops_unassign_ticket(request, ticket_id):
    """
    POST /api/ops/tickets/{id}/unassign/
    Body: {"note": "optional reason"}
    Remove current freelancer from a ticket, resetting it to open.
    Accessible to Ops Manager, Support Agent, and Super Admin.
    Finance Managers are blocked — they have no ticket-management authority.
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


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated, IsAnyStaffRole])
def ops_ticket_history(request, ticket_id):
    """
    GET /api/ops/tickets/{id}/history/
    Assignment and status-change events for this ticket.
    """
    ticket = get_object_or_404(Ticket, pk=ticket_id)
    logs = TicketActivityLog.objects.filter(
        ticket=ticket
    ).select_related("actor").order_by("-created_at")

    return Response(TicketActivityLogSerializer(logs, many=True).data)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, IsTicketManagementStaff])
def ops_status_update(request, ticket_id):
    """
    POST /api/ops/tickets/{id}/status/
    Body: {"new_status": "in_progress", "note": "optional"}

    Update a ticket's status from the operations portal.
    Accessible to Ops Manager, Support Agent, and Super Admin.
    Finance Managers are blocked — they have no ticket-management authority.
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


# ══════════════════════════════════════════════════════════════════
# USER MANAGEMENT (Super Admin only for write; both roles for read)
# ══════════════════════════════════════════════════════════════════

_ROLE_DISPLAY = {
    "customer": "Customer",
    "freelancer": "Engineer",
    "admin": "Super Admin",
    "operations_manager": "Operations Manager",
    "finance_manager": "Finance Manager",
    "support_agent": "Support Agent",
}

# Transitions that require Super Admin. All transitions listed here
# are ALLOWED for Super Admin. Operations Managers cannot change any roles.
_ALLOWED_TRANSITIONS = {
    "customer":            {"freelancer", "operations_manager", "finance_manager", "support_agent", "admin"},
    "freelancer":          {"customer", "operations_manager", "finance_manager", "support_agent", "admin"},
    "operations_manager":  {"customer", "freelancer", "finance_manager", "support_agent", "admin"},
    "finance_manager":     {"customer", "operations_manager", "support_agent"},
    "support_agent":       {"customer", "operations_manager", "finance_manager"},
    "admin":               {"operations_manager"},  # Super Admin can step down to ops_manager
}


class OpsUserListView(generics.ListAPIView):
    """
    GET /api/ops/users/
    All users — filterable by role, active status, and search.
    Accessible to both Operations Managers (read-only) and Super Admins.
    """
    serializer_class = OpsUserSerializer
    permission_classes = [permissions.IsAuthenticated, IsOpsManagerOrSuperAdmin]
    pagination_class = OpsPageNumberPagination  # adds ?page_size= (max 100), matches freelancer

    def get_queryset(self):
        qs = User.objects.all().order_by("-date_joined")

        role_filter = self.request.query_params.get("role")
        if role_filter:
            qs = qs.filter(role=role_filter)

        active_filter = self.request.query_params.get("is_active")
        if active_filter is not None:
            qs = qs.filter(is_active=(active_filter.lower() == "true"))

        search = self.request.query_params.get("search", "").strip()
        if search:
            from django.db.models import Q
            qs = qs.filter(
                Q(email__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
            )

        return qs


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated, IsOpsManagerOrSuperAdmin])
def ops_user_detail(request, user_id):
    """
    GET /api/ops/users/{id}/
    Single user detail including role change history.
    """
    target = get_object_or_404(User, pk=user_id)
    history = RoleChangeAudit.objects.filter(
        target_user=target
    ).select_related("changed_by").order_by("-timestamp")[:20]

    return Response({
        "user": OpsUserSerializer(target).data,
        "role_history": RoleChangeAuditSerializer(history, many=True).data,
    })


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, IsSuperAdmin])
def ops_change_role(request, user_id):
    """
    POST /api/ops/users/{id}/role/
    Body: {"new_role": "<role>", "note": "optional"}

    Super Admin only. Promote or demote a user's role.
    Writes an immutable RoleChangeAudit entry on every successful change.
    """
    from django.db import transaction

    target = get_object_or_404(User, pk=user_id)

    # Prevent changing your own role (avoid accidental self-demotion)
    if target.pk == request.user.pk:
        return Response(
            {"detail": "Super Admins cannot change their own role."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    serializer = RoleChangeSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    new_role = serializer.validated_data["new_role"]
    note = serializer.validated_data.get("note", "")
    old_role = target.role

    if old_role == new_role:
        return Response(
            {"detail": f"User already has role '{_ROLE_DISPLAY.get(old_role, old_role)}'."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    allowed = _ALLOWED_TRANSITIONS.get(old_role, set())
    if new_role not in allowed:
        return Response(
            {
                "detail": (
                    f"Cannot change role from '{_ROLE_DISPLAY.get(old_role, old_role)}' "
                    f"to '{_ROLE_DISPLAY.get(new_role, new_role)}'."
                )
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    with transaction.atomic():
        # Update role field
        target.role = new_role

        # Sync is_staff: only admin (Super Admin) should have is_staff=True
        target.is_staff = (new_role == "admin")
        target.is_superuser = (new_role == "admin")

        target.save(update_fields=["role", "is_staff", "is_superuser"])

        # Write the immutable audit entry
        RoleChangeAudit.objects.create(
            changed_by=request.user,
            target_user=target,
            target_email=target.email,
            old_role=old_role,
            new_role=new_role,
            note=note,
        )

    return Response({
        "detail": (
            f"Role changed from '{_ROLE_DISPLAY.get(old_role, old_role)}' "
            f"to '{_ROLE_DISPLAY.get(new_role, new_role)}'."
        ),
        "user": OpsUserSerializer(target).data,
    })


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, IsSuperAdmin])
def ops_deactivate_user(request, user_id):
    """
    POST /api/ops/users/{id}/deactivate/
    Super Admin only. Prevent a user from logging in.
    """
    from .services.audit_service import log_action

    target = get_object_or_404(User, pk=user_id)

    if target.pk == request.user.pk:
        return Response(
            {"detail": "You cannot deactivate your own account."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not target.is_active:
        return Response(
            {"detail": "User is already inactive."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    target.is_active = False
    target.save(update_fields=["is_active"])

    log_action(
        user=request.user, entity="user", action="user_deactivated",
        entity_id=target.pk, metadata={"target_email": target.email}, request=request,
    )

    return Response({
        "detail": f"{target.email} has been deactivated.",
        "user": OpsUserSerializer(target).data,
    })


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, IsSuperAdmin])
def ops_reactivate_user(request, user_id):
    """
    POST /api/ops/users/{id}/reactivate/
    Super Admin only. Re-enable a previously deactivated account.
    """
    from .services.audit_service import log_action

    target = get_object_or_404(User, pk=user_id)

    if target.is_active:
        return Response(
            {"detail": "User is already active."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    target.is_active = True
    target.save(update_fields=["is_active"])

    log_action(
        user=request.user, entity="user", action="user_reactivated",
        entity_id=target.pk, metadata={"target_email": target.email}, request=request,
    )

    return Response({
        "detail": f"{target.email} has been reactivated.",
        "user": OpsUserSerializer(target).data,
    })


# ══════════════════════════════════════════════════════════════════
# ROLE CHANGE AUDIT LOG
# ══════════════════════════════════════════════════════════════════

class OpsRoleAuditListView(generics.ListAPIView):
    """
    GET /api/ops/role-audit/
    Paginated, filterable role change history. Readable by both ops roles.
    """
    serializer_class = RoleChangeAuditSerializer
    permission_classes = [permissions.IsAuthenticated, IsOpsManagerOrSuperAdmin]

    def get_queryset(self):
        qs = RoleChangeAudit.objects.select_related(
            "changed_by", "target_user"
        ).order_by("-timestamp")

        role_filter = self.request.query_params.get("role")
        if role_filter:
            from django.db.models import Q
            qs = qs.filter(Q(old_role=role_filter) | Q(new_role=role_filter))

        search = self.request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(target_email__icontains=search)

        return qs


# ══════════════════════════════════════════════════════════════════
# SYSTEM AUDIT LOG
# ══════════════════════════════════════════════════════════════════

class OpsAuditLogListView(generics.ListAPIView):
    """
    GET /api/ops/audit-log/
    Paginated, filterable system-wide audit trail. Readable by both ops roles.
    """
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated, IsOpsManagerOrSuperAdmin]
    pagination_class = OpsPageNumberPagination  # adds ?page_size= (max 100)

    def get_queryset(self):
        from django.db.models import OuterRef, Subquery

        email_subquery = User.objects.filter(pk=OuterRef("user_id")).values("email")[:1]
        qs = AuditLog.objects.annotate(
            user_email=Subquery(email_subquery)
        ).order_by("-created_at")

        entity_filter = self.request.query_params.get("entity")
        if entity_filter:
            qs = qs.filter(entity=entity_filter)

        action_filter = self.request.query_params.get("action")
        if action_filter:
            qs = qs.filter(action=action_filter)

        search = self.request.query_params.get("search", "").strip()
        if search:
            import uuid as _uuid
            from django.db.models import Q

            matching_user_ids = User.objects.filter(email__icontains=search).values_list("pk", flat=True)
            search_filter = Q(user_id__in=matching_user_ids)
            try:
                search_filter |= Q(entity_id=_uuid.UUID(search))
            except ValueError:
                pass  # search term isn't a UUID — skip the entity_id match
            qs = qs.filter(search_filter)

        return qs


# ══════════════════════════════════════════════════════════════════
# SERVICES MANAGEMENT
# ══════════════════════════════════════════════════════════════════

class OpsServiceListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/ops/services/ — list all services
    POST /api/ops/services/ — create a new service
    Both roles can manage services.
    """
    serializer_class = ServiceSerializer
    permission_classes = [permissions.IsAuthenticated, IsOpsManagerOrSuperAdmin]

    def get_queryset(self):
        qs = Service.objects.all()
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        search = self.request.query_params.get("search", "").strip()
        if search:
            from django.db.models import Q
            qs = qs.filter(Q(name__icontains=search) | Q(description__icontains=search))
        return qs

    def perform_create(self, serializer):
        from .services.audit_service import log_action

        service = serializer.save()
        log_action(
            user=self.request.user, entity="service", action="service_created",
            entity_id=service.pk, metadata={"name": service.name}, request=self.request,
        )


class OpsServiceDetailView(generics.RetrieveUpdateAPIView):
    """
    GET   /api/ops/services/{id}/ — retrieve a service
    PATCH /api/ops/services/{id}/ — update name, description, required_skills
    """
    serializer_class = ServiceSerializer
    permission_classes = [permissions.IsAuthenticated, IsOpsManagerOrSuperAdmin]
    queryset = Service.objects.all()

    def perform_update(self, serializer):
        from .services.audit_service import log_action

        service = serializer.save()
        log_action(
            user=self.request.user, entity="service", action="service_updated",
            entity_id=service.pk, metadata={"name": service.name}, request=self.request,
        )


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, IsOpsManagerOrSuperAdmin])
def ops_service_toggle(request, pk):
    """
    POST /api/ops/services/{id}/toggle/
    Toggle a service between active and inactive.
    """
    from .services.audit_service import log_action

    service = get_object_or_404(Service, pk=pk)
    service.status = "inactive" if service.status == "active" else "active"
    service.save(update_fields=["status", "updated_at"])

    log_action(
        user=request.user,
        entity="service",
        action="service_enabled" if service.status == "active" else "service_disabled",
        entity_id=service.pk, metadata={"name": service.name}, request=request,
    )

    return Response(ServiceSerializer(service).data)


# ══════════════════════════════════════════════════════════════════
# SLA POLICY MANAGEMENT
# ══════════════════════════════════════════════════════════════════
#
# SLAPolicy rows are overrides looked up by sla_service.get_sla_policy()
# (service_type + severity + plan) with hardcoded fallback defaults when no
# row matches — deleting a policy here reverts that combo to the default,
# there is no separate active/inactive flag the way Service has.

class OpsSLAPolicyListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/ops/sla-policies/ — list all SLA policy overrides
    POST /api/ops/sla-policies/ — create a new override
    Same visibility as Services: both Ops Manager and Super Admin manage these.
    """
    serializer_class = SLAPolicySerializer
    permission_classes = [permissions.IsAuthenticated, IsOpsManagerOrSuperAdmin]

    def get_queryset(self):
        qs = SLAPolicy.objects.all().order_by("service_type", "severity", "plan")

        service_type = self.request.query_params.get("service_type")
        if service_type:
            qs = qs.filter(service_type=service_type)

        severity = self.request.query_params.get("severity")
        if severity:
            qs = qs.filter(severity=severity)

        plan = self.request.query_params.get("plan")
        if plan:
            qs = qs.filter(plan=plan)

        return qs

    def perform_create(self, serializer):
        from .services.audit_service import log_action

        policy = serializer.save()
        log_action(
            user=self.request.user, entity="sla_policy", action="sla_policy_created",
            entity_id=policy.pk,
            metadata={"service_type": policy.service_type, "severity": policy.severity, "plan": policy.plan},
            request=self.request,
        )


class OpsSLAPolicyDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/ops/sla-policies/{id}/ — retrieve a policy
    PATCH  /api/ops/sla-policies/{id}/ — update its thresholds
    DELETE /api/ops/sla-policies/{id}/ — remove the override (reverts to default)
    """
    serializer_class = SLAPolicySerializer
    permission_classes = [permissions.IsAuthenticated, IsOpsManagerOrSuperAdmin]
    queryset = SLAPolicy.objects.all()

    def perform_update(self, serializer):
        from .services.audit_service import log_action

        policy = serializer.save()
        log_action(
            user=self.request.user, entity="sla_policy", action="sla_policy_updated",
            entity_id=policy.pk,
            metadata={"service_type": policy.service_type, "severity": policy.severity, "plan": policy.plan},
            request=self.request,
        )

    def perform_destroy(self, instance):
        from .services.audit_service import log_action

        metadata = {"service_type": instance.service_type, "severity": instance.severity, "plan": instance.plan}
        policy_id = instance.pk
        instance.delete()
        log_action(
            user=self.request.user, entity="sla_policy", action="sla_policy_deleted",
            entity_id=policy_id, metadata=metadata, request=self.request,
        )


# ══════════════════════════════════════════════════════════════════
# PAYMENTS (Finance Manager + Super Admin write; Ops Manager read)
# ══════════════════════════════════════════════════════════════════

class OpsPaymentListView(generics.ListAPIView):
    """
    GET /api/ops/payments/
    All payments — Finance Manager and Super Admin see full detail with refund eligibility.
    Ops Manager gets the same list in read-only mode (no action buttons on the frontend).
    """
    permission_classes = [permissions.IsAuthenticated, IsPaymentReader]

    def get_serializer_class(self):
        if is_finance_manager(self.request.user) or self.request.user.is_staff:
            return OpsPaymentSerializer
        return AdminPaymentSerializer

    def get_queryset(self):
        qs = Payment.objects.select_related("customer__user", "ticket").order_by("-created_at")
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        payment_type = self.request.query_params.get("payment_type")
        if payment_type:
            qs = qs.filter(payment_type=payment_type)
        return qs


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, IsFinanceManagerOrSuperAdmin])
def ops_payment_confirm(request, pk):
    """
    POST /api/ops/payments/{id}/confirm/
    Manually mark a payment as completed and move the linked ticket to 'open'.
    """
    from .services.audit_service import log_action

    payment = get_object_or_404(Payment, pk=pk)
    if payment.status != "pending":
        return Response(
            {"detail": f"Payment is already '{payment.status}' — cannot confirm."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    with transaction.atomic():
        payment = (
            Payment.objects.select_related("ticket")
            .select_for_update(of=("self",))
            .get(pk=payment.pk)
        )
        if payment.status != "pending":
            return Response(
                {"detail": f"Payment is already '{payment.status}' — cannot confirm."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        payment.status = "completed"
        payment.save(update_fields=["status", "updated_at"])
        if payment.ticket:
            payment.ticket._actor = request.user
            payment.ticket._actor_note = f"Payment {payment.invoice_number} manually confirmed"
            payment.ticket.status = "open"
            payment.ticket.save(update_fields=["status", "updated_at"])

    log_action(
        user=request.user, entity="payment", action="payment_confirmed",
        entity_id=payment.pk, metadata={"invoice_number": payment.invoice_number}, request=request,
    )

    return Response(OpsPaymentSerializer(payment).data)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, IsFinanceManagerOrSuperAdmin])
def ops_payment_refund(request, pk):
    """
    POST /api/ops/payments/{id}/refund/
    Initiate a Razorpay refund for a completed payment and mark it refunded in the
    database.  Finance Manager or Super Admin — refunds are irreversible.

    Idempotent: if the payment already has a gateway_refund_id (a prior call succeeded),
    returns 200 with the current state without making a second Razorpay API call.

    On gateway failure the payment is left in 'completed' status and 502 is returned
    so the admin can retry.
    """
    from .services.audit_service import log_action
    from .services.payment_service import issue_refund as _issue_refund

    payment = get_object_or_404(
        Payment.objects.select_related("customer__user", "ticket"), pk=pk
    )

    if payment.status not in ("completed", "refunded"):
        return Response(
            {"detail": f"Only completed payments can be refunded (current status: '{payment.status}')."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    _logger.info(
        "ops_payment_refund: refund requested by user %s for payment %s "
        "(invoice=%s, status=%s)",
        request.user.pk, payment.pk, payment.invoice_number, payment.status,
    )

    try:
        updated = _issue_refund(payment)
    except ValueError as exc:
        _logger.warning(
            "ops_payment_refund: refund rejected for payment %s — %s",
            payment.pk, exc,
        )
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    except Exception:
        _logger.exception(
            "ops_payment_refund: gateway error for payment %s (gateway_payment_id=%s)",
            payment.pk, payment.gateway_payment_id,
        )
        return Response(
            {
                "detail": (
                    "Refund could not be processed by the payment gateway. "
                    "Please try again or initiate the refund manually via the Razorpay dashboard."
                )
            },
            status=status.HTTP_502_BAD_GATEWAY,
        )

    log_action(
        user=request.user, entity="payment", action="payment_refunded",
        entity_id=updated.pk, metadata={"invoice_number": updated.invoice_number}, request=request,
    )

    return Response(OpsPaymentSerializer(updated).data)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated, IsFinanceManagerOrSuperAdmin])
def ops_payment_summary(request):
    """
    GET /api/ops/payments/summary/
    Aggregate revenue metrics for the Finance Manager analytics view.
    Returns: monthly revenue, payment type breakdown, refund count.
    """
    from decimal import Decimal
    from django.db.models import Count, DecimalField, Sum, Value
    from django.db.models.functions import Coalesce, TruncMonth

    completed = Payment.objects.filter(status="completed")

    total_revenue = completed.aggregate(
        total=Coalesce(Sum("amount"), Value(Decimal("0.00")), output_field=DecimalField())
    )["total"]

    by_type = list(
        completed.values("payment_type")
        .annotate(count=Count("id"), total=Sum("amount"))
        .order_by("payment_type")
    )

    monthly = list(
        completed.annotate(month=TruncMonth("created_at"))
        .values("month")
        .annotate(total=Sum("amount"))
        .order_by("month")
        .values("month", "total")
    )

    refund_count = Payment.objects.filter(status="refunded").count()

    return Response({
        "total_revenue": float(total_revenue),
        "by_type": by_type,
        "monthly": [
            {"month": row["month"].strftime("%Y-%m"), "total": float(row["total"])}
            for row in monthly
        ],
        "refund_count": refund_count,
    })


# ══════════════════════════════════════════════════════════════════
# TICKET ESCALATION (Support Agent + Ops Manager)
# ══════════════════════════════════════════════════════════════════

@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, IsTicketManagementStaff])
def ops_ticket_escalate(request, ticket_id):
    """
    POST /api/ops/tickets/{id}/escalate/
    Flag a ticket as escalated.
    Accessible to Ops Manager, Support Agent, and Super Admin.
    Finance Managers are blocked at the permission class — no inline check needed.
    """
    user = request.user
    ticket = get_object_or_404(Ticket, pk=ticket_id)
    note = request.data.get("note", "")
    TicketActivityLog.objects.create(
        ticket=ticket,
        actor=user,
        action="escalated",
        note=note,
    )
    return Response({"detail": "Ticket escalated.", "ticket_id": str(ticket.id)})


# ══════════════════════════════════════════════════════════════════
# OPERATIONS COMMAND CENTER (/operations) — all 4 staff roles
# ══════════════════════════════════════════════════════════════════
#
# Split into two endpoints because only 3 of the 10 Command Center widgets
# need frequent polling (Live Incident Queue, SLA Risk Board, Activity
# Timeline). A single unified payload would force re-running Engineer
# Capacity/Service Health/Critical Customers/Ticket Flow's queries on every
# poll tick for no UX benefit — see ops_command_center_live below.
#
# Neither endpoint exposes revenue/financial figures, so — unlike
# ops_dashboard's Support-Agent revenue omission — no per-role field
# gating is needed inside either view; IsAnyStaffRole alone is sufficient.

@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated, IsAnyStaffRole])
def ops_command_center_core(request):
    """
    GET /api/ops/command-center/
    Load-once payload for the Operations Command Center: Escalation Queue,
    Engineer Capacity, Service Health, Critical Customers, Ticket Flow.
    None of these need 30-60s polling — see ops_command_center_live for the
    three that do.
    """
    from datetime import timedelta

    from django.utils import timezone

    from .services import ops_command_center_service as svc

    now = timezone.now()
    window_start = now - timedelta(days=7)

    escalation_qs = svc.get_escalation_queryset(limit=50)

    return Response({
        "escalation_queue": OpsTicketListSerializer(
            escalation_qs, many=True, context={"request": request}
        ).data,
        "engineer_capacity": svc.get_engineer_capacity(),
        "service_health": svc.get_service_health(window_start, now),
        "critical_customers": svc.get_critical_customers(limit=10),
        "ticket_flow": svc.get_ticket_flow(hours=24),
        "generated_at": now.isoformat(),
    })


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated, IsAnyStaffRole])
def ops_command_center_live(request):
    """
    GET /api/ops/command-center/live/
    The 3 time-sensitive Operations Command Center widgets, meant to be
    polled every 30-60s by the frontend: Live Incident Queue, SLA Risk
    Board, Activity Timeline.
    """
    from django.utils import timezone

    from .services import ops_command_center_service as svc

    now = timezone.now()
    incident_qs = svc.get_incident_queue_queryset(limit=50)
    sla_qs = svc.get_sla_risk_queryset(horizon_hours=4, limit=50)
    activity_qs = svc.get_recent_activity(hours=4, limit=30)

    return Response({
        "incident_queue": OpsTicketListSerializer(
            incident_qs, many=True, context={"request": request}
        ).data,
        "sla_risk_board": OpsTicketListSerializer(
            sla_qs, many=True, context={"request": request}
        ).data,
        "activity_timeline": OpsActivityLogSerializer(activity_qs, many=True).data,
        "generated_at": now.isoformat(),
    })


# ══════════════════════════════════════════════════════════════════
# OPS ANALYTICS (role-scoped)
# ══════════════════════════════════════════════════════════════════

@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated, IsAnyStaffRole])
def ops_analytics(request):
    """
    GET /api/ops/analytics/
    Role-scoped analytics for the /operations portal.

    Scope by role:
      Super Admin       → all sections (operational + financial + user growth)
      Ops Manager       → operational only (SLA, engineer utilisation, service demand)
      Finance Manager   → financial only (revenue, payment types, refund rate)
      Support Agent     → ticket KPIs only (counts by status, avg resolution time)
    """
    from decimal import Decimal
    from django.db.models import Avg, Count, DecimalField, DurationField, ExpressionWrapper, F, Sum, Value
    from django.db.models.functions import Coalesce, TruncMonth
    from django.utils import timezone
    from datetime import timedelta

    user = request.user
    today = timezone.now()
    thirty_days_ago = today - timedelta(days=30)

    include_operational = user.is_staff or user.role in ("operations_manager", "support_agent")
    include_financial = user.is_staff or user.role == "finance_manager"

    data = {}

    if include_operational:
        tickets = Ticket.objects.filter(created_at__gte=thirty_days_ago)
        by_status = dict(
            tickets.values_list("status")
            .annotate(n=Count("id"))
            .values_list("status", "n")
        )
        avg_resolution = Ticket.objects.filter(
            status__in=["resolved", "closed"],
            resolved_at__isnull=False,
        ).aggregate(
            avg=Avg(
                ExpressionWrapper(
                    F("resolved_at") - F("created_at"),
                    output_field=DurationField(),
                )
            )
        )["avg"]
        avg_hours = round(avg_resolution.total_seconds() / 3600, 1) if avg_resolution else None

        # Severity distribution (last 30 days)
        severity_dist = list(
            tickets.values("severity").annotate(n=Count("id")).order_by("severity")
        )
        # Revenue by severity from completed resolution payments (last 30 days)
        sev_revenue = list(
            Payment.objects.filter(
                status="completed",
                payment_type="resolution_fee",
                created_at__gte=thirty_days_ago,
                ticket__isnull=False,
            )
            .values("ticket__severity")
            .annotate(revenue=Sum(F("amount") + F("gst_amount")))
            .order_by("ticket__severity")
        )

        data["operational"] = {
            "by_status": by_status,
            "avg_resolution_hours": avg_hours,
            "total_last_30_days": tickets.count(),
            "severity_distribution": severity_dist,
            "severity_revenue": [
                {"severity": r["ticket__severity"], "revenue": float(r["revenue"] or 0)}
                for r in sev_revenue
            ],
        }

    if include_financial:
        completed = Payment.objects.filter(status="completed")
        total_revenue = completed.aggregate(
            total=Coalesce(Sum("amount"), Value(Decimal("0.00")), output_field=DecimalField())
        )["total"]
        monthly = list(
            completed.annotate(month=TruncMonth("created_at"))
            .values("month")
            .annotate(total=Sum("amount"))
            .order_by("month")
            .values("month", "total")
        )
        refund_count = Payment.objects.filter(status="refunded").count()

        # Revenue split by payment type (consulting vs resolution)
        by_type = list(
            completed.values("payment_type")
            .annotate(total=Sum(F("amount") + F("gst_amount")))
            .order_by("payment_type")
        )
        # Total pending payouts
        pending_payouts = Payout.objects.filter(status="pending").aggregate(
            total=Coalesce(Sum("engineer_share"), Value(Decimal("0.00")), output_field=DecimalField())
        )["total"]

        data["financial"] = {
            "total_revenue": float(total_revenue),
            "monthly_revenue": [
                {"month": row["month"].strftime("%Y-%m"), "total": float(row["total"])}
                for row in monthly
            ],
            "refund_count": refund_count,
            "revenue_by_type": [
                {"payment_type": r["payment_type"], "total": float(r["total"] or 0)}
                for r in by_type
            ],
            "pending_payouts_total": float(pending_payouts),
        }

    return Response(data)


# ══════════════════════════════════════════════════════════════════
# EXECUTIVE ANALYTICS (Super Admin + Ops Manager + Finance Manager)
# ══════════════════════════════════════════════════════════════════

@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated, IsExecutiveAnalytics])
@throttle_classes_dec([AnalyticsRateThrottle])
def executive_analytics(request):
    """
    GET /api/ops/executive-analytics/
    Unified cross-functional analytics for Super Admin, Ops Manager, and
    Finance Manager — a single payload (not role-partitioned, since access
    is already restricted to those three roles).

    Query params:
      period  — "7d" | "30d" (default) | "90d" | "all"
      start, end — ISO date strings; override `period` when both are given
    """
    from .services.executive_analytics_service import build_executive_analytics_payload

    payload = build_executive_analytics_payload(
        period=request.query_params.get("period"),
        start_param=request.query_params.get("start"),
        end_param=request.query_params.get("end"),
    )
    return Response(payload)


# ── Knowledge Base ──────────────────────────────────────────────

class IsStaffOrReadOnly(permissions.BasePermission):
    """
    Any authenticated user (customer, freelancer, staff) can read.
    Only internal staff (support_agent, operations_manager, finance_manager,
    admin) can create/edit/delete — Knowledge Base authoring is a staff
    tool, but the content itself is customer-facing self-service.
    """

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        return is_internal_staff(request.user)


class KBArticleListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/kb/articles/  — browse/search articles (customers/freelancers see
         published only; staff also see drafts)
    POST /api/kb/articles/  — create a new article (staff only)

    Query params:
      ?q=<text>        — search title/body/tags
      ?category=<key>  — filter by category
      ?status=draft    — staff only, narrows further (defaults to all statuses for staff)
    """
    permission_classes = [IsStaffOrReadOnly]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return KBArticleWriteSerializer
        return KBArticleListSerializer

    def get_queryset(self):
        from .services import kb_service

        base = KBArticle.objects.all()
        if not is_internal_staff(self.request.user):
            base = base.filter(status="published")
        elif self.request.query_params.get("status"):
            base = base.filter(status=self.request.query_params["status"])

        query = self.request.query_params.get("q", "")
        category = self.request.query_params.get("category")
        return kb_service.search_articles(query=query, category=category, status=None, queryset=base)

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)


class KBArticleDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/kb/articles/{id}/  — view (increments view_count); staff can view drafts
    PATCH  /api/kb/articles/{id}/  — edit (staff only)
    DELETE /api/kb/articles/{id}/  — remove (staff only)
    """
    permission_classes = [IsStaffOrReadOnly]

    def get_queryset(self):
        qs = KBArticle.objects.all()
        if not is_internal_staff(self.request.user):
            qs = qs.filter(status="published")
        return qs

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return KBArticleWriteSerializer
        return KBArticleDetailSerializer

    def retrieve(self, request, *args, **kwargs):
        from .services import kb_service

        instance = self.get_object()
        kb_service.increment_view_count(instance)
        serializer = self.get_serializer(instance)
        return Response(serializer.data)


@api_view(["GET"])
def kb_categories(request):
    """GET /api/kb/categories/ — the fixed category taxonomy (service catalogue + General)."""
    from .services.service_catalog import SERVICE_CATALOG

    categories = [{"key": s["key"], "name": s["name"]} for s in SERVICE_CATALOG]
    categories.append({"key": "general", "name": "General"})
    return Response({"categories": categories})


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def ticket_kb_articles(request, ticket_id):
    """
    GET /api/tickets/{id}/kb-articles/
    Returns manually-linked and auto-suggested articles for a ticket.
    Visible to the ticket owner and any internal staff — same access rule
    as the ticket itself (Knowledge Base self-service applies to customers too).
    """
    from .services import kb_service

    ticket = _get_ticket_for_user(request.user, ticket_id)

    links = KBArticleTicketLink.objects.filter(ticket=ticket).select_related("article")
    linked_ids = {link.article_id for link in links}
    suggested = [
        a for a in kb_service.get_related_articles_for_ticket(ticket, limit=5)
        if a.id not in linked_ids
    ]

    return Response({
        "linked": KBArticleListSerializer([link.article for link in links], many=True).data,
        "suggested": KBArticleListSerializer(suggested, many=True).data,
    })


@api_view(["POST", "DELETE"])
@permission_classes([IsTicketManagementStaff])
def kb_link_article(request, ticket_id, article_id):
    """
    POST   /api/tickets/{id}/kb-articles/{article_id}/link/  — link an article to a ticket
    DELETE /api/tickets/{id}/kb-articles/{article_id}/link/  — unlink

    Staff-only — no object-level ownership check beyond role, matching
    admin_assign_ticket/admin_status_update: internal ticket-management
    staff can act on any ticket, not just ones assigned to them.
    """
    ticket = get_object_or_404(Ticket, pk=ticket_id)
    article = get_object_or_404(KBArticle, pk=article_id)

    if request.method == "DELETE":
        KBArticleTicketLink.objects.filter(ticket=ticket, article=article).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    link, created = KBArticleTicketLink.objects.get_or_create(
        ticket=ticket, article=article, defaults={"linked_by": request.user},
    )
    if created:
        TicketActivityLog.objects.create(
            ticket=ticket, actor=request.user, action="kb_article_linked",
            to_value=article.title,
        )
    return Response(
        KBArticleListSerializer(article).data,
        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
    )


# ── AI Assistant (internal staff only) ───────────────────────────
# Mock-provider today (support_app/services/ai_assistant_service.py);
# swapping in a real LLM later needs no changes here — get_ai_provider()
# is the seam.

@api_view(["GET"])
@permission_classes([IsTicketManagementStaff])
@throttle_classes_dec([AIAssistantRateThrottle])
def ai_assistant_view(request, ticket_id):
    """
    GET /api/tickets/{id}/ai-assistant/?tone=professional|friendly|concise
    Returns suggested root cause, resolution, related KB articles, similar
    tickets, and a draft customer reply in one payload.
    """
    from .services.ai_assistant_service import get_ai_provider

    ticket = get_object_or_404(Ticket, pk=ticket_id)
    tone = request.query_params.get("tone", "professional")
    provider = get_ai_provider()
    similar = provider.find_similar_tickets(ticket)

    return Response({
        "root_cause": provider.suggest_root_cause(ticket),
        "resolution": provider.suggest_resolution(ticket),
        "related_articles": KBArticleListSerializer(provider.find_related_articles(ticket), many=True).data,
        "similar_tickets": [
            {
                "id": str(t.id),
                "ticket_number": t.ticket_number,
                "title": t.title,
                "status": t.status,
            }
            for t in similar
        ],
        "draft_reply": provider.draft_reply(ticket, tone=tone),
    })


@api_view(["POST"])
@permission_classes([IsTicketManagementStaff])
def ai_assistant_log_insert(request, ticket_id):
    """POST /api/tickets/{id}/ai-assistant/log-insert/ — record that an agent inserted the AI draft reply."""
    ticket = get_object_or_404(Ticket, pk=ticket_id)
    tone = request.data.get("tone", "professional")
    TicketActivityLog.objects.create(
        ticket=ticket, actor=request.user, action="ai_suggestion_used",
        note=f"AI draft reply inserted (tone={tone}).",
    )
    return Response(status=status.HTTP_204_NO_CONTENT)
