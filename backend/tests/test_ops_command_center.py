"""
Tests for the Operations Command Center endpoints:
  GET /api/ops/command-center/       (ops_command_center_core)
  GET /api/ops/command-center/live/  (ops_command_center_live)

Access: all 4 internal staff roles (IsAnyStaffRole) — Super Admin,
Operations Manager, Finance Manager, Support Agent.
"""
import datetime

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from support_app.models import Customer, Freelancer, Ticket, TicketActivityLog
from support_app.services import service_catalog

User = get_user_model()

CORE_URL = "/api/ops/command-center/"
LIVE_URL = "/api/ops/command-center/live/"


def _user(email, role, is_staff=False):
    return User.objects.create_user(email=email, password="Pass123!", role=role, is_staff=is_staff)


def _client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def _make_ticket(customer, **kwargs):
    defaults = dict(
        title="Test ticket",
        service_type="server_admin",
        severity="medium",
        status="open",
    )
    defaults.update(kwargs)
    return Ticket.objects.create(customer=customer, **defaults)


def _log(ticket, action, actor=None, created_at=None):
    """Create a TicketActivityLog row, optionally backdated (bypassing
    auto_now_add via .update(), same pattern as seed_demo_data.py) so
    escalation-supersession / activity-window tests aren't timing-flaky."""
    entry = TicketActivityLog.objects.create(ticket=ticket, actor=actor, action=action)
    if created_at is not None:
        TicketActivityLog.objects.filter(pk=entry.pk).update(created_at=created_at)
    return entry


@pytest.fixture
def super_admin(db):
    return _user("admin@occ.test", "admin", is_staff=True)


@pytest.fixture
def ops_manager(db):
    return _user("ops@occ.test", "operations_manager")


@pytest.fixture
def finance_manager(db):
    return _user("finance@occ.test", "finance_manager")


@pytest.fixture
def support_agent(db):
    return _user("support@occ.test", "support_agent")


@pytest.fixture
def engineer_user(db):
    u = _user("eng@occ.test", "freelancer")
    Freelancer.objects.create(user=u, onboarding_status="approved", active=True, skills="server_admin")
    return u


@pytest.fixture
def customer_user(db):
    u = _user("cust@occ.test", "customer")
    Customer.objects.create(user=u, company="Acme OCC")
    return u


# ── Access control ──────────────────────────────────────────────


@pytest.mark.django_db
@pytest.mark.parametrize("url", [CORE_URL, LIVE_URL])
@pytest.mark.parametrize(
    "role_fixture", ["super_admin", "ops_manager", "finance_manager", "support_agent"]
)
def test_all_staff_roles_get_200(request, role_fixture, url):
    user = request.getfixturevalue(role_fixture)
    resp = _client(user).get(url)
    assert resp.status_code == 200


@pytest.mark.django_db
@pytest.mark.parametrize("url", [CORE_URL, LIVE_URL])
@pytest.mark.parametrize("role_fixture", ["customer_user", "engineer_user"])
def test_non_staff_roles_get_403(request, role_fixture, url):
    user = request.getfixturevalue(role_fixture)
    resp = _client(user).get(url)
    assert resp.status_code == 403


@pytest.mark.django_db
@pytest.mark.parametrize("url", [CORE_URL, LIVE_URL])
def test_anonymous_gets_401(api_client, url):
    resp = api_client.get(url)
    assert resp.status_code == 401


# ── Payload shape ──────────────────────────────────────────────


@pytest.mark.django_db
def test_core_payload_has_expected_top_level_keys(super_admin):
    resp = _client(super_admin).get(CORE_URL)
    assert resp.status_code == 200
    for key in [
        "escalation_queue", "engineer_capacity", "service_health",
        "critical_customers", "ticket_flow", "generated_at",
    ]:
        assert key in resp.data, f"missing '{key}' in core payload"


@pytest.mark.django_db
def test_live_payload_has_expected_top_level_keys(super_admin):
    resp = _client(super_admin).get(LIVE_URL)
    assert resp.status_code == 200
    for key in ["incident_queue", "sla_risk_board", "activity_timeline", "generated_at"]:
        assert key in resp.data, f"missing '{key}' in live payload"


