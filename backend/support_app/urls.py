"""
URL patterns for the support_app.

All paths here are prefixed with /api/ because this file is included
in supportmitra/urls.py as: path("api/", include("support_app.urls"))

VERSIONING STRATEGY:
  Currently all routes live under /api/.
  When a breaking change is needed, add /api/v2/ in the root urls.py
  and point it to a new include. No view code changes needed.

ROUTE GROUPS:
  /api/auth/           — authentication (login, register, logout, refresh)
  /api/customers/      — customer profile and payment history
  /api/services/       — service catalogue (public)
  /api/tickets/        — customer ticket operations
  /api/freelancer/     — freelancer ticket operations
  /api/admin/          — admin-only operations
  /api/notifications/  — in-app notification inbox
  /api/payments/       — payment details and webhooks
  /api/health/         — system health check
"""

from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

urlpatterns = [
    # ── System ────────────────────────────────────────────────────
    path("health/", views.health_check, name="health-check"),

    # ── Authentication ────────────────────────────────────────────
    path("auth/register/", views.RegisterView.as_view(), name="auth-register"),
    path("auth/login/", views.CustomTokenObtainPairView.as_view(), name="auth-login"),
    path("auth/logout/", views.logout_view, name="auth-logout"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="auth-token-refresh"),

    # ── Customer Profile ─────────────────────────────────────────
    path("customers/me/", views.CustomerMeView.as_view(), name="customer-me"),
    path("customers/me/payments/", views.PaymentListView.as_view(), name="payment-list"),

    # ── Services Catalog ─────────────────────────────────────────
    path("services/", views.services_list, name="services-list"),

    # ── Tickets (Customer) ───────────────────────────────────────
    path("tickets/", views.TicketListCreateView.as_view(), name="ticket-list-create"),
    path("tickets/<uuid:pk>/", views.TicketDetailView.as_view(), name="ticket-detail"),
    path("tickets/<uuid:ticket_id>/comments/", views.TicketCommentListCreateView.as_view(), name="ticket-comments"),
    path("tickets/<uuid:ticket_id>/activity/", views.TicketActivityLogListView.as_view(), name="ticket-activity"),
    path("tickets/<uuid:ticket_id>/csat/", views.submit_csat, name="ticket-csat"),

    # ── Notifications ────────────────────────────────────────────
    # NOTE: mark-all-read MUST come before <uuid:pk>/read/ to avoid
    # Django trying to parse "mark-all-read" as a UUID.
    path("notifications/", views.NotificationListView.as_view(), name="notification-list"),
    path("notifications/mark-all-read/", views.notification_mark_all_read, name="notification-mark-all-read"),
    path("notifications/<uuid:pk>/read/", views.notification_mark_read, name="notification-mark-read"),

    # ── Freelancer APIs ──────────────────────────────────────────
    path("freelancer/tickets/", views.FreelancerTicketListView.as_view(), name="freelancer-ticket-list"),
    path("freelancer/tickets/<uuid:pk>/", views.FreelancerTicketDetailView.as_view(), name="freelancer-ticket-detail"),
    path("freelancer/tickets/<uuid:ticket_id>/status/", views.freelancer_update_status, name="freelancer-ticket-status"),

    # ── Payments ─────────────────────────────────────────────────
    path("payments/<uuid:pk>/", views.PaymentDetailView.as_view(), name="payment-detail"),
    path("payments/<uuid:pk>/invoice/", views.payment_invoice, name="payment-invoice"),
    path("payments/webhook/", views.payment_webhook, name="payment-webhook"),

    # ── Admin: Ticket Management ─────────────────────────────────
    path("admin/tickets/", views.AdminTicketListView.as_view(), name="admin-ticket-list"),
    path("admin/tickets/<uuid:ticket_id>/assign/", views.admin_assign_ticket, name="admin-assign-ticket"),
    path("admin/tickets/<uuid:ticket_id>/status/", views.admin_status_update, name="admin-ticket-status"),
    path("admin/tickets/<uuid:ticket_id>/unassign/", views.admin_unassign_ticket, name="admin-unassign-ticket"),

    # ── Admin: Freelancer Management ─────────────────────────────
    path("admin/freelancers/", views.AdminFreelancerListCreateView.as_view(), name="admin-freelancer-list"),
]
