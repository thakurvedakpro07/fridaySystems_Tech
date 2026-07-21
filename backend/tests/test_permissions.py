"""
Comprehensive permission matrix tests.

Verifies that every role can access exactly the endpoints they are supposed
to, and is blocked from every endpoint they should not touch.

Permission matrix (✓ = allowed, ✗ = denied):

Endpoint                              Super  Ops   Finance Support Engineer Customer
                                      Admin  Mgr   Mgr     Agent
──────────────────────────────────────────────────────────────────────────────────
GET  /api/ops/tickets/                 ✓      ✓     ✓       ✓       ✗        ✗
POST /api/ops/tickets/{id}/assign/     ✓      ✓     ✗       ✓       ✗        ✗
POST /api/ops/tickets/{id}/unassign/   ✓      ✓     ✗       ✓       ✗        ✗
POST /api/ops/tickets/{id}/status/     ✓      ✓     ✗       ✓       ✗        ✗
POST /api/ops/tickets/{id}/escalate/   ✓      ✓     ✗       ✓       ✗        ✗
GET  /api/ops/tickets/{id}/history/    ✓      ✓     ✓       ✓       ✗        ✗
GET  /api/ops/dashboard/               ✓      ✓     ✓       ✓       ✗        ✗
GET  /api/ops/freelancers/             ✓      ✓     ✓       ✓       ✗        ✗
GET  /api/ops/payments/                ✓      ✓     ✓       ✗       ✗        ✗
POST /api/ops/payments/{id}/confirm/   ✓      ✗     ✓       ✗       ✗        ✗
POST /api/ops/payments/{id}/refund/    ✓      ✗     ✓       ✗       ✗        ✗
GET  /api/ops/payments/summary/        ✓      ✗     ✓       ✗       ✗        ✗
GET  /api/ops/services/                ✓      ✓     ✗       ✗       ✗        ✗
POST /api/ops/services/                ✓      ✓     ✗       ✗       ✗        ✗
GET  /api/ops/users/                   ✓      ✓     ✗       ✗       ✗        ✗
POST /api/ops/users/{id}/role/         ✓      ✗     ✗       ✗       ✗        ✗
POST /api/ops/users/{id}/deactivate/   ✓      ✗     ✗       ✗       ✗        ✗
GET  /api/ops/analytics/               ✓      ✓     ✓       ✓       ✗        ✗
GET  /api/admin/tickets/               ✓      ✗     ✗       ✗       ✗        ✗
POST /api/admin/tickets/{id}/assign/   ✓      ✗     ✗       ✗       ✗        ✗
POST /api/admin/tickets/{id}/status/   ✓      ✗     ✗       ✗       ✗        ✗
GET  /api/tickets/                     ✗      ✗     ✗       ✗       ✗        ✓
PATCH /api/tickets/{id}/               ✓*     ✗     ✗       ✗       ✗        ✓*
GET  /api/tickets/{id}/comments/       ✓      ✓     ✓       ✓       ✓**      ✓**
GET  /api/tickets/{id}/activity/       ✓      ✓     ✓       ✓       ✓**      ✓**
GET  /api/freelancer/payouts/          ✗      ✗     ✗       ✗       ✓***     ✗
GET  /api/freelancer/stats/            ✗      ✗     ✗       ✗       ✓***     ✗

*  = only own ticket for customer; all tickets for Super Admin
*** = engineer must be approved (onboarding_status="approved"); own payouts/stats only
** = only assigned ticket for engineer; own ticket for customer
"""

import uuid as uuid_lib
import pytest
from decimal import Decimal
from rest_framework.test import APIClient

from django.contrib.auth import get_user_model
from support_app.models import (
    Customer, Freelancer, Payment, Service, Ticket, TicketActivityLog
)

User = get_user_model()


# ── Test fixtures ─────────────────────────────────────────────────


def _user(email, role, is_staff=False):
    return User.objects.create_user(
        email=email, password="Pass123!", role=role, is_staff=is_staff
    )


def _client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@pytest.fixture
def super_admin(db):
    return _user("admin@perm.test", "admin", is_staff=True)


@pytest.fixture
def ops_manager(db):
    return _user("ops@perm.test", "operations_manager")


@pytest.fixture
def finance_manager(db):
    return _user("finance@perm.test", "finance_manager")


@pytest.fixture
def support_agent(db):
    return _user("support@perm.test", "support_agent")


