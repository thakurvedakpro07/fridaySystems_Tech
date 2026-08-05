"""
DPDP Act 2023 self-service compliance tests: consent capture at registration
(password and Google paths), personal-data export, and the right-to-erasure
request/cancel/anonymize flow.

Run with:
  cd backend
  pytest tests/test_dpdp_compliance.py -v
"""

import json
import uuid as uuid_lib
from datetime import timedelta
from decimal import Decimal
from unittest.mock import MagicMock

import pytest
from django.contrib.auth import get_user_model
from django.core import mail
from django.utils import timezone
from rest_framework.test import APIClient

from support_app.models import (
    ConsentRecord, Customer, Freelancer, Payment, Payout, Ticket, TicketComment,
)
from support_app.services.anonymization_service import anonymize_user
from support_app.tasks import anonymize_pending_deletions

User = get_user_model()


# ── Fixtures ──────────────────────────────────────────────────────

@pytest.fixture
def customer_user(db):
    user = User.objects.create_user(
        email="customer@dpdp.test", password="StrongPass123!", role="customer",
    )
    Customer.objects.create(user=user, company="Acme Ltd", phone="+91 90000 00001")
    return user


@pytest.fixture
def freelancer_user(db):
    user = User.objects.create_user(
        email="freelancer@dpdp.test", password="StrongPass123!", role="freelancer",
    )
    Freelancer.objects.create(
        user=user, skills="server_admin", onboarding_status="approved", active=True,
        payout_details={"upi_id": "freelancer@okhdfcbank"},
    )
    return user


def _login(client, email):
    """
    Authenticate the test client without hitting the real /api/auth/login/
    endpoint — these tests only need an authenticated session, not to
    exercise login itself, and repeated real logins within one test run
    would exhaust the shared per-IP AuthRateThrottle (see test_tickets.py's
    admin_client for the same force_authenticate precedent).
    """
    user = User.objects.get(email=email)
    client.force_authenticate(user=user)


def _make_ticket_payment_payout(customer_user, freelancer_user):
    ticket = Ticket.objects.create(
        customer=customer_user.customer_profile,
        title="Server down",
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
        invoice_number=f"INV-DPDP-{uuid_lib.uuid4().hex[:8]}",
    )
    payout = Payout.objects.create(
        ticket=ticket,
        freelancer=freelancer_user.freelancer_profile,
        payment=payment,
        resolution_fee=Decimal("1000.00"),
        severity_surcharge=Decimal("200.00"),
        engineer_share=Decimal("650.00"),
        platform_share=Decimal("350.00"),
        status="processed",
    )
    return ticket, payment, payout


def _fake_google_response(url, **kwargs):
    """
    Stand-in for requests.get() against Google's tokeninfo/userinfo endpoints,
    matching google_auth_view's two-call sequence in views.py.
    """
    resp = MagicMock()
    resp.raise_for_status = lambda: None
    if "tokeninfo" in url:
        resp.json.return_value = {"azp": ""}
    else:
        resp.json.return_value = {
            "email": "googleuser@dpdp.test",
            "email_verified": True,
            "given_name": "Google",
            "family_name": "User",
        }
    return resp


# ── Consent at registration (password path) ────────────────────────

@pytest.mark.django_db
def test_registration_without_consent_returns_400():
    client = APIClient()
    resp = client.post("/api/auth/register/", {
        "email": "noconsent@dpdp.test", "password": "StrongPass123!", "password2": "StrongPass123!",
    }, format="json")
    assert resp.status_code == 400
    assert not User.objects.filter(email="noconsent@dpdp.test").exists()


@pytest.mark.django_db
def test_registration_with_consent_false_returns_400():
    client = APIClient()
    resp = client.post("/api/auth/register/", {
        "email": "falseconsent@dpdp.test", "password": "StrongPass123!", "password2": "StrongPass123!",
        "consent": False,
    }, format="json")
    assert resp.status_code == 400
    assert not User.objects.filter(email="falseconsent@dpdp.test").exists()


@pytest.mark.django_db
def test_registration_with_consent_creates_consent_record():
    client = APIClient()
    resp = client.post("/api/auth/register/", {
        "email": "consented@dpdp.test", "password": "StrongPass123!", "password2": "StrongPass123!",
        "consent": True,
    }, format="json")
    assert resp.status_code == 201
    user = User.objects.get(email="consented@dpdp.test")
    records = ConsentRecord.objects.filter(user=user)
    assert records.count() == 1
    assert records.first().consent_type == "registration_privacy_policy"
    assert records.first().policy_version


# ── Consent at registration (Google OAuth path) ─────────────────────

