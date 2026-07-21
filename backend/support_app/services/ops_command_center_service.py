"""
Operations Command Center Service — aggregation logic for the daily-ops
dashboard at /operations (all 4 internal staff roles: Super Admin,
Operations Manager, Finance Manager, Support Agent).

Unlike executive_analytics_service.py (leadership-facing, period-scoped,
trend-oriented), this module answers "what needs attention right now":
incidents, SLA risk, escalations, engineer overload, service health,
throughput, recent activity, and affected customers. Most functions are
point-in-time or short-forward/backward-window, not period-selector-driven.

Escalation/incident concepts are derived entirely from existing signals —
there is no Incident or Escalation model. "Incident" = an open ticket at
critical/high severity. "Escalated" = a ticket whose most recent relevant
TicketActivityLog action is "escalated" (services.ticket_signals), reusing
the exact mechanism ReplyOwnershipSignalsMixin.get_waiting_on_internal()
already uses elsewhere in the app.

Functions that return a QuerySet (the three "live" ones — incident queue,
SLA risk, escalation queue) are serialized by the view via
OpsTicketListSerializer, matching this codebase's existing convention of
sharing one ticket-list serializer across every ops endpoint.
"""
from datetime import timedelta

from django.db.models import Case, Count, F, IntegerField, OuterRef, Q, Subquery, Value, When
from django.utils import timezone

from ..models import Customer, Freelancer, Ticket, TicketActivityLog
from . import service_catalog
from .executive_analytics_service import ACTIVE_STATUSES, CLOSED_STATUSES, _utilization_pct
from .ticket_signals import annotate_reply_ownership_signals

# Service Health status-tone thresholds — a first-pass heuristic, not yet
# calibrated against real production ticket volume. Same status as
# executive_analytics_service's _AVAILABILITY_CAPACITY heuristic: revisit
# once real usage data exists to tune against.
_SERVICE_HEALTH_THRESHOLDS = {
    "critical": {"critical_high_count": 3, "breach_rate_pct": 30},
    "degraded": {"critical_high_count": 1, "breach_rate_pct": 10},
}

_SEVERITY_RANK = Case(
    When(severity="critical", then=Value(0)),
    When(severity="high", then=Value(1)),
    default=Value(2),
    output_field=IntegerField(),
)


def _service_status_tone(critical_high_count, breach_rate_pct):
    critical = _SERVICE_HEALTH_THRESHOLDS["critical"]
    degraded = _SERVICE_HEALTH_THRESHOLDS["degraded"]
    if critical_high_count >= critical["critical_high_count"] or (
        breach_rate_pct is not None and breach_rate_pct >= critical["breach_rate_pct"]
    ):
        return "critical"
    if critical_high_count >= degraded["critical_high_count"] or (
        breach_rate_pct is not None and breach_rate_pct >= degraded["breach_rate_pct"]
    ):
        return "degraded"
    return "healthy"


def get_incident_queue_queryset(limit=50):
    """
    Open tickets at critical/high severity — the "Live Incident Queue".
    Ordered most-severe-first, then soonest-due first (nulls last).
    """
    qs = Ticket.objects.filter(
        status__in=ACTIVE_STATUSES, severity__in=["critical", "high"],
    ).select_related("customer__user", "assigned_to__user")
    qs = annotate_reply_ownership_signals(qs)
    qs = qs.annotate(_severity_rank=_SEVERITY_RANK).order_by(
        "_severity_rank", F("due_at").asc(nulls_last=True)
    )
    return qs[:limit]


def get_sla_risk_queryset(horizon_hours=4, limit=50):
    """
    Open tickets whose due_at is already past or falls within the next
    `horizon_hours` — the "SLA Risk Board". Already-overdue tickets sort
    first automatically since due_at ascending puts the earliest deadlines
    (including past ones) at the top.
    """
    horizon = timezone.now() + timedelta(hours=horizon_hours)
    qs = Ticket.objects.filter(
        status__in=ACTIVE_STATUSES, due_at__isnull=False, due_at__lte=horizon,
    ).select_related("customer__user", "assigned_to__user")
    qs = annotate_reply_ownership_signals(qs)
    return qs.order_by("due_at")[:limit]


