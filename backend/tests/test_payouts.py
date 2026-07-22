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


# ── Finance payout processing (Roadmap #1) ─────────────────────────
# Staff-role fixtures for the ops payouts workspace.

@pytest.fixture
def finance_manager_user(db):
    return User.objects.create_user(
        email="finance@test.com", password="StrongPass123!",
        role="finance_manager", is_staff=False,
    )


@pytest.fixture
def ops_manager_user(db):
    return User.objects.create_user(
        email="opsmgr@test.com", password="StrongPass123!",
        role="operations_manager", is_staff=False,
    )


@pytest.fixture
def support_agent_user(db):
    return User.objects.create_user(
        email="agent@test.com", password="StrongPass123!",
        role="support_agent", is_staff=False,
    )


@pytest.fixture
def super_admin_user(db):
    return User.objects.create_user(
        email="admin@test.com", password="StrongPass123!",
        role="admin", is_staff=True, is_superuser=True,
    )


# ── GET /api/ops/payouts/ ──────────────────────────────────────────

@pytest.mark.django_db
def test_finance_manager_can_list_all_payouts(finance_manager_user, freelancer_user, other_freelancer_user, customer_user):
    _make_payout(freelancer_user, customer_user)
    _make_payout(other_freelancer_user, customer_user)

    client = APIClient()
    client.force_authenticate(user=finance_manager_user)
    response = client.get("/api/ops/payouts/")

    assert response.status_code == 200
    assert len(response.data["results"]) == 2


@pytest.mark.django_db
def test_ops_manager_can_list_payouts_read_only(ops_manager_user, freelancer_user, customer_user):
    _make_payout(freelancer_user, customer_user)

    client = APIClient()
    client.force_authenticate(user=ops_manager_user)
    response = client.get("/api/ops/payouts/")

    assert response.status_code == 200
    assert len(response.data["results"]) == 1


@pytest.mark.django_db
def test_ops_payout_list_includes_platform_share_and_freelancer_identity(finance_manager_user, freelancer_user, customer_user):
    _make_payout(freelancer_user, customer_user)

    client = APIClient()
    client.force_authenticate(user=finance_manager_user)
    response = client.get("/api/ops/payouts/")

    payout_data = response.data["results"][0]
    assert payout_data["platform_share"] == "350.00"
    assert payout_data["freelancer_email"] == "freelancer@test.com"
    assert "freelancer_name" in payout_data


@pytest.mark.django_db
def test_ops_payout_list_never_exposes_bank_details(finance_manager_user, freelancer_user, customer_user):
    """H-05: Freelancer.payout_details is plaintext bank/UPI info and must
    never appear in any API response, including the finance workspace."""
    _make_payout(freelancer_user, customer_user)

    client = APIClient()
    client.force_authenticate(user=finance_manager_user)
    response = client.get("/api/ops/payouts/")

    payout_data = response.data["results"][0]
    assert "payout_details" not in payout_data
    assert "payout_mode" not in payout_data


@pytest.mark.django_db
def test_ops_payout_list_status_filter(finance_manager_user, freelancer_user, customer_user):
    _make_payout(freelancer_user, customer_user, status="pending")
    _make_payout(freelancer_user, customer_user, status="processed")

    client = APIClient()
    client.force_authenticate(user=finance_manager_user)
    response = client.get("/api/ops/payouts/?status=pending")

    assert response.status_code == 200
    assert len(response.data["results"]) == 1
    assert response.data["results"][0]["status"] == "pending"


@pytest.mark.django_db
def test_freelancer_cannot_list_ops_payouts(freelancer_user, customer_user):
    _make_payout(freelancer_user, customer_user)

    client = APIClient()
    client.force_authenticate(user=freelancer_user)
    response = client.get("/api/ops/payouts/")

    assert response.status_code == 403


@pytest.mark.django_db
def test_support_agent_cannot_list_ops_payouts(support_agent_user, freelancer_user, customer_user):
    _make_payout(freelancer_user, customer_user)

    client = APIClient()
    client.force_authenticate(user=support_agent_user)
    response = client.get("/api/ops/payouts/")

    assert response.status_code == 403


@pytest.mark.django_db
def test_anonymous_cannot_list_ops_payouts():
    client = APIClient()
    response = client.get("/api/ops/payouts/")

    assert response.status_code == 401


# ── GET /api/ops/payouts/summary/ ──────────────────────────────────

@pytest.mark.django_db
def test_ops_payout_summary_totals_pending(finance_manager_user, freelancer_user, other_freelancer_user, customer_user):
    _make_payout(freelancer_user, customer_user, status="pending")
    _make_payout(other_freelancer_user, customer_user, status="pending")
    _make_payout(freelancer_user, customer_user, status="processed")

    client = APIClient()
    client.force_authenticate(user=finance_manager_user)
    response = client.get("/api/ops/payouts/summary/")

    assert response.status_code == 200
    assert response.data["pending_count"] == 2
    assert response.data["pending_total"] == 1300.0  # 650.00 * 2


