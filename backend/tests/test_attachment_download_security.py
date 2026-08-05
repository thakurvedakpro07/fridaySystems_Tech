"""
Tests for the ticket_attachment_download endpoint — the fix for the IDOR
where attachments used to be served from an unauthenticated static /media/
URL, bypassing every ticket-access check entirely.

Covers: unauthenticated access, cross-customer/cross-organization/
unassigned-freelancer access all rejected; literal owner and same-
organization customer succeed; the old raw /media/ path is no longer
routed at all (see supportmitra/urls.py — the dev static() route was
removed, and nginx marks /media/ `internal;` in prod, which pytest can't
exercise directly — that half needs a manual/deploy-time check).

Run with:
  cd backend
  pytest tests/test_attachment_download_security.py -v
"""
import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from django.contrib.auth import get_user_model
from support_app.models import Customer, Freelancer, Ticket, TicketAttachment
from support_app.services.organization_service import create_organization_for_customer

User = get_user_model()

FILE_CONTENT = b"the quick brown fox"


def _user(email, role="customer", is_staff=False):
    return User.objects.create_user(email=email, password="StrongPass123!", role=role, is_staff=is_staff)


def _client(user=None):
    c = APIClient()
    if user:
        c.force_authenticate(user=user)
    return c


@pytest.fixture
def owner(db):
    user = _user("owner@example.com")
    Customer.objects.create(user=user, company="Co")
    return user


@pytest.fixture
def org_mate(db, owner):
    org = create_organization_for_customer(owner, "Owner Co")
    owner.customer_profile.organization = org
    owner.customer_profile.save(update_fields=["organization"])

    from support_app.models import OrganizationMembership
    mate = _user("mate@example.com")
    Customer.objects.create(user=mate, company="Owner Co", organization=org)
    OrganizationMembership.objects.create(organization=org, user=mate, role="org_member")
    return mate


@pytest.fixture
def stranger(db):
    user = _user("stranger@example.com")
    Customer.objects.create(user=user, company="Other Co")
    return user


@pytest.fixture
def assigned_freelancer(db, ticket):
    user = _user("assigned@example.com", role="freelancer")
    freelancer = Freelancer.objects.create(user=user, onboarding_status="approved")
    ticket.assigned_to = freelancer
    ticket.save(update_fields=["assigned_to"])
    return user


@pytest.fixture
def unassigned_freelancer(db):
    user = _user("unassigned@example.com", role="freelancer")
    Freelancer.objects.create(user=user, onboarding_status="approved")
    return user


@pytest.fixture
def ticket(owner):
    resp = _client(owner).post(
        "/api/tickets/",
        {"title": "Attachment ticket", "service_type": "server_admin", "severity": "medium"},
        format="json",
    )
    assert resp.status_code == 201
    return Ticket.objects.get(title="Attachment ticket")


@pytest.fixture
def attachment(owner, ticket):
    resp = _client(owner).post(
        f"/api/tickets/{ticket.id}/attachments/",
        {"file": SimpleUploadedFile("secret.txt", FILE_CONTENT, content_type="text/plain")},
        format="multipart",
    )
    assert resp.status_code == 201
    return TicketAttachment.objects.get(pk=resp.data["id"])


def _download_url(ticket, attachment):
    return f"/api/tickets/{ticket.id}/attachments/{attachment.id}/download/"


@pytest.mark.django_db
def test_unauthenticated_download_rejected(ticket, attachment):
    resp = _client().get(_download_url(ticket, attachment))
    assert resp.status_code == 401


@pytest.mark.django_db
def test_stranger_customer_cannot_download(stranger, ticket, attachment):
    resp = _client(stranger).get(_download_url(ticket, attachment))
    assert resp.status_code == 404


@pytest.mark.django_db
def test_unassigned_freelancer_cannot_download(unassigned_freelancer, ticket, attachment):
    resp = _client(unassigned_freelancer).get(_download_url(ticket, attachment))
    assert resp.status_code == 404


@pytest.mark.django_db
def test_owner_can_download_correct_bytes(owner, ticket, attachment):
    resp = _client(owner).get(_download_url(ticket, attachment))
    assert resp.status_code == 200
    assert b"".join(resp.streaming_content) == FILE_CONTENT
    assert "secret.txt" in resp["Content-Disposition"]


@pytest.mark.django_db
def test_org_mate_can_download_colleagues_attachment(org_mate, ticket, attachment):
    resp = _client(org_mate).get(_download_url(ticket, attachment))
    assert resp.status_code == 200
    assert b"".join(resp.streaming_content) == FILE_CONTENT


@pytest.mark.django_db
def test_assigned_freelancer_can_download(assigned_freelancer, ticket, attachment):
    resp = _client(assigned_freelancer).get(_download_url(ticket, attachment))
    assert resp.status_code == 200


@pytest.mark.django_db
def test_staff_can_download_any_attachment(ticket, attachment):
    staff = _user("staff@example.com", role="admin", is_staff=True)
    resp = _client(staff).get(_download_url(ticket, attachment))
    assert resp.status_code == 200


@pytest.mark.django_db
def test_raw_media_path_is_not_routed(ticket, attachment):
    """
    The old vulnerability: attachment.file.url used to be served directly
    and unauthenticated. Confirms Django's urlconf no longer serves /media/
    at all (see supportmitra/urls.py) — an unauthenticated client hitting
    the raw storage path gets Django's plain 404, not the file.
    """
    resp = _client().get(f"/media/{attachment.file.name}")
    assert resp.status_code == 404