@pytest.mark.django_db
def test_google_signup_without_consent_returns_400(monkeypatch, settings):
    import requests
    settings.GOOGLE_OAUTH_CLIENT_ID = ""  # skip azp matching, isolate the consent check
    monkeypatch.setattr(requests, "get", _fake_google_response)

    client = APIClient()
    resp = client.post("/api/auth/google/", {"access_token": "fake-token"}, format="json")
    assert resp.status_code == 400
    assert not User.objects.filter(email="googleuser@dpdp.test").exists()


@pytest.mark.django_db
def test_google_signup_with_consent_creates_consent_record(monkeypatch, settings):
    import requests
    settings.GOOGLE_OAUTH_CLIENT_ID = ""
    monkeypatch.setattr(requests, "get", _fake_google_response)

    client = APIClient()
    resp = client.post(
        "/api/auth/google/", {"access_token": "fake-token", "consent": True}, format="json",
    )
    assert resp.status_code == 200
    user = User.objects.get(email="googleuser@dpdp.test")
    assert ConsentRecord.objects.filter(user=user).exists()


# ── Permission boundaries ────────────────────────────────────────────

@pytest.mark.django_db
def test_export_and_deletion_endpoints_require_auth():
    client = APIClient()
    assert client.get("/api/auth/profile/export/").status_code == 401
    assert client.post("/api/auth/deletion-request/").status_code == 401
    assert client.post("/api/auth/deletion-request/cancel/").status_code == 401


# ── Personal-data export ─────────────────────────────────────────────

@pytest.mark.django_db
def test_export_scopes_customer_data_and_excludes_others(customer_user, freelancer_user):
    other_customer = User.objects.create_user(
        email="other@dpdp.test", password="StrongPass123!", role="customer",
    )
    Customer.objects.create(user=other_customer, company="Other Co")
    Ticket.objects.create(
        customer=other_customer.customer_profile, title="Other ticket",
        service_type="server_admin", severity="low", status="open",
    )

    ticket, payment, _payout = _make_ticket_payment_payout(customer_user, freelancer_user)
    TicketComment.objects.create(ticket=ticket, author=customer_user, body="public note", is_internal=False)
    TicketComment.objects.create(ticket=ticket, author=freelancer_user, body="secret internal note", is_internal=True)

    client = APIClient()
    _login(client, customer_user.email)
    resp = client.get("/api/auth/profile/export/")

    assert resp.status_code == 200
    assert resp["Content-Disposition"].startswith("attachment;")
    data = json.loads(resp.content)

    ticket_numbers = {t["ticket_number"] for t in data["tickets"]}
    assert ticket.ticket_number in ticket_numbers
    assert len(data["tickets"]) == 1  # other customer's ticket must not appear

    comment_bodies = [c["body"] for c in data["comments_authored"]]
    assert "public note" in comment_bodies
    assert "secret internal note" not in comment_bodies  # internal comments excluded

    assert any(p["invoice_number"] == payment.invoice_number for p in data["payments"])


@pytest.mark.django_db
def test_export_never_includes_freelancer_payout_details(customer_user, freelancer_user):
    _make_ticket_payment_payout(customer_user, freelancer_user)

    client = APIClient()
    _login(client, freelancer_user.email)
    resp = client.get("/api/auth/profile/export/")

    assert resp.status_code == 200
    body_text = resp.content.decode()
    assert "payout_details" not in body_text
    assert "okhdfcbank" not in body_text  # the actual bank/UPI value never leaks


# ── Deletion request / cancel state machine ──────────────────────────

@pytest.mark.django_db
def test_request_deletion_requires_correct_password(customer_user):
    client = APIClient()
    _login(client, customer_user.email)
    resp = client.post("/api/auth/deletion-request/", {"current_password": "WrongPass!"}, format="json")
    assert resp.status_code == 400
    customer_user.refresh_from_db()
    assert customer_user.deletion_requested_at is None


@pytest.mark.django_db
def test_request_deletion_sets_timestamp_and_sends_email(customer_user, django_capture_on_commit_callbacks):
    client = APIClient()
    _login(client, customer_user.email)
    # The confirmation email is dispatched via transaction.on_commit(), which
    # pytest-django's default per-test rollback never fires — must capture and
    # execute it explicitly (same pattern as test_async_tasks.py).
    with django_capture_on_commit_callbacks(execute=True):
        resp = client.post("/api/auth/deletion-request/", {"current_password": "StrongPass123!"}, format="json")

    assert resp.status_code == 200
    customer_user.refresh_from_db()
    assert customer_user.deletion_requested_at is not None
    assert "scheduled_for" in resp.data
    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == [customer_user.email]


@pytest.mark.django_db
def test_duplicate_deletion_request_returns_400(customer_user):
    customer_user.deletion_requested_at = timezone.now()
    customer_user.save(update_fields=["deletion_requested_at"])

    client = APIClient()
    _login(client, customer_user.email)
    resp = client.post("/api/auth/deletion-request/", {"current_password": "StrongPass123!"}, format="json")
    assert resp.status_code == 400


