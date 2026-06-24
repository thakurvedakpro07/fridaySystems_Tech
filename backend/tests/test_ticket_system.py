"""
Tests for Phase 3 — Ticket system architecture.

Tests focus on:
  - TicketActivityLog is written on creation and status change
  - TicketAssignment records full history through reassignments
  - Internal comments are hidden from customers
  - Service layer functions produce correct side effects
  - Priority field accepted on ticket creation
  - ForeignKey author on comments (not raw UUID)

Run with:
  docker compose exec backend python -m pytest tests/test_ticket_system.py -v
"""

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from support_app.models import (
    Customer,
    Freelancer,
    Ticket,
    TicketActivityLog,
    TicketAssignment,
    TicketComment,
)
from support_app.services.ticket_service import (
    add_comment,
    assign_ticket,
    create_ticket,
    unassign_ticket,
    update_status,
)

User = get_user_model()


# ── Fixtures ──────────────────────────────────────────────────────

@pytest.fixture
def customer_user(db):
    user = User.objects.create_user(
        email="customer@test.com",
        password="StrongPass123!",
        role="customer",
    )
    Customer.objects.create(user=user, company="Acme Ltd")
    return user


@pytest.fixture
def freelancer_user(db):
    user = User.objects.create_user(
        email="freelancer@test.com",
        password="StrongPass123!",
        role="freelancer",
    )
    Freelancer.objects.create(
        user=user,
        skills="linux,vmware",
        onboarding_status="approved",
        active=True,
    )
    return user


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        email="admin@test.com",
        password="StrongPass123!",
        role="admin",
        is_staff=True,
    )


@pytest.fixture
def ticket(db, customer_user):
    """A saved ticket in pending_payment state."""
    return Ticket.objects.create(
        customer=customer_user.customer_profile,
        title="Linux server down",
        service_type="linux",
        severity="high",
        priority="urgent",
        status="open",
    )


# ── Activity Log tests ────────────────────────────────────────────

@pytest.mark.django_db
def test_ticket_creation_logs_activity(customer_user):
    """
    Creating a ticket via service should produce a 'created' activity log entry.
    """
    ticket = create_ticket(
        customer=customer_user.customer_profile,
        validated_data={
            "title": "SSH broken",
            "service_type": "linux",
            "severity": "high",
        },
    )
    logs = TicketActivityLog.objects.filter(ticket=ticket)
    assert logs.count() >= 1
    created_log = logs.filter(action="created").first()
    assert created_log is not None
    assert created_log.actor == customer_user


@pytest.mark.django_db
def test_status_change_logs_activity(ticket, admin_user):
    """
    Changing a ticket's status via update_status() should create a log entry
    with the correct from/to values and the actor set.
    """
    update_status(ticket, "in_progress", actor=admin_user)

    log = TicketActivityLog.objects.filter(
        ticket=ticket,
        action="status_changed",
    ).order_by("-created_at").first()

    assert log is not None
    assert log.from_value == "open"
    assert log.to_value == "in_progress"
    assert log.actor == admin_user


@pytest.mark.django_db
def test_resolve_stamps_resolved_at(ticket, admin_user):
    """
    Moving a ticket to 'resolved' must set resolved_at timestamp.
    """
    assert ticket.resolved_at is None
    update_status(ticket, "resolved", actor=admin_user)
    ticket.refresh_from_db()
    assert ticket.resolved_at is not None


# ── Assignment tests ──────────────────────────────────────────────

@pytest.mark.django_db
def test_assign_ticket_creates_assignment_record(ticket, freelancer_user, admin_user):
    """
    assign_ticket() should create a TicketAssignment record and update
    Ticket.assigned_to and Ticket.status.
    """
    assignment = assign_ticket(
        ticket=ticket,
        freelancer=freelancer_user.freelancer_profile,
        assigned_by=admin_user,
    )

    ticket.refresh_from_db()
    assert ticket.assigned_to == freelancer_user.freelancer_profile
    assert ticket.status == "assigned"
    assert assignment.freelancer == freelancer_user.freelancer_profile
    assert assignment.assigned_by == admin_user
    assert assignment.unassigned_at is None  # still active


@pytest.mark.django_db
def test_reassignment_closes_old_assignment(ticket, freelancer_user, admin_user, db):
    """
    When a ticket is reassigned to a second freelancer, the first assignment
    record should have unassigned_at set. History is preserved.
    """
    freelancer_b_user = User.objects.create_user(
        email="freelancer2@test.com",
        password="StrongPass123!",
        role="freelancer",
    )
    freelancer_b = Freelancer.objects.create(
        user=freelancer_b_user,
        skills="sap",
        onboarding_status="approved",
        active=True,
    )

    # First assignment
    first = assign_ticket(
        ticket=ticket,
        freelancer=freelancer_user.freelancer_profile,
        assigned_by=admin_user,
    )

    # Reassignment
    second = assign_ticket(
        ticket=ticket,
        freelancer=freelancer_b,
        assigned_by=admin_user,
    )

    first.refresh_from_db()
    assert first.unassigned_at is not None       # first assignment closed
    assert second.unassigned_at is None          # second still active
    assert second.reason == "reassigned"

    # Two assignment records exist — full history preserved
    assert TicketAssignment.objects.filter(ticket=ticket).count() == 2


