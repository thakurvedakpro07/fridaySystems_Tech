"""
Tests for authentication endpoints.

Run with:
  cd backend
  pytest tests/test_auth.py -v
"""

from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

User = get_user_model()


@pytest.fixture
def client():
    """A fresh API test client for each test."""
    return APIClient()


@pytest.fixture
def sample_user(db):
    """A saved CustomUser + Customer for use in tests."""
    from support_app.models import Customer
    # No username= kwarg: CustomUser has no username field.
    user = User.objects.create_user(
        email="test@example.com",
        password="StrongPass123!",
        role="customer",
    )
    Customer.objects.create(user=user, company="Test Co")
    return user


@pytest.mark.django_db
def test_register_creates_user_and_customer(client):
    """POST /api/auth/register/ should create a User and a Customer profile."""
    payload = {
        "email": "new@example.com",
        "password": "StrongPass123!",
        "password2": "StrongPass123!",
        "company": "Acme Pvt Ltd",
        "phone": "+91 98765 43210",
        "consent": True,
    }
    response = client.post("/api/auth/register/", payload, format="json")

    assert response.status_code == 201
    assert "access" in response.data
    assert "refresh" in response.data
    assert User.objects.filter(email="new@example.com").exists()


@pytest.mark.django_db
def test_login_returns_tokens(client, sample_user):
    """POST /api/auth/login/ should return access and refresh tokens."""
    # Key is "email" (not "username") because USERNAME_FIELD = "email" on CustomUser.
    # SimpleJWT dynamically uses USERNAME_FIELD as the JSON key name.
    payload = {"email": "test@example.com", "password": "StrongPass123!"}
    response = client.post("/api/auth/login/", payload, format="json")

    assert response.status_code == 200
    assert "access" in response.data
    assert "refresh" in response.data


@pytest.mark.django_db
def test_login_wrong_password_returns_401(client, sample_user):
    payload = {"email": "test@example.com", "password": "WrongPassword!"}
    response = client.post("/api/auth/login/", payload, format="json")

    assert response.status_code == 401


@pytest.mark.django_db
def test_register_duplicate_email_returns_400(client):
    """
    Registering twice with the same email must return 400 with an 'email'
    error key — not 500 (IntegrityError). The frontend reads response.data.email[0]
    to show the error message, so the key name matters.
    """
    payload = {
        "email": "dup@example.com",
        "password": "StrongPass123!",
        "password2": "StrongPass123!",
        "company": "Acme",
        "consent": True,
    }
    # First registration succeeds
    r1 = client.post("/api/auth/register/", payload, format="json")
    assert r1.status_code == 201

    # Second registration with the exact same email must fail gracefully
    r2 = client.post("/api/auth/register/", payload, format="json")
    assert r2.status_code == 400
    # Error is nested under "errors" key by the custom exception handler
    errors = r2.data.get("errors", r2.data)
    assert "email" in errors


@pytest.mark.django_db
def test_logout_blacklists_refresh_token(client, sample_user):
    """POST /api/auth/logout/ should blacklist the refresh token so it cannot be reused."""
    from rest_framework_simplejwt.tokens import RefreshToken as RT
    from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken

    refresh = str(RT.for_user(sample_user))

    response = client.post("/api/auth/logout/", {"refresh": refresh}, format="json")
    assert response.status_code == 204
    assert BlacklistedToken.objects.count() == 1

    # A second call with the same token must still return 204 (idempotent)
    response2 = client.post("/api/auth/logout/", {"refresh": refresh}, format="json")
    assert response2.status_code == 204


@pytest.mark.django_db
def test_register_duplicate_email_case_insensitive_returns_400(client):
    """
    Email matching must be case-insensitive: 'User@Example.com' and
    'user@example.com' are the same account.
    """
    client.post("/api/auth/register/", {
        "email": "case@example.com",
        "password": "StrongPass123!",
        "password2": "StrongPass123!",
        "consent": True,
    }, format="json")

    response = client.post("/api/auth/register/", {
        "email": "CASE@EXAMPLE.COM",
        "password": "StrongPass123!",
        "password2": "StrongPass123!",
        "consent": True,
    }, format="json")
    assert response.status_code == 400
    errors = response.data.get("errors", response.data)
    assert "email" in errors


# ── /api/auth/me/ tests ───────────────────────────────────────────

