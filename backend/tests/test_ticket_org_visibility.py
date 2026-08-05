"""
Tests for organization-wide ticket READ visibility (customers only) and the
matching write restrictions.

Ground rule being tested: a customer can read (list/detail/comments minus
internal/attachments-list/activity-log) any ticket belonging to another
Customer in the SAME Organization, but every write action (PATCH, posting a
comment, uploading an attachment, CSAT, accept/reject resolution, initiating
payment) and every payment/invoice read stays strictly owner-only. A
customer with no organization (organization_id=None) keeps the exact
pre-Organizations behaviour, and cross-organization access is never granted.

Run with:
  cd backend
  pytest tests/test_ticket_org_visibility.py -v
"""
import pytest
from rest_framework.test import APIClient

from django.contrib.auth import get_user_model
from support_app.models import Customer, Freelancer, Payment, Ticket, TicketComment
from support_app.services.organization_service import create_organization_for_customer

User = get_user_model()


def _user(email, role="customer", is_staff=False):
    return User.objects.create_user(email=email, password="StrongPass123!", role=role, is_staff=is_staff)


def _client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def _customer_in_org(email, org, company="Acme Corp", org_role="org_member"):
    """A Customer whose organization is set, plus a matching OrganizationMembership
    (mirrors what registration/invitation-accept do for real accounts)."""
    from support_app.models import OrganizationMembership
    user = _user(email)
    customer = Customer.objects.create(user=user, company=company, organization=org)
    OrganizationMembership.objects.create(organization=org, user=user, role=org_role)
    return user, customer


def _create_ticket(client, title, service_type="server_admin", severity="medium"):
    resp = client.post(
        "/api/tickets/",
        {"title": title, "service_type": service_type, "severity": severity},
        format="json",
    )
    assert resp.status_code == 201
    return Ticket.objects.get(title=title)


@pytest.fixture
def org_a(db):
    # Org creator — the create_organization_for_customer helper needs a user,
    # but we only care about the Organization row it returns.
    creator = _user("org-a-creator@example.com")
    return create_organization_for_customer(creator, "Org A")


@pytest.fixture
def org_b(db):
    creator = _user("org-b-creator@example.com")
    return create_organization_for_customer(creator, "Org B")


@pytest.fixture
def org_a_owner(db, org_a):
    """The customer who creates the ticket under test."""
    user, _customer = _customer_in_org("owner@org-a.test", org_a, org_role="org_admin")
    return user


@pytest.fixture
def org_a_mate(db, org_a):
    """A different Customer, same Organization as org_a_owner."""
    user, _customer = _customer_in_org("mate@org-a.test", org_a, org_role="org_member")
    return user


@pytest.fixture
def org_b_customer(db, org_b):
    """A Customer in a completely different Organization."""
    user, _customer = _customer_in_org("outsider@org-b.test", org_b, org_role="org_admin")
    return user


@pytest.fixture
def no_org_customer_a(db):
    user = _user("legacy-a@example.com")
    Customer.objects.create(user=user, company="Legacy Co")  # organization left null
    return user


@pytest.fixture
def no_org_customer_b(db):
    user = _user("legacy-b@example.com")
    Customer.objects.create(user=user, company="Other Legacy Co")
    return user


@pytest.fixture
def freelancer_user(db):
    user = _user("engineer@example.com", role="freelancer")
    Freelancer.objects.create(user=user, onboarding_status="approved")
    return user


@pytest.fixture
def owned_ticket(org_a_owner):
    ticket = _create_ticket(_client(org_a_owner), "Org A ticket")
    return ticket


# ── Org-mate READ access ────────────────────────────────────────────

@pytest.mark.django_db
def test_org_mate_sees_colleague_ticket_in_list(org_a_owner, org_a_mate, owned_ticket):
    resp = _client(org_a_mate).get("/api/tickets/")
    assert resp.status_code == 200
    ids = [t["id"] for t in resp.data["results"]]
    assert str(owned_ticket.id) in ids


@pytest.mark.django_db
def test_org_mate_can_view_colleague_ticket_detail(org_a_mate, owned_ticket):
    resp = _client(org_a_mate).get(f"/api/tickets/{owned_ticket.id}/")
    assert resp.status_code == 200
    assert resp.data["id"] == str(owned_ticket.id)


@pytest.mark.django_db
def test_org_mate_can_list_comments_but_not_internal_ones(org_a_owner, org_a_mate, owned_ticket, freelancer_user):
    owner_client = _client(org_a_owner)
    owner_client.post(f"/api/tickets/{owned_ticket.id}/comments/", {"body": "public note"}, format="json")

    staff = _user("staff@example.com", role="admin", is_staff=True)
    _client(staff).post(
        f"/api/tickets/{owned_ticket.id}/comments/",
        {"body": "internal only", "is_internal": True},
        format="json",
    )

    resp = _client(org_a_mate).get(f"/api/tickets/{owned_ticket.id}/comments/")
    assert resp.status_code == 200
    bodies = [c["body"] for c in resp.data["results"]]
    assert "public note" in bodies
    assert "internal only" not in bodies


@pytest.mark.django_db
def test_org_mate_can_list_attachments_and_activity_log(org_a_mate, owned_ticket):
    resp = _client(org_a_mate).get(f"/api/tickets/{owned_ticket.id}/attachments/")
    assert resp.status_code == 200

    resp = _client(org_a_mate).get(f"/api/tickets/{owned_ticket.id}/activity/")
    assert resp.status_code == 200


# ── Org-mate WRITE restrictions ─────────────────────────────────────