# ── Live Incident Queue ──────────────────────────────────────────


@pytest.mark.django_db
def test_incident_queue_only_includes_open_critical_or_high(super_admin, customer_user):
    cust = customer_user.customer_profile
    critical_open = _make_ticket(cust, severity="critical", status="open")
    high_assigned = _make_ticket(cust, severity="high", status="assigned")
    _make_ticket(cust, severity="medium", status="open")               # excluded: not critical/high
    _make_ticket(cust, severity="critical", status="closed")           # excluded: not active
    _make_ticket(cust, severity="critical", status="pending_payment")  # excluded: not active

    resp = _client(super_admin).get(LIVE_URL)
    assert resp.status_code == 200
    ids = {row["id"] for row in resp.data["incident_queue"]}
    assert str(critical_open.id) in ids
    assert str(high_assigned.id) in ids
    assert len(ids) == 2


@pytest.mark.django_db
def test_incident_queue_orders_critical_before_high(super_admin, customer_user):
    cust = customer_user.customer_profile
    now = timezone.now()
    high = _make_ticket(cust, severity="high", status="open", due_at=now + datetime.timedelta(hours=1))
    critical = _make_ticket(cust, severity="critical", status="open", due_at=now + datetime.timedelta(days=1))

    resp = _client(super_admin).get(LIVE_URL)
    ids = [row["id"] for row in resp.data["incident_queue"]]
    assert ids.index(str(critical.id)) < ids.index(str(high.id))


# ── SLA Risk Board ────────────────────────────────────────────────


@pytest.mark.django_db
def test_sla_risk_board_includes_overdue_and_near_term_only(super_admin, customer_user):
    cust = customer_user.customer_profile
    now = timezone.now()
    overdue = _make_ticket(cust, status="open", due_at=now - datetime.timedelta(hours=1))
    near_term = _make_ticket(cust, status="in_progress", due_at=now + datetime.timedelta(hours=1))
    far_out = _make_ticket(cust, status="open", due_at=now + datetime.timedelta(hours=10))
    no_deadline = _make_ticket(cust, status="open", due_at=None)
    closed_overdue = _make_ticket(cust, status="closed", due_at=now - datetime.timedelta(hours=1))

    resp = _client(super_admin).get(LIVE_URL)
    ids = {row["id"] for row in resp.data["sla_risk_board"]}
    assert str(overdue.id) in ids
    assert str(near_term.id) in ids
    assert str(far_out.id) not in ids
    assert str(no_deadline.id) not in ids
    assert str(closed_overdue.id) not in ids


@pytest.mark.django_db
def test_sla_risk_board_orders_soonest_due_first(super_admin, customer_user):
    cust = customer_user.customer_profile
    now = timezone.now()
    later = _make_ticket(cust, status="open", due_at=now + datetime.timedelta(hours=3))
    sooner = _make_ticket(cust, status="open", due_at=now + datetime.timedelta(hours=1))

    resp = _client(super_admin).get(LIVE_URL)
    ids = [row["id"] for row in resp.data["sla_risk_board"]]
    assert ids.index(str(sooner.id)) < ids.index(str(later.id))


# ── Escalation Queue ──────────────────────────────────────────────


@pytest.mark.django_db
def test_escalation_queue_includes_ticket_with_latest_escalated_action(super_admin, customer_user):
    cust = customer_user.customer_profile
    ticket = _make_ticket(cust, status="in_progress")
    _log(ticket, "escalated")

    resp = _client(super_admin).get(CORE_URL)
    ids = {row["id"] for row in resp.data["escalation_queue"]}
    assert str(ticket.id) in ids


@pytest.mark.django_db
def test_escalation_queue_excludes_ticket_superseded_by_later_action(super_admin, customer_user):
    """A later non-escalation activity (status_changed/comment_added) means
    the ticket is no longer purely 'awaiting escalation action' — matches
    ReplyOwnershipSignalsMixin.get_waiting_on_internal()'s exact semantics."""
    cust = customer_user.customer_profile
    ticket = _make_ticket(cust, status="in_progress")
    now = timezone.now()
    _log(ticket, "escalated", created_at=now - datetime.timedelta(hours=1))
    _log(ticket, "status_changed", created_at=now)

    resp = _client(super_admin).get(CORE_URL)
    ids = {row["id"] for row in resp.data["escalation_queue"]}
    assert str(ticket.id) not in ids


