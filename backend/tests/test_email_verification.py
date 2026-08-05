"""
Tests for the email verification system: the verify_email confirm endpoint,
the purpose-scoped token generator (support_app/tokens.py), resend cooldown/
throttling, and the is_verified permission gates on ticket creation and
freelancer job actions.

Run with:
  docker compose exec backend python -m pytest tests/test_email_verification.py -v
"""

import datetime

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core import mail
from django.core.cache import cache
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.test import APIClient

from support_app.models import Customer, Freelancer, Service, Ticket
from support_app.services.ticket_service import assign_ticket
from support_app.tokens import email_verification_token_generator

User = get_user_model()


# ── Fixtures ──────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def _clear_cache():
    """
    Tests run against supportmitra.settings directly (no separate test
    settings file), so CACHES points at real Redis here too. The resend
    cooldown uses cache.add() with a 60s TTL — without clearing between
    tests, a cooldown key set by one test would make an unrelated later
    test's resend call spuriously 429.
    """
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def customer_user(db):
    user = User.objects.create_user(
        email="customer@verify-email.test",
        password="StrongPass123!",
        role="customer",
    )
    Customer.objects.create(user=user, company="Acme Ltd")
    return user


@pytest.fixture
def freelancer_user(db):
    user = User.objects.create_user(
        email="freelancer@verify-email.test",
        password="StrongPass123!",
        role="freelancer",
    )
    Freelancer.objects.create(
        user=user,
        skills="server_admin",
        onboarding_status="approved",
        active=True,
    )
    return user


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        email="admin@verify-email.test",
        password="StrongPass123!",
        role="admin",
        is_staff=True,
    )


@pytest.fixture
def a_service(db):
    # "server_admin" is seeded by a data migration (0026_replace_service_catalog),
    # so fetch-or-create rather than always creating to avoid a unique-key clash.
    service, _ = Service.objects.get_or_create(
        key="server_admin",
        defaults={"name": "Server Administration", "category": "Testing", "resolution_fee": 500},
    )
    if not service.is_active or not service.is_available:
        service.is_active = True
        service.is_available = True
        service.save(update_fields=["is_active", "is_available"])
    return service


@pytest.fixture
def ticket(db, customer_user):
    return Ticket.objects.create(
        customer=customer_user.customer_profile,
        title="Server unreachable",
        service_type="server_admin",
        severity="high",
        status="open",
    )


def _uid_token_for(user):
    uid = urlsafe_base64_encode(force_bytes(str(user.pk)))
    token = email_verification_token_generator.make_token(user)
    return uid, token


# ── verify_email confirm path ──────────────────────────────────────

@pytest.mark.django_db
def test_verify_email_success_marks_user_verified(customer_user):
    customer_user.is_verified = False
    customer_user.save(update_fields=["is_verified"])
    uid, token = _uid_token_for(customer_user)

    client = APIClient()
    resp = client.post("/api/auth/verify-email/", {"uid": uid, "token": token}, format="json")

    assert resp.status_code == 200
    assert resp.data["code"] == "success"
    customer_user.refresh_from_db()
    assert customer_user.is_verified is True


@pytest.mark.django_db
def test_verify_email_already_verified_replay(customer_user):
    # customer_user fixture doesn't touch is_verified, so it keeps the
    # model default (True) — simulates replaying a link after verifying.
    uid, token = _uid_token_for(customer_user)

    client = APIClient()
    resp = client.post("/api/auth/verify-email/", {"uid": uid, "token": token}, format="json")

    assert resp.status_code == 200
    assert resp.data["code"] == "already_verified"


@pytest.mark.django_db
def test_verify_email_expired_token(customer_user, monkeypatch):
    customer_user.is_verified = False
    customer_user.save(update_fields=["is_verified"])
    uid, token = _uid_token_for(customer_user)

    real_now = email_verification_token_generator._now()
    monkeypatch.setattr(
        email_verification_token_generator, "_now",
        lambda: real_now + datetime.timedelta(hours=25),
    )

    client = APIClient()
    resp = client.post("/api/auth/verify-email/", {"uid": uid, "token": token}, format="json")

    assert resp.status_code == 400
    assert resp.data["code"] == "expired_link"