@pytest.mark.django_db
def test_me_endpoint_returns_user_data(client, sample_user):
    """GET /api/auth/me/ must return id, email, role, is_staff for the caller."""
    from rest_framework_simplejwt.tokens import RefreshToken as RT
    access = str(RT.for_user(sample_user).access_token)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    response = client.get("/api/auth/me/")

    assert response.status_code == 200
    assert response.data["email"] == sample_user.email
    assert response.data["role"] == "customer"
    assert response.data["is_staff"] is False
    assert "id" in response.data


@pytest.mark.django_db
def test_me_endpoint_includes_customer_profile(client, sample_user):
    """/auth/me/ should include a 'profile' key with plan and company for customers."""
    from rest_framework_simplejwt.tokens import RefreshToken as RT
    access = str(RT.for_user(sample_user).access_token)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    response = client.get("/api/auth/me/")

    assert response.status_code == 200
    assert "profile" in response.data
    assert "plan" in response.data["profile"]
    assert "company" in response.data["profile"]


@pytest.mark.django_db
def test_me_endpoint_requires_authentication(client):
    """GET /api/auth/me/ without a token must return 401."""
    response = client.get("/api/auth/me/")
    assert response.status_code == 401


@pytest.mark.django_db
def test_me_endpoint_works_for_admin(db):
    """GET /api/auth/me/ must return role='admin' for staff users with no customer profile."""
    admin = User.objects.create_user(
        email="admin@example.com",
        password="AdminPass123!",
        role="admin",
        is_staff=True,
    )
    from rest_framework_simplejwt.tokens import RefreshToken as RT
    access = str(RT.for_user(admin).access_token)

    admin_client = APIClient()
    admin_client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    response = admin_client.get("/api/auth/me/")

    assert response.status_code == 200
    assert response.data["role"] == "admin"
    assert response.data["is_staff"] is True
    # Admins have no customer/freelancer profile
    assert "profile" not in response.data


# ── Protected route tests ─────────────────────────────────────────

@pytest.mark.django_db
def test_protected_route_with_valid_token(client, sample_user):
    """A request with a valid Bearer token must reach protected endpoints."""
    from rest_framework_simplejwt.tokens import RefreshToken as RT
    access = str(RT.for_user(sample_user).access_token)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    response = client.get("/api/tickets/")
    assert response.status_code == 200


@pytest.mark.django_db
def test_protected_route_without_token_returns_401(client):
    """A request with no Authorization header must be rejected with 401."""
    response = client.get("/api/tickets/")
    assert response.status_code == 401


@pytest.mark.django_db
def test_protected_route_with_invalid_token_returns_401(client):
    """A garbled Bearer token must return 401."""
    client.credentials(HTTP_AUTHORIZATION="Bearer this.is.not.a.real.token")
    response = client.get("/api/tickets/")
    assert response.status_code == 401


# ── Refresh token flow ────────────────────────────────────────────

@pytest.mark.django_db
def test_refresh_token_returns_new_access_token(client, sample_user):
    """POST /api/auth/refresh/ with a valid refresh token must return a new access token."""
    from rest_framework_simplejwt.tokens import RefreshToken as RT
    refresh = str(RT.for_user(sample_user))

    response = client.post("/api/auth/refresh/", {"refresh": refresh}, format="json")

    assert response.status_code == 200
    assert "access" in response.data


@pytest.mark.django_db
def test_refresh_token_rotation_invalidates_old_refresh(client, sample_user):
    """
    After rotating a refresh token, the old refresh token must be blacklisted.
    ROTATE_REFRESH_TOKENS=True and BLACKLIST_AFTER_ROTATION=True ensure this.
    """
    from rest_framework_simplejwt.tokens import RefreshToken as RT
    from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken

    refresh = str(RT.for_user(sample_user))

    # First refresh call — succeeds and rotates
    r1 = client.post("/api/auth/token/refresh/", {"refresh": refresh}, format="json")
    assert r1.status_code == 200

    # The old refresh token must now be blacklisted
    assert BlacklistedToken.objects.count() >= 1

    # Using the old refresh token again must fail
    r2 = client.post("/api/auth/token/refresh/", {"refresh": refresh}, format="json")
    assert r2.status_code == 401


# ── Blacklisted token rejection ────────────────────────────────────