@pytest.mark.django_db
def test_escalation_queue_excludes_closed_tickets(super_admin, customer_user):
    cust = customer_user.customer_profile
    ticket = _make_ticket(cust, status="closed")
    _log(ticket, "escalated")

    resp = _client(super_admin).get(CORE_URL)
    ids = {row["id"] for row in resp.data["escalation_queue"]}
    assert str(ticket.id) not in ids


# ── Engineer Capacity ──────────────────────────────────────────────


@pytest.mark.django_db
def test_engineer_capacity_utilization_math_and_over_capacity_flag(super_admin, customer_user):
    cust = customer_user.customer_profile
    eng_user = _user("busy@occ.test", "freelancer")
    freelancer = Freelancer.objects.create(
        user=eng_user, onboarding_status="approved", active=True,
        availability="ad_hoc", skills="server_admin",  # capacity = 2
    )
    for _ in range(3):
        _make_ticket(cust, status="assigned", assigned_to=freelancer)

    resp = _client(super_admin).get(CORE_URL)
    row = next(r for r in resp.data["engineer_capacity"] if r["id"] == str(freelancer.id))
    assert row["active_ticket_count"] == 3
    assert row["utilization_pct"] == 150.0
    assert row["over_capacity"] is True


@pytest.mark.django_db
def test_engineer_capacity_unavailable_tier_has_no_divide_by_zero(super_admin):
    eng_user = _user("idle@occ.test", "freelancer")
    freelancer = Freelancer.objects.create(
        user=eng_user, onboarding_status="approved", active=True,
        availability="unavailable", skills="server_admin",
    )

    resp = _client(super_admin).get(CORE_URL)
    row = next(r for r in resp.data["engineer_capacity"] if r["id"] == str(freelancer.id))
    assert row["utilization_pct"] is None
    assert row["over_capacity"] is False


# ── Service Health ──────────────────────────────────────────────────


@pytest.mark.django_db
def test_service_health_breach_rate_and_tone(super_admin, customer_user):
    cust = customer_user.customer_profile
    now = timezone.now()
    # 3 resolved "aws" tickets: 1 met, 2 missed -> breach_rate_pct = 66.7 -> "critical" (>=30%)
    _make_ticket(
        cust, service_type="aws", status="resolved",
        due_at=now + datetime.timedelta(hours=2), resolved_at=now,
    )
    _make_ticket(
        cust, service_type="aws", status="resolved",
        due_at=now - datetime.timedelta(hours=2), resolved_at=now,
    )
    _make_ticket(
        cust, service_type="aws", status="resolved",
        due_at=now - datetime.timedelta(hours=1), resolved_at=now,
    )

    resp = _client(super_admin).get(CORE_URL)
    row = next(r for r in resp.data["service_health"] if r["service_type"] == "aws")
    assert row["breach_rate_pct"] == 66.7
    assert row["status"] == "critical"


@pytest.mark.django_db
def test_service_health_labels_come_from_service_catalog_not_hardcoded(super_admin, customer_user):
    cust = customer_user.customer_profile
    _make_ticket(cust, service_type="kubernetes", status="open")

    resp = _client(super_admin).get(CORE_URL)
    row = next(r for r in resp.data["service_health"] if r["service_type"] == "kubernetes")
    expected_label = next(s["name"] for s in service_catalog.SERVICE_CATALOG if s["key"] == "kubernetes")
    assert row["label"] == expected_label


# ── Critical Customers ────────────────────────────────────────────


