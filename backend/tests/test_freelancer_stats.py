"""
Freelancer "My Stats" tests — cross-checks the extraction in
services/executive_analytics_service.py and the new
services/freelancer_stats_service.py against each other, plus the CSAT
bug fix in views.py::analytics_view.

Run with:
  docker compose exec backend python -m pytest tests/test_freelancer_stats.py -v
"""
import uuid as uuid_lib
from datetime import timedelta
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from support_app.models import CSATSurvey, Customer, Freelancer, Payment, Payout, Ticket
from support_app.services import freelancer_stats_service
from support_app.services.executive_analytics_service import get_engineer_utilization

User = get_user_model()


@pytest.fixture
def customer_user(db):
    user = User.objects.create_user(
        email="customer@stats.test", password="StrongPass123!", role="customer"
    )
    Customer.objects.create(user=user, company="Acme Ltd")
    return user


@pytest.fixture
def freelancer_user(db):
    user = User.objects.create_user(
        email="freelancer@stats.test", password="StrongPass123!", role="freelancer"
    )
    Freelancer.objects.create(
        user=user, skills="server_admin", onboarding_status="approved",
        active=True, availability="full_time",
    )
    return user


@pytest.fixture
def now_window():
    end = timezone.now()
    start = end - timedelta(days=30)
    return start, end


def _make_resolved_ticket(customer, freelancer, resolved_at):
    ticket = Ticket.objects.create(
        customer=customer.customer_profile,
        title="Server down",
        service_type="server_admin",
        severity="high",
        status="resolved",
        assigned_to=freelancer.freelancer_profile,
    )
    Ticket.objects.filter(pk=ticket.pk).update(resolved_at=resolved_at)
    ticket.refresh_from_db()
    return ticket


def _make_active_ticket(customer, freelancer):
    return Ticket.objects.create(
        customer=customer.customer_profile,
        title="Ongoing issue",
        service_type="server_admin",
        severity="medium",
        status="in_progress",
        assigned_to=freelancer.freelancer_profile,
    )


# ── Cross-check against get_engineer_utilization() (regression guard) ──

@pytest.mark.django_db
def test_my_stats_matches_engineer_utilization_numbers(freelancer_user, customer_user, now_window):
    start, end = now_window
    _make_active_ticket(customer_user, freelancer_user)
    _make_resolved_ticket(customer_user, freelancer_user, resolved_at=end - timedelta(days=1))

    fleet = {row["id"]: row for row in get_engineer_utilization(start, end)}
    fleet_row = fleet[str(freelancer_user.freelancer_profile.id)]

    my_stats = freelancer_stats_service.get_my_stats(freelancer_user.freelancer_profile, start, end)

    assert my_stats["active_ticket_count"] == fleet_row["active_ticket_count"]
    assert my_stats["resolved_count"] == fleet_row["resolved_count"]
    assert my_stats["utilization_pct"] == fleet_row["utilization_pct"]
    assert my_stats["avg_resolution_hours"] == fleet_row["avg_resolution_hours"]


# ── CSAT (the bug fix) ──────────────────────────────────────────────

@pytest.mark.django_db
def test_my_stats_csat_is_populated_when_surveys_exist(freelancer_user, customer_user):
    start = timezone.now() - timedelta(days=30)
    ticket = _make_resolved_ticket(customer_user, freelancer_user, resolved_at=timezone.now())
    CSATSurvey.objects.create(ticket=ticket, customer=customer_user.customer_profile, score=5)
    # submitted_at is auto_now_add — compute `end` after creation so the
    # survey's real timestamp falls inside the window.
    end = timezone.now() + timedelta(seconds=5)

    stats = freelancer_stats_service.get_my_stats(freelancer_user.freelancer_profile, start, end)

    assert stats["csat_count"] == 1
    assert stats["csat_avg"] == 5.0