@pytest.fixture
def engineer_user(db):
    u = _user("eng@perm.test", "freelancer")
    Freelancer.objects.create(user=u, onboarding_status="approved", active=True, skills="server_admin")
    return u


@pytest.fixture
def customer_user(db):
    u = _user("cust@perm.test", "customer")
    Customer.objects.create(user=u, company="Acme")
    return u


@pytest.fixture
def customer_b(db):
    u = _user("cust_b@perm.test", "customer")
    Customer.objects.create(user=u, company="Beta Corp")
    return u


@pytest.fixture
def open_ticket(db, customer_user):
    return Ticket.objects.create(
        customer=customer_user.customer_profile,
        title="Open ticket",
        service_type="server_admin",
        severity="medium",
        status="open",
    )


@pytest.fixture
def pending_payment_ticket(db, customer_user):
    return Ticket.objects.create(
        customer=customer_user.customer_profile,
        title="Pending payment ticket",
        service_type="server_admin",
        severity="low",
        status="pending_payment",
    )


@pytest.fixture
def payment(db, customer_user, open_ticket):
    return Payment.objects.create(
        customer=customer_user.customer_profile,
        ticket=open_ticket,
        amount=Decimal("299.00"),
        gst_amount=Decimal("53.82"),
        invoice_number=f"INV-PM-{uuid_lib.uuid4().hex[:8]}",
        payment_type="consulting_fee",
        gateway="razorpay",
        gateway_payment_id="pay_test_123",
        status="completed",
    )


@pytest.fixture
def assigned_ticket(db, customer_user, engineer_user):
    return Ticket.objects.create(
        customer=customer_user.customer_profile,
        title="Assigned ticket",
        service_type="server_admin",
        severity="low",
        status="assigned",
        assigned_to=engineer_user.freelancer_profile,
    )


# ── 1. Ticket management endpoints ───────────────────────────────
# Rule: Ops Manager + Support Agent + Super Admin only.
# Finance Manager is BLOCKED.


TICKET_MGMT_ENDPOINTS_POST = [
    "/api/ops/tickets/{}/assign/",
    "/api/ops/tickets/{}/unassign/",
    "/api/ops/tickets/{}/status/",
    "/api/ops/tickets/{}/escalate/",
]


@pytest.mark.django_db
@pytest.mark.parametrize("url_tpl", TICKET_MGMT_ENDPOINTS_POST)
def test_ticket_mgmt_ops_manager_allowed(ops_manager, open_ticket, url_tpl):
    url = url_tpl.format(open_ticket.id)
    resp = _client(ops_manager).post(url, {}, format="json")
    # 200/400 = reached view logic; 403 = permission denied (the bug)
    assert resp.status_code != 403, f"Ops Manager blocked from {url}: {resp.data}"


@pytest.mark.django_db
@pytest.mark.parametrize("url_tpl", TICKET_MGMT_ENDPOINTS_POST)
def test_ticket_mgmt_support_agent_allowed(support_agent, open_ticket, url_tpl):
    url = url_tpl.format(open_ticket.id)
    resp = _client(support_agent).post(url, {}, format="json")
    assert resp.status_code != 403, f"Support Agent blocked from {url}: {resp.data}"


@pytest.mark.django_db
@pytest.mark.parametrize("url_tpl", TICKET_MGMT_ENDPOINTS_POST)
def test_ticket_mgmt_super_admin_allowed(super_admin, open_ticket, url_tpl):
    url = url_tpl.format(open_ticket.id)
    resp = _client(super_admin).post(url, {}, format="json")
    assert resp.status_code != 403, f"Super Admin blocked from {url}: {resp.data}"


@pytest.mark.django_db
@pytest.mark.parametrize("url_tpl", TICKET_MGMT_ENDPOINTS_POST)
def test_ticket_mgmt_finance_manager_blocked(finance_manager, open_ticket, url_tpl):
    url = url_tpl.format(open_ticket.id)
    resp = _client(finance_manager).post(url, {}, format="json")
    assert resp.status_code == 403, (
        f"Finance Manager should be blocked from {url} (got {resp.status_code}): {resp.data}"
    )


@pytest.mark.django_db
@pytest.mark.parametrize("url_tpl", TICKET_MGMT_ENDPOINTS_POST)
def test_ticket_mgmt_engineer_blocked(engineer_user, open_ticket, url_tpl):
    url = url_tpl.format(open_ticket.id)
    resp = _client(engineer_user).post(url, {}, format="json")
    assert resp.status_code == 403, f"Engineer should be blocked from {url}"


