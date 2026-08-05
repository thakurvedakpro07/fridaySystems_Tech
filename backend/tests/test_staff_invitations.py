"""
Tests for Staff Invite-by-Email (Engineer=freelancer / Admin roles):
  - apply_role_change() unit tests (the helper extracted out of ops_change_role)
    + confirmation ops_change_role still behaves the same after the refactor
  - Invitation create: permission gate, duplicate-pending, already-has-role,
    ineligible-existing-role-transition rejection (Finance Manager/Support
    Agent can't jump directly to Engineer/Admin)
  - List / revoke / resend
  - Accept — new user (Engineer creates a Freelancer profile; Admin does not)
  - Accept — existing user (role applied via apply_role_change, RoleChangeAudit written)
  - Accept — expired / revoked / already-accepted / tampered token
  - Audit logging (generic AuditLog via log_action())
"""
from datetime import timedelta

import pytest
from rest_framework.test import APIClient

from django.contrib.auth import get_user_model
from django.utils import timezone

from support_app.models import AuditLog, Freelancer, RoleChangeAudit, StaffInvitation
from support_app.services.role_service import RoleTransitionError, apply_role_change

User = get_user_model()


def _user(email, role="customer", is_staff=False):
    return User.objects.create_user(email=email, password="Pass123!", role=role, is_staff=is_staff)


def _client(user=None):
    c = APIClient()
    if user:
        c.force_authenticate(user=user)
    return c


@pytest.fixture
def super_admin(db):
    return _user("admin@resolvehq.test", role="admin", is_staff=True)


@pytest.fixture
def ops_manager(db):
    return _user("ops@resolvehq.test", role="operations_manager")


@pytest.fixture
def customer_user(db):
    return _user("customer@resolvehq.test", role="customer")


# ── apply_role_change (shared helper) ──────────────────────────────

@pytest.mark.django_db
def test_apply_role_change_valid_transition_syncs_fields_and_writes_audit(customer_user, super_admin):
    old_role = apply_role_change(customer_user, "freelancer", changed_by=super_admin, note="test")
    assert old_role == "customer"
    customer_user.refresh_from_db()
    assert customer_user.role == "freelancer"
    assert customer_user.is_staff is False
    assert customer_user.is_superuser is False

    audit = RoleChangeAudit.objects.get(target_user=customer_user)
    assert audit.old_role == "customer"
    assert audit.new_role == "freelancer"
    assert audit.changed_by == super_admin
    assert audit.note == "test"


@pytest.mark.django_db
def test_apply_role_change_admin_syncs_is_staff_and_is_superuser(customer_user, super_admin):
    apply_role_change(customer_user, "admin", changed_by=super_admin)
    customer_user.refresh_from_db()
    assert customer_user.is_staff is True
    assert customer_user.is_superuser is True


@pytest.mark.django_db
def test_apply_role_change_rejects_same_role(customer_user, super_admin):
    with pytest.raises(RoleTransitionError):
        apply_role_change(customer_user, "customer", changed_by=super_admin)


@pytest.mark.django_db
def test_apply_role_change_rejects_disallowed_transition(super_admin):
    finance_user = _user("finance@resolvehq.test", role="finance_manager")
    with pytest.raises(RoleTransitionError):
        apply_role_change(finance_user, "freelancer", changed_by=super_admin)


@pytest.mark.django_db
def test_ops_change_role_still_works_after_role_service_refactor(customer_user, super_admin):
    """Regression check: extracting apply_role_change() out of ops_change_role
    must not change that endpoint's existing behavior/response shape."""
    resp = _client(super_admin).post(
        f"/api/ops/users/{customer_user.id}/role/", {"new_role": "support_agent"}, format="json",
    )
    assert resp.status_code == 200
    assert "Support Agent" in resp.data["detail"]
    customer_user.refresh_from_db()
    assert customer_user.role == "support_agent"
    assert RoleChangeAudit.objects.filter(target_user=customer_user, new_role="support_agent").exists()


