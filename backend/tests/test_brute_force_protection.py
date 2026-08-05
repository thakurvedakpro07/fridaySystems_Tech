"""
Tests for brute-force / account-lockout protection:
  - support_app/services/account_protection_service.py (unit-level)
  - CustomTokenObtainPairSerializer login wiring (views.py)
  - password_reset_confirm token-guessing lockout + throttle
  - password_reset_request per-email cooldown

Run with:
  docker compose exec backend python -m pytest tests/test_brute_force_protection.py -v
"""

import pytest
from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from rest_framework.test import APIClient

from support_app.models import AuditLog, Customer
from support_app.services import account_protection_service as bfp

User = get_user_model()


# ── Fixtures ──────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def _clear_cache():
    """
    Tests run against supportmitra.settings directly (no separate test
    settings file), so CACHES points at real Redis here too — mirrors
    test_email_verification.py's fixture. Without this, lockout/cooldown
    counters set by one test would bleed into an unrelated later test.
    """
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def locked_out_user(db):
    user = User.objects.create_user(email="target@example.com", password="StrongPass123!", role="customer")
    Customer.objects.create(user=user, company="Test Co")
    return user


def _client_from_ip(ip):
    """
    A fresh APIClient pinned to a distinct fake source IP.

    AuthRateThrottle (per-IP, 5/min) runs in APIView.initial() — BEFORE the
    login serializer's validate() ever executes — so hammering the same IP
    would trip that pre-existing throttle first and mask the account-based
    lockout under test entirely. Using a distinct IP per attempt is also the
    realistic threat model account-based lockout exists to catch: a
    credential-stuffing attack distributed across many source IPs against
    one account.
    """
    c = APIClient()
    c.defaults["REMOTE_ADDR"] = ip
    return c


def _attempt_login(ip_suffix, email, password):
    return _client_from_ip(f"10.9.0.{ip_suffix}").post(
        "/api/auth/login/", {"email": email, "password": password}, format="json",
    )


# ── Unit tests: account_protection_service ──────────────────────────

@pytest.mark.django_db
def test_below_threshold_never_locks(settings):
    settings.LOGIN_LOCKOUT_THRESHOLD = 5
    identifier = "unit-below@example.com"
    for _ in range(4):
        state = bfp.record_failed_attempt(identifier)
        assert state.locked is False
    assert bfp.is_locked(identifier).locked is False


@pytest.mark.django_db
def test_threshold_crossing_locks_with_retry_after(settings):
    settings.LOGIN_LOCKOUT_THRESHOLD = 5
    settings.LOGIN_LOCKOUT_BASE_DURATION_SECONDS = 900
    identifier = "unit-cross@example.com"
    for _ in range(4):
        assert bfp.record_failed_attempt(identifier).locked is False

    state = bfp.record_failed_attempt(identifier)
    assert state.locked is True
    assert state.retry_after_seconds == 900

    still = bfp.is_locked(identifier)
    assert still.locked is True
    assert 0 < still.retry_after_seconds <= 900


@pytest.mark.django_db
def test_successful_attempt_clears_fail_streak(settings):
    settings.LOGIN_LOCKOUT_THRESHOLD = 5
    identifier = "unit-clear@example.com"
    for _ in range(3):
        bfp.record_failed_attempt(identifier)

    bfp.clear_attempts(identifier)

    # Streak reset to 0 — one more failure should be attempt #1, not #4.
    state = bfp.record_failed_attempt(identifier)
    assert state.locked is False


@pytest.mark.django_db
def test_progressive_backoff_doubles_duration_on_repeat_lockout(settings):
    settings.LOGIN_LOCKOUT_THRESHOLD = 3
    settings.LOGIN_LOCKOUT_BASE_DURATION_SECONDS = 100
    settings.LOGIN_LOCKOUT_MAX_DURATION_SECONDS = 100_000
    settings.LOGIN_LOCKOUT_STRIKE_WINDOW_SECONDS = 86400
    identifier = "unit-backoff@example.com"

    state = None
    for _ in range(3):
        state = bfp.record_failed_attempt(identifier)
    assert state.locked is True
    assert state.retry_after_seconds == 100  # strikes=1 → base * 2**0

    # Simulate this lockout's own window elapsing WITHOUT erasing the
    # strikes counter — exactly what expiry looks like in production
    # (the lockout/fail-streak keys expire on their own TTL; the strikes
    # key has a separate, longer TTL by design).
    cache.delete(bfp._lockout_key(identifier))
    cache.delete(bfp._fail_key(identifier))

    for _ in range(3):
        state = bfp.record_failed_attempt(identifier)
    assert state.locked is True
    assert state.retry_after_seconds == 200  # strikes=2 → base * 2**1