@pytest.mark.django_db
@pytest.mark.parametrize("url_tpl", TICKET_MGMT_ENDPOINTS_POST)
def test_ticket_mgmt_customer_blocked(customer_user, open_ticket, url_tpl):
    url = url_tpl.format(open_ticket.id)
    resp = _client(customer_user).post(url, {}, format="json")
    assert resp.status_code == 403, f"Customer should be blocked from {url}"


@pytest.mark.django_db
def test_ticket_mgmt_unauthenticated_blocked(open_ticket):
    for url_tpl in TICKET_MGMT_ENDPOINTS_POST:
        url = url_tpl.format(open_ticket.id)
        resp = APIClient().post(url, {}, format="json")
        assert resp.status_code == 401, f"Unauthenticated should get 401 on {url}"


# ── 2. Ops status update (new endpoint) ──────────────────────────

@pytest.mark.django_db
def test_ops_status_update_support_agent_can_update_status(support_agent, open_ticket):
    """Support Agent must be able to update ticket status via the ops endpoint."""
    resp = _client(support_agent).post(
        f"/api/ops/tickets/{open_ticket.id}/status/",
        {"new_status": "in_progress"},
        format="json",
    )
    assert resp.status_code == 200, f"Support Agent should update status: {resp.data}"
    open_ticket.refresh_from_db()
    assert open_ticket.status == "in_progress"


@pytest.mark.django_db
def test_ops_status_update_ops_manager_allowed(ops_manager, open_ticket):
    resp = _client(ops_manager).post(
        f"/api/ops/tickets/{open_ticket.id}/status/",
        {"new_status": "in_progress"},
        format="json",
    )
    assert resp.status_code == 200


@pytest.mark.django_db
def test_ops_status_update_finance_manager_blocked(finance_manager, open_ticket):
    resp = _client(finance_manager).post(
        f"/api/ops/tickets/{open_ticket.id}/status/",
        {"new_status": "in_progress"},
        format="json",
    )
    assert resp.status_code == 403, "Finance Manager must not update ticket status"


# ── 3. Payment endpoints ─────────────────────────────────────────

@pytest.mark.django_db
def test_payment_refund_finance_manager_allowed(finance_manager, payment):
    """Finance Manager must be able to process refunds — was incorrectly blocked."""
    resp = _client(finance_manager).post(f"/api/ops/payments/{payment.id}/refund/")
    # 200/400/502 = reached view logic; 403 = still blocked (the bug)
    assert resp.status_code != 403, (
        f"Finance Manager must be allowed to refund payments (got 403). Bug: ops_payment_refund uses IsSuperAdmin."
    )


@pytest.mark.django_db
def test_payment_refund_super_admin_allowed(super_admin, payment):
    resp = _client(super_admin).post(f"/api/ops/payments/{payment.id}/refund/")
    assert resp.status_code != 403, "Super Admin must be able to refund"


@pytest.mark.django_db
def test_payment_refund_ops_manager_blocked(ops_manager, payment):
    resp = _client(ops_manager).post(f"/api/ops/payments/{payment.id}/refund/")
    assert resp.status_code == 403, "Ops Manager cannot process refunds"


@pytest.mark.django_db
def test_payment_refund_support_agent_blocked(support_agent, payment):
    resp = _client(support_agent).post(f"/api/ops/payments/{payment.id}/refund/")
    assert resp.status_code == 403, "Support Agent cannot process refunds"


@pytest.mark.django_db
def test_payment_refund_customer_blocked(customer_user, payment):
    resp = _client(customer_user).post(f"/api/ops/payments/{payment.id}/refund/")
    assert resp.status_code == 403, "Customer cannot process refunds"


@pytest.mark.django_db
def test_payment_confirm_finance_manager_allowed(finance_manager, pending_payment_ticket):
    """Finance Manager can confirm pending payments."""
    p = Payment.objects.create(
        customer=pending_payment_ticket.customer,
        ticket=pending_payment_ticket,
        amount=Decimal("299.00"),
        gst_amount=Decimal("53.82"),
        invoice_number=f"INV-FC-{uuid_lib.uuid4().hex[:8]}",
        payment_type="consulting_fee",
        gateway="razorpay",
        status="pending",
    )
    resp = _client(finance_manager).post(f"/api/ops/payments/{p.id}/confirm/")
    assert resp.status_code == 200, f"Finance Manager must confirm payments: {resp.data}"