# ── Create ──────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_non_super_admin_cannot_create_staff_invitation(ops_manager):
    resp = _client(ops_manager).post(
        "/api/ops/staff-invitations/", {"email": "invitee@resolvehq.test", "role": "freelancer"}, format="json",
    )
    assert resp.status_code == 403


@pytest.mark.django_db
def test_super_admin_can_create_staff_invitation(super_admin):
    resp = _client(super_admin).post(
        "/api/ops/staff-invitations/", {"email": "Engineer@ResolveHQ.test", "role": "freelancer"}, format="json",
    )
    assert resp.status_code == 201
    invitation = StaffInvitation.objects.get(email="engineer@resolvehq.test")
    assert invitation.status == "pending"
    assert invitation.role == "freelancer"
    assert invitation.invited_by == super_admin
    assert AuditLog.objects.filter(
        entity="staff_invitation", action="staff_invited", entity_id=invitation.id,
    ).exists()


@pytest.mark.django_db
def test_cannot_create_duplicate_pending_invitation(super_admin):
    client = _client(super_admin)
    client.post("/api/ops/staff-invitations/", {"email": "dup@resolvehq.test", "role": "freelancer"}, format="json")
    resp = client.post("/api/ops/staff-invitations/", {"email": "dup@resolvehq.test", "role": "admin"}, format="json")
    assert resp.status_code == 400


