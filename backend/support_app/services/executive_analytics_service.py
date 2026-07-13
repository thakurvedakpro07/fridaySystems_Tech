"""
Executive Analytics Service — aggregation logic for the cross-functional
executive dashboard (Super Admin + Operations Manager + Finance Manager).

Every function here takes already-resolved datetime bounds and returns a
plain dict, matching the rest of this codebase's analytics endpoints
(analytics_view / ops_analytics in views.py) — no serializers.

Access to all of this data is already restricted to Super Admin/Ops
Manager/Finance Manager at the permission layer (IsExecutiveAnalytics), so
unlike ops_analytics this endpoint returns one unified payload rather than
role-partitioned sections.

SLA compliance is computed directly from Ticket.resolved_at/due_at and
first_response_at/first_response_due_at, NOT from SLALog.status — SLALog
only ever records "pending" (on creation) and "missed" (on breach) events;
sla_service.py never writes a "met" event for tickets resolved on time, so
SLALog alone cannot answer "what % of tickets met SLA".
"""
from datetime import datetime, timedelta
from decimal import Decimal

from django.db.models import (
    Avg, Count, DecimalField, DurationField, ExpressionWrapper, F, Q, Sum, Value,
)
from django.db.models.functions import Coalesce, TruncDate, TruncWeek
from django.utils import timezone

from ..models import CSATSurvey, Customer, Freelancer, Payment, Payout, Ticket
from . import service_catalog

ACTIVE_STATUSES = ["open", "assigned", "in_progress"]
CLOSED_STATUSES = ["resolved", "closed"]

_PERIOD_DAYS = {"7d": 7, "30d": 30, "90d": 90}

# Heuristic concurrent-ticket capacity per availability tier, used only to
# derive an approximate utilization %. Not a stored/configurable value yet —
# revisit if per-engineer capacity needs to become configurable.
_AVAILABILITY_CAPACITY = {
    "full_time": 8,
    "part_time": 4,
    "ad_hoc": 2,
    "unavailable": 0,
}


def _bucket_key(value):
    """Normalize a TruncDate/TruncWeek annotation value to a 'YYYY-MM-DD' string."""
    if hasattr(value, "date") and callable(value.date):
        return value.date().isoformat()
    return value.isoformat()


def _trend_granularity(start, end):
    return "date" if (end - start).days <= 45 else "week"


def _pct_change(previous, current):
    previous = float(previous or 0)
    current = float(current or 0)
    if previous == 0:
        return None if current == 0 else 100.0
    return round((current - previous) / previous * 100, 1)


def _hours(duration):
    return round(duration.total_seconds() / 3600, 1) if duration else None


def resolve_period(period, start_param, end_param):
    """
    Resolve the (start, end, prev_start, prev_end) datetime window.

    - start_param/end_param (ISO date strings) win if both are given.
    - Otherwise `period` selects a rolling window: 7d/30d/90d (default 30d)
      or "all" (from the first ticket ever created).
    - prev_start/prev_end is the immediately preceding window of the same
      length, used for the period-over-period deltas in get_summary().
    """
    now = timezone.now()

    if start_param and end_param:
        start = datetime.fromisoformat(start_param)
        end = datetime.fromisoformat(end_param)
        if timezone.is_naive(start):
            start = timezone.make_aware(start)
        if timezone.is_naive(end):
            end = timezone.make_aware(end)
    elif period == "all":
        first = Ticket.objects.order_by("created_at").values_list("created_at", flat=True).first()
        start = first or (now - timedelta(days=_PERIOD_DAYS["90d"]))
        end = now
    else:
        days = _PERIOD_DAYS.get(period, _PERIOD_DAYS["30d"])
        end = now
        start = now - timedelta(days=days)

    span = end - start
    prev_end = start
    prev_start = start - span
    return start, end, prev_start, prev_end