@pytest.mark.django_db
def test_payment_confirm_ops_manager_blocked(ops_manager, pending_payment_ticket):
    """Ops Manager cannot confirm payments — finance-only action."""
    p = Payment.objects.create(
        customer=pending_payment_ticket.customer,
        ticket=pending_payment_ticket,
        amount=Decimal("299.00"),
        gst_amount=Decimal("53.82"),
        invoice_number=f"INV-OC-{uuid_lib.uuid4().hex[:8]}",
        payment_type="consulting_fee",
        gateway="razorpay",
        status="pending",
    )
    resp = _client(ops_manager).post(f"/api/ops/payments/{p.id}/confirm/")
    assert resp.status_code == 403, "Ops Manager must not confirm payments"


@pytest.mark.django_db
def test_payment_summary_finance_manager_allowed(finance_manager):
    resp = _client(finance_manager).get("/api/ops/payments/summary/")
    assert resp.status_code == 200


@pytest.mark.django_db
def test_payment_summary_ops_manager_blocked(ops_manager):
    resp = _client(ops_manager).get("/api/ops/payments/summary/")
    assert resp.status_code == 403, "Ops Manager must not see payment summary"


@pytest.mark.django_db
def test_payment_summary_support_agent_blocked(support_agent):
    resp = _client(support_agent).get("/api/ops/payments/summary/")
    assert resp.status_code == 403


@pytest.mark.django_db
def test_payment_list_support_agent_blocked(support_agent):
    """Support Agent cannot read payment records."""
    resp = _client(support_agent).get("/api/ops/payments/")
    assert resp.status_code == 403, "Support Agent must not access payment records"


@pytest.mark.django_db
def test_payment_list_ops_manager_allowed(ops_manager):
    resp = _client(ops_manager).get("/api/ops/payments/")
    assert resp.status_code == 200


@pytest.mark.django_db
def test_payment_list_finance_manager_allowed(finance_manager):
    resp = _client(finance_manager).get("/api/ops/payments/")
    assert resp.status_code == 200


# ── 4. Service management (Ops Manager + Super Admin only) ────────

@pytest.mark.django_db
def test_service_list_ops_manager_allowed(ops_manager):
    resp = _client(ops_manager).get("/api/ops/services/")
    assert resp.status_code == 200


@pytest.mark.django_db
def test_service_list_super_admin_allowed(super_admin):
    resp = _client(super_admin).get("/api/ops/services/")
    assert resp.status_code == 200


@pytest.mark.django_db
def test_service_list_finance_manager_blocked(finance_manager):
    resp = _client(finance_manager).get("/api/ops/services/")
    assert resp.status_code == 403, "Finance Manager cannot manage services/pricing"


@pytest.mark.django_db
def test_service_list_support_agent_blocked(support_agent):
    resp = _client(support_agent).get("/api/ops/services/")
    assert resp.status_code == 403, "Support Agent cannot manage services"


# ── 5. User management ────────────────────────────────────────────

@pytest.mark.django_db
def test_user_list_ops_manager_allowed(ops_manager):
    resp = _client(ops_manager).get("/api/ops/users/")
    assert resp.status_code == 200, "Ops Manager can view user list"


@pytest.mark.django_db
def test_user_list_finance_manager_blocked(finance_manager):
    resp = _client(finance_manager).get("/api/ops/users/")
    assert resp.status_code == 403, "Finance Manager cannot view user management"


@pytest.mark.django_db
def test_user_list_support_agent_blocked(support_agent):
    resp = _client(support_agent).get("/api/ops/users/")
    assert resp.status_code == 403, "Support Agent cannot view user management"


@pytest.mark.django_db
def test_role_change_ops_manager_blocked(ops_manager, customer_user):
    resp = _client(ops_manager).post(
        f"/api/ops/users/{customer_user.id}/role/",
        {"new_role": "support_agent"},
        format="json",
    )
    assert resp.status_code == 403, "Ops Manager must not change user roles"


@pytest.mark.django_db
def test_role_change_super_admin_allowed(super_admin, customer_user):
    resp = _client(super_admin).post(
        f"/api/ops/users/{customer_user.id}/role/",
        {"new_role": "support_agent"},
        format="json",
    )
    assert resp.status_code in (200, 400), f"Super Admin must be able to change roles: {resp.data}"


