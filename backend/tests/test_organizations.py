"""
Tests for Organizations & Multi-Tenant Management:
  - Registration auto-creates an Organization + org_admin membership
  - Organization profile read/update (member vs org_admin)
  - Membership list, role change, removal (incl. last-admin protection)
  - Invitation create/preview/accept (new-user and existing-user paths)/revoke
  - Permission enforcement (non-member, non-admin)
  - Organization audit log (reuses the generic AuditLog/log_action())
"""
from datetime import timedelta

import pytest
from rest_framework.test import APIClient

from django.contrib.auth import get_user_model
from django.utils import timezone
from support_app.models import AuditLog, Customer, Organization, OrganizationInvitation, OrganizationMembership

User = get_user_model()


def _user(email, role="customer", is_staff=False):
    return User.objects.create_user(email=email, password="Pass123!", role=role, is_staff=is_staff)


def _client(user=None):
    c = APIClient()
    if user:
        c.force_authenticate(user=user)
    return c


@pytest.fixture
def org_admin_user(db):
    """A customer who is org_admin of their own auto-created organization —
    mirrors what RegisterSerializer.create() does for real registrations."""
    from support_app.services.organization_service import create_organization_for_customer

    user = _user("owner@org.test")
    customer = Customer.objects.create(user=user, company="Acme Corp")
    org = create_organization_for_customer(user, "Acme Corp")
    customer.organization = org
    customer.save(update_fields=["organization"])
    return user


@pytest.fixture
def organization(org_admin_user):
    return org_admin_user.customer_profile.organization


@pytest.fixture
def org_member_user(db, organization):
    """A second member of the same organization, role=org_member."""
    user = _user("member@org.test")
    OrganizationMembership.objects.create(organization=organization, user=user, role="org_member")
    return user


@pytest.fixture
def outsider_user(db):
    """A user with no relationship to `organization` at all."""
    return _user("outsider@org.test")


# ── Registration wiring ───────────────────────────────────────────

@pytest.mark.django_db
def test_customer_registration_creates_organization_and_admin_membership():
    client = _client()
    resp = client.post("/api/auth/register/", {
        "email": "newcust@org.test", "password": "StrongPass123!", "password2": "StrongPass123!",
        "company": "New Co", "role": "customer",
    }, format="json")
    assert resp.status_code == 201

    user = User.objects.get(email="newcust@org.test")
    customer = user.customer_profile
    assert customer.organization is not None
    assert customer.organization.name == "New Co"

    membership = OrganizationMembership.objects.get(organization=customer.organization, user=user)
    assert membership.role == "org_admin"


@pytest.mark.django_db
def test_freelancer_registration_does_not_create_organization():
    client = _client()
    resp = client.post("/api/auth/register/", {
        "email": "newfreelancer@org.test", "password": "StrongPass123!", "password2": "StrongPass123!",
        "role": "freelancer",
    }, format="json")
    assert resp.status_code == 201
    user = User.objects.get(email="newfreelancer@org.test")
    assert not OrganizationMembership.objects.filter(user=user).exists()


# ── Organization profile ──────────────────────────────────────────

@pytest.mark.django_db
def test_org_admin_can_view_and_update_organization(org_admin_user, organization):
    client = _client(org_admin_user)
    resp = client.get(f"/api/organizations/{organization.id}/")
    assert resp.status_code == 200
    assert resp.data["name"] == "Acme Corp"
    assert resp.data["member_count"] == 1
    assert resp.data["my_role"] == "org_admin"

    resp = client.patch(f"/api/organizations/{organization.id}/", {"name": "Acme Corp Renamed"}, format="json")
    assert resp.status_code == 200
    organization.refresh_from_db()
    assert organization.name == "Acme Corp Renamed"
    assert AuditLog.objects.filter(entity="organization", action="organization_updated", entity_id=organization.id).exists()


@pytest.mark.django_db
def test_org_member_can_view_but_not_update_organization(org_member_user, organization):
    client = _client(org_member_user)
    resp = client.get(f"/api/organizations/{organization.id}/")
    assert resp.status_code == 200
    assert resp.data["my_role"] == "org_member"

    resp = client.patch(f"/api/organizations/{organization.id}/", {"name": "Hijacked"}, format="json")
    assert resp.status_code == 403


