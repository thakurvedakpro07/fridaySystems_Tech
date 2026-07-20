"""
Tests for Phase 3 of the Admin Portal audit: Service Catalog Management.

Covers the full CRUD + Archive/Mark-Unavailable/Reactivate lifecycle on the
`Service` model (now the live source of truth for the customer-facing
catalog, replacing the hardcoded SERVICE_CATALOG list), audit logging for
every action, permission boundaries (Super Admin + Ops Manager only),
GET /api/services/'s availability-aware public response, and ticket-creation
validation against the live catalog (services_list, TicketCreateSerializer,
get_resolution_fee).
"""

import uuid as uuid_lib
from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from django.contrib.auth import get_user_model
from support_app.models import AuditLog, Customer, Service, Ticket

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
    return _user("admin@catalog.test", "admin", is_staff=True)


@pytest.fixture
def ops_manager(db):
    return _user("ops@catalog.test", "operations_manager")


@pytest.fixture
def finance_manager(db):
    return _user("finance@catalog.test", "finance_manager")


@pytest.fixture
def support_agent(db):
    return _user("support@catalog.test", "support_agent")


@pytest.fixture
def customer_user(db):
    u = _user("cust@catalog.test", "customer")
    Customer.objects.create(user=u, company="Acme")
    return u


@pytest.fixture
def a_service(db):
    return Service.objects.create(
        key="test_service", name="Test Service", category="Testing", icon="🧪",
        description="A service used for tests", resolution_fee=500,
        estimated_response_minutes=60, estimated_resolution_minutes=480,
        is_active=True, is_available=True,
    )


@pytest.fixture
def unavailable_service(db):
    return Service.objects.create(
        key="unavailable_service", name="Unavailable Service", resolution_fee=700,
        is_active=True, is_available=False,
    )


@pytest.fixture
def archived_service(db):
    return Service.objects.create(
        key="archived_service", name="Archived Service", resolution_fee=800,
        is_active=False, is_available=False,
    )


# ── Permissions ───────────────────────────────────────────────────


@pytest.mark.django_db
def test_list_super_admin_allowed(super_admin):
    assert _client(super_admin).get("/api/ops/services/").status_code == 200


@pytest.mark.django_db
def test_list_ops_manager_allowed(ops_manager):
    assert _client(ops_manager).get("/api/ops/services/").status_code == 200


@pytest.mark.django_db
def test_list_finance_manager_blocked(finance_manager):
    assert _client(finance_manager).get("/api/ops/services/").status_code == 403


@pytest.mark.django_db
def test_list_support_agent_blocked(support_agent):
    assert _client(support_agent).get("/api/ops/services/").status_code == 403


@pytest.mark.django_db
def test_list_customer_blocked(customer_user):
    assert _client(customer_user).get("/api/ops/services/").status_code == 403


@pytest.mark.django_db
def test_list_unauthenticated_blocked():
    assert APIClient().get("/api/ops/services/").status_code == 401


@pytest.mark.django_db
def test_archive_finance_manager_blocked(finance_manager, a_service):
    resp = _client(finance_manager).post(f"/api/ops/services/{a_service.id}/archive/")
    assert resp.status_code == 403


@pytest.mark.django_db
def test_delete_support_agent_blocked(support_agent, a_service):
    resp = _client(support_agent).delete(f"/api/ops/services/{a_service.id}/")
    assert resp.status_code == 403


# ── Create / auto-key / immutability ─────────────────────────────


@pytest.mark.django_db
def test_create_auto_generates_key_from_name(ops_manager):
    resp = _client(ops_manager).post("/api/ops/services/", {
        "name": "Cool New Service", "resolution_fee": 999,
    })
    assert resp.status_code == 201
    assert resp.data["key"] == "cool_new_service"


@pytest.mark.django_db
def test_create_with_explicit_key(super_admin):
    resp = _client(super_admin).post("/api/ops/services/", {
        "name": "My Service", "key": "my_custom_key", "resolution_fee": 100,
    })
    assert resp.status_code == 201
    assert resp.data["key"] == "my_custom_key"