@pytest.mark.django_db
def test_deactivate_ops_manager_blocked(ops_manager, customer_user):
    resp = _client(ops_manager).post(f"/api/ops/users/{customer_user.id}/deactivate/")
    assert resp.status_code == 403, "Ops Manager must not deactivate users"


# ── 6. Admin-only endpoints ───────────────────────────────────────

ADMIN_ONLY_ENDPOINTS = [
    ("GET",  "/api/admin/tickets/"),
    ("POST", "/api/admin/tickets/{}/assign/"),
    ("POST", "/api/admin/tickets/{}/status/"),
    ("POST", "/api/admin/tickets/{}/unassign/"),
    ("GET",  "/api/admin/payments/"),
]


@pytest.mark.django_db
@pytest.mark.parametrize("method,url_tpl", ADMIN_ONLY_ENDPOINTS)
def test_admin_endpoint_ops_manager_blocked(ops_manager, open_ticket, method, url_tpl):
    url = url_tpl.format(open_ticket.id)
    resp = getattr(_client(ops_manager), method.lower())(url)
    assert resp.status_code == 403, f"Ops Manager must not access {url}"


@pytest.mark.django_db
@pytest.mark.parametrize("method,url_tpl", ADMIN_ONLY_ENDPOINTS)
def test_admin_endpoint_finance_manager_blocked(finance_manager, open_ticket, method, url_tpl):
    url = url_tpl.format(open_ticket.id)
    resp = getattr(_client(finance_manager), method.lower())(url)
    assert resp.status_code == 403, f"Finance Manager must not access {url}"


@pytest.mark.django_db
@pytest.mark.parametrize("method,url_tpl", ADMIN_ONLY_ENDPOINTS)
def test_admin_endpoint_support_agent_blocked(support_agent, open_ticket, method, url_tpl):
    url = url_tpl.format(open_ticket.id)
    resp = getattr(_client(support_agent), method.lower())(url)
    assert resp.status_code == 403, f"Support Agent must not access {url}"


@pytest.mark.django_db
@pytest.mark.parametrize("method,url_tpl", ADMIN_ONLY_ENDPOINTS)
def test_admin_endpoint_super_admin_allowed(super_admin, open_ticket, method, url_tpl):
    url = url_tpl.format(open_ticket.id)
    resp = getattr(_client(super_admin), method.lower())(url)
    # 200/400/404 = reached view logic; 403 = still incorrectly blocked
    assert resp.status_code != 403, f"Super Admin must access {url}: {resp.data}"


# ── 7. Customer data isolation ────────────────────────────────────

@pytest.mark.django_db
def test_customer_cannot_see_other_customer_ticket(customer_user, customer_b):
    """Customer A cannot read Customer B's ticket."""
    ticket_b = Ticket.objects.create(
        customer=customer_b.customer_profile,
        title="B ticket",
        service_type="server_admin",
        severity="low",
        status="open",
    )
    resp = _client(customer_user).get(f"/api/tickets/{ticket_b.id}/")
    assert resp.status_code in (403, 404), (
        "Customer A must not access Customer B's ticket"
    )


@pytest.mark.django_db
def test_customer_can_see_own_ticket(customer_user, open_ticket):
    resp = _client(customer_user).get(f"/api/tickets/{open_ticket.id}/")
    assert resp.status_code == 200


@pytest.mark.django_db
def test_customer_ticket_list_only_own(customer_user, customer_b):
    """Customer's ticket list contains only their own tickets."""
    Ticket.objects.create(
        customer=customer_b.customer_profile,
        title="B ticket",
        service_type="server_admin",
        severity="low",
        status="open",
    )
    mine = Ticket.objects.create(
        customer=customer_user.customer_profile,
        title="Mine",
        service_type="server_admin",
        severity="low",
        status="open",
    )
    resp = _client(customer_user).get("/api/tickets/")
    assert resp.status_code == 200
    # Handle both paginated and non-paginated responses
    tickets = resp.data.get("results", resp.data) if isinstance(resp.data, dict) else resp.data
    ids = {t["id"] for t in tickets}
    assert str(mine.id) in ids, "Customer should see own ticket"
    # Customer B's ticket must NOT appear in customer A's list
    b_ticket_ids = set(
        str(t.id) for t in Ticket.objects.filter(customer=customer_b.customer_profile)
    )
    assert not ids.intersection(b_ticket_ids), "Customer must not see another customer's tickets"