def get_escalation_queryset(limit=50):
    """
    Not-yet-closed tickets whose most recent relevant activity-log action is
    "escalated" — the "Escalation Queue". A later comment/status-change
    supersedes an earlier escalation (the ticket is no longer purely
    "awaiting escalation action"), matching
    ReplyOwnershipSignalsMixin.get_waiting_on_internal()'s exact semantics.
    """
    qs = Ticket.objects.exclude(status__in=CLOSED_STATUSES).select_related(
        "customer__user", "assigned_to__user"
    )
    qs = annotate_reply_ownership_signals(qs)
    qs = qs.filter(_latest_relevant_activity_action="escalated")
    qs = qs.annotate(
        _escalated_at=Subquery(
            TicketActivityLog.objects.filter(ticket=OuterRef("pk"), action="escalated")
            .order_by("-created_at")
            .values("created_at")[:1]
        )
    )
    return qs.order_by("-_escalated_at")[:limit]


def get_engineer_capacity():
    """
    Per-engineer current active-ticket load and utilization % — the
    "Engineer Capacity" widget. A point-in-time sibling of
    executive_analytics_service.get_engineer_utilization() that skips the
    period-scoped resolved-ticket join (Command Center has no period
    selector and doesn't need it here).
    """
    freelancers = Freelancer.objects.filter(active=True).select_related("user").annotate(
        active_ticket_count=Count(
            "assigned_tickets", filter=Q(assigned_tickets__status__in=ACTIVE_STATUSES)
        ),
    )

    data = []
    for f in freelancers:
        utilization_pct = _utilization_pct(f.active_ticket_count, f.availability)
        first = f.user.first_name.strip()
        last = f.user.last_name.strip()
        data.append({
            "id": str(f.id),
            "name": f"{first} {last}".strip() or f.user.email,
            "availability": f.availability,
            "active_ticket_count": f.active_ticket_count,
            "utilization_pct": utilization_pct,
            "over_capacity": bool(utilization_pct is not None and utilization_pct > 100),
        })

    data.sort(key=lambda r: r["active_ticket_count"], reverse=True)
    return data


def get_service_health(start, end):
    """
    Per-service_type open load + SLA breach rate in [start, end] — the
    "Service Health" widget. No live uptime/health signal exists anywhere
    in this codebase (Service.status is a manual catalog-visibility toggle,
    not a health metric), so this is a derived proxy: ticket volume +
    breach rate stands in for "is this service failing its customers".
    """
    labels = {s["key"]: s["name"] for s in service_catalog.SERVICE_CATALOG}

    open_by_type = {
        r["service_type"]: r
        for r in (
            Ticket.objects.filter(status__in=ACTIVE_STATUSES)
            .values("service_type")
            .annotate(
                open_count=Count("id"),
                critical_high_count=Count("id", filter=Q(severity__in=["critical", "high"])),
            )
        )
    }
    resolved_by_type = {
        r["service_type"]: r
        for r in (
            Ticket.objects.filter(
                resolved_at__gte=start, resolved_at__lte=end, due_at__isnull=False,
            )
            .values("service_type")
            .annotate(
                met=Count("id", filter=Q(resolved_at__lte=F("due_at"))),
                missed=Count("id", filter=Q(resolved_at__gt=F("due_at"))),
            )
        )
    }

    data = []
    for service_type in set(open_by_type) | set(resolved_by_type):
        open_row = open_by_type.get(service_type, {})
        resolved_row = resolved_by_type.get(service_type, {})
        open_count = open_row.get("open_count", 0)
        critical_high_count = open_row.get("critical_high_count", 0)
        met = resolved_row.get("met", 0)
        missed = resolved_row.get("missed", 0)
        total = met + missed
        breach_rate_pct = round(missed / total * 100, 1) if total else None

        data.append({
            "service_type": service_type,
            "label": labels.get(service_type, service_type),
            "open_count": open_count,
            "critical_high_count": critical_high_count,
            "breach_rate_pct": breach_rate_pct,
            "status": _service_status_tone(critical_high_count, breach_rate_pct),
        })

    data.sort(key=lambda r: (-r["critical_high_count"], -(r["breach_rate_pct"] or 0)))
    return data