@pytest.mark.django_db
def test_backoff_caps_at_max_duration(settings):
    settings.LOGIN_LOCKOUT_THRESHOLD = 1
    settings.LOGIN_LOCKOUT_BASE_DURATION_SECONDS = 1000
    settings.LOGIN_LOCKOUT_MAX_DURATION_SECONDS = 1500
    settings.LOGIN_LOCKOUT_STRIKE_WINDOW_SECONDS = 86400
    identifier = "unit-cap@example.com"

    # First lockout: strikes=1, duration = 1000 (under cap).
    state = bfp.record_failed_attempt(identifier)
    assert state.retry_after_seconds == 1000
    cache.delete(bfp._lockout_key(identifier))
    cache.delete(bfp._fail_key(identifier))

    # Second lockout: strikes=2, uncapped would be 2000 — must clamp to 1500.
    state = bfp.record_failed_attempt(identifier)
    assert state.retry_after_seconds == 1500


@pytest.mark.django_db
def test_disabled_via_setting_never_locks(settings):
    settings.BRUTE_FORCE_PROTECTION_ENABLED = False
    settings.LOGIN_LOCKOUT_THRESHOLD = 1
    identifier = "unit-disabled@example.com"
    for _ in range(10):
        assert bfp.record_failed_attempt(identifier).locked is False
    assert bfp.is_locked(identifier).locked is False


# ── Integration tests: login endpoint ────────────────────────────────

@pytest.mark.django_db
def test_login_lockout_triggers_after_threshold_and_blocks_further_attempts(settings, locked_out_user):
    settings.LOGIN_LOCKOUT_THRESHOLD = 5

    for i in range(5):
        response = _attempt_login(i, "target@example.com", "WrongPassword!")
        assert response.status_code == 401

    blocked = _attempt_login(5, "target@example.com", "WrongPassword!")
    assert blocked.status_code == 429
    assert blocked.has_header("Retry-After")
    assert "too many failed login attempts" in blocked.data["detail"].lower()


@pytest.mark.django_db
def test_login_lockout_blocks_correct_password_too(settings, locked_out_user):
    """Proves this is a real account lock, not just continued wrong-password
    rejection — the CORRECT password must also be refused while locked."""
    settings.LOGIN_LOCKOUT_THRESHOLD = 5

    for i in range(5):
        _attempt_login(i, "target@example.com", "WrongPassword!")

    response = _attempt_login(5, "target@example.com", "StrongPass123!")
    assert response.status_code == 429


@pytest.mark.django_db
def test_login_lockout_no_enumeration_between_real_and_fake_email(settings, locked_out_user):
    """The lockout sequence must look identical whether the email is real
    or made up — no status/detail/timing-shape difference that would let an
    attacker distinguish 'this account exists' from 'it doesn't'."""
    settings.LOGIN_LOCKOUT_THRESHOLD = 5

    real_statuses, fake_statuses = [], []
    for i in range(6):
        real_statuses.append(_attempt_login(i, "target@example.com", "WrongPassword!").status_code)
    for i in range(6):
        fake_statuses.append(_attempt_login(100 + i, "nobody-here@example.com", "WrongPassword!").status_code)

    assert real_statuses == fake_statuses == [401, 401, 401, 401, 401, 429]


@pytest.mark.django_db
def test_login_lockout_writes_audit_log_with_matched_user(settings, locked_out_user):
    settings.LOGIN_LOCKOUT_THRESHOLD = 5
    for i in range(5):
        _attempt_login(i, "target@example.com", "WrongPassword!")

    entry = AuditLog.objects.get(entity="auth", action="account_locked", metadata__identifier="target@example.com")
    assert entry.user_id == locked_out_user.id
    assert entry.user_type == "customer"


@pytest.mark.django_db
def test_login_lockout_writes_audit_log_as_system_for_unknown_email(settings, db):
    settings.LOGIN_LOCKOUT_THRESHOLD = 5
    for i in range(5):
        _attempt_login(i, "ghost@example.com", "WrongPassword!")

    entry = AuditLog.objects.get(entity="auth", action="account_locked", metadata__identifier="ghost@example.com")
    assert entry.user_id is None
    assert entry.user_type == "system"