def get_sla_metrics(start, end):
    resolved_in_period = Ticket.objects.filter(
        resolved_at__gte=start, resolved_at__lte=end, due_at__isnull=False,
    )
    resolution_met = resolved_in_period.filter(resolved_at__lte=F("due_at")).count()
    resolution_missed = resolved_in_period.filter(resolved_at__gt=F("due_at")).count()
    resolution_total = resolution_met + resolution_missed
    resolution_compliance_pct = (
        round(resolution_met / resolution_total * 100, 1) if resolution_total else None
    )

    responded_in_period = Ticket.objects.filter(
        first_response_at__gte=start, first_response_at__lte=end,
        first_response_due_at__isnull=False,
    )
    fr_met = responded_in_period.filter(first_response_at__lte=F("first_response_due_at")).count()
    fr_missed = responded_in_period.filter(first_response_at__gt=F("first_response_due_at")).count()
    fr_total = fr_met + fr_missed
    first_response_compliance_pct = round(fr_met / fr_total * 100, 1) if fr_total else None

    avg_resolution = Ticket.objects.filter(
        status__in=CLOSED_STATUSES, resolved_at__isnull=False,
        resolved_at__gte=start, resolved_at__lte=end,
    ).aggregate(
        avg=Avg(ExpressionWrapper(F("resolved_at") - F("created_at"), output_field=DurationField()))
    )["avg"]

    avg_first_response = Ticket.objects.filter(
        first_response_at__isnull=False, first_response_at__gte=start, first_response_at__lte=end,
    ).aggregate(
        avg=Avg(ExpressionWrapper(F("first_response_at") - F("created_at"), output_field=DurationField()))
    )["avg"]

    return {
        "resolution_compliance_pct": resolution_compliance_pct,
        "resolution_met": resolution_met,
        "resolution_missed": resolution_missed,
        "first_response_compliance_pct": first_response_compliance_pct,
        "first_response_met": fr_met,
        "first_response_missed": fr_missed,
        "avg_resolution_hours": _hours(avg_resolution),
        "avg_first_response_hours": _hours(avg_first_response),
    }


def get_summary(start, end, prev_start, prev_end):
    current_qs = Ticket.objects.filter(created_at__gte=start, created_at__lte=end)
    previous_qs = Ticket.objects.filter(created_at__gte=prev_start, created_at__lte=prev_end)

    total = current_qs.count()
    prev_total = previous_qs.count()
    open_count = current_qs.filter(status__in=ACTIVE_STATUSES).count()
    closed_count = current_qs.filter(status__in=CLOSED_STATUSES).count()

    revenue = Payment.objects.filter(
        status="completed", created_at__gte=start, created_at__lte=end,
    ).aggregate(
        total=Coalesce(Sum("amount"), Value(Decimal("0.00")), output_field=DecimalField())
    )["total"]
    prev_revenue = Payment.objects.filter(
        status="completed", created_at__gte=prev_start, created_at__lte=prev_end,
    ).aggregate(
        total=Coalesce(Sum("amount"), Value(Decimal("0.00")), output_field=DecimalField())
    )["total"]

    sla = get_sla_metrics(start, end)
    csat = get_csat_metrics(start, end)

    return {
        "total_tickets": total,
        "total_tickets_change_pct": _pct_change(prev_total, total),
        "open_tickets": open_count,
        "closed_tickets": closed_count,
        "total_revenue": float(revenue),
        "total_revenue_change_pct": _pct_change(prev_revenue, revenue),
        "sla_compliance_pct": sla["resolution_compliance_pct"],
        "csat_avg": csat["avg_score"],
    }


def get_operational_health(start, end):
    granularity = _trend_granularity(start, end)
    trunc_fn = TruncDate if granularity == "date" else TruncWeek

    created_rows = (
        Ticket.objects.filter(created_at__gte=start, created_at__lte=end)
        .annotate(bucket=trunc_fn("created_at"))
        .values("bucket")
        .annotate(created=Count("id"))
        .order_by("bucket")
    )
    resolved_rows = (
        Ticket.objects.filter(resolved_at__gte=start, resolved_at__lte=end)
        .annotate(bucket=trunc_fn("resolved_at"))
        .values("bucket")
        .annotate(resolved=Count("id"))
        .order_by("bucket")
    )

    trend = {}
    for row in created_rows:
        key = _bucket_key(row["bucket"])
        trend.setdefault(key, {"bucket": key, "created": 0, "resolved": 0})
        trend[key]["created"] = row["created"]
    for row in resolved_rows:
        key = _bucket_key(row["bucket"])
        trend.setdefault(key, {"bucket": key, "created": 0, "resolved": 0})
        trend[key]["resolved"] = row["resolved"]

    period_tickets = Ticket.objects.filter(created_at__gte=start, created_at__lte=end)
    open_count = period_tickets.filter(status__in=ACTIVE_STATUSES).count()
    closed_count = period_tickets.filter(status__in=CLOSED_STATUSES).count()

    return {
        "granularity": granularity,
        "open_vs_closed": {"open": open_count, "closed": closed_count},
        "trend": sorted(trend.values(), key=lambda r: r["bucket"]),
    }