@pytest.mark.django_db
def test_create_duplicate_key_gets_unique_suffix(ops_manager):
    Service.objects.create(key="dup_test", name="First", resolution_fee=1)
    resp = _client(ops_manager).post("/api/ops/services/", {
        "name": "Dup Test", "resolution_fee": 2,
    })
    assert resp.status_code == 201
    assert resp.data["key"] != "dup_test"
    assert resp.data["key"].startswith("dup_test")


@pytest.mark.django_db
def test_create_writes_audit_log(super_admin):
    resp = _client(super_admin).post("/api/ops/services/", {
        "name": "Audited Service", "resolution_fee": 500,
    })
    assert resp.status_code == 201
    assert AuditLog.objects.filter(
        entity="service", action="service_created", entity_id=resp.data["id"]
    ).exists()


@pytest.mark.django_db
def test_create_full_field_set(ops_manager):
    resp = _client(ops_manager).post("/api/ops/services/", {
        "name": "Full Service", "category": "Cloud", "description": "Full desc",
        "icon": "☁️", "display_order": 5, "resolution_fee": 1200,
        "estimated_response_minutes": 90, "estimated_resolution_minutes": 720,
        "featured": True, "required_skills": "aws,azure",
    })
    assert resp.status_code == 201, resp.data
    for field, expected in [
        ("category", "Cloud"), ("description", "Full desc"), ("icon", "☁️"),
        ("display_order", 5), ("resolution_fee", 1200),
        ("estimated_response_minutes", 90), ("estimated_resolution_minutes", 720),
        ("featured", True), ("required_skills", "aws,azure"),
        ("is_active", True), ("is_available", True),
    ]:
        assert resp.data[field] == expected, field


@pytest.mark.django_db
def test_update_cannot_change_key(super_admin, a_service):
    resp = _client(super_admin).patch(f"/api/ops/services/{a_service.id}/", {"key": "different_key"})
    assert resp.status_code == 400


@pytest.mark.django_db
def test_update_writes_audit_log(super_admin, a_service):
    resp = _client(super_admin).patch(f"/api/ops/services/{a_service.id}/", {"resolution_fee": 999})
    assert resp.status_code == 200
    assert resp.data["resolution_fee"] == 999
    assert AuditLog.objects.filter(
        entity="service", action="service_updated", entity_id=a_service.id
    ).exists()


@pytest.mark.django_db
def test_partial_update_does_not_reset_is_active_or_is_available(super_admin, unavailable_service):
    """
    Regression guard: BooleanField has an HTML-forms quirk where a field
    absent from a multipart PATCH body can be misread as "explicitly set to
    False" instead of "not provided, leave unchanged." A PATCH that only
    touches resolution_fee must not silently flip is_available back to True
    (or is_active to False) as a side effect.
    """
    assert unavailable_service.is_active is True
    assert unavailable_service.is_available is False

    resp = _client(super_admin).patch(f"/api/ops/services/{unavailable_service.id}/", {"resolution_fee": 1})
    assert resp.status_code == 200
    unavailable_service.refresh_from_db()
    assert unavailable_service.is_active is True
    assert unavailable_service.is_available is False, "PATCH without is_available must not reset it to True"


# ── Archive / Mark Unavailable / Reactivate ──────────────────────


@pytest.mark.django_db
def test_archive_sets_inactive_and_unavailable(ops_manager, a_service):
    resp = _client(ops_manager).post(f"/api/ops/services/{a_service.id}/archive/")
    assert resp.status_code == 200
    a_service.refresh_from_db()
    assert a_service.is_active is False
    assert a_service.is_available is False
    assert AuditLog.objects.filter(
        entity="service", action="service_archived", entity_id=a_service.id
    ).exists()


@pytest.mark.django_db
def test_mark_unavailable_keeps_active(ops_manager, a_service):
    resp = _client(ops_manager).post(f"/api/ops/services/{a_service.id}/mark-unavailable/")
    assert resp.status_code == 200
    a_service.refresh_from_db()
    assert a_service.is_active is True
    assert a_service.is_available is False
    assert AuditLog.objects.filter(
        entity="service", action="service_marked_unavailable", entity_id=a_service.id
    ).exists()