@pytest.mark.django_db
def test_verify_email_tampered_token_is_invalid(customer_user):
    customer_user.is_verified = False
    customer_user.save(update_fields=["is_verified"])
    uid, _ = _uid_token_for(customer_user)

    client = APIClient()
    resp = client.post("/api/auth/verify-email/", {"uid": uid, "token": "garbage-token"}, format="json")

    assert resp.status_code == 400
    assert resp.data["code"] == "invalid_link"


@pytest.mark.django_db
def test_verify_email_malformed_uid(db):
    client = APIClient()
    resp = client.post("/api/auth/verify-email/", {"uid": "not-valid-base64!!", "token": "x-y"}, format="json")

    assert resp.status_code == 400
    assert resp.data["code"] == "invalid_link"


@pytest.mark.django_db
def test_verify_email_missing_params(db):
    client = APIClient()
    resp = client.post("/api/auth/verify-email/", {}, format="json")

    assert resp.status_code == 400
    assert resp.data["code"] == "missing_params"


@pytest.mark.django_db
def test_verify_email_deleted_user(customer_user):
    uid, token = _uid_token_for(customer_user)
    customer_user.delete()

    client = APIClient()
    resp = client.post("/api/auth/verify-email/", {"uid": uid, "token": token}, format="json")

    assert resp.status_code == 400
    assert resp.data["code"] == "invalid_link"


# ── cross-purpose token rejection ──────────────────────────────────

@pytest.mark.django_db
def test_password_reset_token_rejected_by_verify_email(customer_user):
    customer_user.is_verified = False
    customer_user.save(update_fields=["is_verified"])
    uid = urlsafe_base64_encode(force_bytes(str(customer_user.pk)))
    reset_token = default_token_generator.make_token(customer_user)  # password-reset generator, not verification

    client = APIClient()
    resp = client.post("/api/auth/verify-email/", {"uid": uid, "token": reset_token}, format="json")

    assert resp.status_code == 400
    assert resp.data["code"] == "invalid_link"
    customer_user.refresh_from_db()
    assert customer_user.is_verified is False


@pytest.mark.django_db
def test_verify_email_token_rejected_by_password_reset_confirm(customer_user):
    uid, verify_token = _uid_token_for(customer_user)

    client = APIClient()
    resp = client.post(
        "/api/auth/password/reset/confirm/",
        {"uid": uid, "token": verify_token, "new_password": "NewStrongPass123!"},
        format="json",
    )

    assert resp.status_code == 400


# ── resend — authenticated ──────────────────────────────────────────

@pytest.mark.django_db
def test_resend_verification_email_sends_and_sets_cooldown(customer_user, django_capture_on_commit_callbacks):
    customer_user.is_verified = False
    customer_user.save(update_fields=["is_verified"])
    client = APIClient()
    client.force_authenticate(user=customer_user)

    with django_capture_on_commit_callbacks(execute=True):
        resp = client.post("/api/auth/verify-email/resend/")

    assert resp.status_code == 200
    assert resp.data["code"] == "sent"
    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == [customer_user.email]


@pytest.mark.django_db
def test_resend_verification_email_cooldown_enforced(customer_user, django_capture_on_commit_callbacks):
    customer_user.is_verified = False
    customer_user.save(update_fields=["is_verified"])
    client = APIClient()
    client.force_authenticate(user=customer_user)

    with django_capture_on_commit_callbacks(execute=True):
        first = client.post("/api/auth/verify-email/resend/")
    second = client.post("/api/auth/verify-email/resend/")

    assert first.status_code == 200
    assert second.status_code == 429
    assert second.data["code"] == "cooldown"
    assert len(mail.outbox) == 1  # only the first call actually queued an email


@pytest.mark.django_db
def test_resend_verification_email_noop_when_already_verified(customer_user):
    client = APIClient()
    client.force_authenticate(user=customer_user)

    resp = client.post("/api/auth/verify-email/resend/")

    assert resp.status_code == 200
    assert resp.data["code"] == "already_verified"
    assert len(mail.outbox) == 0


# ── resend — by email (AllowAny) ─────────────────────────────────────

@pytest.mark.django_db
def test_resend_verification_by_email_sends_for_unverified_account(customer_user, django_capture_on_commit_callbacks):
    customer_user.is_verified = False
    customer_user.save(update_fields=["is_verified"])
    client = APIClient()

    with django_capture_on_commit_callbacks(execute=True):
        resp = client.post(
            "/api/auth/verify-email/resend-by-email/", {"email": customer_user.email}, format="json",
        )

    assert resp.status_code == 200
    assert len(mail.outbox) == 1


