"""
Tests for ticket endpoints.

Run with:
  cd backend
  pytest tests/test_tickets.py -v
"""

from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from support_app.models import Customer, Freelancer, Ticket, TicketComment

User = get_user_model()


@pytest.fixture
def auth_client(db):
    """An API client authenticated as a customer (uses force_authenticate to avoid rate limits)."""
    user = User.objects.create_user(
        email="customer@example.com",
        password="StrongPass123!",
        role="customer",
    )
    Customer.objects.create(user=user, company="Test Co")
    client = APIClient()
    client.force_authenticate(user=user)
    return client, user


@pytest.mark.django_db
def test_create_ticket(auth_client):
    """POST /api/tickets/ should create a ticket with status pending_payment."""
    client, user = auth_client
    payload = {
        "title": "Server down",
        "description": "Production server not responding",
        "service_type": "server_admin",
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
        {"title": "My ticket", "service_type": "laptop_desktop", "severity": "low"},
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
        {"title": "Test", "service_type": "server_admin", "severity": "high"},
        format="json",
    )
    assert response.status_code == 401


@pytest.mark.django_db
def test_admin_can_retrieve_any_ticket(auth_client):
    """
    GET /api/tickets/{id}/ must return 200 for an admin user even when the
    ticket belongs to a different customer. Previously this raised a 500
    because get_queryset() called .customer_profile on a User with no
    Customer record.
    """
    customer_client, customer_user = auth_client

    # Customer creates a ticket
    create_resp = customer_client.post(
        "/api/tickets/",
        {"title": "Customer ticket", "service_type": "server_admin", "severity": "low"},
        format="json",
    )
    assert create_resp.status_code == 201
    # TicketCreateSerializer only echoes back the input fields (no id in response).
    # Fetch the id directly from the database.
    ticket_id = str(Ticket.objects.get(title="Customer ticket").id)

    # Create a staff user (no Customer profile — that's intentional)
    admin_user = User.objects.create_user(
        email="admin@example.com",
        password="AdminPass123!",
        is_staff=True,
        role="admin",
    )
    admin_client = APIClient()
    admin_client.force_authenticate(user=admin_user)

    # Admin should get 200, not 500
    response = admin_client.get(f"/api/tickets/{ticket_id}/")
    assert response.status_code == 200
    assert response.data["id"] == ticket_id


# ── Comment ownership tests ───────────────────────────────────────

def _make_customer_client(db, email):
    """
    Helper: create a customer user and return an authenticated APIClient.
    Uses force_authenticate() instead of the login endpoint to avoid
    consuming the anonymous rate-limit quota during tests.
    """
    user = User.objects.create_user(
        email=email, password="StrongPass123!", role="customer"
    )
    from support_app.models import Customer
    Customer.objects.create(user=user, company="Co")
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
def test_customer_cannot_read_another_customers_comments(db):
    """
    GET /api/tickets/{id}/comments/ must return 404 when the ticket
    belongs to a different customer — not expose the comment thread.
    """
    client_a = _make_customer_client(db, "a@example.com")
    client_b = _make_customer_client(db, "b@example.com")

    # Customer A creates a ticket
    client_a.post(
        "/api/tickets/",
        {"title": "A ticket", "service_type": "server_admin", "severity": "low"},
        format="json",
    )
    from support_app.models import Ticket
    ticket_id = str(Ticket.objects.get(title="A ticket").id)

    # Customer B tries to read A's comments — must get 404
    response = client_b.get(f"/api/tickets/{ticket_id}/comments/")
    assert response.status_code == 404


@pytest.mark.django_db
def test_customer_cannot_post_comment_on_another_customers_ticket(db):
    """
    POST /api/tickets/{id}/comments/ must return 404 when the ticket
    belongs to a different customer — must not create a comment.
    """
    client_a = _make_customer_client(db, "c@example.com")
    client_b = _make_customer_client(db, "d@example.com")

    client_a.post(
        "/api/tickets/",
        {"title": "C ticket", "service_type": "laptop_desktop", "severity": "low"},
        format="json",
    )
    from support_app.models import Ticket, TicketComment
    ticket_id = str(Ticket.objects.get(title="C ticket").id)

    response = client_b.post(
        f"/api/tickets/{ticket_id}/comments/",
        {"body": "intruder comment"},
        format="json",
    )
    assert response.status_code == 404
    assert TicketComment.objects.count() == 0


@pytest.mark.django_db
def test_customer_can_post_comment_on_own_ticket(db):
    """
    POST /api/tickets/{id}/comments/ must succeed (201) for the ticket owner.
    """
    client_a = _make_customer_client(db, "e@example.com")

    client_a.post(
        "/api/tickets/",
        {"title": "E ticket", "service_type": "server_admin", "severity": "medium"},
        format="json",
    )
    from support_app.models import Ticket, TicketComment
    ticket_id = str(Ticket.objects.get(title="E ticket").id)

    response = client_a.post(
        f"/api/tickets/{ticket_id}/comments/",
        {"body": "please fix asap"},
        format="json",
    )
    assert response.status_code == 201
    assert TicketComment.objects.filter(body="please fix asap").exists()


