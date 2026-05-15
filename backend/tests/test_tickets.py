"""
Tests for ticket endpoints.

Run with:
  cd backend
  pytest tests/test_tickets.py -v
"""

import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from support_app.models import Customer, Ticket


@pytest.fixture
def auth_client(db):
    """An API client authenticated as a customer."""
    user = User.objects.create_user(
        username="customer@example.com",
        email="customer@example.com",
        password="StrongPass123!",
    )
    Customer.objects.create(user=user, company="Test Co")

    client = APIClient()
    response = client.post(
        "/api/auth/login/",
        {"username": "customer@example.com", "password": "StrongPass123!"},
        format="json",
    )
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
    return client, user


@pytest.mark.django_db
def test_create_ticket(auth_client):
    """POST /api/tickets/ should create a ticket with status pending_payment."""
    client, user = auth_client
    payload = {
        "title": "Server down",
        "description": "Production server not responding",
        "service_type": "linux",
        "severity": "high",
    }
    response = client.post("/api/tickets/", payload, format="json")

    assert response.status_code == 201
    assert Ticket.objects.filter(title="Server down").exists()
    ticket = Ticket.objects.get(title="Server down")
    assert ticket.status == "pending_payment"
    assert ticket.ticket_number.startswith("TKT-")


@pytest.mark.django_db
def test_list_tickets_only_shows_own(auth_client):
    """GET /api/tickets/ should only return the authenticated customer's tickets."""
    client, user = auth_client

    # Create a ticket for this user
    client.post(
        "/api/tickets/",
        {"title": "My ticket", "service_type": "desktop", "severity": "low"},
        format="json",
    )

    response = client.get("/api/tickets/")
    assert response.status_code == 200
    # Only 1 ticket visible — their own
    assert response.data["count"] == 1


@pytest.mark.django_db
def test_unauthenticated_cannot_create_ticket():
    """Unauthenticated users should receive 401."""
    client = APIClient()
    response = client.post(
        "/api/tickets/",
        {"title": "Test", "service_type": "linux", "severity": "high"},
        format="json",
    )
    assert response.status_code == 401