@pytest.mark.django_db
def test_outsider_cannot_view_organization(outsider_user, organization):
    client = _client(outsider_user)
    resp = client.get(f"/api/organizations/{organization.id}/")
    assert resp.status_code == 403


@pytest.mark.django_db
def test_organizations_mine_lists_only_orgs_the_user_belongs_to(org_admin_user, org_member_user, outsider_user, organization):
    resp = _client(org_admin_user).get("/api/organizations/mine/")
    assert resp.status_code == 200
    assert [o["id"] for o in resp.data["results"]] == [str(organization.id)]

    resp = _client(outsider_user).get("/api/organizations/mine/")
    assert resp.status_code == 200
    assert resp.data["results"] == []


# ── Membership list / role change / removal ───────────────────────

@pytest.mark.django_db
def test_member_list_visible_to_any_member(org_member_user, organization):
    resp = _client(org_member_user).get(f"/api/organizations/{organization.id}/members/")
    assert resp.status_code == 200
    assert resp.data["count"] == 2  # org_admin_user + org_member_user


@pytest.mark.django_db
def test_org_admin_can_change_member_role(org_admin_user, org_member_user, organization):
    client = _client(org_admin_user)
    resp = client.patch(
        f"/api/organizations/{organization.id}/members/{org_member_user.id}/",
        {"role": "org_admin"}, format="json",
    )
    assert resp.status_code == 200
    membership = OrganizationMembership.objects.get(organization=organization, user=org_member_user)
    assert membership.role == "org_admin"
    assert AuditLog.objects.filter(entity="organization", action="member_role_changed").exists()