@pytest.mark.django_db
def test_blacklisted_refresh_token_is_rejected(client, sample_user):
    """A refresh token that was blacklisted via logout must be rejected."""
    from rest_framework_simplejwt.tokens import RefreshToken as RT
    refresh = str(RT.for_user(sample_user))

    # Log out — blacklists the token
    client.post("/api/auth/logout/", {"refresh": refresh}, format="json")

    # Trying to refresh with the now-blacklisted token must fail
    response = client.post("/api/auth/token/refresh/", {"refresh": refresh}, format="json")
    assert response.status_code == 401


# ── Admin login compatibility ──────────────────────────────────────

@pytest.mark.django_db
def test_admin_can_login_via_api(db):
    """Admin accounts must be able to log in via /api/auth/login/ and get tokens."""
    admin = User.objects.create_user(
        email="admin2@example.com",
        password="AdminPass123!",
        role="admin",
        is_staff=True,
    )
    admin_client = APIClient()
    response = admin_client.post(
        "/api/auth/login/",
        {"email": "admin2@example.com", "password": "AdminPass123!"},
        format="json",
    )
    assert response.status_code == 200
    assert "access" in response.data
    assert response.data["user"]["role"] == "admin"
    assert response.data["user"]["is_staff"] is True


@pytest.mark.django_db
def test_login_response_includes_user_object(client, sample_user):
    """The login response must include {id, email, role, is_staff} so the frontend
    can populate the auth store without a second API call."""
    response = client.post(
        "/api/auth/login/",
        {"email": sample_user.email, "password": "StrongPass123!"},
        format="json",
    )
    assert response.status_code == 200
    assert "user" in response.data
    user = response.data["user"]
    assert user["email"] == sample_user.email
    assert "role" in user
    assert "is_staff" in user
    assert "id" in user


@pytest.mark.django_db
def test_register_returns_tokens_and_user(client):
    """POST /api/auth/register/ must return {access, refresh, user} so the
    frontend can log in immediately after registration without a second call."""
    response = client.post("/api/auth/register/", {
        "email": "newuser@example.com",
        "password": "StrongPass123!",
        "password2": "StrongPass123!",
        "company": "Test Company",
        "consent": True,
    }, format="json")

    assert response.status_code == 201
    assert "access" in response.data
    assert "refresh" in response.data
    assert response.data["user"]["role"] == "customer"


@pytest.mark.django_db
def test_register_mismatched_passwords_returns_400(db):
    """Registering with password != password2 must return 400 and not create a user."""
    # Use a dedicated client with unique IP to avoid AuthRateThrottle bleed from
    # other tests (all tests share 127.0.0.1 by default, but throttle is per-IP).
    c = APIClient()
    c.defaults["REMOTE_ADDR"] = "10.0.0.91"
    response = c.post("/api/auth/register/", {
        "email": "mismatch@example.com",
        "password": "StrongPass123!",
        "password2": "DifferentPass456!",
        "consent": True,
    }, format="json")

    assert response.status_code == 400
    errors = response.data.get("errors", response.data)
    assert "password2" in errors or "non_field_errors" in errors
    assert not User.objects.filter(email="mismatch@example.com").exists()


@pytest.mark.django_db
def test_register_missing_password2_returns_400(db):
    """Omitting password2 entirely must return 400 — it is a required field."""
    c = APIClient()
    c.defaults["REMOTE_ADDR"] = "10.0.0.92"
    response = c.post("/api/auth/register/", {
        "email": "nopw2@example.com",
        "password": "StrongPass123!",
        "consent": True,
    }, format="json")

    assert response.status_code == 400
    assert not User.objects.filter(email="nopw2@example.com").exists()


# ── Password-change rate limiting (PasswordChangeRateThrottle) ─────
#
# change-password is keyed per authenticated user (UserRateThrottle falls
# back to per-user.pk, not per-IP), so each test below uses a distinct user
# to avoid sharing a throttle bucket with other tests.

def _make_authed_client(email):
    """Create a user + Customer profile and return an authenticated APIClient."""
    from support_app.models import Customer
    from rest_framework_simplejwt.tokens import RefreshToken as RT

    user = User.objects.create_user(email=email, password="StrongPass123!", role="customer")
    Customer.objects.create(user=user, company="Test Co")
    access = str(RT.for_user(user).access_token)
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
    return c, user


