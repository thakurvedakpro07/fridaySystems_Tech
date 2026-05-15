"""
URL patterns for the support_app.

All paths here are automatically prefixed with /api/ because
this file is included in supportmitra/urls.py as:
    path("api/", include("support_app.urls"))
"""

from django.urls import path
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

from . import views

urlpatterns = [
    # ── System ────────────────────────────────────────────────────
    path("health/", views.health_check, name="health-check"),

    # ── Authentication ────────────────────────────────────────────
    path("auth/register/", views.RegisterView.as_view(), name="auth-register"),
    path("auth/login/", TokenObtainPairView.as_view(), name="auth-login"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="auth-token-refresh"),

    # ── Customer Profile ─────────────────────────────────────────
    path("customers/me/", views.CustomerMeView.as_view(), name="customer-me"),

    # ── Services Catalog ─────────────────────────────────────────
    path("services/", views.services_list, name="services-list"),

    # ── Tickets ──────────────────────────────────────────────────
    path("tickets/", views.TicketListCreateView.as_view(), name="ticket-list-create"),
    path("tickets/<uuid:pk>/", views.TicketDetailView.as_view(), name="ticket-detail"),
    path("tickets/<uuid:ticket_id>/comments/", views.TicketCommentListCreateView.as_view(), name="ticket-comments"),

    # ── Payments ─────────────────────────────────────────────────
    path("payments/webhook/", views.payment_webhook, name="payment-webhook"),

    # ── Admin: Tickets ───────────────────────────────────────────
    path("admin/tickets/", views.AdminTicketListView.as_view(), name="admin-ticket-list"),
    path("admin/tickets/<uuid:ticket_id>/assign/", views.admin_assign_ticket, name="admin-assign-ticket"),

    # ── Admin: Freelancers ───────────────────────────────────────
    path("admin/freelancers/", views.AdminFreelancerListCreateView.as_view(), name="admin-freelancer-list"),
]
