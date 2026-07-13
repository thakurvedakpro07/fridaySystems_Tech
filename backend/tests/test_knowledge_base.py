"""
Tests for the Knowledge Base module: article visibility (draft vs
published, customer vs staff), write permissions, search, and
ticket-linking endpoints.
"""

import pytest
from rest_framework.test import APIClient

from support_app.models import Customer, KBArticle, KBArticleTicketLink, Ticket

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
    u = _user("kb_cust@test.local", "customer")
    Customer.objects.create(user=u, company="Acme")
    return u


@pytest.fixture
def support_agent(db):
    return _user("kb_agent@test.local", "support_agent")


@pytest.fixture
def finance_manager(db):
    return _user("kb_finance@test.local", "finance_manager")


@pytest.fixture
def published_article(db, support_agent):
    return KBArticle.objects.create(
        title="Fixing VPN drops", body="Some **markdown** body.",
        category="security", tags="vpn,network", status="published", author=support_agent,
    )


@pytest.fixture
def draft_article(db, support_agent):
    return KBArticle.objects.create(
        title="Draft article about SAP", body="Draft content.",
        category="sap", status="draft", author=support_agent,
    )


@pytest.fixture
def ticket(db, customer_user):
    return Ticket.objects.create(
        customer=customer_user.customer_profile, title="VPN keeps dropping",
        description="VPN connection unstable", service_type="security", severity="high", status="open",
    )


# ── Read visibility ─────────────────────────────────────────────

@pytest.mark.django_db
def test_customer_sees_only_published_articles(customer_user, published_article, draft_article):
    resp = _client(customer_user).get("/api/kb/articles/")
    assert resp.status_code == 200
    ids = {a["id"] for a in resp.data["results"]} if "results" in resp.data else {a["id"] for a in resp.data}
    assert str(published_article.id) in ids
    assert str(draft_article.id) not in ids


@pytest.mark.django_db
def test_customer_cannot_fetch_draft_article_detail(customer_user, draft_article):
    resp = _client(customer_user).get(f"/api/kb/articles/{draft_article.id}/")
    assert resp.status_code == 404


@pytest.mark.django_db
def test_staff_sees_draft_and_published(support_agent, published_article, draft_article):
    resp = _client(support_agent).get("/api/kb/articles/")
    ids = {a["id"] for a in resp.data["results"]} if "results" in resp.data else {a["id"] for a in resp.data}
    assert str(published_article.id) in ids
    assert str(draft_article.id) in ids


# ── Write permissions ────────────────────────────────────────────

@pytest.mark.django_db
def test_customer_cannot_create_article(customer_user):
    resp = _client(customer_user).post("/api/kb/articles/", {
        "title": "Hack", "body": "x", "category": "general",
    })
    assert resp.status_code == 403


@pytest.mark.django_db
def test_staff_can_create_article_with_auto_slug(support_agent):
    resp = _client(support_agent).post("/api/kb/articles/", {
        "title": "How to Reset a Password", "body": "Steps here.", "category": "general",
    })
    assert resp.status_code == 201
    article = KBArticle.objects.get(pk=resp.data["id"])
    assert article.slug == "how-to-reset-a-password"
    assert article.author_id == support_agent.id


@pytest.mark.django_db
def test_duplicate_title_gets_unique_slug(support_agent):
    KBArticle.objects.create(title="Duplicate Title", body="a", category="general", author=support_agent)
    resp = _client(support_agent).post("/api/kb/articles/", {
        "title": "Duplicate Title", "body": "b", "category": "general",
    })
    assert resp.status_code == 201
    assert resp.data["slug"] != "duplicate-title"
    assert resp.data["slug"].startswith("duplicate-title-")


@pytest.mark.django_db
def test_customer_cannot_edit_or_delete_article(customer_user, published_article):
    c = _client(customer_user)
    assert c.patch(f"/api/kb/articles/{published_article.id}/", {"title": "New"}).status_code == 403
    assert c.delete(f"/api/kb/articles/{published_article.id}/").status_code == 403


