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
  /api/freelancer/     — freelancer ticket, payout, and stats operations
  /api/admin/          — admin-only operations
  /api/notifications/  — in-app notification inbox
  /api/payments/       — payment details and webhooks
  /api/health/         — system health check
  /api/admin/queue-status/ — Celery worker/queue liveness (Super Admin only)
"""

from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

urlpatterns = [
    # ── System ────────────────────────────────────────────────────
    path("health/", views.health_check, name="health-check"),
    path("admin/queue-status/", views.queue_status, name="queue-status"),

    # ── Authentication ────────────────────────────────────────────
    path("auth/register/", views.RegisterView.as_view(), name="auth-register"),
    path("auth/login/", views.CustomTokenObtainPairView.as_view(), name="auth-login"),
    path("auth/logout/", views.logout_view, name="auth-logout"),
    path("auth/google/", views.google_auth_view, name="auth-google"),
    # Two URLs for token refresh — keep /token/refresh/ because the Axios
    # interceptor in client.js uses it; /refresh/ is the cleaner public alias.
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="auth-token-refresh"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="auth-refresh"),
    # Current user endpoint — works for all roles (customer, freelancer, admin).
    # Use this instead of /customers/me/ in initializeAuth() so admins/freelancers
    # don't get logged out on page refresh.
    path("auth/me/", views.me_view, name="auth-me"),

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
    path("tickets/<uuid:ticket_id>/accept-resolution/", views.accept_resolution, name="ticket-accept-resolution"),
    path("tickets/<uuid:ticket_id>/reject-resolution/", views.reject_resolution, name="ticket-reject-resolution"),
    # Payment flow — per-ticket endpoints
    path("tickets/<uuid:ticket_id>/initiate-payment/", views.ticket_initiate_payment, name="ticket-initiate-payment"),
    path("tickets/<uuid:ticket_id>/verify-payment/", views.ticket_verify_payment, name="ticket-verify-payment"),
    # Resolution fee payment flow
    path("tickets/<uuid:ticket_id>/resolution-quote/", views.resolution_quote, name="ticket-resolution-quote"),
    path("tickets/<uuid:ticket_id>/initiate-resolution-payment/", views.initiate_resolution_payment, name="ticket-initiate-resolution-payment"),
    path("tickets/<uuid:ticket_id>/verify-resolution-payment/", views.verify_resolution_payment, name="ticket-verify-resolution-payment"),

    # ── Notifications ────────────────────────────────────────────
    # NOTE: mark-all-read MUST come before <uuid:pk>/read/ to avoid
    # Django trying to parse "mark-all-read" as a UUID.
    path("notifications/", views.NotificationListView.as_view(), name="notification-list"),
    # NOTE: all string-path routes must precede the <uuid:pk> route
    path("notifications/unread-count/", views.notification_unread_count, name="notification-unread-count"),
    path("notifications/mark-all-read/", views.notification_mark_all_read, name="notification-mark-all-read"),
    path("notifications/<uuid:pk>/read/", views.notification_mark_read, name="notification-mark-read"),

    # ── Freelancer APIs ──────────────────────────────────────────
    path("freelancer/tickets/", views.FreelancerTicketListView.as_view(), name="freelancer-ticket-list"),
    path("freelancer/tickets/<uuid:pk>/", views.FreelancerTicketDetailView.as_view(), name="freelancer-ticket-detail"),
    path("freelancer/tickets/<uuid:ticket_id>/status/", views.freelancer_update_status, name="freelancer-ticket-status"),
    path("freelancer/tickets/<uuid:ticket_id>/remote-session/", views.freelancer_start_remote_session, name="freelancer-ticket-remote-session"),
    path("freelancer/payouts/", views.FreelancerPayoutListView.as_view(), name="freelancer-payout-list"),
    path("freelancer/stats/", views.freelancer_my_stats, name="freelancer-my-stats"),

    # ── Payments ─────────────────────────────────────────────────
    # NOTE: webhook/ MUST precede <uuid:pk>/ so the literal path matches first.
    path("payments/webhook/", views.payment_webhook, name="payment-webhook"),
    path("payments/<uuid:pk>/", views.PaymentDetailView.as_view(), name="payment-detail"),
    path("payments/<uuid:pk>/invoice/", views.payment_invoice, name="payment-invoice"),

    # ── Admin: Ticket Management ─────────────────────────────────
    path("admin/tickets/", views.AdminTicketListView.as_view(), name="admin-ticket-list"),
    path("admin/tickets/<uuid:ticket_id>/assign/", views.admin_assign_ticket, name="admin-assign-ticket"),
    path("admin/tickets/<uuid:ticket_id>/status/", views.admin_status_update, name="admin-ticket-status"),
    path("admin/tickets/<uuid:ticket_id>/unassign/", views.admin_unassign_ticket, name="admin-unassign-ticket"),

    # ── Admin: Payment Controls ──────────────────────────────────
    # NOTE: confirm/ MUST precede <uuid:pk>/ to avoid UUID parsing "confirm"
    path("admin/payments/", views.AdminPaymentListView.as_view(), name="admin-payment-list"),
    path("admin/payments/<uuid:pk>/confirm/", views.admin_payment_confirm, name="admin-payment-confirm"),

    # ── Admin: Freelancer Management ─────────────────────────────
    path("admin/freelancers/", views.AdminFreelancerListCreateView.as_view(), name="admin-freelancer-list"),

    # ── User Profile & Password ──────────────────────────────────
    path("auth/profile/", views.user_profile, name="user-profile"),
    path("auth/change-password/", views.change_password, name="change-password"),

    # ── DPDP Act 2023: Data Export & Right to Erasure ─────────────
    path("auth/profile/export/", views.export_my_data, name="profile-export"),
    path("auth/deletion-request/", views.request_account_deletion, name="deletion-request"),
    path("auth/deletion-request/cancel/", views.cancel_account_deletion, name="deletion-request-cancel"),

    # ── Email Verification ────────────────────────────────────────
    path("auth/verify-email/", views.verify_email, name="verify-email"),
    path("auth/verify-email/resend/", views.resend_verification_email, name="verify-email-resend"),
    path("auth/verify-email/resend-by-email/", views.resend_verification_email_by_email, name="verify-email-resend-by-email"),

    # ── Password Reset ────────────────────────────────────────────
    path("auth/password/reset/", views.password_reset_request, name="password-reset-request"),
    path("auth/password/reset/confirm/", views.password_reset_confirm, name="password-reset-confirm"),

    # ── Analytics ────────────────────────────────────────────────
    path("analytics/", views.analytics_view, name="analytics"),

    # ── Attachments ──────────────────────────────────────────────
    path("tickets/<uuid:ticket_id>/attachments/", views.ticket_attachments, name="ticket-attachments"),
    path("tickets/<uuid:ticket_id>/attachments/<uuid:attachment_id>/", views.ticket_attachment_delete, name="ticket-attachment-delete"),
    path("tickets/<uuid:ticket_id>/attachments/<uuid:attachment_id>/download/", views.ticket_attachment_download, name="ticket-attachment-download"),

    # ── Related Tickets ──────────────────────────────────────────
    path("tickets/<uuid:ticket_id>/related/", views.ticket_related, name="ticket-related"),

    # ── Operations Dashboard ─────────────────────────────────────
    # Accessible to role=operations_manager AND role=admin (Super Admin).
    # No payment, system-settings, or Django admin access.
    path("ops/dashboard/",                                  views.ops_dashboard,                    name="ops-dashboard"),
    path("ops/tickets/",                                    views.OpsTicketListView.as_view(),       name="ops-ticket-list"),
    path("ops/tickets/<uuid:ticket_id>/assign/",            views.ops_assign_ticket,                name="ops-assign-ticket"),
    path("ops/tickets/<uuid:ticket_id>/unassign/",          views.ops_unassign_ticket,              name="ops-unassign-ticket"),
    path("ops/tickets/<uuid:ticket_id>/status/",            views.ops_status_update,                name="ops-ticket-status"),
    path("ops/tickets/<uuid:ticket_id>/history/",           views.ops_ticket_history,               name="ops-ticket-history"),
    path("ops/freelancers/",                                views.OpsFreelancerListView.as_view(),  name="ops-freelancer-list"),

    # ── User Management (Super Admin write; both roles read) ─────
    # NOTE: list/ and detail/<uuid>/ routes must precede action sub-paths
    path("ops/users/",                                      views.OpsUserListView.as_view(),        name="ops-user-list"),
    path("ops/users/<uuid:user_id>/",                       views.ops_user_detail,                  name="ops-user-detail"),
    path("ops/users/<uuid:user_id>/role/",                  views.ops_change_role,                  name="ops-user-role"),
    path("ops/users/<uuid:user_id>/deactivate/",            views.ops_deactivate_user,              name="ops-user-deactivate"),
    path("ops/users/<uuid:user_id>/reactivate/",            views.ops_reactivate_user,              name="ops-user-reactivate"),

    # ── Role Change Audit Log ────────────────────────────────────
    path("ops/role-audit/",                                 views.OpsRoleAuditListView.as_view(),   name="ops-role-audit"),

    # ── System Audit Log ─────────────────────────────────────────
    path("ops/audit-log/",                                  views.OpsAuditLogListView.as_view(),    name="ops-audit-log"),

    # ── Services Management ──────────────────────────────────────
    # NOTE: action sub-paths must precede <uuid:pk>/ to avoid UUID parsing
    path("ops/services/",                                   views.OpsServiceListCreateView.as_view(), name="ops-service-list"),
    path("ops/services/<uuid:pk>/archive/",                 views.ops_service_archive,              name="ops-service-archive"),
    path("ops/services/<uuid:pk>/mark-unavailable/",        views.ops_service_mark_unavailable,     name="ops-service-mark-unavailable"),
    path("ops/services/<uuid:pk>/reactivate/",              views.ops_service_reactivate,           name="ops-service-reactivate"),
    path("ops/services/<uuid:pk>/",                         views.OpsServiceDetailView.as_view(),   name="ops-service-detail"),

    # ── SLA Policy Management ─────────────────────────────────────
    path("ops/sla-policies/",                               views.OpsSLAPolicyListCreateView.as_view(), name="ops-sla-policy-list"),
    path("ops/sla-policies/<uuid:pk>/",                     views.OpsSLAPolicyDetailView.as_view(), name="ops-sla-policy-detail"),

    # ── Staff Invitations (Super Admin only) ──────────────────────
    # NOTE: action sub-paths must precede <uuid:invitation_id>/ if one is added later.
    path("ops/staff-invitations/",                          views.OpsStaffInvitationListCreateView.as_view(), name="ops-staff-invitation-list"),
    path("ops/staff-invitations/<uuid:invitation_id>/revoke/", views.staff_invitation_revoke,        name="ops-staff-invitation-revoke"),
    path("ops/staff-invitations/<uuid:invitation_id>/resend/", views.staff_invitation_resend,        name="ops-staff-invitation-resend"),

    # ── Ops: Payments (Finance Manager write; Ops Manager read) ───
    path("ops/payments/summary/",                           views.ops_payment_summary,              name="ops-payment-summary"),
    path("ops/payments/<uuid:pk>/confirm/",                 views.ops_payment_confirm,              name="ops-payment-confirm"),
    path("ops/payments/<uuid:pk>/refund/",                  views.ops_payment_refund,               name="ops-payment-refund"),
    path("ops/payments/",                                   views.OpsPaymentListView.as_view(),     name="ops-payment-list"),

    # ── Ops: Payouts (Finance Manager write; Ops Manager read) ────
    path("ops/payouts/summary/",                            views.ops_payout_summary,               name="ops-payout-summary"),
    path("ops/payouts/<uuid:pk>/process/",                  views.ops_payout_process,               name="ops-payout-process"),
    path("ops/payouts/",                                    views.OpsPayoutListView.as_view(),      name="ops-payout-list"),

    # ── Ops: Ticket Escalation (Ops Manager + Support Agent + Super Admin) ──
    path("ops/tickets/<uuid:ticket_id>/escalate/",          views.ops_ticket_escalate,              name="ops-ticket-escalate"),

    # ── Ops: Command Center (all 4 staff roles) ────────────────────
    path("ops/command-center/",                             views.ops_command_center_core,          name="ops-command-center-core"),
    path("ops/command-center/live/",                        views.ops_command_center_live,          name="ops-command-center-live"),

    # ── Ops: Analytics (role-scoped) ──────────────────────────────
    path("ops/analytics/",                                  views.ops_analytics,                    name="ops-analytics"),
    path("ops/executive-analytics/",                        views.executive_analytics,              name="ops-executive-analytics"),

    # ── Knowledge Base ──────────────────────────────────────────
    path("kb/articles/",                                    views.KBArticleListCreateView.as_view(), name="kb-article-list"),
    path("kb/articles/<uuid:pk>/",                          views.KBArticleDetailView.as_view(),     name="kb-article-detail"),
    path("kb/categories/",                                  views.kb_categories,                     name="kb-categories"),
    path("tickets/<uuid:ticket_id>/kb-articles/",           views.ticket_kb_articles,                name="ticket-kb-articles"),
    path("tickets/<uuid:ticket_id>/kb-articles/<uuid:article_id>/link/", views.kb_link_article,       name="kb-article-link"),

    # ── AI Assistant (internal staff only) ────────────────────────
    path("tickets/<uuid:ticket_id>/ai-assistant/",          views.ai_assistant_view,                 name="ticket-ai-assistant"),
    path("tickets/<uuid:ticket_id>/ai-assistant/log-insert/", views.ai_assistant_log_insert,          name="ticket-ai-assistant-log-insert"),

    # ── Organizations & Multi-Tenant Management ────────────────────
    # NOTE: "mine/" and "invitations/..." must precede <uuid:org_id>/ so
    # Django doesn't try to parse those literal segments as a UUID.
    path("organizations/mine/",                             views.OrganizationMineView.as_view(),     name="organization-mine"),
    path("organizations/invitations/accept/",                views.invitation_accept,                 name="organization-invitation-accept"),
    path("organizations/invitations/<str:token>/",           views.invitation_preview,                name="organization-invitation-preview"),
    path("organizations/<uuid:org_id>/",                     views.OrganizationDetailView.as_view(),   name="organization-detail"),
    path("organizations/<uuid:org_id>/members/",             views.OrganizationMembershipListView.as_view(), name="organization-member-list"),
    path("organizations/<uuid:org_id>/members/<uuid:user_id>/", views.organization_membership_detail, name="organization-member-detail"),
    path("organizations/<uuid:org_id>/invitations/",         views.OrganizationInvitationListCreateView.as_view(), name="organization-invitation-list"),
    path("organizations/<uuid:org_id>/invitations/<uuid:invitation_id>/", views.organization_invitation_revoke, name="organization-invitation-revoke"),
    path("organizations/<uuid:org_id>/audit/",                views.OrganizationAuditLogListView.as_view(), name="organization-audit-log"),

    # ── Staff Invitations: public preview/accept ───────────────────
    # NOTE: "accept/" must precede <str:token>/ so Django doesn't try to
    # parse that literal segment as a token.
    path("staff-invitations/accept/",                        views.staff_invitation_accept,           name="staff-invitation-accept"),
    path("staff-invitations/<str:token>/",                    views.staff_invitation_preview,          name="staff-invitation-preview"),
]
