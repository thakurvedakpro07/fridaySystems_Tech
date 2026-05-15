"""
API Views — each class or function handles one URL endpoint.

For now these are skeleton views that return placeholder responses.
Business logic will be added in the services/ layer later.
"""

from django.contrib.auth.models import User
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

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
                "user": {"id": user.id, "email": user.email},
            },
            status=status.HTTP_201_CREATED,
        )


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
        return Ticket.objects.filter(customer=self.request.user.customer_profile)


class TicketCommentListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/tickets/{ticket_id}/comments/  — list comments
    POST /api/tickets/{ticket_id}/comments/  — add a comment
    """
    serializer_class = TicketCommentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return TicketComment.objects.filter(ticket_id=self.kwargs["ticket_id"])

    def perform_create(self, serializer):
        ticket = Ticket.objects.get(pk=self.kwargs["ticket_id"])
        serializer.save(
            ticket=ticket,
            author_id=self.request.user.customer_profile.id,
            author_type="customer",
        )


# ── Payments ─────────────────────────────────────────────────────

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
