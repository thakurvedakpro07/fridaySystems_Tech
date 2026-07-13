"""
Tests for the AI Assistant panel: endpoint permissions (internal
ticket-management staff only — explicitly excluding Finance Manager),
payload shape, and MockAIProvider determinism.
"""

import pytest
from rest_framework.test import APIClient

from support_app.models import Customer, Freelancer, Ticket, TicketActivityLog
from support_app.services.ai_assistant_service import MockAIProvider, get_ai_provider

from django.contrib.auth import get_user_model

User = get_user_model()


def _user(email, role, is_staff=False):
    return User.objects.create_user(email=email, password="Pass123!", role=role, is_staff=is_staff)


def _client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@pytest.fixture
def customer_user(db):
    u = _user("ai_cust@test.local", "customer")
    Customer.objects.create(user=u, company="Acme")
    return u


@pytest.fixture
def engineer_user(db):
    u = _user("ai_eng@test.local", "freelancer")
    Freelancer.objects.create(user=u, onboarding_status="approved", active=True, skills="linux")
    return u


@pytest.fixture
def support_agent(db):
    return _user("ai_agent@test.local", "support_agent")


@pytest.fixture
def ops_manager(db):
    return _user("ai_ops@test.local", "operations_manager")


@pytest.fixture
def super_admin(db):
    return _user("ai_admin@test.local", "admin", is_staff=True)


@pytest.fixture
def finance_manager(db):
    return _user("ai_finance@test.local", "finance_manager")


@pytest.fixture
def ticket(db, customer_user):
    return Ticket.objects.create(
        customer=customer_user.customer_profile, title="Server disk full",
        description="Disk usage at 98 percent on the app server", service_type="linux",
        severity="high", status="in_progress",
    )


# ── Permissions ───────────────────────────────────────────────────

@pytest.mark.django_db
@pytest.mark.parametrize("fixture_name", ["support_agent", "ops_manager", "super_admin"])
def test_ticket_management_staff_can_access(request, fixture_name, ticket):
    user = request.getfixturevalue(fixture_name)
    resp = _client(user).get(f"/api/tickets/{ticket.id}/ai-assistant/")
    assert resp.status_code == 200
    for key in ("root_cause", "resolution", "related_articles", "similar_tickets", "draft_reply"):
        assert key in resp.data


@pytest.mark.django_db
def test_customer_denied(customer_user, ticket):
    resp = _client(customer_user).get(f"/api/tickets/{ticket.id}/ai-assistant/")
    assert resp.status_code == 403


@pytest.mark.django_db
def test_freelancer_denied(engineer_user, ticket):
    resp = _client(engineer_user).get(f"/api/tickets/{ticket.id}/ai-assistant/")
    assert resp.status_code == 403


@pytest.mark.django_db
def test_finance_manager_denied(finance_manager, ticket):
    """
    Regression guard: the frontend's `role` prop collapses Finance Manager
    into the same string as Support Agent at TicketDetailPage — it's easy
    to accidentally grant Finance Manager access if that string is trusted
    instead of the real role. The backend must reject it regardless.
    """
    resp = _client(finance_manager).get(f"/api/tickets/{ticket.id}/ai-assistant/")
    assert resp.status_code == 403


# ── Draft reply tone ──────────────────────────────────────────────

@pytest.mark.django_db
def test_tone_query_param_changes_draft_reply(support_agent, ticket):
    client = _client(support_agent)
    professional = client.get(f"/api/tickets/{ticket.id}/ai-assistant/?tone=professional").data["draft_reply"]
    friendly = client.get(f"/api/tickets/{ticket.id}/ai-assistant/?tone=friendly").data["draft_reply"]
    concise = client.get(f"/api/tickets/{ticket.id}/ai-assistant/?tone=concise").data["draft_reply"]
    assert professional != friendly != concise
    assert len({professional, friendly, concise}) == 3


@pytest.mark.django_db
def test_unknown_tone_falls_back_to_professional(support_agent, ticket):
    client = _client(support_agent)
    professional = client.get(f"/api/tickets/{ticket.id}/ai-assistant/?tone=professional").data["draft_reply"]
    unknown = client.get(f"/api/tickets/{ticket.id}/ai-assistant/?tone=sarcastic").data["draft_reply"]
    assert professional == unknown


# ── Log insert ────────────────────────────────────────────────────

@pytest.mark.django_db
def test_log_insert_creates_exactly_one_activity_log(support_agent, ticket):
    before = TicketActivityLog.objects.filter(ticket=ticket, action="ai_suggestion_used").count()
    resp = _client(support_agent).post(
        f"/api/tickets/{ticket.id}/ai-assistant/log-insert/", {"tone": "friendly"}, format="json",
    )
    assert resp.status_code == 204
    after = TicketActivityLog.objects.filter(ticket=ticket, action="ai_suggestion_used").count()
    assert after == before + 1
    entry = TicketActivityLog.objects.filter(ticket=ticket, action="ai_suggestion_used").latest("created_at")
    assert entry.actor_id == support_agent.id


@pytest.mark.django_db
def test_log_insert_denied_for_customer(customer_user, ticket):
    resp = _client(customer_user).post(f"/api/tickets/{ticket.id}/ai-assistant/log-insert/")
    assert resp.status_code == 403


# ── MockAIProvider unit tests (no HTTP) ───────────────────────────

@pytest.mark.django_db
def test_mock_provider_is_deterministic(ticket):
    provider = MockAIProvider()
    assert provider.suggest_root_cause(ticket) == provider.suggest_root_cause(ticket)
    assert provider.suggest_resolution(ticket) == provider.suggest_resolution(ticket)
    assert provider.draft_reply(ticket) == provider.draft_reply(ticket)


@pytest.mark.django_db
def test_mock_provider_root_cause_flags_high_severity(ticket):
    provider = MockAIProvider()
    result = provider.suggest_root_cause(ticket)
    assert "high" in result.lower() or "priority" in result.lower()


@pytest.mark.django_db
def test_get_ai_provider_returns_mock_by_default(settings):
    settings.AI_ASSISTANT_PROVIDER = "mock"
    assert isinstance(get_ai_provider(), MockAIProvider)


@pytest.mark.django_db
def test_get_ai_provider_raises_for_unknown_provider(settings):
    settings.AI_ASSISTANT_PROVIDER = "some_future_llm"
    with pytest.raises(NotImplementedError):
        get_ai_provider()
