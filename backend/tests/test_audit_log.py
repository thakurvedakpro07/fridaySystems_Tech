"""
Tests for the System Audit Log (AuditLog model + log_action() service +
GET /api/ops/audit-log/), and for the admin actions that now write to it:
user deactivate/reactivate, service create/update/toggle, payment confirm/refund.
"""

import uuid as uuid_lib
from decimal import Decimal
from unittest.mock import patch

import pytest
from rest_framework.test import APIClient

from django.contrib.auth import get_user_model
from django.test import override_settings
from support_app.models import AuditLog, Customer, Payment, Service, Ticket
from support_app.services.audit_service import log_action

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
    return _user("admin@audit.test", "admin", is_staff=True)


@pytest.fixture
def ops_manager(db):
    return _user("ops@audit.test", "operations_manager")


@pytest.fixture
def finance_manager(db):
    return _user("finance@audit.test", "finance_manager")


@pytest.fixture
def support_agent(db):
    return _user("support@audit.test", "support_agent")


@pytest.fixture
def customer_user(db):
    u = _user("cust@audit.test", "customer")
    Customer.objects.create(user=u, company="Acme")
    return u


@pytest.fixture
def target_user(db):
    u = _user("target@audit.test", "customer")
    Customer.objects.create(user=u, company="TargetCo")
    return u


@pytest.fixture
def a_service(db):
    return Service.objects.create(
        key="kubernetes_support_audit_test", name="Kubernetes Support (audit test)",
        description="", resolution_fee=100,
    )


@pytest.fixture
def a_payment(db, customer_user):
    ticket = Ticket.objects.create(
        customer=customer_user.customer_profile,
        title="Audit test ticket",
        service_type="server_admin",
        severity="low",
        status="open",
    )
    return Payment.objects.create(
        customer=customer_user.customer_profile,
        ticket=ticket,
        amount=Decimal("299.00"),
        gst_amount=Decimal("53.82"),
        invoice_number=f"INV-AUDIT-{uuid_lib.uuid4().hex[:8]}",
        payment_type="consulting_fee",
        gateway="razorpay",
        gateway_payment_id="pay_audit_test",
        status="completed",
    )


# ── log_action() unit tests ──────────────────────────────────────


@pytest.mark.django_db
def test_log_action_writes_expected_fields(super_admin):
    entity_id = uuid_lib.uuid4()
    log_action(
        user=super_admin, entity="user", action="user_deactivated",
        entity_id=entity_id, metadata={"target_email": "x@y.test"},
    )
    row = AuditLog.objects.get(entity_id=entity_id)
    assert row.user_id == super_admin.pk
    assert row.user_type == "admin"
    assert row.entity == "user"
    assert row.action == "user_deactivated"
    assert row.metadata == {"target_email": "x@y.test"}
    assert row.ip_address is None


@pytest.mark.django_db
def test_log_action_extracts_ip_from_x_forwarded_for(super_admin, rf):
    request = rf.post("/api/ops/users/x/deactivate/")
    request.META["HTTP_X_FORWARDED_FOR"] = "203.0.113.5, 10.0.0.1"
    log_action(user=super_admin, entity="user", action="user_deactivated", request=request)
    row = AuditLog.objects.filter(entity="user", action="user_deactivated").latest("created_at")
    assert row.ip_address == "203.0.113.5"


@pytest.mark.django_db
def test_log_action_falls_back_to_remote_addr(super_admin, rf):
    request = rf.post("/api/ops/users/x/deactivate/", REMOTE_ADDR="127.0.0.1")
    log_action(user=super_admin, entity="user", action="user_deactivated", request=request)
    row = AuditLog.objects.filter(entity="user", action="user_deactivated").latest("created_at")
    assert row.ip_address == "127.0.0.1"


@pytest.mark.django_db
def test_log_action_never_raises_on_db_error(super_admin):
    with patch("support_app.services.audit_service.AuditLog.objects.create", side_effect=Exception("boom")):
        log_action(user=super_admin, entity="user", action="user_deactivated")  # must not raise
    assert not AuditLog.objects.filter(action="user_deactivated").exists()


# ── View-level: writes happen on the real admin actions ──────────


@pytest.mark.django_db
def test_deactivate_user_writes_audit_log(super_admin, target_user):
    resp = _client(super_admin).post(f"/api/ops/users/{target_user.id}/deactivate/")
    assert resp.status_code == 200
    row = AuditLog.objects.get(entity="user", action="user_deactivated", entity_id=target_user.id)
    assert row.user_id == super_admin.pk
    assert row.metadata["target_email"] == target_user.email


@pytest.mark.django_db
def test_reactivate_user_writes_audit_log(super_admin, target_user):
    target_user.is_active = False
    target_user.save(update_fields=["is_active"])
    resp = _client(super_admin).post(f"/api/ops/users/{target_user.id}/reactivate/")
    assert resp.status_code == 200
    assert AuditLog.objects.filter(
        entity="user", action="user_reactivated", entity_id=target_user.id
    ).exists()