@pytest.mark.django_db
def test_critical_customers_includes_only_currently_affected(super_admin):
    now = timezone.now()

    at_risk_user = _user("atrisk@occ.test", "customer")
    at_risk = Customer.objects.create(user=at_risk_user, company="AtRisk Co")
    _make_ticket(at_risk, severity="critical", status="open")

    breaching_user = _user("breach@occ.test", "customer")
    breaching = Customer.objects.create(user=breaching_user, company="Breach Co")
    _make_ticket(breaching, severity="low", status="in_progress", due_at=now - datetime.timedelta(hours=1))

    safe_user = _user("safe@occ.test", "customer")
    safe = Customer.objects.create(user=safe_user, company="Safe Co")
    _make_ticket(safe, severity="low", status="open")  # not critical/high, not overdue -> excluded

    closed_only_user = _user("closedonly@occ.test", "customer")
    closed_only = Customer.objects.create(user=closed_only_user, company="Closed Co")
    _make_ticket(closed_only, severity="critical", status="closed")  # only a closed ticket -> excluded

    resp = _client(super_admin).get(CORE_URL)
    names = {row["name"] for row in resp.data["critical_customers"]}
    assert "AtRisk Co" in names
    assert "Breach Co" in names
    assert "Safe Co" not in names
    assert "Closed Co" not in names


# ── Ticket Flow ──────────────────────────────────────────────────────


@pytest.mark.django_db
def test_ticket_flow_counts_within_window_only(super_admin, customer_user):
    cust = customer_user.customer_profile
    now = timezone.now()
    inside = _make_ticket(cust, status="open")
    Ticket.objects.filter(pk=inside.pk).update(created_at=now - datetime.timedelta(hours=2))

    outside = _make_ticket(cust, status="open")
    Ticket.objects.filter(pk=outside.pk).update(created_at=now - datetime.timedelta(hours=30))

    resp = _client(super_admin).get(CORE_URL)
    flow = resp.data["ticket_flow"]
    assert flow["window_hours"] == 24
    assert flow["created_count"] == 1
    assert set(flow["by_status"].keys()) == {c[0] for c in Ticket.STATUS_CHOICES}


# ── Activity Timeline ────────────────────────────────────────────────


@pytest.mark.django_db
def test_activity_timeline_filters_by_window_and_orders_newest_first(super_admin, customer_user):
    cust = customer_user.customer_profile
    ticket = _make_ticket(cust, status="open")
    now = timezone.now()

    recent = _log(ticket, "comment_added", created_at=now - datetime.timedelta(minutes=10))
    older_but_still_recent = _log(ticket, "status_changed", created_at=now - datetime.timedelta(minutes=30))
    outside_window = _log(ticket, "resolved", created_at=now - datetime.timedelta(hours=6))

    resp = _client(super_admin).get(LIVE_URL)
    ids = [row["id"] for row in resp.data["activity_timeline"]]
    assert str(recent.id) in ids
    assert str(older_but_still_recent.id) in ids
    assert str(outside_window.id) not in ids
    assert ids.index(str(recent.id)) < ids.index(str(older_but_still_recent.id))


@pytest.mark.django_db
def test_activity_timeline_rows_include_ticket_reference(super_admin, customer_user):
    cust = customer_user.customer_profile
    ticket = _make_ticket(cust, status="open", title="Timeline Test Ticket")
    entry = _log(ticket, "comment_added")

    resp = _client(super_admin).get(LIVE_URL)
    row = next(r for r in resp.data["activity_timeline"] if r["id"] == str(entry.id))
    assert row["ticket_id"] == str(ticket.id)
    assert row["ticket_number"] == ticket.ticket_number
    assert row["ticket_title"] == "Timeline Test Ticket"


# ── OpsTicketListSerializer field extension ──────────────────────────


@pytest.mark.django_db
def test_ops_ticket_list_exposes_reply_ownership_signals(super_admin, customer_user):
    cust = customer_user.customer_profile
    ticket = _make_ticket(cust, status="in_progress")
    _log(ticket, "escalated")

    resp = _client(super_admin).get("/api/ops/tickets/")
    assert resp.status_code == 200
    results = resp.data["results"] if isinstance(resp.data, dict) and "results" in resp.data else resp.data
    row = next(r for r in results if r["id"] == str(ticket.id))
    for field in [
        "waiting_on_customer", "awaiting_engineer_reply",
        "waiting_on_internal", "last_public_comment_at", "escalated_at",
    ]:
        assert field in row
    assert row["waiting_on_internal"] is True