@pytest.mark.django_db
def test_org_mate_cannot_patch_colleague_ticket(org_a_mate, owned_ticket):
    resp = _client(org_a_mate).patch(f"/api/tickets/{owned_ticket.id}/", {"title": "Hijacked"}, format="json")
    assert resp.status_code == 403
    owned_ticket.refresh_from_db()
    assert owned_ticket.title == "Org A ticket"


@pytest.mark.django_db
def test_org_mate_cannot_post_comment_on_colleague_ticket(org_a_mate, owned_ticket):
    resp = _client(org_a_mate).post(
        f"/api/tickets/{owned_ticket.id}/comments/", {"body": "not my ticket"}, format="json"
    )
    assert resp.status_code == 404
    assert not TicketComment.objects.filter(body="not my ticket").exists()


@pytest.mark.django_db
def test_org_mate_cannot_upload_attachment_to_colleague_ticket(org_a_mate, owned_ticket):
    from django.core.files.uploadedfile import SimpleUploadedFile
    resp = _client(org_a_mate).post(
        f"/api/tickets/{owned_ticket.id}/attachments/",
        {"file": SimpleUploadedFile("note.txt", b"hello", content_type="text/plain")},
        format="multipart",
    )
    assert resp.status_code == 404


@pytest.mark.django_db
def test_org_mate_cannot_delete_colleague_uploaded_attachment(org_a_owner, org_a_mate, owned_ticket):
    from django.core.files.uploadedfile import SimpleUploadedFile
    upload_resp = _client(org_a_owner).post(
        f"/api/tickets/{owned_ticket.id}/attachments/",
        {"file": SimpleUploadedFile("note.txt", b"hello", content_type="text/plain")},
        format="multipart",
    )
    assert upload_resp.status_code == 201
    attachment_id = upload_resp.data["id"]

    # The ticket lookup succeeds (org-mate has read access) but the
    # uploader-or-staff check on the attachment itself must still reject them.
    resp = _client(org_a_mate).delete(f"/api/tickets/{owned_ticket.id}/attachments/{attachment_id}/")
    assert resp.status_code == 403


@pytest.mark.django_db
@pytest.mark.parametrize("status_override,url_suffix,payload", [
    ("closed", "csat", {"score": 5}),
    ("resolved", "accept-resolution", {"score": 5}),
    ("resolved", "reject-resolution", {"note": "not fixed"}),
    ("pending_payment", "initiate-payment", {}),
])
def test_org_mate_cannot_perform_ticket_actions(org_a_owner, org_a_mate, owned_ticket, status_override, url_suffix, payload):
    owned_ticket.status = status_override
    owned_ticket.save(update_fields=["status"])
    resp = _client(org_a_mate).post(f"/api/tickets/{owned_ticket.id}/{url_suffix}/", payload, format="json")
    assert resp.status_code == 404


# ── Payments/invoices stay strictly per-customer, even for org-mates ─

@pytest.mark.django_db
def test_org_mate_cannot_see_colleague_payment_or_invoice(org_a_owner, org_a_mate, owned_ticket):
    payment = Payment.objects.create(
        ticket=owned_ticket, customer=owned_ticket.customer, amount="500.00",
        invoice_number=f"INV-{owned_ticket.id}", payment_type="consulting_fee", status="completed",
    )
    resp = _client(org_a_mate).get("/api/customers/me/payments/")
    assert resp.status_code == 200
    assert all(p["id"] != str(payment.id) for p in resp.data["results"])

    resp = _client(org_a_mate).get(f"/api/payments/{payment.id}/")
    assert resp.status_code == 404

    resp = _client(org_a_mate).get(f"/api/payments/{payment.id}/invoice/")
    assert resp.status_code == 403


# ── Cross-organization isolation (the critical regression guard) ────

@pytest.mark.django_db
def test_different_org_customer_cannot_see_ticket_at_all(org_b_customer, owned_ticket):
    client = _client(org_b_customer)

    resp = client.get("/api/tickets/")
    ids = [t["id"] for t in resp.data["results"]]
    assert str(owned_ticket.id) not in ids

    for path in (
        f"/api/tickets/{owned_ticket.id}/",
        f"/api/tickets/{owned_ticket.id}/comments/",
        f"/api/tickets/{owned_ticket.id}/attachments/",
        f"/api/tickets/{owned_ticket.id}/activity/",
    ):
        resp = client.get(path)
        assert resp.status_code == 404, path


# ── No-organization customers keep exact pre-Organizations behaviour ─

@pytest.mark.django_db
def test_customer_without_organization_only_sees_own_tickets(no_org_customer_a, no_org_customer_b):
    ticket = _create_ticket(_client(no_org_customer_a), "Legacy ticket")

    resp = _client(no_org_customer_b).get(f"/api/tickets/{ticket.id}/")
    assert resp.status_code == 404

    resp = _client(no_org_customer_a).get("/api/tickets/")
    ids = [t["id"] for t in resp.data["results"]]
    assert str(ticket.id) in ids
    assert len(ids) == 1


# ── Freelancer/staff access is unaffected by the refactor ───────────

@pytest.mark.django_db
def test_freelancer_not_assigned_still_gets_404(freelancer_user, owned_ticket):
    resp = _client(freelancer_user).get(f"/api/tickets/{owned_ticket.id}/")
    assert resp.status_code == 404
    resp = _client(freelancer_user).get(f"/api/tickets/{owned_ticket.id}/comments/")
    assert resp.status_code == 404


@pytest.mark.django_db
def test_staff_can_still_access_any_ticket(owned_ticket):
    staff = _user("staff2@example.com", role="admin", is_staff=True)
    resp = _client(staff).get(f"/api/tickets/{owned_ticket.id}/")
    assert resp.status_code == 200
    resp = _client(staff).get(f"/api/tickets/{owned_ticket.id}/comments/")
    assert resp.status_code == 200