# ── Categories ────────────────────────────────────────────────────

@pytest.mark.django_db
def test_kb_categories_endpoint(customer_user):
    resp = _client(customer_user).get("/api/kb/categories/")
    assert resp.status_code == 200
    keys = {c["key"] for c in resp.data["categories"]}
    assert "general" in keys
    assert len(keys) >= 2


# ── Search ────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_search_matches_title_case_insensitive(customer_user, published_article):
    resp = _client(customer_user).get("/api/kb/articles/?q=vpn")
    results = resp.data["results"] if "results" in resp.data else resp.data
    ids = {a["id"] for a in results}
    assert str(published_article.id) in ids

    resp2 = _client(customer_user).get("/api/kb/articles/?q=VPN")
    results2 = resp2.data["results"] if "results" in resp2.data else resp2.data
    ids2 = {a["id"] for a in results2}
    assert str(published_article.id) in ids2


@pytest.mark.django_db
def test_search_no_match_returns_empty(customer_user, published_article):
    resp = _client(customer_user).get("/api/kb/articles/?q=zzznomatchzzz")
    results = resp.data["results"] if "results" in resp.data else resp.data
    assert len(results) == 0


# ── View count ────────────────────────────────────────────────────

@pytest.mark.django_db
def test_view_count_increments_once_per_get(customer_user, published_article):
    client = _client(customer_user)
    client.get(f"/api/kb/articles/{published_article.id}/")
    published_article.refresh_from_db()
    assert published_article.view_count == 1

    client.get(f"/api/kb/articles/{published_article.id}/")
    published_article.refresh_from_db()
    assert published_article.view_count == 2


# ── Ticket linking ────────────────────────────────────────────────

@pytest.mark.django_db
def test_ticket_kb_articles_returns_linked_and_suggested(customer_user, ticket, published_article, support_agent):
    KBArticleTicketLink.objects.create(ticket=ticket, article=published_article, linked_by=support_agent)
    resp = _client(customer_user).get(f"/api/tickets/{ticket.id}/kb-articles/")
    assert resp.status_code == 200
    assert "linked" in resp.data and "suggested" in resp.data
    linked_ids = {a["id"] for a in resp.data["linked"]}
    assert str(published_article.id) in linked_ids


@pytest.mark.django_db
def test_ticket_kb_articles_denies_other_customer(db, ticket):
    other = _user("other_cust@test.local", "customer")
    Customer.objects.create(user=other, company="Other Co")
    resp = _client(other).get(f"/api/tickets/{ticket.id}/kb-articles/")
    assert resp.status_code == 404


@pytest.mark.django_db
def test_link_article_requires_ticket_management_staff(customer_user, finance_manager, ticket, published_article):
    resp = _client(customer_user).post(f"/api/tickets/{ticket.id}/kb-articles/{published_article.id}/link/")
    assert resp.status_code == 403

    resp2 = _client(finance_manager).post(f"/api/tickets/{ticket.id}/kb-articles/{published_article.id}/link/")
    assert resp2.status_code == 403


@pytest.mark.django_db
def test_link_and_unlink_article(support_agent, ticket, published_article):
    client = _client(support_agent)
    resp = client.post(f"/api/tickets/{ticket.id}/kb-articles/{published_article.id}/link/")
    assert resp.status_code == 201
    assert KBArticleTicketLink.objects.filter(ticket=ticket, article=published_article).exists()

    # Linking again is idempotent — returns 200, no duplicate row.
    resp2 = client.post(f"/api/tickets/{ticket.id}/kb-articles/{published_article.id}/link/")
    assert resp2.status_code == 200
    assert KBArticleTicketLink.objects.filter(ticket=ticket, article=published_article).count() == 1

    resp3 = client.delete(f"/api/tickets/{ticket.id}/kb-articles/{published_article.id}/link/")
    assert resp3.status_code == 204
    assert not KBArticleTicketLink.objects.filter(ticket=ticket, article=published_article).exists()
    # Article itself is untouched by unlink.
    assert KBArticle.objects.filter(pk=published_article.id).exists()
