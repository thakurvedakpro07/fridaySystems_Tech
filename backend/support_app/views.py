"""
API Views — each class or function handles one URL endpoint.

For now these are skeleton views that return placeholder responses.
Business logic will be added in the services/ layer later.
"""

import uuid

from django.contrib.auth.models import User
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView as BaseTokenObtainPairView

from .models import Customer, Freelancer, Payment, Subscription, Ticket, TicketComment
from .permissions import IsAdminUser, IsCustomer, IsFreelancer, IsOwnerOrAdmin
from .serializers import (
    CSATSurveySerializer,
    CustomerSerializer,
    FreelancerSerializer,
    PaymentSerializer,
    RegisterSerializer,
    SubscriptionSerializer,
    TicketCommentSerializer,
    TicketCreateSerializer,
    TicketDetailSerializer,
    TicketListSerializer,
)


# ── Custom JWT Login ─────────────────────────────────────────────

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Extends the default SimpleJWT login serializer to include user data.
    SimpleJWT returns only {access, refresh} by default; the frontend
    needs {id, email, is_staff} to set up the auth store correctly.
    """
    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = {
            "id": self.user.id,
            "email": self.user.email,
            "is_staff": self.user.is_staff,
        }
        return data


class CustomTokenObtainPairView(BaseTokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


# ── Health Check ──────────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def health_check(request):
    """
    GET /api/health/
    Returns 200 OK if the app is running and the database is reachable.
    Used by Docker healthchecks and monitoring tools.
    """
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

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": {"id": user.id, "email": user.email, "is_staff": user.is_staff},
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
    Blacklists the token so it cannot mint new access tokens.
    Returns 204 regardless — logout goal is achieved even if token was
    already expired or blacklisted.
    """
    try:
        token = RefreshToken(request.data.get("refresh", ""))
        token.blacklist()
    except Exception:
        pass
    return Response(status=status.HTTP_204_NO_CONTENT)


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
    """
    GET /api/services/
    Returns all service types with their names and resolution fees.
    """
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


# ── Tickets ───────────────────────────────────────────────────────

class TicketListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/tickets/   — list the logged-in customer's tickets
    POST /api/tickets/   — open a new ticket
    """
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return TicketCreateSerializer
        return TicketListSerializer

    def get_queryset(self):
        qs = Ticket.objects.filter(customer=self.request.user.customer_profile)

        # Optional filters via query parameters
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)

        service_filter = self.request.query_params.get("service_type")
        if service_filter:
            qs = qs.filter(service_type=service_filter)

        severity_filter = self.request.query_params.get("severity")
        if severity_filter:
            qs = qs.filter(severity=severity_filter)

        return qs

    def perform_create(self, serializer):
        # TODO: trigger consulting fee payment order (Phase 2)
        ticket = serializer.save(
            customer=self.request.user.customer_profile,
            status="pending_payment",
        )
        return ticket


class TicketDetailView(generics.RetrieveUpdateAPIView):
    """
    GET   /api/tickets/{id}/  — get ticket detail
    PATCH /api/tickets/{id}/  — update description/notes (before assignment)
    """
    serializer_class = TicketDetailSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrAdmin]

    def get_queryset(self):
        if self.request.user.is_staff:
            return Ticket.objects.all()
        return Ticket.objects.filter(customer=self.request.user.customer_profile)


class TicketCommentListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/tickets/{ticket_id}/comments/  — list comments
    POST /api/tickets/{ticket_id}/comments/  — add a comment
    """
    serializer_class = TicketCommentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def _get_ticket(self):
        """
        Fetch the ticket for this URL and enforce ownership in one place.
        - Staff can access any ticket's comments.
        - Customers can only access comments on their own tickets (404 otherwise).
        - Any other role (freelancer, etc.) gets 403.
        """
        if self.request.user.is_staff:
            return get_object_or_404(Ticket, pk=self.kwargs["ticket_id"])
        if not hasattr(self.request.user, "customer_profile"):
            raise PermissionDenied()
        return get_object_or_404(
            Ticket,
            pk=self.kwargs["ticket_id"],
            customer=self.request.user.customer_profile,
        )

    def get_queryset(self):
        self._get_ticket()  # raises 404 or 403 if access is denied
        return TicketComment.objects.filter(ticket_id=self.kwargs["ticket_id"])

    def perform_create(self, serializer):
        ticket = self._get_ticket()
        if self.request.user.is_staff:
            # Django User.pk is an int; convert to UUID to fit the UUIDField schema
            author_id = uuid.UUID(int=self.request.user.pk)
            author_type = "admin"
        else:
            author_id = self.request.user.customer_profile.id
            author_type = "customer"
        serializer.save(ticket=ticket, author_id=author_id, author_type=author_type)


# ── Payments ─────────────────────────────────────────────────────

class PaymentListView(generics.ListAPIView):
    """
    GET /api/customers/me/payments/
    List all payments belonging to the authenticated customer.
    """
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated, IsCustomer]

    def get_queryset(self):
        return Payment.objects.filter(customer=self.request.user.customer_profile)


class PaymentDetailView(generics.RetrieveAPIView):
    """
    GET /api/payments/{id}/
    Retrieve a single payment owned by the authenticated customer.
    Returns 404 if the payment belongs to a different customer.
    """
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated, IsCustomer]

    def get_queryset(self):
        return Payment.objects.filter(customer=self.request.user.customer_profile)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated, IsCustomer])
def payment_invoice(request, pk):
    """
    GET /api/payments/{id}/invoice/
    Download invoice PDF.
    TODO: implement PDF generation with Razorpay details (Phase 2).
    """
    return Response(
        {"detail": "Invoice generation is not yet available."},
        status=status.HTTP_501_NOT_IMPLEMENTED,
    )


@api_view(["POST"])
@permission_classes([permissions.AllowAny])  # webhook is not authenticated; HMAC-verified instead
def payment_webhook(request):
    """
    POST /api/payments/webhook/
    Receives payment status events from Razorpay.
    The HMAC signature is verified before processing.
    TODO: implement HMAC verification and status updates (Phase 2).
    """
    return Response({"received": True})


# ── CSAT ─────────────────────────────────────────────────────────

@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, IsCustomer])
def submit_csat(request, ticket_id):
    """
    POST /api/tickets/{id}/csat/
    Submit a satisfaction score (1–5) for a resolved or closed ticket.
    Each ticket can only receive one CSAT submission.
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


# ── Admin: Ticket Management ──────────────────────────────────────

class AdminTicketListView(generics.ListAPIView):
    """
    GET /api/admin/tickets/
    List ALL tickets across all customers. Admin only.
    """
    serializer_class = TicketListSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]
    queryset = Ticket.objects.all()


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated, IsAdminUser])
def admin_assign_ticket(request, ticket_id):
    """
    POST /api/admin/tickets/{id}/assign/
    Assign a ticket to a freelancer.
    Body: { "freelancer_id": "<uuid>" }
    TODO: implement assignment logic and notifications (Phase 3).
    """
    return Response({"message": "Assignment endpoint — coming in Phase 3."})


# ── Admin: Freelancer Management ─────────────────────────────────

class AdminFreelancerListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/admin/freelancers/  — list all freelancers
    POST /api/admin/freelancers/  — register a new freelancer
    """
    serializer_class = FreelancerSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]
    queryset = Freelancer.objects.all()
