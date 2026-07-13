"""
AI Assistant service for the Ticket Detail page.

Exposes a small provider interface (AIProvider) so the view layer never
talks to a specific implementation directly. Today the only implementation
is MockAIProvider — deterministic, rule-based on ticket.service_type /
severity / description keywords, no network calls. Swapping in a real
LLM-backed provider later means adding one new class + one branch in
get_ai_provider(); no changes to views.py, urls.py, or the frontend.

WHY deterministic (no `random`)?
  The same ticket must always produce the same suggestions. That keeps the
  demo reproducible and makes MockAIProvider trivially unit-testable.
"""

from abc import ABC, abstractmethod

from .kb_service import _tokenize, get_related_articles_for_ticket


class AIProvider(ABC):
    @abstractmethod
    def suggest_root_cause(self, ticket) -> str: ...

    @abstractmethod
    def suggest_resolution(self, ticket) -> str: ...

    @abstractmethod
    def find_related_articles(self, ticket) -> list: ...

    @abstractmethod
    def find_similar_tickets(self, ticket) -> list: ...

    @abstractmethod
    def draft_reply(self, ticket, tone: str = "professional") -> str: ...


# ── Canned knowledge, derived from the service catalogue ──────────
# WHY derive from SERVICE_CATALOG instead of a hardcoded per-key dict?
# service_catalog.py is the single source of truth for service categories
# (its own docstring says "Adding or removing a service: edit this file
# only") and its key set does change over time. Templating off each
# service's `name`/`scope` fields means this module never goes stale when
# a category is renamed, added, or removed there — no parallel dict to
# keep in sync.

_GENERAL_ROOT_CAUSE = (
    "Root cause is not yet clear from the ticket description — gather more "
    "diagnostic detail from the customer before proceeding."
)
_GENERAL_RESOLUTION = (
    "Escalate for a diagnostic call with the customer to narrow down the "
    "issue before proposing a fix."
)


def _service_info(service_key):
    from .service_catalog import SERVICE_CATALOG

    return next((s for s in SERVICE_CATALOG if s["key"] == service_key), None)


def _root_cause_for_service(service_key) -> str:
    info = _service_info(service_key)
    if not info:
        return _GENERAL_ROOT_CAUSE
    return (
        f"Likely tied to the {info['name']} area — recent changes, misconfiguration, "
        f"or a failure within its usual scope ({info['scope'].lower()}) is the most probable trigger."
    )


def _resolution_for_service(service_key) -> str:
    info = _service_info(service_key)
    if not info:
        return _GENERAL_RESOLUTION
    return (
        f"Reproduce the issue in the context of {info['name']}, check recent changes within "
        f"\"{info['scope']}\", apply the targeted fix, and confirm with the customer before closing."
    )

_TONE_OPENERS = {
    "professional": "Thank you for reaching out — I've reviewed the details of your ticket.",
    "friendly": "Hi there! Thanks for your patience — I've taken a look at what's going on.",
    "concise": "Update on your ticket:",
}

_TONE_CLOSERS = {
    "professional": "Please let me know if you have any questions, and I'll keep you updated as we proceed.",
    "friendly": "Feel free to reach out anytime if you need anything else — happy to help!",
    "concise": "Will update as this progresses.",
}


class MockAIProvider(AIProvider):
    def suggest_root_cause(self, ticket) -> str:
        base = _root_cause_for_service(ticket.service_type)
        if ticket.severity in ("high", "critical"):
            return f"{base} Given the {ticket.severity} severity, treat this as a priority diagnosis."
        return base

    def suggest_resolution(self, ticket) -> str:
        return _resolution_for_service(ticket.service_type)

    def find_related_articles(self, ticket) -> list:
        return get_related_articles_for_ticket(ticket, limit=5)

    def find_similar_tickets(self, ticket) -> list:
        from ..models import Ticket

        candidates = (
            Ticket.objects.filter(service_type=ticket.service_type)
            .exclude(pk=ticket.pk)
            .exclude(status="pending_payment")
            .select_related("customer__user")
            .order_by("-resolved_at", "-created_at")[:30]
        )

        ticket_tokens = _tokenize(ticket.title)
        scored = []
        for candidate in candidates:
            overlap = len(ticket_tokens & _tokenize(candidate.title))
            scored.append((overlap, candidate))
        scored.sort(key=lambda pair: pair[0], reverse=True)
        return [c for _, c in scored[:5]]

    def draft_reply(self, ticket, tone: str = "professional") -> str:
        if tone not in _TONE_OPENERS:
            tone = "professional"

        opener = _TONE_OPENERS[tone]
        closer = _TONE_CLOSERS[tone]
        resolution = _resolution_for_service(ticket.service_type)

        return (
            f"{opener}\n\n"
            f"Regarding \"{ticket.title}\" — {resolution}\n\n"
            f"{closer}"
        )


def get_ai_provider() -> AIProvider:
    from django.conf import settings

    provider = getattr(settings, "AI_ASSISTANT_PROVIDER", "mock")
    if provider == "mock":
        return MockAIProvider()
    raise NotImplementedError(f"Unknown AI_ASSISTANT_PROVIDER: {provider!r}")
