"""
conftest.py — shared pytest fixtures for all tests.

pytest-django automatically discovers this file. Any fixture defined here
is available in every test file without an explicit import.

DJANGO_SETTINGS_MODULE is set in pytest.ini, so Django initializes before
any test runs.
"""

import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from support_app.models import Customer


@pytest.fixture
def api_client():
    """An unauthenticated DRF test client."""
    return APIClient()


@pytest.fixture
def make_user(db):
    """
    Factory fixture — call it to create a User + Customer in one step.

    Usage in a test:
        def test_something(make_user):
            user = make_user(email="a@b.com", password="Pass123!")
    """
    def _make(email="user@example.com", password="StrongPass123!", company="Test Co"):
        user = User.objects.create_user(
            username=email,
            email=email,
            password=password,
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
    response = api_client.post(
        "/api/auth/login/",
        {"username": user.email, "password": "StrongPass123!"},
        format="json",
    )
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
    return api_client, user
