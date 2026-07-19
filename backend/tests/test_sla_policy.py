"""
Tests for the SLA Policy admin REST API (GET/POST /api/ops/sla-policies/,
GET/PATCH/DELETE /api/ops/sla-policies/{id}/) — Phase 2 of the Admin Portal
audit. SLAPolicy itself predates this work (used by services/sla_service.py);
this only adds the missing REST surface + audit logging.
"""

import pytest
from rest_framework.test import APIClient

from django.contrib.auth import get_user_model
from support_app.models import AuditLog, Customer, SLAPolicy

User = get_user_model()


def _user(email, role, is_staff=False):
    return User.objects.create_user(
        email=email, password="Pass123!", role=role, is_staff=is_staff
    )


def _client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@pytest.fixture
def super_admin(db):
    return _user("admin@slapolicy.test", "admin", is_staff=True)


@pytest.fixture
def ops_manager(db):
    return _user("ops@slapolicy.test", "operations_manager")


@pytest.fixture
def finance_manager(db):
    return _user("finance@slapolicy.test", "finance_manager")


@pytest.fixture
def support_agent(db):
    return _user("support@slapolicy.test", "support_agent")


@pytest.fixture
def customer_user(db):
    u = _user("cust@slapolicy.test", "customer")
    Customer.objects.create(user=u, company="Acme")
    return u


@pytest.fixture
def a_policy(db):
    return SLAPolicy.objects.create(
        service_type="server_admin", severity="high", plan="default",
        first_response_seconds=3600, resolution_seconds=28800,
    )


# ── Permissions ───────────────────────────────────────────────────


@pytest.mark.django_db
def test_list_super_admin_allowed(super_admin):
    resp = _client(super_admin).get("/api/ops/sla-policies/")
    assert resp.status_code == 200


@pytest.mark.django_db
def test_list_ops_manager_allowed(ops_manager):
    resp = _client(ops_manager).get("/api/ops/sla-policies/")
    assert resp.status_code == 200


@pytest.mark.django_db
def test_list_finance_manager_blocked(finance_manager):
    resp = _client(finance_manager).get("/api/ops/sla-policies/")
    assert resp.status_code == 403


@pytest.mark.django_db
def test_list_support_agent_blocked(support_agent):
    resp = _client(support_agent).get("/api/ops/sla-policies/")
    assert resp.status_code == 403


@pytest.mark.django_db
def test_list_customer_blocked(customer_user):
    resp = _client(customer_user).get("/api/ops/sla-policies/")
    assert resp.status_code == 403


@pytest.mark.django_db
def test_list_unauthenticated_blocked():
    resp = APIClient().get("/api/ops/sla-policies/")
    assert resp.status_code == 401


@pytest.mark.django_db
def test_create_finance_manager_blocked(finance_manager):
    resp = _client(finance_manager).post("/api/ops/sla-policies/", {
        "service_type": "aws", "severity": "low", "plan": "default",
        "first_response_seconds": 3600, "resolution_seconds": 7200,
    })
    assert resp.status_code == 403


# ── Create / validation ───────────────────────────────────────────


@pytest.mark.django_db
def test_create_valid_policy_succeeds(ops_manager):
    resp = _client(ops_manager).post("/api/ops/sla-policies/", {
        "service_type": "aws", "severity": "low", "plan": "default",
        "first_response_seconds": 3600, "resolution_seconds": 7200,
    })
    assert resp.status_code == 201
    assert resp.data["service_type_display"] == "AWS Support"
    assert resp.data["severity_display"] == "Low"
    assert SLAPolicy.objects.filter(service_type="aws", severity="low").exists()


@pytest.mark.django_db
def test_create_writes_audit_log(super_admin):
    resp = _client(super_admin).post("/api/ops/sla-policies/", {
        "service_type": "database", "severity": "medium", "plan": "default",
        "first_response_seconds": 7200, "resolution_seconds": 86400,
    })
    assert resp.status_code == 201
    assert AuditLog.objects.filter(
        entity="sla_policy", action="sla_policy_created", entity_id=resp.data["id"]
    ).exists()