@pytest.mark.django_db
def test_cancel_deletion_clears_timestamp_and_sends_email(customer_user, django_capture_on_commit_callbacks):
    customer_user.deletion_requested_at = timezone.now()
    customer_user.save(update_fields=["deletion_requested_at"])

    client = APIClient()
    _login(client, customer_user.email)
    with django_capture_on_commit_callbacks(execute=True):
        resp = client.post("/api/auth/deletion-request/cancel/")

    assert resp.status_code == 200
    customer_user.refresh_from_db()
    assert customer_user.deletion_requested_at is None
    assert len(mail.outbox) == 1


@pytest.mark.django_db
def test_cancel_with_nothing_pending_returns_400(customer_user):
    client = APIClient()
    _login(client, customer_user.email)
    resp = client.post("/api/auth/deletion-request/cancel/")
    assert resp.status_code == 400


# ── Anonymization ─────────────────────────────────────────────────────

@pytest.mark.django_db
def test_anonymize_user_scrubs_pii_but_preserves_financial_records(customer_user, freelancer_user):
    ticket, payment, payout = _make_ticket_payment_payout(customer_user, freelancer_user)

    anonymize_user(customer_user)

    customer_user.refresh_from_db()
    assert customer_user.email.startswith("deleted-")
    assert customer_user.email.endswith("@deleted.resolvehq.invalid")
    assert customer_user.is_active is False
    assert customer_user.anonymized_at is not None
    assert customer_user.has_usable_password() is False

    profile = customer_user.customer_profile
    profile.refresh_from_db()
    assert profile.company == ""
    assert profile.phone == ""

    # PROTECT-linked records must survive untouched, FK still resolving.
    ticket.refresh_from_db()
    payment.refresh_from_db()
    payout.refresh_from_db()
    assert ticket.customer_id == profile.id
    assert payment.customer_id == profile.id
    assert payout.freelancer_id == freelancer_user.freelancer_profile.id


@pytest.mark.django_db
def test_anonymize_user_is_idempotent(customer_user):
    anonymize_user(customer_user)
    customer_user.refresh_from_db()
    first_email = customer_user.email
    first_anonymized_at = customer_user.anonymized_at

    anonymize_user(customer_user)  # second call must be a no-op
    customer_user.refresh_from_db()
    assert customer_user.email == first_email
    assert customer_user.anonymized_at == first_anonymized_at


@pytest.mark.django_db
def test_anonymize_pending_deletions_task_processes_due_users_only(customer_user):
    due_user = customer_user
    due_user.deletion_requested_at = timezone.now() - timedelta(days=31)
    due_user.save(update_fields=["deletion_requested_at"])

    not_due_user = User.objects.create_user(
        email="notdue@dpdp.test", password="StrongPass123!", role="customer",
    )
    Customer.objects.create(user=not_due_user, company="Not Due Co")
    not_due_user.deletion_requested_at = timezone.now() - timedelta(days=5)
    not_due_user.save(update_fields=["deletion_requested_at"])

    anonymize_pending_deletions()

    due_user.refresh_from_db()
    not_due_user.refresh_from_db()
    assert due_user.anonymized_at is not None
    assert not_due_user.anonymized_at is None
    assert len(mail.outbox) == 1  # only the due user gets the final "account deleted" notice


@pytest.mark.django_db
def test_anonymize_pending_deletions_is_idempotent_across_runs(customer_user):
    customer_user.deletion_requested_at = timezone.now() - timedelta(days=31)
    customer_user.save(update_fields=["deletion_requested_at"])

    anonymize_pending_deletions()
    customer_user.refresh_from_db()
    first_email = customer_user.email

    anonymize_pending_deletions()  # already anonymized_at is set — must not re-process
    customer_user.refresh_from_db()
    assert customer_user.email == first_email
    assert len(mail.outbox) == 1  # not sent a second time


@pytest.mark.django_db
def test_anonymized_customer_name_renders_as_deleted_user_on_ticket_detail(customer_user, freelancer_user):
    ticket, _payment, _payout = _make_ticket_payment_payout(customer_user, freelancer_user)
    anonymize_user(customer_user)

    admin_user = User.objects.create_user(
        email="admin@dpdp.test", password="AdminPass123!", is_staff=True, role="admin",
    )
    admin_client = APIClient()
    admin_client.force_authenticate(user=admin_user)

    resp = admin_client.get(f"/api/tickets/{ticket.id}/")
    assert resp.status_code == 200
    assert resp.data["customer"]["name"] == "Deleted User"
    assert "deleted-" not in resp.data["customer"]["name"]
