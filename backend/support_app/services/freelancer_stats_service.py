"""
Freelancer Stats Service — a freelancer's own "My Stats" numbers.

Reuses the shared utilization/resolved-ticket helpers from
executive_analytics_service.py (the established home for this math) rather
than re-deriving them a third time alongside get_engineer_utilization()
(executive dashboard) and get_engineer_capacity() (ops command center).

Returns a plain dict, matching the rest of this codebase's analytics
endpoints — no serializer.
"""
from decimal import Decimal

from django.db.models import Avg, Q, Sum

from ..models import CSATSurvey, Payout, Ticket
from .executive_analytics_service import (
    ACTIVE_STATUSES,
    _hours,
    _resolved_stats_map,
    _utilization_pct,
)


def get_my_stats(freelancer, start, end):
    active_ticket_count = Ticket.objects.filter(
        assigned_to=freelancer, status__in=ACTIVE_STATUSES
    ).count()

    resolved_stats = _resolved_stats_map([freelancer.id], start, end).get(freelancer.id, {})

    # Correctly scoped to this freelancer's own tickets — analytics_view's
    # equivalent block was broken for freelancers until this was written
    # (see the fix in views.py::analytics_view).
    surveys = CSATSurvey.objects.filter(
        ticket__assigned_to=freelancer, submitted_at__gte=start, submitted_at__lte=end,
    )
    csat_count = surveys.count()
    csat_avg = round(float(surveys.aggregate(avg=Avg("score"))["avg"]), 1) if csat_count else None

    # Lifetime (unscoped by period) — "how much have I ever earned" is a
    # different question from "how am I doing this period".
    earnings = Payout.objects.filter(freelancer=freelancer).aggregate(
        processed=Sum("engineer_share", filter=Q(status="processed")),
        pending=Sum("engineer_share", filter=Q(status="pending")),
    )

    return {
        "active_ticket_count": active_ticket_count,
        "resolved_count": resolved_stats.get("resolved_count", 0),
        "avg_resolution_hours": _hours(resolved_stats.get("avg_resolution")),
        "utilization_pct": _utilization_pct(active_ticket_count, freelancer.availability),
        "csat_avg": csat_avg,
        "csat_count": csat_count,
        "earnings_processed": earnings["processed"] or Decimal("0.00"),
        "earnings_pending": earnings["pending"] or Decimal("0.00"),
    }