@pytest.mark.django_db
def test_customer_cannot_patch_another_customers_ticket(customer_user, customer_b):
    ticket_b = Ticket.objects.create(
        customer=customer_b.customer_profile,
        title="B ticket",
        service_type="server_admin",
        severity="low",
        status="pending_payment",
    )
    resp = _client(customer_user).patch(
        f"/api/tickets/{ticket_b.id}/",
        {"severity": "high"},
        format="json",
    )
    assert resp.status_code in (403, 404), "Customer must not patch another customer's ticket"


# ── 8. Engineer ticket isolation ──────────────────────────────────

@pytest.mark.django_db
def test_engineer_can_see_assigned_ticket(engineer_user, assigned_ticket):
    resp = _client(engineer_user).get(f"/api/freelancer/tickets/{assigned_ticket.id}/")
    assert resp.status_code == 200


@pytest.mark.django_db
def test_engineer_cannot_see_unassigned_ticket(engineer_user, open_ticket):
    """Engineer cannot see a ticket not assigned to them."""
    resp = _client(engineer_user).get(f"/api/freelancer/tickets/{open_ticket.id}/")
    assert resp.status_code in (403, 404), (
        "Engineer must not access tickets not assigned to them"
    )


@pytest.mark.django_db
def test_engineer_freelancer_list_only_assigned(engineer_user, open_ticket, assigned_ticket):
    """Freelancer ticket list contains only the engineer's assigned tickets."""
    resp = _client(engineer_user).get("/api/freelancer/tickets/")
    assert resp.status_code == 200
    tickets = resp.data.get("results", resp.data) if isinstance(resp.data, dict) else resp.data
    ids = {t["id"] for t in tickets}
    assert str(assigned_ticket.id) in ids, "Engineer should see their assigned ticket"
    assert str(open_ticket.id) not in ids, "Engineer must not see unassigned tickets"


@pytest.mark.django_db
def test_engineer_cannot_access_ops_ticket_list(engineer_user):
    resp = _client(engineer_user).get("/api/ops/tickets/")
    assert resp.status_code == 403, "Engineer must not access the ops ticket queue"


@pytest.mark.django_db
def test_engineer_can_access_own_payouts(engineer_user):
    resp = _client(engineer_user).get("/api/freelancer/payouts/")
    assert resp.status_code == 200


@pytest.mark.django_db
def test_unapproved_engineer_cannot_access_payouts(db):
    u = _user("pending-eng@perm.test", "freelancer")
    Freelancer.objects.create(user=u, onboarding_status="pending", active=True)
    resp = _client(u).get("/api/freelancer/payouts/")
    assert resp.status_code == 403


@pytest.mark.django_db
@pytest.mark.parametrize(
    "role_fixture", ["super_admin", "ops_manager", "finance_manager", "support_agent", "customer_user"]
)
def test_non_engineer_roles_cannot_access_freelancer_payouts(request, role_fixture):
    user = request.getfixturevalue(role_fixture)
    resp = _client(user).get("/api/freelancer/payouts/")
    assert resp.status_code == 403, f"{role_fixture} must not access freelancer payouts"


@pytest.mark.django_db
def test_engineer_can_access_own_stats(engineer_user):
    resp = _client(engineer_user).get("/api/freelancer/stats/")
    assert resp.status_code == 200


@pytest.mark.django_db
@pytest.mark.parametrize(
    "role_fixture", ["super_admin", "ops_manager", "finance_manager", "support_agent", "customer_user"]
)
def test_non_engineer_roles_cannot_access_freelancer_stats(request, role_fixture):
    user = request.getfixturevalue(role_fixture)
    resp = _client(user).get("/api/freelancer/stats/")
    assert resp.status_code == 403, f"{role_fixture} must not access freelancer stats"


# ── 9. Customer cannot access ops/admin endpoints ────────────────

@pytest.mark.django_db
def test_customer_cannot_access_ops_dashboard(customer_user):
    resp = _client(customer_user).get("/api/ops/dashboard/")
    assert resp.status_code == 403


@pytest.mark.django_db
def test_customer_cannot_access_ops_ticket_queue(customer_user):
    resp = _client(customer_user).get("/api/ops/tickets/")
    assert resp.status_code == 403