@pytest.mark.django_db
def test_create_rejects_invalid_service_type(ops_manager):
    resp = _client(ops_manager).post("/api/ops/sla-policies/", {
        "service_type": "not_a_real_service", "severity": "low", "plan": "default",
        "first_response_seconds": 3600, "resolution_seconds": 7200,
    })
    assert resp.status_code == 400
    assert "service_type" in resp.data.get("errors", resp.data)


@pytest.mark.django_db
def test_create_rejects_invalid_severity(ops_manager):
    resp = _client(ops_manager).post("/api/ops/sla-policies/", {
        "service_type": "aws", "severity": "not_a_real_severity", "plan": "default",
        "first_response_seconds": 3600, "resolution_seconds": 7200,
    })
    assert resp.status_code == 400
    assert "severity" in resp.data.get("errors", resp.data)


@pytest.mark.django_db
def test_create_rejects_first_response_longer_than_resolution(ops_manager):
    resp = _client(ops_manager).post("/api/ops/sla-policies/", {
        "service_type": "aws", "severity": "low", "plan": "default",
        "first_response_seconds": 99999, "resolution_seconds": 100,
    })
    assert resp.status_code == 400


@pytest.mark.django_db
def test_create_rejects_duplicate(ops_manager, a_policy):
    resp = _client(ops_manager).post("/api/ops/sla-policies/", {
        "service_type": a_policy.service_type, "severity": a_policy.severity, "plan": a_policy.plan,
        "first_response_seconds": 1000, "resolution_seconds": 2000,
    })
    assert resp.status_code == 400


# ── Update / delete ───────────────────────────────────────────────


@pytest.mark.django_db
def test_update_writes_audit_log(super_admin, a_policy):
    resp = _client(super_admin).patch(f"/api/ops/sla-policies/{a_policy.id}/", {
        "first_response_seconds": 1800,
    })
    assert resp.status_code == 200
    assert resp.data["first_response_seconds"] == 1800
    assert AuditLog.objects.filter(
        entity="sla_policy", action="sla_policy_updated", entity_id=a_policy.id
    ).exists()


@pytest.mark.django_db
def test_delete_reverts_to_default_and_writes_audit_log(ops_manager, a_policy):
    policy_id = a_policy.id
    resp = _client(ops_manager).delete(f"/api/ops/sla-policies/{policy_id}/")
    assert resp.status_code == 204
    assert not SLAPolicy.objects.filter(id=policy_id).exists()
    assert AuditLog.objects.filter(
        entity="sla_policy", action="sla_policy_deleted", entity_id=policy_id
    ).exists()


@pytest.mark.django_db
def test_delete_finance_manager_blocked(finance_manager, a_policy):
    resp = _client(finance_manager).delete(f"/api/ops/sla-policies/{a_policy.id}/")
    assert resp.status_code == 403
    assert SLAPolicy.objects.filter(id=a_policy.id).exists()


# ── Filters ───────────────────────────────────────────────────────


@pytest.mark.django_db
def test_filters_by_service_type_and_severity(ops_manager, a_policy):
    SLAPolicy.objects.create(
        service_type="aws", severity="low", plan="default",
        first_response_seconds=1000, resolution_seconds=2000,
    )
    resp = _client(ops_manager).get("/api/ops/sla-policies/", {"service_type": "server_admin"})
    assert resp.status_code == 200
    results = resp.data["results"] if "results" in resp.data else resp.data
    assert all(r["service_type"] == "server_admin" for r in results)

    resp = _client(ops_manager).get("/api/ops/sla-policies/", {"severity": "low"})
    results = resp.data["results"] if "results" in resp.data else resp.data
    assert all(r["severity"] == "low" for r in results)


# ── sla_service.py integration: confirms the API-created row is actually used ──


@pytest.mark.django_db
def test_created_policy_is_used_by_sla_service(ops_manager):
    from support_app.services.sla_service import get_sla_policy

    _client(ops_manager).post("/api/ops/sla-policies/", {
        "service_type": "kubernetes", "severity": "critical", "plan": "default",
        "first_response_seconds": 111, "resolution_seconds": 222,
    })
    policy = get_sla_policy("kubernetes", "critical", "default")
    assert policy is not None
    assert policy.first_response_seconds == 111
    assert policy.resolution_seconds == 222