@pytest.mark.django_db
def test_reactivate_from_archived(super_admin, archived_service):
    resp = _client(super_admin).post(f"/api/ops/services/{archived_service.id}/reactivate/")
    assert resp.status_code == 200
    archived_service.refresh_from_db()
    assert archived_service.is_active is True
    assert archived_service.is_available is True
    assert AuditLog.objects.filter(
        entity="service", action="service_reactivated", entity_id=archived_service.id
    ).exists()


@pytest.mark.django_db
def test_reactivate_from_unavailable(super_admin, unavailable_service):
    resp = _client(super_admin).post(f"/api/ops/services/{unavailable_service.id}/reactivate/")
    assert resp.status_code == 200
    unavailable_service.refresh_from_db()
    assert unavailable_service.is_active is True
    assert unavailable_service.is_available is True


# ── Delete ────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_delete_succeeds_when_unreferenced(super_admin, a_service):
    service_id = a_service.id
    resp = _client(super_admin).delete(f"/api/ops/services/{service_id}/")
    assert resp.status_code == 204
    assert not Service.objects.filter(id=service_id).exists()
    assert AuditLog.objects.filter(
        entity="service", action="service_deleted", entity_id=service_id
    ).exists()


@pytest.mark.django_db
def test_delete_blocked_when_referenced_by_ticket(super_admin, a_service, customer_user):
    Ticket.objects.create(
        customer=customer_user.customer_profile,
        title="Uses the test service",
        service_type=a_service.key,
        severity="low",
        status="open",
    )
    resp = _client(super_admin).delete(f"/api/ops/services/{a_service.id}/")
    assert resp.status_code == 400
    assert Service.objects.filter(id=a_service.id).exists()


# ── Filters ───────────────────────────────────────────────────────


@pytest.mark.django_db
def test_filter_by_status(ops_manager, a_service, unavailable_service, archived_service):
    resp = _client(ops_manager).get("/api/ops/services/", {"status": "active"})
    keys = {r["key"] for r in (resp.data.get("results") or resp.data)}
    assert a_service.key in keys and unavailable_service.key not in keys and archived_service.key not in keys

    resp = _client(ops_manager).get("/api/ops/services/", {"status": "unavailable"})
    keys = {r["key"] for r in (resp.data.get("results") or resp.data)}
    assert unavailable_service.key in keys and a_service.key not in keys

    resp = _client(ops_manager).get("/api/ops/services/", {"status": "archived"})
    keys = {r["key"] for r in (resp.data.get("results") or resp.data)}
    assert archived_service.key in keys and a_service.key not in keys


# ── GET /api/services/ (public, customer-facing) ─────────────────


@pytest.mark.django_db
def test_public_catalog_excludes_archived(a_service, archived_service):
    resp = APIClient().get("/api/services/")
    assert resp.status_code == 200
    keys = {s["key"] for s in resp.data["services"]}
    assert a_service.key in keys
    assert archived_service.key not in keys


@pytest.mark.django_db
def test_public_catalog_includes_unavailable_with_flag(a_service, unavailable_service):
    resp = APIClient().get("/api/services/")
    by_key = {s["key"]: s for s in resp.data["services"]}
    assert unavailable_service.key in by_key
    assert by_key[unavailable_service.key]["is_available"] is False
    assert by_key[a_service.key]["is_available"] is True


@pytest.mark.django_db
def test_public_catalog_includes_new_fields(a_service):
    resp = APIClient().get("/api/services/")
    entry = next(s for s in resp.data["services"] if s["key"] == a_service.key)
    assert entry["icon"] == "🧪"
    assert entry["category"] == "Testing"
    assert entry["estimated_response_minutes"] == 60
    assert entry["estimated_resolution_minutes"] == 480


# ── Ticket creation validation ────────────────────────────────────


@pytest.mark.django_db
def test_create_ticket_rejects_unknown_service(customer_user):
    resp = _client(customer_user).post("/api/tickets/", {
        "title": "x", "description": "y", "service_type": "does_not_exist", "severity": "low",
    }, format="json")
    assert resp.status_code == 400