@pytest.mark.django_db
def test_resend_verification_by_email_unknown_address_still_returns_200(db, django_capture_on_commit_callbacks):
    client = APIClient()

    with django_capture_on_commit_callbacks(execute=True):
        resp = client.post(
            "/api/auth/verify-email/resend-by-email/", {"email": "nobody@verify-email.test"}, format="json",
        )

    # Enumeration-safe: always 200, never reveals whether the account exists.
    assert resp.status_code == 200
    assert len(mail.outbox) == 0


@pytest.mark.django_db
def test_resend_verification_by_email_already_verified_sends_nothing(customer_user, django_capture_on_commit_callbacks):
    client = APIClient()

    with django_capture_on_commit_callbacks(execute=True):
        resp = client.post(
            "/api/auth/verify-email/resend-by-email/", {"email": customer_user.email}, format="json",
        )

    assert resp.status_code == 200
    assert len(mail.outbox) == 0


# ── ticket creation gate ─────────────────────────────────────────────

@pytest.mark.django_db
def test_unverified_customer_cannot_create_ticket(customer_user, a_service):
    customer_user.is_verified = False
    customer_user.save(update_fields=["is_verified"])
    client = APIClient()
    client.force_authenticate(user=customer_user)

    resp = client.post(
        "/api/tickets/",
        {"title": "Help", "service_type": "server_admin", "severity": "high"},
        format="json",
    )

    assert resp.status_code == 403


@pytest.mark.django_db
def test_unverified_customer_can_still_list_tickets(customer_user, ticket):
    customer_user.is_verified = False
    customer_user.save(update_fields=["is_verified"])
    client = APIClient()
    client.force_authenticate(user=customer_user)

    resp = client.get("/api/tickets/")

    assert resp.status_code == 200


@pytest.mark.django_db
def test_verified_customer_can_create_ticket(customer_user, a_service, django_capture_on_commit_callbacks):
    client = APIClient()
    client.force_authenticate(user=customer_user)

    with django_capture_on_commit_callbacks(execute=True):
        resp = client.post(
            "/api/tickets/",
            {"title": "Help", "service_type": "server_admin", "severity": "high"},
            format="json",
        )

    assert resp.status_code == 201


# ── freelancer job action gate ───────────────────────────────────────

@pytest.mark.django_db
def test_unverified_freelancer_cannot_update_status(ticket, freelancer_user, admin_user):
    assign_ticket(ticket, freelancer_user.freelancer_profile, admin_user)
    freelancer_user.is_verified = False
    freelancer_user.save(update_fields=["is_verified"])
    client = APIClient()
    client.force_authenticate(user=freelancer_user)

    resp = client.post(
        f"/api/freelancer/tickets/{ticket.id}/status/", {"new_status": "in_progress"}, format="json",
    )

    assert resp.status_code == 403


@pytest.mark.django_db
def test_unverified_freelancer_cannot_start_remote_session(ticket, freelancer_user, admin_user):
    assign_ticket(ticket, freelancer_user.freelancer_profile, admin_user)
    freelancer_user.is_verified = False
    freelancer_user.save(update_fields=["is_verified"])
    client = APIClient()
    client.force_authenticate(user=freelancer_user)

    resp = client.post(
        f"/api/freelancer/tickets/{ticket.id}/remote-session/",
        {"remote_session_url": "https://anydesk.com/abc123"},
        format="json",
    )

    assert resp.status_code == 403


@pytest.mark.django_db
def test_verified_freelancer_can_update_status(ticket, freelancer_user, admin_user):
    assign_ticket(ticket, freelancer_user.freelancer_profile, admin_user)
    client = APIClient()
    client.force_authenticate(user=freelancer_user)

    resp = client.post(
        f"/api/freelancer/tickets/{ticket.id}/status/", {"new_status": "in_progress"}, format="json",
    )

    assert resp.status_code == 200


# ── login response includes is_verified ──────────────────────────────

@pytest.mark.django_db
def test_login_response_includes_is_verified(customer_user):
    customer_user.is_verified = False
    customer_user.save(update_fields=["is_verified"])
    client = APIClient()

    resp = client.post(
        "/api/auth/login/", {"email": customer_user.email, "password": "StrongPass123!"}, format="json",
    )

    assert resp.status_code == 200
    assert resp.data["user"]["is_verified"] is False