@pytest.mark.django_db
def test_ops_payout_summary_requires_staff_role(customer_user):
    client = APIClient()
    client.force_authenticate(user=customer_user)
    response = client.get("/api/ops/payouts/summary/")

    assert response.status_code == 403


@pytest.mark.django_db
def test_ops_manager_cannot_access_payout_summary(ops_manager_user):
    """Mirrors ops_payment_summary: Ops Manager sees the payouts list but not
    the aggregate financial summary — Finance Manager/Super Admin only."""
    client = APIClient()
    client.force_authenticate(user=ops_manager_user)
    response = client.get("/api/ops/payouts/summary/")

    assert response.status_code == 403


# ── POST /api/ops/payouts/{id}/process/ ────────────────────────────

@pytest.mark.django_db
def test_finance_manager_can_process_pending_payout(finance_manager_user, freelancer_user, customer_user):
    payout = _make_payout(freelancer_user, customer_user, status="pending")

    client = APIClient()
    client.force_authenticate(user=finance_manager_user)
    response = client.post(f"/api/ops/payouts/{payout.id}/process/", {"utr_number": "UTR999888"})

    assert response.status_code == 200
    assert response.data["status"] == "processed"
    assert response.data["utr_number"] == "UTR999888"
    assert response.data["processed_at"] is not None

    payout.refresh_from_db()
    assert payout.status == "processed"
    assert payout.utr_number == "UTR999888"


@pytest.mark.django_db
def test_super_admin_can_process_pending_payout(super_admin_user, freelancer_user, customer_user):
    payout = _make_payout(freelancer_user, customer_user, status="pending")

    client = APIClient()
    client.force_authenticate(user=super_admin_user)
    response = client.post(f"/api/ops/payouts/{payout.id}/process/", {"utr_number": "UTR111222"})

    assert response.status_code == 200
    assert response.data["status"] == "processed"


@pytest.mark.django_db
def test_ops_manager_cannot_process_payout(ops_manager_user, freelancer_user, customer_user):
    payout = _make_payout(freelancer_user, customer_user, status="pending")

    client = APIClient()
    client.force_authenticate(user=ops_manager_user)
    response = client.post(f"/api/ops/payouts/{payout.id}/process/", {"utr_number": "UTR333444"})

    assert response.status_code == 403
    payout.refresh_from_db()
    assert payout.status == "pending"


@pytest.mark.django_db
def test_process_payout_requires_utr_number(finance_manager_user, freelancer_user, customer_user):
    payout = _make_payout(freelancer_user, customer_user, status="pending")

    client = APIClient()
    client.force_authenticate(user=finance_manager_user)
    response = client.post(f"/api/ops/payouts/{payout.id}/process/", {})

    assert response.status_code == 400
    payout.refresh_from_db()
    assert payout.status == "pending"


@pytest.mark.django_db
def test_process_payout_rejects_already_processed(finance_manager_user, freelancer_user, customer_user):
    payout = _make_payout(freelancer_user, customer_user, status="processed")

    client = APIClient()
    client.force_authenticate(user=finance_manager_user)
    response = client.post(f"/api/ops/payouts/{payout.id}/process/", {"utr_number": "UTR555666"})

    assert response.status_code == 400
    payout.refresh_from_db()
    assert payout.utr_number == "UTR123456"  # unchanged from _make_payout


@pytest.mark.django_db
def test_process_payout_returns_404_for_unknown_id(finance_manager_user):
    client = APIClient()
    client.force_authenticate(user=finance_manager_user)
    response = client.post(f"/api/ops/payouts/{uuid_lib.uuid4()}/process/", {"utr_number": "UTR777"})

    assert response.status_code == 404


@pytest.mark.django_db
def test_process_payout_writes_audit_log(finance_manager_user, freelancer_user, customer_user):
    from support_app.models import AuditLog

    payout = _make_payout(freelancer_user, customer_user, status="pending")

    client = APIClient()
    client.force_authenticate(user=finance_manager_user)
    client.post(f"/api/ops/payouts/{payout.id}/process/", {"utr_number": "UTR888999"})

    entry = AuditLog.objects.filter(action="payout_processed", entity="payout", entity_id=payout.id).first()
    assert entry is not None
    assert entry.metadata["utr_number"] == "UTR888999"
    assert entry.user_id == finance_manager_user.id


@pytest.mark.django_db
def test_customer_cannot_process_payout(customer_user, freelancer_user):
    payout = _make_payout(freelancer_user, customer_user, status="pending")

    client = APIClient()
    client.force_authenticate(user=customer_user)
    response = client.post(f"/api/ops/payouts/{payout.id}/process/", {"utr_number": "UTR000111"})

    assert response.status_code == 403


@pytest.mark.django_db
def test_anonymous_cannot_process_payout(freelancer_user, customer_user):
    payout = _make_payout(freelancer_user, customer_user, status="pending")

    client = APIClient()
    response = client.post(f"/api/ops/payouts/{payout.id}/process/", {"utr_number": "UTR222333"})

    assert response.status_code == 401
