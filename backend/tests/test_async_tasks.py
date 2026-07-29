"""
Tests for Roadmap Item #2 — wiring the async task queue into the request path.

Covers two things:
  - Call sites: each business action that used to send email inline now
    defers it via transaction.on_commit(lambda: some_task.delay(...)), and
    the task (running eagerly under CELERY_TASK_ALWAYS_EAGER, see conftest.py)
    still results in a real email landing in the outbox.
  - Task bodies: each new task fetches its object by id and skips gracefully
    (no exception) when that id no longer exists — mirrors the existing
    send_ticket_opened_email/send_ticket_assigned_notification convention.

Run with:
  docker compose exec backend python -m pytest tests/test_async_tasks.py -v
"""

import uuid

import pytest
from django.contrib.auth import get_user_model
from django.core import mail
from rest_framework.test import APIClient

from support_app.models import (
    Customer,
    Freelancer,
    Organization,
    OrganizationInvitation,
    OrganizationMembership,
    Ticket,
)
from support_app.services.ticket_service import (
    add_comment,
    assign_ticket,
    create_ticket,
    update_status,
)

User = get_user_model()


# ── Fixtures ──────────────────────────────────────────────────────

@pytest.fixture
def customer_user(db):
    user = User.objects.create_user(
        email="customer@async-tasks.test",
        password="StrongPass123!",
        role="customer",
    )
    Customer.objects.create(user=user, company="Acme Ltd")
    return user


@pytest.fixture
def freelancer_user(db):
    user = User.objects.create_user(
        email="freelancer@async-tasks.test",
        password="StrongPass123!",
        role="freelancer",
    )
    Freelancer.objects.create(
        user=user,
        skills="server_admin",
        onboarding_status="approved",
        active=True,
    )
    return user


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        email="admin@async-tasks.test",
        password="StrongPass123!",
        role="admin",
        is_staff=True,
    )


@pytest.fixture
def ticket(db, customer_user):
    return Ticket.objects.create(
        customer=customer_user.customer_profile,
        title="Server unreachable",
        service_type="server_admin",
        severity="high",
        status="open",
    )


# ── Call sites: ticket_service.py ─────────────────────────────────