def get_engineer_utilization(start, end):
    freelancers = Freelancer.objects.filter(active=True).select_related("user").annotate(
        active_ticket_count=Count(
            "assigned_tickets", filter=Q(assigned_tickets__status__in=ACTIVE_STATUSES)
        ),
    )

    resolved_stats = {
        row["assigned_to"]: row
        for row in (
            Ticket.objects.filter(
                assigned_to__isnull=False, status__in=CLOSED_STATUSES,
                resolved_at__gte=start, resolved_at__lte=end,
            )
            .values("assigned_to")
            .annotate(
                resolved_count=Count("id"),
                avg_resolution=Avg(
                    ExpressionWrapper(F("resolved_at") - F("created_at"), output_field=DurationField())
                ),
            )
        )
    }

    data = []
    for f in freelancers:
        stats = resolved_stats.get(f.id, {})
        capacity = _AVAILABILITY_CAPACITY.get(f.availability, 0)
        utilization_pct = (
            round(f.active_ticket_count / capacity * 100, 1) if capacity else None
        )
        first = f.user.first_name.strip()
        last = f.user.last_name.strip()
        data.append({
            "id": str(f.id),
            "name": f"{first} {last}".strip() or f.user.email,
            "availability": f.availability,
            "active_ticket_count": f.active_ticket_count,
            "resolved_count": stats.get("resolved_count", 0),
            "avg_resolution_hours": _hours(stats.get("avg_resolution")),
            "utilization_pct": utilization_pct,
        })

    data.sort(key=lambda r: r["active_ticket_count"], reverse=True)
    return data


def get_ticket_aging():
    now = timezone.now()
    created_ats = Ticket.objects.filter(status__in=ACTIVE_STATUSES).values_list("created_at", flat=True)

    buckets = {"0_1d": 0, "1_3d": 0, "3_7d": 0, "7d_plus": 0}
    for created_at in created_ats:
        age_days = (now - created_at).total_seconds() / 86400
        if age_days <= 1:
            buckets["0_1d"] += 1
        elif age_days <= 3:
            buckets["1_3d"] += 1
        elif age_days <= 7:
            buckets["3_7d"] += 1
        else:
            buckets["7d_plus"] += 1

    return buckets


def get_priority_distribution(start, end):
    rows = (
        Ticket.objects.filter(created_at__gte=start, created_at__lte=end)
        .values("severity")
        .annotate(count=Count("id"))
        .order_by("severity")
    )
    return [{"severity": r["severity"], "count": r["count"]} for r in rows]


def get_service_category_distribution(start, end):
    rows = (
        Ticket.objects.filter(created_at__gte=start, created_at__lte=end)
        .values("service_type")
        .annotate(count=Count("id"))
        .order_by("-count")
    )
    labels = {s["key"]: s["name"] for s in service_catalog.SERVICE_CATALOG}
    return [
        {
            "service_type": r["service_type"],
            "label": labels.get(r["service_type"], r["service_type"]),
            "count": r["count"],
        }
        for r in rows
    ]


def get_csat_metrics(start, end):
    surveys = CSATSurvey.objects.filter(submitted_at__gte=start, submitted_at__lte=end)
    avg_score = surveys.aggregate(avg=Avg("score"))["avg"]

    weekly_rows = (
        surveys.annotate(bucket=TruncWeek("submitted_at"))
        .values("bucket")
        .annotate(avg=Avg("score"), count=Count("id"))
        .order_by("bucket")
    )
    trend = [
        {
            "bucket": _bucket_key(r["bucket"]),
            "avg_score": round(r["avg"], 2) if r["avg"] else None,
            "count": r["count"],
        }
        for r in weekly_rows
    ]

    return {
        "avg_score": round(avg_score, 2) if avg_score else None,
        "response_count": surveys.count(),
        "trend": trend,
    }


def get_top_problem_categories(start, end, limit=5):
    labels = {s["key"]: s["name"] for s in service_catalog.SERVICE_CATALOG}
    rows = (
        Ticket.objects.filter(created_at__gte=start, created_at__lte=end)
        .values("service_type")
        .annotate(
            count=Count("id"),
            avg_resolution=Avg(
                ExpressionWrapper(F("resolved_at") - F("created_at"), output_field=DurationField()),
                filter=Q(status__in=CLOSED_STATUSES, resolved_at__isnull=False),
            ),
        )
        .order_by("-count")[:limit]
    )
    return [
        {
            "service_type": r["service_type"],
            "label": labels.get(r["service_type"], r["service_type"]),
            "count": r["count"],
            "avg_resolution_hours": _hours(r["avg_resolution"]),
        }
        for r in rows
    ]