@pytest.mark.django_db
def test_cannot_demote_the_only_admin(org_admin_user, organization):
    client = _client(org_admin_user)
    resp = client.patch(
        f"/api/organizations/{organization.id}/members/{org_admin_user.id}/",
        {"role": "org_member"}, format="json",
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_org_admin_can_remove_member(org_admin_user, org_member_user, organization):
    client = _client(org_admin_user)
    resp = client.delete(f"/api/organizations/{organization.id}/members/{org_member_user.id}/")
    assert resp.status_code == 204
    assert not OrganizationMembership.objects.filter(organization=organization, user=org_member_user).exists()
    assert AuditLog.objects.filter(entity="organization", action="member_removed").exists()


@pytest.mark.django_db
def test_cannot_remove_the_only_admin(org_admin_user, organization):
    client = _client(org_admin_user)
    resp = client.delete(f"/api/organizations/{organization.id}/members/{org_admin_user.id}/")
    assert resp.status_code == 400
    assert OrganizationMembership.objects.filter(organization=organization, user=org_admin_user).exists()


@pytest.mark.django_db
def test_org_member_cannot_remove_others(org_member_user, org_admin_user, organization):
    client = _client(org_member_user)
    resp = client.delete(f"/api/organizations/{organization.id}/members/{org_admin_user.id}/")
    assert resp.status_code == 403


# ── Invitations ────────────────────────────────────────────────────

@pytest.mark.django_db
def test_org_admin_can_invite_and_org_member_cannot(org_admin_user, org_member_user, organization):
    resp = _client(org_member_user).post(
        f"/api/organizations/{organization.id}/invitations/", {"email": "invitee@org.test"}, format="json",
    )
    assert resp.status_code == 403

    resp = _client(org_admin_user).post(
        f"/api/organizations/{organization.id}/invitations/",
        {"email": "invitee@org.test", "role": "org_member"}, format="json",
    )
    assert resp.status_code == 201
    invitation = OrganizationInvitation.objects.get(email="invitee@org.test")
    assert invitation.status == "pending"
    assert invitation.organization == organization
    assert AuditLog.objects.filter(entity="organization", action="member_invited").exists()


@pytest.mark.django_db
def test_cannot_invite_existing_member_or_duplicate_pending_invite(org_admin_user, org_member_user, organization):
    client = _client(org_admin_user)
    resp = client.post(
        f"/api/organizations/{organization.id}/invitations/", {"email": org_member_user.email}, format="json",
    )
    assert resp.status_code == 400

    client.post(f"/api/organizations/{organization.id}/invitations/", {"email": "dup@org.test"}, format="json")
    resp = client.post(f"/api/organizations/{organization.id}/invitations/", {"email": "dup@org.test"}, format="json")
    assert resp.status_code == 400


@pytest.mark.django_db
def test_invitation_preview_is_public(org_admin_user, organization):
    invitation = OrganizationInvitation.objects.create(
        organization=organization, email="preview@org.test", role="org_member",
        invited_by=org_admin_user, token="preview-token-123",
        expires_at=timezone.now() + timedelta(days=7),
    )
    resp = _client().get(f"/api/organizations/invitations/{invitation.token}/")
    assert resp.status_code == 200
    assert resp.data["organization_name"] == organization.name
    assert resp.data["account_exists"] is False


@pytest.mark.django_db
def test_accept_invitation_creates_account_for_new_invitee(org_admin_user, organization):
    invitation = OrganizationInvitation.objects.create(
        organization=organization, email="brandnew@org.test", role="org_member",
        invited_by=org_admin_user, token="accept-token-new",
        expires_at=timezone.now() + timedelta(days=7),
    )
    resp = _client().post("/api/organizations/invitations/accept/", {
        "token": invitation.token, "password": "BrandNewPass123!", "first_name": "Brand",
    }, format="json")
    assert resp.status_code == 200
    assert "access" in resp.data

    user = User.objects.get(email="brandnew@org.test")
    assert user.is_verified is True
    assert not hasattr(user, "customer_profile")  # deliberately no billing profile — see views.py docstring
    membership = OrganizationMembership.objects.get(organization=organization, user=user)
    assert membership.role == "org_member"

    invitation.refresh_from_db()
    assert invitation.status == "accepted"
    assert invitation.accepted_at is not None


@pytest.mark.django_db
def test_accept_invitation_for_existing_user_requires_correct_login(org_admin_user, outsider_user, organization):
    invitation = OrganizationInvitation.objects.create(
        organization=organization, email=outsider_user.email, role="org_member",
        invited_by=org_admin_user, token="accept-token-existing",
        expires_at=timezone.now() + timedelta(days=7),
    )
    # Not logged in at all
    resp = _client().post("/api/organizations/invitations/accept/", {"token": invitation.token}, format="json")
    assert resp.status_code == 403

    # Logged in as a DIFFERENT user than the invited email
    someone_else = _user("someone-else@org.test")
    resp = _client(someone_else).post("/api/organizations/invitations/accept/", {"token": invitation.token}, format="json")
    assert resp.status_code == 403

    # Logged in as the correct invited user
    resp = _client(outsider_user).post("/api/organizations/invitations/accept/", {"token": invitation.token}, format="json")
    assert resp.status_code == 200
    assert OrganizationMembership.objects.filter(organization=organization, user=outsider_user).exists()


@pytest.mark.django_db
def test_accept_expired_invitation_is_rejected(org_admin_user, organization):
    invitation = OrganizationInvitation.objects.create(
        organization=organization, email="expired@org.test", role="org_member",
        invited_by=org_admin_user, token="accept-token-expired",
        expires_at=timezone.now() - timedelta(days=1),
    )
    resp = _client().post("/api/organizations/invitations/accept/", {
        "token": invitation.token, "password": "SomePass123!",
    }, format="json")
    assert resp.status_code == 400
    invitation.refresh_from_db()
    assert invitation.status == "expired"


@pytest.mark.django_db
def test_org_admin_can_revoke_pending_invitation(org_admin_user, organization):
    invitation = OrganizationInvitation.objects.create(
        organization=organization, email="revoke-me@org.test", role="org_member",
        invited_by=org_admin_user, token="revoke-token",
        expires_at=timezone.now() + timedelta(days=7),
    )
    resp = _client(org_admin_user).delete(f"/api/organizations/{organization.id}/invitations/{invitation.id}/")
    assert resp.status_code == 204
    invitation.refresh_from_db()
    assert invitation.status == "revoked"


# ── Organization audit log ────────────────────────────────────────

@pytest.mark.django_db
def test_org_audit_log_visible_to_admin_only(org_admin_user, org_member_user, organization):
    organization.name = "Renamed For Audit Test"
    _client(org_admin_user).patch(f"/api/organizations/{organization.id}/", {"name": "Renamed"}, format="json")

    resp = _client(org_admin_user).get(f"/api/organizations/{organization.id}/audit/")
    assert resp.status_code == 200
    results = resp.data["results"] if isinstance(resp.data, dict) else resp.data
    assert any(entry["action"] == "organization_updated" for entry in results)

    resp = _client(org_member_user).get(f"/api/organizations/{organization.id}/audit/")
    assert resp.status_code == 403