@pytest.mark.django_db
def test_customer_cannot_access_payment_list(customer_user):
    resp = _client(customer_user).get("/api/ops/payments/")
    assert resp.status_code == 403


# ── 10. Ops endpoints visible to all four staff roles ─────────────

@pytest.mark.django_db
@pytest.mark.parametrize("role_fixture", ["ops_manager", "finance_manager", "support_agent"])
def test_ops_dashboard_all_staff_roles(request, role_fixture, super_admin):
    user = request.getfixturevalue(role_fixture)
    resp = _client(user).get("/api/ops/dashboard/")
    assert resp.status_code == 200, f"{role_fixture} must access ops dashboard"


@pytest.mark.django_db
@pytest.mark.parametrize("role_fixture", ["ops_manager", "finance_manager", "support_agent"])
def test_ops_ticket_list_all_staff_roles(request, role_fixture):
    user = request.getfixturevalue(role_fixture)
    resp = _client(user).get("/api/ops/tickets/")
    assert resp.status_code == 200, f"{role_fixture} must access ops ticket list"


@pytest.mark.django_db
@pytest.mark.parametrize("role_fixture", ["ops_manager", "finance_manager", "support_agent"])
def test_ops_analytics_all_staff_roles(request, role_fixture):
    user = request.getfixturevalue(role_fixture)
    resp = _client(user).get("/api/ops/analytics/")
    assert resp.status_code == 200, f"{role_fixture} must access ops analytics"


# ── 11. Finance endpoint security ────────────────────────────────

@pytest.mark.django_db
def test_finance_analytics_ops_manager_read_scope(ops_manager):
    """Ops Manager can access analytics but receives operational data only, not financial."""
    resp = _client(ops_manager).get("/api/ops/analytics/")
    assert resp.status_code == 200
    data = resp.data
    # Financial section should be absent for Ops Manager
    assert "total_revenue" not in data, "Ops Manager must not receive financial revenue data"
    assert "payment_type_breakdown" not in data


@pytest.mark.django_db
def test_finance_analytics_finance_manager_financial_scope(finance_manager):
    """Finance Manager receives financial data from ops analytics."""
    resp = _client(finance_manager).get("/api/ops/analytics/")
    assert resp.status_code == 200
    data = resp.data
    # Analytics response nests financial data under a "financial" key
    financial = data.get("financial", data)
    assert "total_revenue" in financial, (
        f"Finance Manager must receive revenue data. Got keys: {list(data.keys())}"
    )


@pytest.mark.django_db
def test_ops_dashboard_hides_revenue_from_support_agent(support_agent):
    """Revenue field must be absent from ops dashboard response for Support Agents."""
    resp = _client(support_agent).get("/api/ops/dashboard/")
    assert resp.status_code == 200
    assert "revenue" not in resp.data, "Support Agent must not see revenue in dashboard"


@pytest.mark.django_db
def test_ops_dashboard_shows_revenue_to_finance_manager(finance_manager):
    resp = _client(finance_manager).get("/api/ops/dashboard/")
    assert resp.status_code == 200
    assert "revenue" in resp.data, "Finance Manager must see revenue in dashboard"


# ── 12. TicketDetailView PATCH — customer-only write ─────────────

@pytest.mark.django_db
def test_ticket_patch_customer_allowed(customer_user, pending_payment_ticket):
    """Customers can patch their own ticket's fields before it's processed."""
    resp = _client(customer_user).patch(
        f"/api/tickets/{pending_payment_ticket.id}/",
        {"severity": "high"},
        format="json",
    )
    assert resp.status_code == 200


@pytest.mark.django_db
def test_ticket_patch_ops_manager_blocked(ops_manager, open_ticket):
    """Ops Manager manages tickets through /api/ops/ endpoints, not the customer endpoint."""
    resp = _client(ops_manager).patch(
        f"/api/tickets/{open_ticket.id}/",
        {"severity": "high"},
        format="json",
    )
    assert resp.status_code == 403, "Ops Manager must use /api/ops/tickets/ for management"


@pytest.mark.django_db
def test_ticket_patch_finance_manager_blocked(finance_manager, open_ticket):
    resp = _client(finance_manager).patch(
        f"/api/tickets/{open_ticket.id}/",
        {"severity": "high"},
        format="json",
    )
    assert resp.status_code == 403, "Finance Manager must not modify ticket fields"