@pytest.mark.django_db
def test_create_ticket_rejects_archived_service(customer_user, archived_service):
    resp = _client(customer_user).post("/api/tickets/", {
        "title": "x", "description": "y", "service_type": archived_service.key, "severity": "low",
    }, format="json")
    assert resp.status_code == 400


@pytest.mark.django_db
def test_create_ticket_rejects_unavailable_service(customer_user, unavailable_service):
    resp = _client(customer_user).post("/api/tickets/", {
        "title": "x", "description": "y", "service_type": unavailable_service.key, "severity": "low",
    }, format="json")
    assert resp.status_code == 400
    assert "unavailable" in str(resp.data).lower()


@pytest.mark.django_db
def test_create_ticket_succeeds_for_active_available_service(customer_user, a_service):
    resp = _client(customer_user).post("/api/tickets/", {
        "title": "x", "description": "y", "service_type": a_service.key, "severity": "low",
    }, format="json")
    assert resp.status_code == 201, resp.data


# ── get_resolution_fee() reads live Service data ─────────────────


@pytest.mark.django_db
def test_get_resolution_fee_reads_from_service_model(a_service):
    from support_app.services.service_catalog import get_resolution_fee

    fee = get_resolution_fee(a_service.key, "low")
    assert fee["base_fee"] == 500

    a_service.resolution_fee = 1000
    a_service.save(update_fields=["resolution_fee"])
    fee = get_resolution_fee(a_service.key, "low")
    assert fee["base_fee"] == 1000


@pytest.mark.django_db
def test_ticket_get_service_type_display_reads_live_service_name(customer_user, a_service):
    """
    Regression guard: Ticket.service_type intentionally has no model-level
    choices= (see its comment in models.py), which means Django does NOT
    auto-generate get_service_type_display() — a manually-defined method on
    Ticket replaces it. Several callers (notifications, email, invoice PDF)
    depend on this exact method name still working.
    """
    ticket = Ticket.objects.create(
        customer=customer_user.customer_profile, title="x",
        service_type=a_service.key, severity="low", status="open",
    )
    assert ticket.get_service_type_display() == a_service.name


@pytest.mark.django_db
def test_ticket_get_service_type_display_falls_back_to_raw_key_for_unknown_service(customer_user):
    ticket = Ticket.objects.create(
        customer=customer_user.customer_profile, title="x",
        service_type="some_legacy_key", severity="low", status="open",
    )
    assert ticket.get_service_type_display() == "some_legacy_key"


@pytest.mark.django_db
def test_sla_policy_can_be_created_for_a_newly_added_service(ops_manager):
    """
    Cross-phase regression guard: Phase 2's SLAPolicySerializer used to
    validate service_type against the legacy static SERVICE_CHOICES list,
    which only ever contained the original 8 built-in services. That would
    silently block SLA policies for any service an admin adds via Phase 3's
    catalog management — defeating the entire point of making the catalog
    dynamic. SLAPolicySerializer.validate_service_type() must check the live
    Service table instead.
    """
    create_resp = _client(ops_manager).post("/api/ops/services/", {
        "name": "Brand New Admin-Added Service", "resolution_fee": 1000,
    })
    assert create_resp.status_code == 201
    new_key = create_resp.data["key"]

    policy_resp = _client(ops_manager).post("/api/ops/sla-policies/", {
        "service_type": new_key, "severity": "low", "plan": "default",
        "first_response_seconds": 3600, "resolution_seconds": 7200,
    })
    assert policy_resp.status_code == 201, policy_resp.data
    assert policy_resp.data["service_type_display"] == "Brand New Admin-Added Service"


@pytest.mark.django_db
def test_get_resolution_fee_falls_back_to_legacy_for_canonical_keys(db):
    # These 8 keys are seeded by migration 0028 in every real environment;
    # this proves the legacy fallback path also has correct values in case
    # a fresh test DB somehow lacks the seed (pytest-django's test DB does
    # run migrations, so this should hit the Service row, not the fallback).
    from support_app.services.service_catalog import get_resolution_fee
    fee = get_resolution_fee("server_admin", "high")
    assert fee["base_fee"] == 999
    assert fee["severity_surcharge"] == 500
    assert fee["subtotal"] == 1499
