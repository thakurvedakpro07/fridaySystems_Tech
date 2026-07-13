"""
Tests for the Executive Analytics endpoint (GET /api/ops/executive-analytics/).

Access: Super Admin, Operations Manager, Finance Manager only (IsExecutiveAnalytics).
"""
import datetime

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from support_app.models import Customer, Freelancer, Ticket
from support_app.services import service_catalog

User = get_user_model()

URL = "/api/ops/executive-analytics/"


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


@pytest.fixture
def super_admin(db):
    return _user("admin@execan.test", "admin", is_staff=True)


@pytest.fixture
def ops_manager(db):
    return _user("ops@execan.test", "operations_manager")


@pytest.fixture
def finance_manager(db):
    return _user("finance@execan.test", "finance_manager")


@pytest.fixture
def support_agent(db):
    return _user("support@execan.test", "support_agent")


@pytest.fixture
def engineer_user(db):
    u = _user("eng@execan.test", "freelancer")
    Freelancer.objects.create(user=u, onboarding_status="approved", active=True, skills="server_admin")
    return u


@pytest.fixture
def customer_user(db):
    u = _user("cust@execan.test", "customer")
    Customer.objects.create(user=u, company="Acme Execan")
    return u


# ── Access control ──────────────────────────────────────────────


@pytest.mark.django_db
@pytest.mark.parametrize("role_fixture", ["super_admin", "ops_manager", "finance_manager"])
def test_allowed_roles_get_200(request, role_fixture):
    user = request.getfixturevalue(role_fixture)
    resp = _client(user).get(URL)
    assert resp.status_code == 200


@pytest.mark.django_db
@pytest.mark.parametrize("role_fixture", ["support_agent", "engineer_user", "customer_user"])
def test_disallowed_roles_get_403(request, role_fixture):
    user = request.getfixturevalue(role_fixture)
    resp = _client(user).get(URL)
    assert resp.status_code == 403


@pytest.mark.django_db
def test_anonymous_gets_401(api_client):
    resp = api_client.get(URL)
    assert resp.status_code == 401


# ── Payload shape ────────────────────────────────────────────────


@pytest.mark.django_db
def test_payload_has_expected_top_level_sections(super_admin):
    resp = _client(super_admin).get(URL)
    assert resp.status_code == 200
    for key in [
        "period", "summary", "operational_health", "sla", "engineer_utilization",
        "ticket_aging", "priority_distribution", "service_category_distribution",
        "csat", "top_problem_categories", "recently_breached_tickets",
        "most_active_customers", "revenue",
    ]:
        assert key in resp.data, f"missing '{key}' in payload"


# ── SLA compliance correctness ───────────────────────────────────
# SLALog never records a "met" event (see sla_service.py), so compliance
# must be derived from Ticket.resolved_at vs due_at directly.


@pytest.mark.django_db
def test_ticket_resolved_before_due_at_counts_as_sla_met(super_admin, customer_user):
    now = timezone.now()
    ticket = _make_ticket(
        customer_user.customer_profile,
        status="resolved",
        due_at=now + datetime.timedelta(hours=2),
        resolved_at=now,
    )

    resp = _client(super_admin).get(URL, {"period": "7d"})
    assert resp.status_code == 200
    assert resp.data["sla"]["resolution_met"] >= 1
    breached_ids = [t["id"] for t in resp.data["recently_breached_tickets"]]
    assert str(ticket.id) not in breached_ids


@pytest.mark.django_db
def test_ticket_resolved_after_due_at_counts_as_sla_missed_and_breached(super_admin, customer_user):
    now = timezone.now()
    ticket = _make_ticket(
        customer_user.customer_profile,
        status="resolved",
        due_at=now - datetime.timedelta(hours=2),
        resolved_at=now,
        sla_breach_notified=True,
    )

    resp = _client(super_admin).get(URL, {"period": "7d"})
    assert resp.status_code == 200
    assert resp.data["sla"]["resolution_missed"] >= 1
    breached_ids = [t["id"] for t in resp.data["recently_breached_tickets"]]
    assert str(ticket.id) in breached_ids


# ── Ticket aging ──────────────────────────────────────────────────


@pytest.mark.django_db
def test_ticket_aging_buckets_old_open_ticket_as_7d_plus(super_admin, customer_user):
    ticket = _make_ticket(customer_user.customer_profile, status="open")
    Ticket.objects.filter(pk=ticket.pk).update(
        created_at=timezone.now() - datetime.timedelta(days=10)
    )

    resp = _client(super_admin).get(URL)
    assert resp.status_code == 200
    assert resp.data["ticket_aging"]["7d_plus"] >= 1


# ── Service category labels resolved from service_catalog ────────


@pytest.mark.django_db
def test_service_category_distribution_uses_service_catalog_labels(super_admin, customer_user):
    _make_ticket(customer_user.customer_profile, service_type="kubernetes", status="open")

    resp = _client(super_admin).get(URL)
    assert resp.status_code == 200
    expected_label = next(
        s["name"] for s in service_catalog.SERVICE_CATALOG if s["key"] == "kubernetes"
    )
    entry = next(
        (r for r in resp.data["service_category_distribution"] if r["service_type"] == "kubernetes"),
        None,
    )
    assert entry is not None
    assert entry["label"] == expected_label


# ── Period param handling ─────────────────────────────────────────


@pytest.mark.django_db
def test_default_period_is_30_days(super_admin):
    resp = _client(super_admin).get(URL)
    assert resp.status_code == 200
    start = datetime.datetime.fromisoformat(resp.data["period"]["start"])
    end = datetime.datetime.fromisoformat(resp.data["period"]["end"])
    assert 29 <= (end - start).days <= 31


@pytest.mark.django_db
@pytest.mark.parametrize("period,expected_days", [("7d", 7), ("90d", 90)])
def test_explicit_period_param(super_admin, period, expected_days):
    resp = _client(super_admin).get(URL, {"period": period})
    assert resp.status_code == 200
    start = datetime.datetime.fromisoformat(resp.data["period"]["start"])
    end = datetime.datetime.fromisoformat(resp.data["period"]["end"])
    assert (expected_days - 1) <= (end - start).days <= (expected_days + 1)


@pytest.mark.django_db
def test_explicit_start_end_overrides_period(super_admin, customer_user):
    ticket = _make_ticket(customer_user.customer_profile, status="open")
    Ticket.objects.filter(pk=ticket.pk).update(
        created_at=timezone.now() - datetime.timedelta(days=200)
    )

    start = (timezone.now() - datetime.timedelta(days=201)).date().isoformat()
    end = (timezone.now() - datetime.timedelta(days=199)).date().isoformat()

    resp = _client(super_admin).get(URL, {"start": start, "end": end})
    assert resp.status_code == 200
    assert resp.data["summary"]["total_tickets"] >= 1