@pytest.mark.django_db
def test_ticket_patch_support_agent_blocked(support_agent, open_ticket):
    resp = _client(support_agent).patch(
        f"/api/tickets/{open_ticket.id}/",
        {"severity": "high"},
        format="json",
    )
    assert resp.status_code == 403, "Support Agent must use /api/ops/tickets/ for management"


@pytest.mark.django_db
def test_ticket_patch_super_admin_allowed(super_admin, open_ticket):
    resp = _client(super_admin).patch(
        f"/api/tickets/{open_ticket.id}/",
        {"severity": "high"},
        format="json",
    )
    assert resp.status_code == 200, "Super Admin can patch any ticket"


# ── 13. Comments and activity visibility ─────────────────────────

@pytest.mark.django_db
def test_staff_can_view_any_ticket_comments(ops_manager, open_ticket):
    resp = _client(ops_manager).get(f"/api/tickets/{open_ticket.id}/comments/")
    assert resp.status_code == 200


@pytest.mark.django_db
def test_staff_can_view_any_ticket_activity(finance_manager, open_ticket):
    resp = _client(finance_manager).get(f"/api/tickets/{open_ticket.id}/activity/")
    assert resp.status_code == 200


@pytest.mark.django_db
def test_customer_can_view_own_ticket_comments(customer_user, open_ticket):
    resp = _client(customer_user).get(f"/api/tickets/{open_ticket.id}/comments/")
    assert resp.status_code == 200


@pytest.mark.django_db
def test_customer_cannot_view_another_tickets_comments(customer_user, customer_b):
    ticket_b = Ticket.objects.create(
        customer=customer_b.customer_profile,
        title="B ticket",
        service_type="server_admin",
        severity="low",
        status="open",
    )
    resp = _client(customer_user).get(f"/api/tickets/{ticket_b.id}/comments/")
    assert resp.status_code in (403, 404)


@pytest.mark.django_db
def test_engineer_can_view_assigned_ticket_comments(engineer_user, assigned_ticket):
    resp = _client(engineer_user).get(f"/api/tickets/{assigned_ticket.id}/comments/")
    assert resp.status_code == 200


@pytest.mark.django_db
def test_engineer_cannot_view_unassigned_ticket_comments(engineer_user, open_ticket):
    resp = _client(engineer_user).get(f"/api/tickets/{open_ticket.id}/comments/")
    assert resp.status_code in (403, 404)


# ── 14. Invoice access control ────────────────────────────────────

@pytest.mark.django_db
def test_customer_can_download_own_invoice(customer_user, payment):
    resp = _client(customer_user).get(f"/api/payments/{payment.id}/invoice/")
    # 200 = PDF returned; 404 if no PDF template — either way, not 403
    assert resp.status_code != 403, "Customer must download own invoice"


@pytest.mark.django_db
def test_customer_cannot_download_another_invoice(customer_user, customer_b, open_ticket):
    ticket_b = Ticket.objects.create(
        customer=customer_b.customer_profile,
        title="B ticket",
        service_type="server_admin",
        severity="low",
        status="open",
    )
    payment_b = Payment.objects.create(
        customer=customer_b.customer_profile,
        ticket=ticket_b,
        amount=Decimal("299.00"),
        gst_amount=Decimal("53.82"),
        invoice_number=f"INV-CB-{uuid_lib.uuid4().hex[:8]}",
        payment_type="consulting_fee",
        gateway="razorpay",
        status="completed",
    )
    resp = _client(customer_user).get(f"/api/payments/{payment_b.id}/invoice/")
    assert resp.status_code in (403, 404), "Customer must not download another customer's invoice"


# ── 15. Unauthenticated access ───────────────────────────────────

PROTECTED_ENDPOINTS = [
    ("GET",  "/api/ops/dashboard/"),
    ("GET",  "/api/ops/tickets/"),
    ("GET",  "/api/ops/payments/"),
    ("GET",  "/api/ops/users/"),
    ("GET",  "/api/tickets/"),
    ("GET",  "/api/admin/tickets/"),
]


@pytest.mark.django_db
@pytest.mark.parametrize("method,url", PROTECTED_ENDPOINTS)
def test_unauthenticated_blocked_from_protected_endpoints(method, url):
    resp = getattr(APIClient(), method.lower())(url)
    assert resp.status_code == 401, f"Unauthenticated must not access {url}"