@pytest.mark.django_db
def test_my_stats_csat_is_none_when_no_surveys(freelancer_user, now_window):
    start, end = now_window
    stats = freelancer_stats_service.get_my_stats(freelancer_user.freelancer_profile, start, end)
    assert stats["csat_count"] == 0
    assert stats["csat_avg"] is None


@pytest.mark.django_db
def test_analytics_view_csat_no_longer_null_for_freelancer_with_surveys(freelancer_user, customer_user):
    """The pre-existing bug: analytics_view's CSAT block skipped freelancers entirely."""
    ticket = _make_resolved_ticket(customer_user, freelancer_user, resolved_at=timezone.now())
    CSATSurvey.objects.create(ticket=ticket, customer=customer_user.customer_profile, score=4)

    client = APIClient()
    client.force_authenticate(user=freelancer_user)
    response = client.get("/api/analytics/")

    assert response.status_code == 200
    assert response.data["csat_avg"] == 4.0
    assert response.data["csat_count"] == 1


# ── Lifetime earnings ────────────────────────────────────────────────

@pytest.mark.django_db
def test_my_stats_lifetime_earnings(freelancer_user, customer_user, now_window):
    start, end = now_window
    ticket = Ticket.objects.create(
        customer=customer_user.customer_profile,
        title="Resolved and paid",
        service_type="server_admin",
        severity="high",
        status="closed",
        assigned_to=freelancer_user.freelancer_profile,
    )
    payment = Payment.objects.create(
        customer=customer_user.customer_profile,
        ticket=ticket,
        amount=Decimal("1000.00"),
        payment_type="resolution_fee",
        status="completed",
        invoice_number=f"INV-STATS-{uuid_lib.uuid4().hex[:8]}",
    )
    Payout.objects.create(
        ticket=ticket, freelancer=freelancer_user.freelancer_profile, payment=payment,
        resolution_fee=Decimal("1000.00"), severity_surcharge=Decimal("0"),
        engineer_share=Decimal("650.00"), platform_share=Decimal("350.00"),
        status="processed",
    )

    ticket2 = Ticket.objects.create(
        customer=customer_user.customer_profile,
        title="Resolved, pending payout",
        service_type="server_admin",
        severity="low",
        status="closed",
        assigned_to=freelancer_user.freelancer_profile,
    )
    payment2 = Payment.objects.create(
        customer=customer_user.customer_profile,
        ticket=ticket2,
        amount=Decimal("500.00"),
        payment_type="resolution_fee",
        status="completed",
        invoice_number=f"INV-STATS-{uuid_lib.uuid4().hex[:8]}",
    )
    Payout.objects.create(
        ticket=ticket2, freelancer=freelancer_user.freelancer_profile, payment=payment2,
        resolution_fee=Decimal("500.00"), severity_surcharge=Decimal("0"),
        engineer_share=Decimal("325.00"), platform_share=Decimal("175.00"),
        status="pending",
    )

    stats = freelancer_stats_service.get_my_stats(freelancer_user.freelancer_profile, start, end)

    assert stats["earnings_processed"] == Decimal("650.00")
    assert stats["earnings_pending"] == Decimal("325.00")


# ── Endpoint-level ────────────────────────────────────────────────────

@pytest.mark.django_db
def test_freelancer_stats_endpoint_requires_approved_freelancer(customer_user):
    client = APIClient()
    client.force_authenticate(user=customer_user)
    response = client.get("/api/freelancer/stats/")
    assert response.status_code == 403


@pytest.mark.django_db
def test_freelancer_stats_endpoint_returns_expected_shape(freelancer_user):
    client = APIClient()
    client.force_authenticate(user=freelancer_user)
    response = client.get("/api/freelancer/stats/")

    assert response.status_code == 200
    for key in (
        "active_ticket_count", "resolved_count", "avg_resolution_hours",
        "utilization_pct", "csat_avg", "csat_count",
        "earnings_processed", "earnings_pending",
    ):
        assert key in response.data
