"""
Freelancer payout self-service API tests.

Run with:
  docker compose exec backend python -m pytest tests/test_payouts.py -v
"""

import uuid as uuid_lib
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from support_app.models import Customer, Freelancer, Payment, Payout, Ticket

User = get_user_model()


# ── Fixtures ──────────────────────────────────────────────────────

@pytest.fixture
def customer_user(db):
    user = User.objects.create_user(
        email="customer@test.com", password="StrongPass123!", role="customer"
    )
    Customer.objects.create(user=user, company="Acme Ltd")
    return user


@pytest.fixture
def freelancer_user(db):
    user = User.objects.create_user(
        email="freelancer@test.com", password="StrongPass123!", role="freelancer"
    )
    Freelancer.objects.create(
        user=user, skills="server_admin", onboarding_status="approved", active=True
    )
    return user


@pytest.fixture
def other_freelancer_user(db):
    user = User.objects.create_user(
        email="other-freelancer@test.com", password="StrongPass123!", role="freelancer"
    )
    Freelancer.objects.create(
        user=user, skills="aws", onboarding_status="approved", active=True
    )
    return user


@pytest.fixture
def pending_freelancer_user(db):
    """An unapproved freelancer — must be denied access to freelancer-only endpoints."""
    user = User.objects.create_user(
        email="pending-freelancer@test.com", password="StrongPass123!", role="freelancer"
    )
    Freelancer.objects.create(
        user=user, skills="linux", onboarding_status="pending", active=True
    )
    return user


def _make_payout(freelancer, customer, status="pending"):
    ticket = Ticket.objects.create(
        customer=customer.customer_profile,
        title="Server down",
        service_type="server_admin",
        severity="high",
        status="closed",
        assigned_to=freelancer.freelancer_profile,
    )
    payment = Payment.objects.create(
        customer=customer.customer_profile,
        ticket=ticket,
        amount=Decimal("1000.00"),
        payment_type="resolution_fee",
        status="completed",
        invoice_number=f"INV-PAYOUT-{uuid_lib.uuid4().hex[:8]}",
    )
    return Payout.objects.create(
        ticket=ticket,
        freelancer=freelancer.freelancer_profile,
        payment=payment,
        resolution_fee=Decimal("1000.00"),
        severity_surcharge=Decimal("200.00"),
        engineer_share=Decimal("650.00"),
        platform_share=Decimal("350.00"),
        status=status,
        utr_number="UTR123456" if status == "processed" else "",
    )


# ── GET /api/freelancer/payouts/ ───────────────────────────────────

@pytest.mark.django_db
def test_freelancer_sees_only_own_payouts(freelancer_user, other_freelancer_user, customer_user):
    _make_payout(freelancer_user, customer_user)
    _make_payout(other_freelancer_user, customer_user)

    client = APIClient()
    client.force_authenticate(user=freelancer_user)
    response = client.get("/api/freelancer/payouts/")

    assert response.status_code == 200
    results = response.data["results"]
    assert len(results) == 1
    assert results[0]["engineer_share"] == "650.00"


@pytest.mark.django_db
def test_freelancer_payout_response_excludes_sensitive_fields(freelancer_user, customer_user):
    _make_payout(freelancer_user, customer_user)

    client = APIClient()
    client.force_authenticate(user=freelancer_user)
    response = client.get("/api/freelancer/payouts/")

    assert response.status_code == 200
    payout_data = response.data["results"][0]
    # platform_share is ResolveHQ's cut — never expose it to the engineer.
    assert "platform_share" not in payout_data
    # payment/freelancer are internal FKs — freelancer/redundant, never needed client-side.
    assert "payment" not in payout_data
    assert "freelancer" not in payout_data


@pytest.mark.django_db
def test_freelancer_payout_list_status_filter(freelancer_user, customer_user):
    _make_payout(freelancer_user, customer_user, status="pending")
    _make_payout(freelancer_user, customer_user, status="processed")

    client = APIClient()
    client.force_authenticate(user=freelancer_user)

    response = client.get("/api/freelancer/payouts/?status=processed")
    assert response.status_code == 200
    assert len(response.data["results"]) == 1
    assert response.data["results"][0]["status"] == "processed"
    assert response.data["results"][0]["utr_number"] == "UTR123456"


@pytest.mark.django_db
def test_freelancer_payout_list_empty_when_no_payouts(freelancer_user):
    client = APIClient()
    client.force_authenticate(user=freelancer_user)
    response = client.get("/api/freelancer/payouts/")

    assert response.status_code == 200
    assert response.data["results"] == []


@pytest.mark.django_db
def test_unapproved_freelancer_cannot_access_payouts(pending_freelancer_user):
    client = APIClient()
    client.force_authenticate(user=pending_freelancer_user)
    response = client.get("/api/freelancer/payouts/")

    assert response.status_code == 403


@pytest.mark.django_db
def test_customer_cannot_access_freelancer_payouts(customer_user):
    client = APIClient()
    client.force_authenticate(user=customer_user)
    response = client.get("/api/freelancer/payouts/")

    assert response.status_code == 403


@pytest.mark.django_db
def test_anonymous_cannot_access_freelancer_payouts():
    client = APIClient()
    response = client.get("/api/freelancer/payouts/")

    assert response.status_code == 401