def get_recently_breached_tickets(limit=10):
    breached = (
        Ticket.objects.filter(
            Q(sla_breach_notified=True)
            | Q(resolved_at__isnull=False, due_at__isnull=False, resolved_at__gt=F("due_at"))
        )
        .select_related("customer__user", "assigned_to__user")
        .order_by("-due_at")[:limit]
    )

    data = []
    for t in breached:
        breach_reference = t.resolved_at or timezone.now()
        breach_minutes = (
            int((breach_reference - t.due_at).total_seconds() / 60) if t.due_at else None
        )
        data.append({
            "id": str(t.id),
            "ticket_number": t.ticket_number,
            "title": t.title,
            "severity": t.severity,
            "status": t.status,
            "customer": t.customer.company or t.customer.user.email,
            "engineer": t.assigned_to.user.email if t.assigned_to else None,
            "due_at": t.due_at.isoformat() if t.due_at else None,
            "breached_by_minutes": breach_minutes,
        })
    return data


def get_most_active_customers(start, end, limit=10):
    rows = (
        Customer.objects.filter(tickets__created_at__gte=start, tickets__created_at__lte=end)
        .select_related("user")
        .annotate(
            ticket_count=Count(
                "tickets",
                filter=Q(tickets__created_at__gte=start, tickets__created_at__lte=end),
                distinct=True,
            ),
        )
        .order_by("-ticket_count")[:limit]
    )

    revenue_by_customer = {
        row["customer"]: row["revenue"]
        for row in (
            Payment.objects.filter(status="completed", created_at__gte=start, created_at__lte=end)
            .values("customer")
            .annotate(revenue=Sum("amount"))
        )
    }

    return [
        {
            "id": str(c.id),
            "name": c.company or c.user.email,
            "ticket_count": c.ticket_count,
            "revenue": float(revenue_by_customer.get(c.id, 0) or 0),
        }
        for c in rows
    ]


def get_revenue_metrics(start, end):
    granularity = _trend_granularity(start, end)
    trunc_fn = TruncDate if granularity == "date" else TruncWeek

    completed = Payment.objects.filter(status="completed", created_at__gte=start, created_at__lte=end)
    total_revenue = completed.aggregate(
        total=Coalesce(Sum("amount"), Value(Decimal("0.00")), output_field=DecimalField())
    )["total"]

    trend_rows = (
        completed.annotate(bucket=trunc_fn("created_at"))
        .values("bucket")
        .annotate(total=Sum("amount"))
        .order_by("bucket")
    )
    trend = [{"bucket": _bucket_key(r["bucket"]), "total": float(r["total"] or 0)} for r in trend_rows]

    by_type = (
        completed.values("payment_type")
        .annotate(total=Sum(F("amount") + F("gst_amount")))
        .order_by("payment_type")
    )
    revenue_by_type = [
        {"payment_type": r["payment_type"], "total": float(r["total"] or 0)} for r in by_type
    ]

    pending_payouts = Payout.objects.filter(status="pending").aggregate(
        total=Coalesce(Sum("engineer_share"), Value(Decimal("0.00")), output_field=DecimalField())
    )["total"]

    return {
        "granularity": granularity,
        "total_revenue": float(total_revenue),
        "trend": trend,
        "revenue_by_type": revenue_by_type,
        "pending_payouts_total": float(pending_payouts),
    }


def build_executive_analytics_payload(period=None, start_param=None, end_param=None):
    """Compose the full executive dashboard payload for the given period."""
    start, end, prev_start, prev_end = resolve_period(period, start_param, end_param)

    return {
        "period": {
            "start": start.isoformat(),
            "end": end.isoformat(),
            "granularity": _trend_granularity(start, end),
        },
        "summary": get_summary(start, end, prev_start, prev_end),
        "operational_health": get_operational_health(start, end),
        "sla": get_sla_metrics(start, end),
        "engineer_utilization": get_engineer_utilization(start, end),
        "ticket_aging": get_ticket_aging(),
        "priority_distribution": get_priority_distribution(start, end),
        "service_category_distribution": get_service_category_distribution(start, end),
        "csat": get_csat_metrics(start, end),
        "top_problem_categories": get_top_problem_categories(start, end),
        "recently_breached_tickets": get_recently_breached_tickets(),
        "most_active_customers": get_most_active_customers(start, end),
        "revenue": get_revenue_metrics(start, end),
    }
