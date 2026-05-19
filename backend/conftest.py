"""
conftest.py — shared pytest fixtures for all tests.

pytest-django automatically discovers this file. Any fixture defined here
is available in every test file without an explicit import.

DJANGO_SETTINGS_MODULE is set in pytest.ini, so Django initializes before
any test runs.
"""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from support_app.models import Customer

User = get_user_model()


@pytest.fixture
def api_client():
    """An unauthenticated DRF test client."""
    return APIClient()


@pytest.fixture
def make_user(db):
    """
    Factory fixture — call it to create a CustomUser + Customer in one step.

    Usage in a test:
        def test_something(make_user):
            user = make_user(email="a@b.com", password="Pass123!")
    """
    def _make(email="user@example.com", password="StrongPass123!", company="Test Co"):
        # No username= kwarg: CustomUser has no username field.
        # role="customer" is explicit: every self-registered user is a customer.
        user = User.objects.create_user(
            email=email,
            password=password,
            role="customer",
        )
        Customer.objects.create(user=user, company=company)
        return user

    return _make


@pytest.fixture
def auth_api_client(make_user, api_client):
    """
    A DRF test client pre-authenticated as a customer.

    Returns (client, user) so tests can inspect the user if needed.

    Usage:
        def test_something(auth_api_client):
            client, user = auth_api_client
            response = client.get("/api/tickets/")
    """
    user = make_user()
    # Login key is now "email" (not "username") because USERNAME_FIELD = "email"
    # on CustomUser. SimpleJWT uses USERNAME_FIELD to name the login JSON key.
    response = api_client.post(
        "/api/auth/login/",
        {"email": user.email, "password": "StrongPass123!"},
        format="json",
    )
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
    return api_client, user