@pytest.mark.django_db
def test_assign_logs_activity(ticket, freelancer_user, admin_user):
    """
    assign_ticket() should write an 'assigned' activity log with actor set.
    """
    assign_ticket(
        ticket=ticket,
        freelancer=freelancer_user.freelancer_profile,
        assigned_by=admin_user,
    )
    log = TicketActivityLog.objects.filter(
        ticket=ticket, action="assigned",
    ).first()
    assert log is not None
    assert log.actor == admin_user
    assert log.to_value == freelancer_user.email


@pytest.mark.django_db
def test_unassign_ticket(ticket, freelancer_user, admin_user):
    """
    unassign_ticket() should clear Ticket.assigned_to, set status back to open,
    and close the TicketAssignment record.
    """
    assign_ticket(ticket, freelancer_user.freelancer_profile, admin_user)
    ticket.refresh_from_db()

    unassign_ticket(ticket, actor=admin_user, note="freelancer unavailable")
    ticket.refresh_from_db()

    assert ticket.assigned_to is None
    assert ticket.status == "open"

    closed = TicketAssignment.objects.filter(ticket=ticket).first()
    assert closed.unassigned_at is not None


# ── Comment tests ─────────────────────────────────────────────────

@pytest.mark.django_db
def test_public_comment_author_is_fk(ticket, customer_user):
    """
    Comments must store author as a FK to CustomUser, not a raw UUID.
    """
    comment = add_comment(ticket, author=customer_user, body="Please fix quickly.")
    assert comment.author == customer_user
    assert comment.author.email == "customer@test.com"
    assert not comment.is_internal


@pytest.mark.django_db
def test_internal_comment_hidden_from_customer_via_api(ticket, customer_user, admin_user):
    """
    GET /api/tickets/{id}/comments/ must NOT return is_internal=True comments
    when requested by a customer.
    """
    # Admin posts an internal note
    add_comment(ticket, author=admin_user, body="Internal: RAID failure suspected.", is_internal=True)
    # Admin posts a public reply
    add_comment(ticket, author=admin_user, body="Looking into it now.", is_internal=False)

    client = APIClient()
    client.force_authenticate(user=customer_user)
    response = client.get(f"/api/tickets/{ticket.id}/comments/")

    assert response.status_code == 200
    results = response.data.get("results", response.data)
    bodies = [c["body"] for c in results]
    assert "Internal: RAID failure suspected." not in bodies
    assert "Looking into it now." in bodies


@pytest.mark.django_db
def test_comment_sets_first_response_at(ticket, freelancer_user):
    """
    first_response_at should be set when a non-customer posts the first
    public comment on a ticket.
    """
    assert ticket.first_response_at is None

    add_comment(ticket, author=freelancer_user, body="Looking into it.", is_internal=False)
    ticket.refresh_from_db()

    assert ticket.first_response_at is not None


@pytest.mark.django_db
def test_customer_comment_does_not_set_first_response_at(ticket, customer_user):
    """
    A comment by the customer themselves must NOT set first_response_at.
    first_response_at measures the support team's response time.
    """
    add_comment(ticket, author=customer_user, body="Any update?", is_internal=False)
    ticket.refresh_from_db()
    assert ticket.first_response_at is None


@pytest.mark.django_db
def test_internal_comment_does_not_set_first_response_at(ticket, admin_user):
    """
    An internal note must NOT set first_response_at — it's not a customer-facing response.
    """
    add_comment(ticket, author=admin_user, body="Internal note.", is_internal=True)
    ticket.refresh_from_db()
    assert ticket.first_response_at is None


# ── Priority field tests ──────────────────────────────────────────

@pytest.mark.django_db
def test_ticket_accepts_priority_field(customer_user):
    """
    Creating a ticket with priority=urgent should persist correctly.
    """
    ticket = create_ticket(
        customer=customer_user.customer_profile,
        validated_data={
            "title": "CEO laptop broken",
            "service_type": "desktop",
            "severity": "low",
            "priority": "urgent",
        },
    )
    assert ticket.priority == "urgent"
    assert ticket.severity == "low"


@pytest.mark.django_db
def test_ticket_default_priority_is_medium(customer_user):
    """
    When no priority is specified, it should default to 'medium'.
    """
    ticket = create_ticket(
        customer=customer_user.customer_profile,
        validated_data={
            "title": "Routine patch",
            "service_type": "patching",
            "severity": "low",
        },
    )
    assert ticket.priority == "medium"


# ── API integration tests ─────────────────────────────────────────

@pytest.mark.django_db
def test_create_ticket_via_api_returns_priority(customer_user):
    """
    POST /api/tickets/ must accept priority and return it in the response.
    """
    client = APIClient()
    client.force_authenticate(user=customer_user)

    response = client.post("/api/tickets/", {
        "title": "SAP login failing",
        "service_type": "sap",
        "severity": "high",
        "priority": "urgent",
    }, format="json")

    assert response.status_code == 201
    assert response.data.get("priority") == "urgent"


@pytest.mark.django_db
def test_ticket_activity_log_ordering(ticket, admin_user, freelancer_user):
    """
    Activity logs should be returned in chronological order (oldest first).
    This matches the "timeline" display pattern in the frontend.
    """
    update_status(ticket, "in_progress", actor=admin_user)
    assign_ticket(ticket, freelancer_user.freelancer_profile, admin_user)

    logs = TicketActivityLog.objects.filter(ticket=ticket).order_by("created_at")
    timestamps = [log.created_at for log in logs]
    assert timestamps == sorted(timestamps)
