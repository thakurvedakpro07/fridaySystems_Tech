"""
Knowledge Base business logic.

Search and "related articles" both use one plain Q(...)__icontains code
path — it behaves identically whether the app is running against Postgres
(production) or the SQLite dev/CI fallback, which matters because this repo
does not guarantee Postgres locally. If full-text search (Postgres
SearchVector / trigram) is added later, it should replace the body of
search_articles() only — callers (views.py) don't need to change.
"""

import re

from django.db.models import Q

STOPWORDS = {
    "the", "a", "an", "is", "are", "was", "were", "to", "of", "in", "on",
    "for", "and", "or", "with", "this", "that", "it", "my", "our", "we",
    "i", "not", "can", "has", "have", "be", "at", "as", "by", "from",
}


def _tokenize(text: str) -> set:
    words = re.findall(r"[a-zA-Z0-9]+", (text or "").lower())
    return {w for w in words if len(w) > 2 and w not in STOPWORDS}


def search_articles(query="", category=None, status="published", queryset=None):
    """
    Return KBArticle rows matching `query` (title/body/tags, case-insensitive
    substring) and optionally `category`.

    Without a query, returns a plain (sliceable, DRF-paginator-friendly)
    QuerySet ordered by the model's default (-updated_at). With a query,
    returns a Python list re-ordered by a cheap relevance score (title match
    ranks above body/tag-only match) — bounded to 200 candidates first,
    since this is a KB with hundreds of articles, not a search engine.
    """
    from ..models import KBArticle

    qs = queryset if queryset is not None else KBArticle.objects.all()
    if status:
        qs = qs.filter(status=status)
    if category:
        qs = qs.filter(category=category)

    query = (query or "").strip()
    if not query:
        return qs

    qs = qs.filter(
        Q(title__icontains=query) | Q(body__icontains=query) | Q(tags__icontains=query)
    )

    articles = list(qs[:200])
    q_lower = query.lower()

    def relevance(article):
        score = 0
        if q_lower in article.title.lower():
            score += 10
        if q_lower in (article.tags or "").lower():
            score += 5
        if q_lower in (article.body or "").lower():
            score += 1
        return -score

    articles.sort(key=relevance)
    return articles


def get_related_articles_for_ticket(ticket, limit=5):
    """
    Score published articles by relevance to a ticket:
      - same category as ticket.service_type: heavy weight
      - shared keyword tokens with the ticket's title/description: light weight
    Returns a plain list (not a queryset) of up to `limit` KBArticle objects.
    """
    from ..models import KBArticle

    ticket_tokens = _tokenize(ticket.title) | _tokenize(ticket.description)
    candidates = KBArticle.objects.filter(status="published").filter(
        Q(category=ticket.service_type) | Q(category="general")
    )[:300]

    scored = []
    for article in candidates:
        score = 0
        if article.category == ticket.service_type:
            score += 20

        article_tokens = _tokenize(article.title) | _tokenize(article.tags)
        overlap = ticket_tokens & article_tokens
        score += len(overlap) * 3

        if score > 0:
            scored.append((score, article))

    scored.sort(key=lambda pair: pair[0], reverse=True)
    return [article for _, article in scored[:limit]]


def increment_view_count(article):
    """Bump view_count with a single atomic UPDATE (no read-modify-write race)."""
    from django.db.models import F

    from ..models import KBArticle

    KBArticle.objects.filter(pk=article.pk).update(view_count=F("view_count") + 1)
    article.view_count += 1
