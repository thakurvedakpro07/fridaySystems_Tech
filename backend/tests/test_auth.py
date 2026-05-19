"""
Tests for authentication endpoints.

Run with:
  cd backend
  pytest tests/test_auth.py -v
"""

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
        "company": "Acme Pvt Ltd",
        "phone": "+91 98765 43210",
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
        "company": "Acme",
    }
    # First registration succeeds
    r1 = client.post("/api/auth/register/", payload, format="json")
    assert r1.status_code == 201

    # Second registration with the exact same email must fail gracefully
    r2 = client.post("/api/auth/register/", payload, format="json")
    assert r2.status_code == 400
    assert "email" in r2.data


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
    }, format="json")

    response = client.post("/api/auth/register/", {
        "email": "CASE@EXAMPLE.COM",
        "password": "StrongPass123!",
    }, format="json")
    assert response.status_code == 400
    assert "email" in response.data
