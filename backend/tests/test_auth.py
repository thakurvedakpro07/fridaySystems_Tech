"""
Tests for authentication endpoints.

Run with:
  cd backend
  pytest tests/test_auth.py -v
"""

import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient


@pytest.fixture
def client():
    """A fresh API test client for each test."""
    return APIClient()


@pytest.fixture
def sample_user(db):
    """A saved User + Customer for use in tests."""
    from support_app.models import Customer
    user = User.objects.create_user(
        username="test@example.com",
        email="test@example.com",
        password="StrongPass123!",
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
    payload = {"username": "test@example.com", "password": "StrongPass123!"}
    response = client.post("/api/auth/login/", payload, format="json")

    assert response.status_code == 200
    assert "access" in response.data
    assert "refresh" in response.data


@pytest.mark.django_db
def test_login_wrong_password_returns_401(client, sample_user):
    payload = {"username": "test@example.com", "password": "WrongPassword!"}
    response = client.post("/api/auth/login/", payload, format="json")

    assert response.status_code == 401