@pytest.mark.django_db
def test_service_create_writes_audit_log(super_admin):
    resp = _client(super_admin).post("/api/ops/services/", {"name": "New Service", "description": "x"})
    assert resp.status_code == 201
    service_id = resp.data["id"]
    assert AuditLog.objects.filter(
        entity="service", action="service_created", entity_id=service_id
    ).exists()


@pytest.mark.django_db
def test_service_update_writes_audit_log(super_admin, a_service):
    resp = _client(super_admin).patch(f"/api/ops/services/{a_service.id}/", {"description": "updated"})
    assert resp.status_code == 200
    assert AuditLog.objects.filter(
        entity="service", action="service_updated", entity_id=a_service.id
    ).exists()


# Note: the old toggle-based test that used to live here was superseded by
# Phase 3 (Service Catalog Management) — ops_service_toggle was replaced by
# separate archive/mark-unavailable/reactivate endpoints. That state-machine
# + audit-log coverage now lives in test_service_catalog.py.


@pytest.mark.django_db
@override_settings(RAZORPAY_KEY_ID="", RAZORPAY_KEY_SECRET="")
def test_payment_refund_writes_audit_log(finance_manager, a_payment):
    resp = _client(finance_manager).post(f"/api/ops/payments/{a_payment.id}/refund/")
    assert resp.status_code == 200
    assert AuditLog.objects.filter(
        entity="payment", action="payment_refunded", entity_id=a_payment.id
    ).exists()


# ── GET /api/ops/audit-log/ — permissions ────────────────────────


@pytest.mark.django_db
def test_audit_log_super_admin_allowed(super_admin):
    resp = _client(super_admin).get("/api/ops/audit-log/")
    assert resp.status_code == 200


@pytest.mark.django_db
def test_audit_log_ops_manager_allowed(ops_manager):
    resp = _client(ops_manager).get("/api/ops/audit-log/")
    assert resp.status_code == 200


@pytest.mark.django_db
def test_audit_log_finance_manager_blocked(finance_manager):
    resp = _client(finance_manager).get("/api/ops/audit-log/")
    assert resp.status_code == 403


@pytest.mark.django_db
def test_audit_log_support_agent_blocked(support_agent):
    resp = _client(support_agent).get("/api/ops/audit-log/")
    assert resp.status_code == 403


@pytest.mark.django_db
def test_audit_log_customer_blocked(customer_user):
    resp = _client(customer_user).get("/api/ops/audit-log/")
    assert resp.status_code == 403


@pytest.mark.django_db
def test_audit_log_unauthenticated_blocked():
    resp = APIClient().get("/api/ops/audit-log/")
    assert resp.status_code == 401


# ── GET /api/ops/audit-log/ — filters + pagination + email resolution ──


@pytest.mark.django_db
def test_audit_log_filters_by_entity_and_action(super_admin, target_user, a_service):
    _client(super_admin).post(f"/api/ops/users/{target_user.id}/deactivate/")
    _client(super_admin).post("/api/ops/services/", {"name": "Filter Test Service"})

    resp = _client(super_admin).get("/api/ops/audit-log/", {"entity": "user"})
    assert resp.status_code == 200
    assert all(row["entity"] == "user" for row in resp.data["results"])

    resp = _client(super_admin).get("/api/ops/audit-log/", {"action": "service_created"})
    assert all(row["action"] == "service_created" for row in resp.data["results"])


@pytest.mark.django_db
def test_audit_log_search_by_actor_email(super_admin, target_user):
    _client(super_admin).post(f"/api/ops/users/{target_user.id}/deactivate/")
    resp = _client(super_admin).get("/api/ops/audit-log/", {"search": "admin@audit.test"})
    assert resp.status_code == 200
    assert len(resp.data["results"]) >= 1
    assert resp.data["results"][0]["user_email"] == "admin@audit.test"


@pytest.mark.django_db
def test_audit_log_search_by_entity_id_uuid(super_admin, target_user):
    _client(super_admin).post(f"/api/ops/users/{target_user.id}/deactivate/")
    resp = _client(super_admin).get("/api/ops/audit-log/", {"search": str(target_user.id)})
    assert resp.status_code == 200
    assert any(row["entity_id"] == str(target_user.id) for row in resp.data["results"])


@pytest.mark.django_db
def test_audit_log_search_non_uuid_non_matching_email_does_not_500(super_admin, target_user):
    _client(super_admin).post(f"/api/ops/users/{target_user.id}/deactivate/")
    resp = _client(super_admin).get("/api/ops/audit-log/", {"search": "not-a-uuid-or-email"})
    assert resp.status_code == 200
    assert resp.data["results"] == []


@pytest.mark.django_db
def test_audit_log_supports_page_size(super_admin, target_user):
    for _ in range(3):
        log_action(user=super_admin, entity="user", action="user_deactivated", entity_id=target_user.id)
    resp = _client(super_admin).get("/api/ops/audit-log/", {"page_size": 2})
    assert resp.status_code == 200
    assert len(resp.data["results"]) == 2
    assert resp.data["count"] >= 3