@pytest.mark.django_db
def test_change_password_success(db):
    """A valid current_password + new_password change must return 200."""
    c, user = _make_authed_client("pwchange_a@example.com")

    response = c.post("/api/auth/change-password/", {
        "current_password": "StrongPass123!",
        "new_password": "BrandNewPass456!",
    }, format="json")

    assert response.status_code == 200
    user.refresh_from_db()
    assert user.check_password("BrandNewPass456!")


@pytest.mark.django_db
def test_change_password_rate_limit_reached(db):
    """
    PasswordChangeRateThrottle allows 5 requests per window; the 6th must
    return 429. Wrong current_password still counts against the bucket —
    DRF throttling runs before the view body, so failed attempts count too.
    """
    c, _user = _make_authed_client("pwchange_b@example.com")

    for _ in range(5):
        response = c.post("/api/auth/change-password/", {
            "current_password": "WrongPassword!",
            "new_password": "Whatever123!",
        }, format="json")
        assert response.status_code != 429

    response = c.post("/api/auth/change-password/", {
        "current_password": "WrongPassword!",
        "new_password": "Whatever123!",
    }, format="json")

    assert response.status_code == 429
    assert response.has_header("Retry-After")
    detail = response.data.get("detail", "")
    assert "throttled" in detail.lower()


@pytest.mark.django_db
def test_change_password_throttle_resets_after_window(db):
    """
    Once the throttle window elapses, requests must be allowed again.
    The throttle history is stored in the cache keyed by scope + user id with
    a TTL equal to the window, so clearing that cache entry is equivalent to
    the window having expired.
    """
    from django.core.cache import cache

    c, _user = _make_authed_client("pwchange_c@example.com")

    for _ in range(5):
        response = c.post("/api/auth/change-password/", {
            "current_password": "WrongPassword!",
            "new_password": "Whatever123!",
        }, format="json")
        assert response.status_code != 429

    blocked = c.post("/api/auth/change-password/", {
        "current_password": "WrongPassword!",
        "new_password": "Whatever123!",
    }, format="json")
    assert blocked.status_code == 429

    cache.clear()  # simulate the 15-minute window elapsing

    response = c.post("/api/auth/change-password/", {
        "current_password": "StrongPass123!",
        "new_password": "FinallyChanged789!",
    }, format="json")
    assert response.status_code == 200


# ── Freelancer profile GET/PATCH ──────────────────────────────────

@pytest.fixture
def freelancer_sample_user(db):
    """A saved CustomUser + Freelancer for profile-endpoint tests."""
    from support_app.models import Freelancer
    user = User.objects.create_user(
        email="engineer-profile@example.com",
        password="StrongPass123!",
        role="freelancer",
    )
    Freelancer.objects.create(
        user=user,
        skills="aws,kubernetes",
        availability="part_time",
        rating=Decimal("4.50"),
        onboarding_status="approved",
    )
    return user


@pytest.mark.django_db
def test_freelancer_profile_get_includes_rating_and_onboarding_status(client, freelancer_sample_user):
    """GET /api/auth/profile/ must expose rating/onboarding_status (read-only) for freelancers."""
    from rest_framework_simplejwt.tokens import RefreshToken as RT
    access = str(RT.for_user(freelancer_sample_user).access_token)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    response = client.get("/api/auth/profile/")

    assert response.status_code == 200
    assert response.data["skills"] == "aws,kubernetes"
    assert response.data["availability"] == "part_time"
    assert response.data["rating"] == "4.50"
    assert response.data["onboarding_status"] == "approved"


@pytest.mark.django_db
def test_freelancer_profile_patch_cannot_write_rating_or_onboarding_status(client, freelancer_sample_user):
    """PATCH must silently ignore attempts to write rating/onboarding_status."""
    from rest_framework_simplejwt.tokens import RefreshToken as RT
    access = str(RT.for_user(freelancer_sample_user).access_token)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    response = client.patch("/api/auth/profile/", {
        "rating": "5.00",
        "onboarding_status": "suspended",
        "skills": "aws,kubernetes,terraform",
    }, format="json")

    assert response.status_code == 200
    freelancer_sample_user.freelancer_profile.refresh_from_db()
    assert freelancer_sample_user.freelancer_profile.rating == Decimal("4.50")
    assert freelancer_sample_user.freelancer_profile.onboarding_status == "approved"
    assert freelancer_sample_user.freelancer_profile.skills == "aws,kubernetes,terraform"
