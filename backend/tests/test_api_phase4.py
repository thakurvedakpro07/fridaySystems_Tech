"""
Phase 4 API tests — new endpoints for assignments, activity logs,
freelancer views, and notifications.

Run with:
  docker compose exec backend python -m pytest tests/test_api_phase4.py -v
"""

import uuid

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from support_app.models import Customer, Freelancer, Notification, Ticket
from support_app.services.notification_service import create_notification
from support_app.services.ticket_service import assign_ticket, create_ticket

User = get_user_model()


# ── Fixtures ──────────────────────────────────────────────────────

@pytest.fixture
def customer_user(db):
    user = User.objects.create_user(
        email="customer@test.com", password="StrongPass123!", role="customer"
    )
    Customer.objects.create(user=user, company="Acme Ltd")
    return user


@pytest.fixture
def freelancer_user(db):
    user = User.objects.create_user(
        email="freelancer@test.com", password="StrongPass123!", role="freelancer"
    )
    Freelancer.objects.create(
        user=user, skills="linux", onboarding_status="approved", active=True
    )
    return user


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        email="admin@test.com", password="StrongPass123!", role="admin", is_staff=True
    )


@pytest.fixture
def open_ticket(db, customer_user):
    return Ticket.objects.create(
        customer=customer_user.customer_profile,
        title="Server down",
        service_type="linux",
        severity="high",
        priority="urgent",
        status="open",
    )


@pytest.fixture
def assigned_ticket(db, open_ticket, freelancer_user, admin_user):
    assign_ticket(open_ticket, freelancer_user.freelancer_profile, admin_user)
    open_ticket.refresh_from_db()
    return open_ticket


# ── Admin assign endpoint ─────────────────────────────────────────

@pytest.mark.django_db
def test_admin_assign_ticket_sets_assigned_to(open_ticket, freelancer_user, admin_user):
    client = APIClient()
    client.force_authenticate(user=admin_user)
    response = client.post(
        f"/api/admin/tickets/{open_ticket.id}/assign/",
        {"freelancer_id": str(freelancer_user.freelancer_profile.id)},
        format="json",
    )
    assert response.status_code == 200
    open_ticket.refresh_from_db()
    assert open_ticket.assigned_to == freelancer_user.freelancer_profile
    assert open_ticket.status == "assigned"


@pytest.mark.django_db
def test_admin_assign_creates_freelancer_notification(open_ticket, freelancer_user, admin_user):
    client = APIClient()
    client.force_authenticate(user=admin_user)
    client.post(
        f"/api/admin/tickets/{open_ticket.id}/assign/",
        {"freelancer_id": str(freelancer_user.freelancer_profile.id)},
        format="json",
    )
    assert Notification.objects.filter(
        recipient=freelancer_user, category="ticket_assigned"
    ).exists()


@pytest.mark.django_db
def test_admin_assign_creates_customer_notification(open_ticket, freelancer_user, admin_user, customer_user):
    client = APIClient()
    client.force_authenticate(user=admin_user)
    client.post(
        f"/api/admin/tickets/{open_ticket.id}/assign/",
        {"freelancer_id": str(freelancer_user.freelancer_profile.id)},
        format="json",
    )
    assert Notification.objects.filter(
        recipient=customer_user, category="status_changed"
    ).exists()


@pytest.mark.django_db
def test_admin_assign_nonexistent_freelancer_returns_404(open_ticket, admin_user):
    client = APIClient()
    client.force_authenticate(user=admin_user)
    response = client.post(
        f"/api/admin/tickets/{open_ticket.id}/assign/",
        {"freelancer_id": str(uuid.uuid4())},
        format="json",
    )
    assert response.status_code == 404


@pytest.mark.django_db
def test_customer_cannot_call_assign_endpoint(open_ticket, freelancer_user, customer_user):
    client = APIClient()
    client.force_authenticate(user=customer_user)
    response = client.post(
        f"/api/admin/tickets/{open_ticket.id}/assign/",
        {"freelancer_id": str(freelancer_user.freelancer_profile.id)},
        format="json",
    )
    assert response.status_code == 403


# ── Admin status update endpoint ──────────────────────────────────