# ── CSAT tests ────────────────────────────────────────────────────

def _create_ticket_for_client(client, title, status_override=None):
    """Helper: create a ticket via API, then optionally force its status in the DB."""
    from support_app.models import Ticket
    client.post(
        "/api/tickets/",
        {"title": title, "service_type": "server_admin", "severity": "medium"},
        format="json",
    )
    ticket = Ticket.objects.get(title=title)
    if status_override:
        ticket.status = status_override
        ticket.save(update_fields=["status"])
    return str(ticket.id)


@pytest.mark.django_db
def test_csat_submit_succeeds_for_resolved_ticket(db):
    """POST /api/tickets/{id}/csat/ returns 201 when the ticket is resolved."""
    client_a = _make_customer_client(db, "csat_a@example.com")
    ticket_id = _create_ticket_for_client(client_a, "CSAT ticket A", status_override="resolved")

    response = client_a.post(
        f"/api/tickets/{ticket_id}/csat/",
        {"score": 5, "comment": "Great service!"},
        format="json",
    )
    assert response.status_code == 201
    assert response.data["score"] == 5

    from support_app.models import CSATSurvey
    assert CSATSurvey.objects.filter(comment="Great service!").exists()


@pytest.mark.django_db
def test_csat_rejected_for_open_ticket(db):
    """POST /api/tickets/{id}/csat/ returns 400 when the ticket is still open."""
    client_a = _make_customer_client(db, "csat_b@example.com")
    ticket_id = _create_ticket_for_client(client_a, "CSAT ticket B")  # status = pending_payment

    response = client_a.post(
        f"/api/tickets/{ticket_id}/csat/",
        {"score": 4},
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_csat_cannot_be_submitted_twice(db):
    """POST /api/tickets/{id}/csat/ returns 409 on a second submission."""
    client_a = _make_customer_client(db, "csat_c@example.com")
    ticket_id = _create_ticket_for_client(client_a, "CSAT ticket C", status_override="resolved")

    client_a.post(f"/api/tickets/{ticket_id}/csat/", {"score": 5}, format="json")
    response = client_a.post(f"/api/tickets/{ticket_id}/csat/", {"score": 3}, format="json")
    assert response.status_code == 409


@pytest.mark.django_db
def test_csat_invalid_score_returns_400(db):
    """POST /api/tickets/{id}/csat/ returns 400 when score is outside 1–5."""
    client_a = _make_customer_client(db, "csat_d@example.com")
    ticket_id = _create_ticket_for_client(client_a, "CSAT ticket D", status_override="resolved")

    response = client_a.post(
        f"/api/tickets/{ticket_id}/csat/",
        {"score": 6},
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_csat_returns_404_for_other_customers_ticket(db):
    """POST /api/tickets/{id}/csat/ returns 404 when the ticket belongs to another customer."""
    client_a = _make_customer_client(db, "csat_e@example.com")
    client_b = _make_customer_client(db, "csat_f@example.com")
    ticket_id = _create_ticket_for_client(client_a, "CSAT ticket E", status_override="resolved")

    response = client_b.post(
        f"/api/tickets/{ticket_id}/csat/",
        {"score": 5},
        format="json",
    )
    assert response.status_code == 404


# ── Customer Workspace Phase 1 — SLA status & reply-ownership signals ──

def _make_customer(email):
    """Helper: create a customer User + Customer profile, return the User."""
    user = User.objects.create_user(email=email, password="StrongPass123!", role="customer")
    Customer.objects.create(user=user, company="Co")
    return user


def _make_freelancer(email):
    """Helper: create a freelancer User + Freelancer profile, return the User."""
    user = User.objects.create_user(email=email, password="StrongPass123!", role="freelancer")
    Freelancer.objects.create(
        user=user, skills="server_admin", onboarding_status="approved", active=True
    )
    return user


def _client_for(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
def test_customer_list_includes_sla_and_ownership_fields(db):
    """
    GET /api/tickets/ must include sla_status plus the reply-ownership
    fields for a ticket whose due_at has already passed.
    """
    customer = _make_customer("sla_a@example.com")
    Ticket.objects.create(
        customer=customer.customer_profile,
        title="Overdue ticket",
        service_type="server_admin",
        severity="high",
        status="in_progress",
        due_at=timezone.now() - timedelta(hours=1),
    )

    response = _client_for(customer).get("/api/tickets/")
    assert response.status_code == 200
    ticket_data = response.data["results"][0]
    assert ticket_data["sla_status"] == "overdue"
    for field in (
        "updated_at", "due_at", "first_response_due_at", "assigned_to",
        "waiting_on_customer", "awaiting_engineer_reply",
        "waiting_on_internal", "last_public_comment_at",
    ):
        assert field in ticket_data


@pytest.mark.django_db
def test_customer_list_sla_status_ok_and_due_soon(db):
    """sla_status must distinguish a far-future deadline (ok) from one within 2h (due_soon)."""
    customer = _make_customer("sla_b@example.com")
    ok_ticket = Ticket.objects.create(
        customer=customer.customer_profile,
        title="Plenty of time",
        service_type="server_admin",
        severity="medium",
        status="open",
        due_at=timezone.now() + timedelta(hours=24),
    )
    due_soon_ticket = Ticket.objects.create(
        customer=customer.customer_profile,
        title="Cutting it close",
        service_type="server_admin",
        severity="medium",
        status="open",
        due_at=timezone.now() + timedelta(minutes=30),
    )

    response = _client_for(customer).get("/api/tickets/")
    assert response.status_code == 200
    by_id = {t["id"]: t for t in response.data["results"]}
    assert by_id[str(ok_ticket.id)]["sla_status"] == "ok"
    assert by_id[str(due_soon_ticket.id)]["sla_status"] == "due_soon"


@pytest.mark.django_db
def test_customer_list_waiting_on_customer_true(db):
    """
    When the latest public comment was posted by the engineer, the ticket
    is waiting on the customer to reply.
    """
    customer = _make_customer("sla_c@example.com")
    freelancer = _make_freelancer("sla_c_engineer@example.com")
    ticket = Ticket.objects.create(
        customer=customer.customer_profile,
        title="Engineer replied",
        service_type="server_admin",
        severity="medium",
        status="in_progress",
        assigned_to=freelancer.freelancer_profile,
    )
    TicketComment.objects.create(
        ticket=ticket, author=freelancer, body="Looking into it", is_internal=False
    )

    response = _client_for(customer).get("/api/tickets/")
    ticket_data = response.data["results"][0]
    assert ticket_data["waiting_on_customer"] is True
    assert ticket_data["awaiting_engineer_reply"] is False
    assert ticket_data["assigned_to"]["email"] == freelancer.email


@pytest.mark.django_db
def test_customer_list_awaiting_engineer_reply_true(db):
    """
    When the latest public comment was posted by the customer, the ticket
    is awaiting the engineer's reply.
    """
    customer = _make_customer("sla_d@example.com")
    freelancer = _make_freelancer("sla_d_engineer@example.com")
    ticket = Ticket.objects.create(
        customer=customer.customer_profile,
        title="Customer replied",
        service_type="server_admin",
        severity="medium",
        status="in_progress",
        assigned_to=freelancer.freelancer_profile,
    )
    TicketComment.objects.create(
        ticket=ticket, author=customer, body="Any update?", is_internal=False
    )

    response = _client_for(customer).get("/api/tickets/")
    ticket_data = response.data["results"][0]
    assert ticket_data["awaiting_engineer_reply"] is True
    assert ticket_data["waiting_on_customer"] is False


@pytest.mark.django_db
def test_customer_list_exclude_status(db):
    """?exclude_status=closed must omit closed tickets from the list."""
    customer = _make_customer("sla_e@example.com")
    open_ticket = Ticket.objects.create(
        customer=customer.customer_profile, title="Still open",
        service_type="server_admin", severity="low", status="open",
    )
    closed_ticket = Ticket.objects.create(
        customer=customer.customer_profile, title="Already closed",
        service_type="server_admin", severity="low", status="closed",
    )

    response = _client_for(customer).get("/api/tickets/?exclude_status=closed")
    assert response.status_code == 200
    ids = {t["id"] for t in response.data["results"]}
    assert str(open_ticket.id) in ids
    assert str(closed_ticket.id) not in ids


@pytest.mark.django_db
def test_customer_list_page_size_param(db):
    """?page_size= must be honored (previously capped at 20 regardless)."""
    customer = _make_customer("sla_f@example.com")
    for i in range(25):
        Ticket.objects.create(
            customer=customer.customer_profile, title=f"Ticket {i}",
            service_type="server_admin", severity="low", status="open",
        )

    response = _client_for(customer).get("/api/tickets/?page_size=50")
    assert response.status_code == 200
    assert len(response.data["results"]) > 20


@pytest.mark.django_db
def test_customer_cannot_see_another_customers_ticket_in_list(db):
    """The richer list payload must still be scoped to the requesting customer only."""
    customer_a = _make_customer("sla_g_a@example.com")
    customer_b = _make_customer("sla_g_b@example.com")
    ticket_a = Ticket.objects.create(
        customer=customer_a.customer_profile, title="A's ticket",
        service_type="server_admin", severity="low", status="open",
    )
    ticket_b = Ticket.objects.create(
        customer=customer_b.customer_profile, title="B's ticket",
        service_type="server_admin", severity="low", status="open",
    )

    response = _client_for(customer_b).get("/api/tickets/")
    ids = {t["id"] for t in response.data["results"]}
    assert str(ticket_b.id) in ids
    assert str(ticket_a.id) not in ids


@pytest.mark.django_db
def test_ticket_detail_includes_sla_status(db):
    """GET /api/tickets/{id}/ must include a computed sla_status field."""
    customer = _make_customer("sla_h@example.com")
    ticket = Ticket.objects.create(
        customer=customer.customer_profile, title="Detail check",
        service_type="server_admin", severity="low", status="open",
    )

    response = _client_for(customer).get(f"/api/tickets/{ticket.id}/")
    assert response.status_code == 200
    assert response.data["sla_status"] in {"no_deadline", "overdue", "due_soon", "ok"}