@pytest.mark.django_db
def test_create_ticket_queues_opened_email(customer_user, django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        ticket = create_ticket(
            customer=customer_user.customer_profile,
            validated_data={"title": "SSH broken", "service_type": "server_admin", "severity": "high"},
        )
    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == [customer_user.email]
    assert ticket.ticket_number in mail.outbox[0].subject


@pytest.mark.django_db
def test_assign_ticket_queues_assigned_email(ticket, freelancer_user, admin_user, django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        assign_ticket(ticket, freelancer_user.freelancer_profile, admin_user)
    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == [ticket.customer.user.email]


@pytest.mark.django_db
def test_add_comment_by_customer_notifies_assigned_freelancer(ticket, freelancer_user, admin_user, django_capture_on_commit_callbacks):
    assign_ticket(ticket, freelancer_user.freelancer_profile, admin_user)
    ticket.refresh_from_db()
    with django_capture_on_commit_callbacks(execute=True):
        add_comment(ticket, author=ticket.customer.user, body="Still broken, please help")
    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == [freelancer_user.email]


@pytest.mark.django_db
def test_add_comment_by_staff_notifies_customer(ticket, admin_user, django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        add_comment(ticket, author=admin_user, body="Looking into this now")
    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == [ticket.customer.user.email]


@pytest.mark.django_db
def test_resolve_ticket_queues_resolved_email(ticket, admin_user, django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        update_status(ticket, "resolved", actor=admin_user)
    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == [ticket.customer.user.email]


# ── Call sites: views.py ──────────────────────────────────────────

@pytest.mark.django_db
def test_register_view_queues_welcome_and_verification_emails(django_capture_on_commit_callbacks):
    client = APIClient()
    with django_capture_on_commit_callbacks(execute=True):
        response = client.post(
            "/api/auth/register/",
            {
                "email": "newcustomer@async-tasks.test",
                "password": "StrongPass123!",
                "password2": "StrongPass123!",
                "company": "New Co",
            },
            format="json",
        )
    assert response.status_code == 201
    assert len(mail.outbox) == 2
    recipients = {m.to[0] for m in mail.outbox}
    assert recipients == {"newcustomer@async-tasks.test"}


@pytest.mark.django_db
def test_resend_verification_email_queues_email(customer_user, django_capture_on_commit_callbacks):
    customer_user.is_verified = False
    customer_user.save(update_fields=["is_verified"])
    client = APIClient()
    client.force_authenticate(user=customer_user)
    with django_capture_on_commit_callbacks(execute=True):
        response = client.post("/api/auth/verify-email/resend/")
    assert response.status_code == 200
    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == [customer_user.email]


@pytest.mark.django_db
def test_password_reset_request_queues_email(customer_user, django_capture_on_commit_callbacks):
    client = APIClient()
    with django_capture_on_commit_callbacks(execute=True):
        response = client.post("/api/auth/password/reset/", {"email": customer_user.email}, format="json")
    assert response.status_code == 200
    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == [customer_user.email]


@pytest.mark.django_db
def test_password_reset_request_unknown_email_queues_nothing(django_capture_on_commit_callbacks):
    client = APIClient()
    with django_capture_on_commit_callbacks(execute=True):
        response = client.post("/api/auth/password/reset/", {"email": "nobody@async-tasks.test"}, format="json")
    assert response.status_code == 200
    assert len(mail.outbox) == 0


@pytest.mark.django_db
def test_reject_resolution_queues_email(ticket, freelancer_user, admin_user, django_capture_on_commit_callbacks):
    assign_ticket(ticket, freelancer_user.freelancer_profile, admin_user)
    ticket.refresh_from_db()
    update_status(ticket, "resolved", actor=admin_user)
    ticket.refresh_from_db()
    mail.outbox.clear()

    client = APIClient()
    client.force_authenticate(user=ticket.customer.user)
    with django_capture_on_commit_callbacks(execute=True):
        response = client.post(f"/api/tickets/{ticket.id}/reject-resolution/", {"note": "still broken"}, format="json")
    assert response.status_code == 200
    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == [freelancer_user.email]


@pytest.mark.django_db
def test_org_invitation_create_queues_email(admin_user, django_capture_on_commit_callbacks):
    from support_app.services.organization_service import create_organization_for_customer

    Customer.objects.create(user=admin_user, company="Acme Corp")
    org = create_organization_for_customer(admin_user, "Acme Corp")

    client = APIClient()
    client.force_authenticate(user=admin_user)
    with django_capture_on_commit_callbacks(execute=True):
        response = client.post(
            f"/api/organizations/{org.id}/invitations/",
            {"email": "invitee@async-tasks.test", "role": "org_member"},
            format="json",
        )
    assert response.status_code == 201
    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == ["invitee@async-tasks.test"]


# ── Task bodies: graceful handling of a missing object ────────────

@pytest.mark.django_db
def test_send_ticket_resolved_email_skips_missing_ticket():
    from support_app.tasks import send_ticket_resolved_email
    send_ticket_resolved_email.run(str(uuid.uuid4()))
    assert len(mail.outbox) == 0


@pytest.mark.django_db
def test_send_comment_notification_email_skips_missing_ticket():
    from support_app.tasks import send_comment_notification_email
    send_comment_notification_email.run(str(uuid.uuid4()), str(uuid.uuid4()), str(uuid.uuid4()))
    assert len(mail.outbox) == 0


@pytest.mark.django_db
def test_send_resolution_rejected_email_skips_missing_ticket():
    from support_app.tasks import send_resolution_rejected_email
    send_resolution_rejected_email.run(str(uuid.uuid4()), "note")
    assert len(mail.outbox) == 0


@pytest.mark.django_db
def test_send_welcome_email_skips_missing_user():
    from support_app.tasks import send_welcome_email
    send_welcome_email.run(str(uuid.uuid4()))
    assert len(mail.outbox) == 0


@pytest.mark.django_db
def test_send_verification_email_task_skips_missing_user():
    from support_app.tasks import send_verification_email_task
    send_verification_email_task.run(str(uuid.uuid4()))
    assert len(mail.outbox) == 0


@pytest.mark.django_db
def test_send_password_reset_email_task_skips_missing_user():
    from support_app.tasks import send_password_reset_email_task
    send_password_reset_email_task.run(str(uuid.uuid4()), "uid", "token")
    assert len(mail.outbox) == 0


@pytest.mark.django_db
def test_send_organization_invitation_email_skips_missing_invitation():
    from support_app.tasks import send_organization_invitation_email
    send_organization_invitation_email.run(str(uuid.uuid4()))
    assert len(mail.outbox) == 0


# ── Queue status endpoint ──────────────────────────────────────────

@pytest.mark.django_db
def test_queue_status_requires_super_admin(admin_user, customer_user):
    client = APIClient()
    response = client.get("/api/admin/queue-status/")
    assert response.status_code == 401

    client.force_authenticate(user=customer_user)
    response = client.get("/api/admin/queue-status/")
    assert response.status_code == 403

    client.force_authenticate(user=admin_user)
    response = client.get("/api/admin/queue-status/")
    assert response.status_code in (200, 503)
    assert "worker_count" in response.data