@pytest.mark.django_db
def test_admin_status_update_changes_status(open_ticket, admin_user):
    client = APIClient()
    client.force_authenticate(user=admin_user)
    response = client.post(
        f"/api/admin/tickets/{open_ticket.id}/status/",
        {"new_status": "in_progress"},
        format="json",
    )
    assert response.status_code == 200
    open_ticket.refresh_from_db()
    assert open_ticket.status == "in_progress"


@pytest.mark.django_db
def test_admin_status_update_invalid_status_returns_400(open_ticket, admin_user):
    client = APIClient()
    client.force_authenticate(user=admin_user)
    response = client.post(
        f"/api/admin/tickets/{open_ticket.id}/status/",
        {"new_status": "flying_spaghetti"},
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_admin_status_update_closed_ticket_returns_400(open_ticket, admin_user):
    # Close the ticket first
    open_ticket.status = "closed"
    open_ticket.save()
    client = APIClient()
    client.force_authenticate(user=admin_user)
    response = client.post(
        f"/api/admin/tickets/{open_ticket.id}/status/",
        {"new_status": "open"},
        format="json",
    )
    assert response.status_code == 400


# ── Admin unassign endpoint ───────────────────────────────────────

@pytest.mark.django_db
def test_admin_unassign_clears_assignment(assigned_ticket, admin_user):
    client = APIClient()
    client.force_authenticate(user=admin_user)
    response = client.post(
        f"/api/admin/tickets/{assigned_ticket.id}/unassign/",
        {"note": "freelancer unavailable"},
        format="json",
    )
    assert response.status_code == 200
    assigned_ticket.refresh_from_db()
    assert assigned_ticket.assigned_to is None
    assert assigned_ticket.status == "open"


@pytest.mark.django_db
def test_admin_unassign_not_assigned_returns_400(open_ticket, admin_user):
    client = APIClient()
    client.force_authenticate(user=admin_user)
    response = client.post(f"/api/admin/tickets/{open_ticket.id}/unassign/")
    assert response.status_code == 400


# ── Activity log endpoint ─────────────────────────────────────────

@pytest.mark.django_db
def test_customer_can_view_own_ticket_activity(open_ticket, customer_user, admin_user):
    from support_app.services.ticket_service import update_status
    update_status(open_ticket, "in_progress", actor=admin_user)

    client = APIClient()
    client.force_authenticate(user=customer_user)
    response = client.get(f"/api/tickets/{open_ticket.id}/activity/")

    assert response.status_code == 200
    results = response.data.get("results", response.data)
    actions = [e["action"] for e in results]
    assert "status_changed" in actions


@pytest.mark.django_db
def test_admin_can_view_any_ticket_activity(open_ticket, admin_user):
    client = APIClient()
    client.force_authenticate(user=admin_user)
    response = client.get(f"/api/tickets/{open_ticket.id}/activity/")
    assert response.status_code == 200


@pytest.mark.django_db
def test_other_customer_cannot_view_activity(open_ticket, admin_user):
    other = User.objects.create_user(
        email="other@test.com", password="StrongPass123!", role="customer"
    )
    Customer.objects.create(user=other, company="Other Co")

    client = APIClient()
    client.force_authenticate(user=other)
    response = client.get(f"/api/tickets/{open_ticket.id}/activity/")
    assert response.status_code == 404


@pytest.mark.django_db
def test_freelancer_can_view_assigned_ticket_activity(assigned_ticket, freelancer_user):
    client = APIClient()
    client.force_authenticate(user=freelancer_user)
    response = client.get(f"/api/tickets/{assigned_ticket.id}/activity/")
    assert response.status_code == 200


@pytest.mark.django_db
def test_freelancer_cannot_view_unassigned_ticket_activity(open_ticket, freelancer_user):
    client = APIClient()
    client.force_authenticate(user=freelancer_user)
    response = client.get(f"/api/tickets/{open_ticket.id}/activity/")
    assert response.status_code == 404


# ── Freelancer ticket list ────────────────────────────────────────

@pytest.mark.django_db
def test_freelancer_ticket_list_shows_assigned(assigned_ticket, freelancer_user):
    client = APIClient()
    client.force_authenticate(user=freelancer_user)
    response = client.get("/api/freelancer/tickets/")

    assert response.status_code == 200
    results = response.data.get("results", response.data)
    assert len(results) == 1
    assert results[0]["id"] == str(assigned_ticket.id)


@pytest.mark.django_db
def test_freelancer_ticket_list_empty_when_no_assignment(open_ticket, freelancer_user):
    client = APIClient()
    client.force_authenticate(user=freelancer_user)
    response = client.get("/api/freelancer/tickets/")

    assert response.status_code == 200
    results = response.data.get("results", response.data)
    assert len(results) == 0


@pytest.mark.django_db
def test_customer_cannot_access_freelancer_list(customer_user):
    client = APIClient()
    client.force_authenticate(user=customer_user)
    response = client.get("/api/freelancer/tickets/")
    assert response.status_code == 403


# ── Freelancer ticket detail ──────────────────────────────────────

@pytest.mark.django_db
def test_freelancer_ticket_detail_returns_full_data(assigned_ticket, freelancer_user):
    client = APIClient()
    client.force_authenticate(user=freelancer_user)
    response = client.get(f"/api/freelancer/tickets/{assigned_ticket.id}/")

    assert response.status_code == 200
    assert response.data["id"] == str(assigned_ticket.id)
    assert "description" in response.data  # detail serializer


@pytest.mark.django_db
def test_freelancer_cannot_view_unassigned_ticket_detail(open_ticket, freelancer_user):
    client = APIClient()
    client.force_authenticate(user=freelancer_user)
    response = client.get(f"/api/freelancer/tickets/{open_ticket.id}/")
    assert response.status_code == 404


# ── Freelancer status update ──────────────────────────────────────

@pytest.mark.django_db
def test_freelancer_can_move_to_waiting_customer(assigned_ticket, freelancer_user):
    client = APIClient()
    client.force_authenticate(user=freelancer_user)
    # Correct workflow: assigned → in_progress → waiting_customer
    client.post(
        f"/api/freelancer/tickets/{assigned_ticket.id}/status/",
        {"new_status": "in_progress"},
        format="json",
    )
    response = client.post(
        f"/api/freelancer/tickets/{assigned_ticket.id}/status/",
        {"new_status": "waiting_customer"},
        format="json",
    )
    assert response.status_code == 200
    assigned_ticket.refresh_from_db()
    assert assigned_ticket.status == "waiting_customer"


@pytest.mark.django_db
def test_freelancer_can_resolve_ticket(assigned_ticket, freelancer_user):
    client = APIClient()
    client.force_authenticate(user=freelancer_user)
    # Correct workflow: assigned → in_progress → resolved
    client.post(
        f"/api/freelancer/tickets/{assigned_ticket.id}/status/",
        {"new_status": "in_progress"},
        format="json",
    )
    response = client.post(
        f"/api/freelancer/tickets/{assigned_ticket.id}/status/",
        {"new_status": "resolved"},
        format="json",
    )
    assert response.status_code == 200
    assigned_ticket.refresh_from_db()
    assert assigned_ticket.status == "resolved"


@pytest.mark.django_db
def test_freelancer_cannot_close_ticket(assigned_ticket, freelancer_user):
    """Closing is an admin-only action."""
    client = APIClient()
    client.force_authenticate(user=freelancer_user)
    response = client.post(
        f"/api/freelancer/tickets/{assigned_ticket.id}/status/",
        {"new_status": "closed"},
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_freelancer_cannot_update_unassigned_ticket(open_ticket, freelancer_user):
    client = APIClient()
    client.force_authenticate(user=freelancer_user)
    response = client.post(
        f"/api/freelancer/tickets/{open_ticket.id}/status/",
        {"new_status": "in_progress"},
        format="json",
    )
    assert response.status_code == 404


@pytest.mark.django_db
def test_freelancer_status_update_notifies_customer(assigned_ticket, freelancer_user, customer_user):
    client = APIClient()
    client.force_authenticate(user=freelancer_user)
    client.post(
        f"/api/freelancer/tickets/{assigned_ticket.id}/status/",
        {"new_status": "resolved"},
        format="json",
    )
    assert Notification.objects.filter(
        recipient=customer_user, category="status_changed"
    ).exists()


# ── Notification endpoints ────────────────────────────────────────

@pytest.mark.django_db
def test_notification_list_shows_own(customer_user, open_ticket):
    create_notification(
        recipient=customer_user, category="status_changed",
        title="Test notification", ticket=open_ticket,
    )
    client = APIClient()
    client.force_authenticate(user=customer_user)
    response = client.get("/api/notifications/")

    assert response.status_code == 200
    results = response.data.get("results", response.data)
    assert len(results) == 1
    assert results[0]["title"] == "Test notification"


@pytest.mark.django_db
def test_notification_list_unread_filter(customer_user, open_ticket):
    n1 = create_notification(
        recipient=customer_user, category="status_changed", title="Unread", ticket=open_ticket
    )
    n2 = create_notification(
        recipient=customer_user, category="status_changed", title="Read", ticket=open_ticket
    )
    n2.is_read = True
    n2.save()

    client = APIClient()
    client.force_authenticate(user=customer_user)
    response = client.get("/api/notifications/?unread=true")

    results = response.data.get("results", response.data)
    assert len(results) == 1
    assert results[0]["title"] == "Unread"


@pytest.mark.django_db
def test_notification_mark_read(customer_user, open_ticket):
    notification = create_notification(
        recipient=customer_user, category="status_changed", title="Mark me", ticket=open_ticket
    )
    assert not notification.is_read

    client = APIClient()
    client.force_authenticate(user=customer_user)
    response = client.patch(f"/api/notifications/{notification.id}/read/")

    assert response.status_code == 200
    assert response.data["is_read"] is True
    notification.refresh_from_db()
    assert notification.is_read


@pytest.mark.django_db
def test_notification_mark_all_read(customer_user, open_ticket):
    create_notification(
        recipient=customer_user, category="status_changed", title="N1", ticket=open_ticket
    )
    create_notification(
        recipient=customer_user, category="status_changed", title="N2", ticket=open_ticket
    )
    client = APIClient()
    client.force_authenticate(user=customer_user)
    response = client.post("/api/notifications/mark-all-read/")

    assert response.status_code == 200
    assert response.data["marked_read"] == 2
    assert Notification.objects.filter(recipient=customer_user, is_read=False).count() == 0


@pytest.mark.django_db
def test_cannot_mark_other_users_notification_as_read(customer_user, open_ticket, admin_user):
    notification = create_notification(
        recipient=admin_user, category="status_changed", title="Admin note", ticket=open_ticket
    )
    client = APIClient()
    client.force_authenticate(user=customer_user)
    response = client.patch(f"/api/notifications/{notification.id}/read/")
    assert response.status_code == 404


# ── Ticket search/filter (customer) ──────────────────────────────

@pytest.mark.django_db
def test_ticket_search_by_title(customer_user):
    Ticket.objects.create(
        customer=customer_user.customer_profile,
        title="Linux SSH problem",
        service_type="linux", severity="high", status="open",
    )
    Ticket.objects.create(
        customer=customer_user.customer_profile,
        title="Windows update",
        service_type="windows", severity="low", status="open",
    )
    client = APIClient()
    client.force_authenticate(user=customer_user)
    response = client.get("/api/tickets/?search=SSH")

    results = response.data.get("results", response.data)
    assert len(results) == 1
    assert "SSH" in results[0]["title"]


@pytest.mark.django_db
def test_admin_ticket_search_by_number(open_ticket, admin_user):
    client = APIClient()
    client.force_authenticate(user=admin_user)
    response = client.get(f"/api/admin/tickets/?search={open_ticket.ticket_number}")

    results = response.data.get("results", response.data)
    assert len(results) >= 1
    ids = [r["id"] for r in results]
    assert str(open_ticket.id) in ids


@pytest.mark.django_db
def test_admin_ticket_filter_by_priority(customer_user, admin_user):
    Ticket.objects.create(
        customer=customer_user.customer_profile,
        title="Urgent ticket", service_type="linux",
        severity="high", priority="urgent", status="open",
    )
    Ticket.objects.create(
        customer=customer_user.customer_profile,
        title="Low ticket", service_type="linux",
        severity="low", priority="low", status="open",
    )
    client = APIClient()
    client.force_authenticate(user=admin_user)
    response = client.get("/api/admin/tickets/?priority=urgent")

    results = response.data.get("results", response.data)
    assert all(r["priority"] == "urgent" for r in results)