@pytest.mark.django_db
def test_cannot_invite_existing_user_who_already_has_role(super_admin):
    _user("already-engineer@resolvehq.test", role="freelancer")
    resp = _client(super_admin).post(
        "/api/ops/staff-invitations/", {"email": "already-engineer@resolvehq.test", "role": "freelancer"}, format="json",
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_cannot_invite_finance_manager_or_support_agent_directly_to_engineer_or_admin(super_admin):
    _user("finance@resolvehq.test", role="finance_manager")
    _user("support@resolvehq.test", role="support_agent")
    client = _client(super_admin)

    resp = client.post("/api/ops/staff-invitations/", {"email": "finance@resolvehq.test", "role": "freelancer"}, format="json")
    assert resp.status_code == 400
    resp = client.post("/api/ops/staff-invitations/", {"email": "finance@resolvehq.test", "role": "admin"}, format="json")
    assert resp.status_code == 400
    resp = client.post("/api/ops/staff-invitations/", {"email": "support@resolvehq.test", "role": "admin"}, format="json")
    assert resp.status_code == 400

    # No invitation should have been created for either rejected attempt.
    assert not StaffInvitation.objects.filter(email__in=["finance@resolvehq.test", "support@resolvehq.test"]).exists()


@pytest.mark.django_db
def test_can_invite_existing_customer_or_ops_manager_to_engineer_or_admin(super_admin, customer_user, ops_manager):
    client = _client(super_admin)
    resp = client.post("/api/ops/staff-invitations/", {"email": customer_user.email, "role": "freelancer"}, format="json")
    assert resp.status_code == 201
    resp = client.post("/api/ops/staff-invitations/", {"email": ops_manager.email, "role": "admin"}, format="json")
    assert resp.status_code == 201


# ── List / revoke / resend ──────────────────────────────────────────

@pytest.mark.django_db
def test_list_staff_invitations_super_admin_only(super_admin, ops_manager):
    StaffInvitation.objects.create(
        email="a@resolvehq.test", role="freelancer", invited_by=super_admin,
        token="tok-list-1", expires_at=timezone.now() + timedelta(days=7),
    )
    resp = _client(ops_manager).get("/api/ops/staff-invitations/")
    assert resp.status_code == 403

    resp = _client(super_admin).get("/api/ops/staff-invitations/")
    assert resp.status_code == 200
    assert resp.data["count"] == 1


@pytest.mark.django_db
def test_revoke_only_from_pending(super_admin):
    invitation = StaffInvitation.objects.create(
        email="revoke@resolvehq.test", role="freelancer", invited_by=super_admin,
        token="tok-revoke", expires_at=timezone.now() + timedelta(days=7),
    )
    resp = _client(super_admin).post(f"/api/ops/staff-invitations/{invitation.id}/revoke/")
    assert resp.status_code == 204
    invitation.refresh_from_db()
    assert invitation.status == "revoked"

    resp = _client(super_admin).post(f"/api/ops/staff-invitations/{invitation.id}/revoke/")
    assert resp.status_code == 400
    assert AuditLog.objects.filter(entity="staff_invitation", action="staff_invitation_revoked").exists()


@pytest.mark.django_db
def test_resend_regenerates_token_and_extends_expiry(super_admin):
    old_expiry = timezone.now() + timedelta(hours=1)
    invitation = StaffInvitation.objects.create(
        email="resend@resolvehq.test", role="admin", invited_by=super_admin,
        token="tok-resend-old", expires_at=old_expiry,
    )
    resp = _client(super_admin).post(f"/api/ops/staff-invitations/{invitation.id}/resend/")
    assert resp.status_code == 200
    invitation.refresh_from_db()
    assert invitation.token != "tok-resend-old"
    assert invitation.expires_at > old_expiry
    assert invitation.status == "pending"
    assert AuditLog.objects.filter(entity="staff_invitation", action="staff_invitation_resent").exists()


@pytest.mark.django_db
def test_resend_allowed_from_expired_but_not_revoked(super_admin):
    expired = StaffInvitation.objects.create(
        email="expired-resend@resolvehq.test", role="freelancer", invited_by=super_admin,
        token="tok-expired-resend", status="expired", expires_at=timezone.now() - timedelta(days=1),
    )
    resp = _client(super_admin).post(f"/api/ops/staff-invitations/{expired.id}/resend/")
    assert resp.status_code == 200

    revoked = StaffInvitation.objects.create(
        email="revoked-resend@resolvehq.test", role="freelancer", invited_by=super_admin,
        token="tok-revoked-resend", status="revoked", expires_at=timezone.now() + timedelta(days=7),
    )
    resp = _client(super_admin).post(f"/api/ops/staff-invitations/{revoked.id}/resend/")
    assert resp.status_code == 400


# ── Accept — new user ───────────────────────────────────────────────

@pytest.mark.django_db
def test_accept_creates_engineer_account_with_freelancer_profile(super_admin):
    invitation = StaffInvitation.objects.create(
        email="new-engineer@resolvehq.test", role="freelancer", invited_by=super_admin,
        token="tok-accept-engineer", expires_at=timezone.now() + timedelta(days=7),
    )
    resp = _client().post("/api/staff-invitations/accept/", {
        "token": invitation.token, "password": "BrandNewPass123!", "first_name": "Engi",
    }, format="json")
    assert resp.status_code == 200
    assert "access" in resp.data

    user = User.objects.get(email="new-engineer@resolvehq.test")
    assert user.role == "freelancer"
    assert user.is_staff is False
    assert user.is_verified is True
    assert Freelancer.objects.filter(user=user).exists()
    assert RoleChangeAudit.objects.filter(target_user=user, old_role="customer", new_role="freelancer").exists()
    assert AuditLog.objects.filter(
        entity="staff_invitation", action="staff_invitation_accepted", entity_id=invitation.id,
    ).exists()

    invitation.refresh_from_db()
    assert invitation.status == "accepted"
    assert invitation.accepted_at is not None


@pytest.mark.django_db
def test_accept_creates_admin_account_without_freelancer_profile(super_admin):
    invitation = StaffInvitation.objects.create(
        email="new-admin@resolvehq.test", role="admin", invited_by=super_admin,
        token="tok-accept-admin", expires_at=timezone.now() + timedelta(days=7),
    )
    resp = _client().post("/api/staff-invitations/accept/", {
        "token": invitation.token, "password": "BrandNewPass123!",
    }, format="json")
    assert resp.status_code == 200

    user = User.objects.get(email="new-admin@resolvehq.test")
    assert user.role == "admin"
    assert user.is_staff is True
    assert user.is_superuser is True
    assert not Freelancer.objects.filter(user=user).exists()


# ── Accept — existing user ──────────────────────────────────────────

@pytest.mark.django_db
def test_accept_for_existing_user_requires_correct_login(super_admin, customer_user):
    invitation = StaffInvitation.objects.create(
        email=customer_user.email, role="freelancer", invited_by=super_admin,
        token="tok-existing", expires_at=timezone.now() + timedelta(days=7),
    )

    resp = _client().post("/api/staff-invitations/accept/", {"token": invitation.token}, format="json")
    assert resp.status_code == 403

    someone_else = _user("someone-else@resolvehq.test")
    resp = _client(someone_else).post("/api/staff-invitations/accept/", {"token": invitation.token}, format="json")
    assert resp.status_code == 403

    resp = _client(customer_user).post("/api/staff-invitations/accept/", {"token": invitation.token}, format="json")
    assert resp.status_code == 200
    customer_user.refresh_from_db()
    assert customer_user.role == "freelancer"
    # Existing-user path reuses apply_role_change only — it does not create a
    # Freelancer profile row, mirroring ops_change_role's existing (pre-existing,
    # out of scope) behavior when promoting an account to freelancer.
    assert not Freelancer.objects.filter(user=customer_user).exists()
    assert RoleChangeAudit.objects.filter(target_user=customer_user, old_role="customer", new_role="freelancer").exists()


# ── Accept — invalid states ──────────────────────────────────────────

@pytest.mark.django_db
def test_accept_expired_invitation_is_rejected(super_admin):
    invitation = StaffInvitation.objects.create(
        email="expired-accept@resolvehq.test", role="freelancer", invited_by=super_admin,
        token="tok-expired-accept", expires_at=timezone.now() - timedelta(days=1),
    )
    resp = _client().post("/api/staff-invitations/accept/", {
        "token": invitation.token, "password": "SomePass123!",
    }, format="json")
    assert resp.status_code == 400
    invitation.refresh_from_db()
    assert invitation.status == "expired"


@pytest.mark.django_db
def test_accept_revoked_invitation_is_rejected(super_admin):
    invitation = StaffInvitation.objects.create(
        email="revoked-accept@resolvehq.test", role="freelancer", invited_by=super_admin,
        token="tok-revoked-accept", status="revoked", expires_at=timezone.now() + timedelta(days=7),
    )
    resp = _client().post("/api/staff-invitations/accept/", {
        "token": invitation.token, "password": "SomePass123!",
    }, format="json")
    assert resp.status_code == 400


@pytest.mark.django_db
def test_accept_already_accepted_invitation_is_rejected(super_admin):
    invitation = StaffInvitation.objects.create(
        email="already-accepted@resolvehq.test", role="freelancer", invited_by=super_admin,
        token="tok-already-accepted", status="accepted", accepted_at=timezone.now(),
        expires_at=timezone.now() + timedelta(days=7),
    )
    resp = _client().post("/api/staff-invitations/accept/", {
        "token": invitation.token, "password": "SomePass123!",
    }, format="json")
    assert resp.status_code == 400


@pytest.mark.django_db
def test_accept_tampered_token_returns_404():
    resp = _client().post("/api/staff-invitations/accept/", {
        "token": "not-a-real-token", "password": "SomePass123!",
    }, format="json")
    assert resp.status_code == 404


# ── Preview ──────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_staff_invitation_preview_is_public(super_admin):
    invitation = StaffInvitation.objects.create(
        email="preview@resolvehq.test", role="admin", invited_by=super_admin,
        token="tok-preview", expires_at=timezone.now() + timedelta(days=7),
    )
    resp = _client().get(f"/api/staff-invitations/{invitation.token}/")
    assert resp.status_code == 200
    assert resp.data["role_display"] == "Super Admin"
    assert resp.data["account_exists"] is False
