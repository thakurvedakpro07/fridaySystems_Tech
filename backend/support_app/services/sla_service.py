"""
SLA monitoring logic.

TODO: implement in Phase 3.
"""


def get_sla_policy(service_type: str, severity: str, plan: str = "default"):
    """Fetch the matching SLAPolicy from the database."""
    raise NotImplementedError


def check_ticket_sla(ticket) -> None:
    """
    Evaluate whether a single ticket has breached its first-response
    or resolution SLA. If breached, log a SLALog entry and trigger alerts.
    """
    raise NotImplementedError


def run_sla_check_for_all_open_tickets() -> None:
    """
    Called by Celery Beat every 5 minutes.
    Iterates over all open/assigned/in-progress tickets and
    calls check_ticket_sla() on each one.
    """
    raise NotImplementedError