@pytest.mark.django_db
def test_successful_login_clears_fail_streak(settings, locked_out_user):
    settings.LOGIN_LOCKOUT_THRESHOLD = 5

    for i in range(3):
        response = _attempt_login(i, "target@example.com", "WrongPassword!")
        assert response.status_code == 401

    success = _attempt_login(3, "target@example.com", "StrongPass123!")
    assert success.status_code == 200

    # Streak was cleared on success — one more wrong attempt is #1, not #4,
    # so it must still be a plain 401, not a lockout.
    response = _attempt_login(4, "target@example.com", "WrongPassword!")
    assert response.status_code == 401


@pytest.mark.django_db
def test_login_lockout_configurable_threshold(settings, locked_out_user):
    settings.LOGIN_LOCKOUT_THRESHOLD = 2

    assert _attempt_login(0, "target@example.com", "WrongPassword!").status_code == 401
    assert _attempt_login(1, "target@example.com", "WrongPassword!").status_code == 401
    assert _attempt_login(2, "target@example.com", "WrongPassword!").status_code == 429


@pytest.mark.django_db
def test_login_brute_force_protection_disabled_never_locks(settings, locked_out_user):
    settings.BRUTE_FORCE_PROTECTION_ENABLED = False
    settings.LOGIN_LOCKOUT_THRESHOLD = 2

    for i in range(10):
        response = _attempt_login(i, "target@example.com", "WrongPassword!")
        assert response.status_code == 401  # never 429 — mechanism fully bypassed


# ── Integration tests: password_reset_confirm ────────────────────────

def _reset_confirm(ip_suffix, uid, token, new_password="NewStrongPass456!"):
    return _client_from_ip(f"10.9.1.{ip_suffix}").post(
        "/api/auth/password/reset/confirm/",
        {"uid": uid, "token": token, "new_password": new_password},
        format="json",
    )


@pytest.mark.django_db
def test_password_reset_confirm_now_throttled_per_ip(db):
    """Previously had zero throttle at all — unlimited POSTs to the same IP."""
    c = _client_from_ip("10.9.2.1")
    payload = {"uid": "bogus", "token": "bogus", "new_password": "NewStrongPass456!"}

    statuses = [c.post("/api/auth/password/reset/confirm/", payload, format="json").status_code for _ in range(5)]
    assert all(s == 400 for s in statuses)  # malformed uid — 400, throttle not yet hit

    blocked = c.post("/api/auth/password/reset/confirm/", payload, format="json")
    assert blocked.status_code == 429


@pytest.mark.django_db
def test_password_reset_confirm_locks_out_after_repeated_invalid_token(settings, locked_out_user):
    from django.utils.http import urlsafe_base64_encode
    from django.utils.encoding import force_bytes
    from django.contrib.auth.tokens import default_token_generator

    settings.LOGIN_LOCKOUT_THRESHOLD = 5
    uid = urlsafe_base64_encode(force_bytes(str(locked_out_user.pk)))
    real_token = default_token_generator.make_token(locked_out_user)

    for i in range(5):
        response = _reset_confirm(i, uid, "not-the-real-token")
        assert response.status_code == 400

    # 6th attempt — even with the REAL token — must be blocked by the lockout.
    blocked = _reset_confirm(5, uid, real_token)
    assert blocked.status_code == 429
    assert blocked.has_header("Retry-After")

    entry = AuditLog.objects.get(entity="auth", action="account_locked", metadata__identifier=f"reset-token:{locked_out_user.pk}")
    assert entry.user_id == locked_out_user.id


# ── Integration tests: password_reset_request cooldown ───────────────

@pytest.mark.django_db
def test_password_reset_request_cooldown_suppresses_duplicate_sends(django_capture_on_commit_callbacks, locked_out_user):
    c = APIClient()

    with django_capture_on_commit_callbacks(execute=True):
        first = c.post("/api/auth/password/reset/", {"email": "target@example.com"}, format="json")
    with django_capture_on_commit_callbacks(execute=True):
        second = c.post("/api/auth/password/reset/", {"email": "target@example.com"}, format="json")

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.data == second.data  # identical response — cooldown is silent, no distinguishing signal
    assert len(mail.outbox) == 1  # only the first call actually queued a send


@pytest.mark.django_db
def test_password_reset_request_cooldown_enumeration_safe_for_unknown_email(django_capture_on_commit_callbacks, db):
    c = APIClient()

    with django_capture_on_commit_callbacks(execute=True):
        first = c.post("/api/auth/password/reset/", {"email": "nobody@example.com"}, format="json")
    with django_capture_on_commit_callbacks(execute=True):
        second = c.post("/api/auth/password/reset/", {"email": "nobody@example.com"}, format="json")

    assert first.status_code == second.status_code == 200
    assert first.data == second.data
    assert len(mail.outbox) == 0  # no account — nothing ever sent, either call