def get_critical_customers(limit=10):
    """
    Customers currently affected by an open critical/high-severity or
    overdue ticket — the "Critical Customers" widget. Deliberately not a
    volume ranking (that's executive_analytics_service.get_most_active_
    customers) — this answers "who's hurting right now", not "who
    generates the most tickets". No VIP/critical-account flag exists on
    Customer, so this is a derived proxy from ticket state.
    """
    now = timezone.now()
    qs = (
        Customer.objects.filter(
            Q(tickets__status__in=ACTIVE_STATUSES, tickets__severity__in=["critical", "high"])
            | Q(
                tickets__status__in=ACTIVE_STATUSES,
                tickets__due_at__isnull=False,
                tickets__due_at__lt=now,
            )
        )
        .select_related("user")
        .distinct()
        .annotate(
            affected_ticket_count=Count(
                "tickets", filter=Q(tickets__status__in=ACTIVE_STATUSES), distinct=True,
            ),
            critical_ticket_count=Count(
                "tickets",
                filter=Q(tickets__status__in=ACTIVE_STATUSES, tickets__severity__in=["critical", "high"]),
                distinct=True,
            ),
            breaching_ticket_count=Count(
                "tickets",
                filter=Q(
                    tickets__status__in=ACTIVE_STATUSES,
                    tickets__due_at__isnull=False,
                    tickets__due_at__lt=now,
                ),
                distinct=True,
            ),
        )
        .order_by("-breaching_ticket_count", "-critical_ticket_count")[:limit]
    )

    return [
        {
            "id": str(c.id),
            "name": c.company or c.user.email,
            "plan": c.plan,
            "affected_ticket_count": c.affected_ticket_count,
            "critical_ticket_count": c.critical_ticket_count,
            "breaching_ticket_count": c.breaching_ticket_count,
        }
        for c in qs
    ]


def get_ticket_flow(hours=24):
    """
    Created/resolved throughput over a rolling window plus the full status
    funnel — the "Ticket Flow" widget.
    """
    now = timezone.now()
    start = now - timedelta(hours=hours)

    created_count = Ticket.objects.filter(created_at__gte=start, created_at__lte=now).count()
    resolved_count = Ticket.objects.filter(resolved_at__gte=start, resolved_at__lte=now).count()

    by_status = dict(
        Ticket.objects.values_list("status").annotate(n=Count("id")).values_list("status", "n")
    )
    full_by_status = {choice[0]: by_status.get(choice[0], 0) for choice in Ticket.STATUS_CHOICES}

    return {
        "window_hours": hours,
        "created_count": created_count,
        "resolved_count": resolved_count,
        "net_change": created_count - resolved_count,
        "by_status": full_by_status,
    }


def get_recent_activity(hours=4, limit=30):
    """
    Cross-ticket activity feed over a rolling window — the "Activity
    Timeline" widget. Every other activity-log read in this codebase
    (ops_ticket_history, TicketActivityLogListView) is scoped to one
    ticket; this is the first cross-ticket feed.
    """
    start = timezone.now() - timedelta(hours=hours)
    return (
        TicketActivityLog.objects.filter(created_at__gte=start)
        .select_related("actor", "ticket")
        .order_by("-created_at")[:limit]
    )
