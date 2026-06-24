"""
Freelancer payout logic for ResolveHQ.

Payouts are created once the customer pays the resolution fee and the
ticket moves to 'closed'. Finance staff later marks them 'processed' with
a UTR number after completing the bank/UPI transfer.

Split: 65% to engineer, 35% platform (defined in service_catalog.py).
All amounts are pre-GST (GST is a customer-side liability).
"""

from decimal import Decimal, ROUND_HALF_UP
from django.utils import timezone

from .service_catalog import ENGINEER_SHARE, PLATFORM_SHARE


def calculate_payout(ticket) -> dict:
    """
    Return the payout breakdown dict for a ticket without creating any DB rows.

    Reads the resolution_fee subtotal from the ticket's completed resolution
    Payment. Returns a dict with the same shape that Payout stores, so callers
    can inspect it before committing.
    """
    payment = _get_resolution_payment(ticket)
    resolution_fee = payment.amount          # pre-GST subtotal stored by payment_service
    surcharge = _get_surcharge(ticket, payment)

    engineer_share = (resolution_fee * ENGINEER_SHARE).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    platform_share = (resolution_fee * PLATFORM_SHARE).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    return {
        "resolution_fee":     resolution_fee,
        "severity_surcharge": surcharge,
        "engineer_share":     engineer_share,
        "platform_share":     platform_share,
    }


def create_payout_for_ticket(ticket, resolution_payment) -> "Payout":  # noqa: F821
    """
    Create and return a Payout record for a just-closed ticket.

    Called exactly once per ticket, inside verify_resolution_payment_service(),
    after the resolution Payment has been marked completed and the ticket closed.

    Idempotent: if a Payout already exists for this ticket (e.g. double-call),
    the existing record is returned unchanged.
    """
    from support_app.models import Payout

    # Idempotency guard
    try:
        return Payout.objects.get(ticket=ticket)
    except Payout.DoesNotExist:
        pass

    if ticket.assigned_to is None:
        raise ValueError(f"Ticket {ticket.ticket_number} has no assigned freelancer — cannot create payout")

    resolution_fee = resolution_payment.amount   # pre-GST subtotal
    surcharge      = _infer_surcharge_from_payment(ticket, resolution_payment)

    engineer_share = (resolution_fee * ENGINEER_SHARE).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    platform_share = (resolution_fee * PLATFORM_SHARE).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )

    return Payout.objects.create(
        ticket             = ticket,
        freelancer         = ticket.assigned_to,
        payment            = resolution_payment,
        resolution_fee     = resolution_fee,
        severity_surcharge = surcharge,
        engineer_share     = engineer_share,
        platform_share     = platform_share,
        status             = "pending",
    )


def mark_payout_processed(payout_id: str, utr_number: str) -> "Payout":  # noqa: F821
    """
    Mark a payout as disbursed and store the bank/UPI UTR reference number.
    Called by finance staff after completing the transfer outside the platform.
    """
    from support_app.models import Payout

    payout = Payout.objects.get(id=payout_id)
    if payout.status == "processed":
        return payout

    payout.status       = "processed"
    payout.utr_number   = utr_number
    payout.processed_at = timezone.now()
    payout.save(update_fields=["status", "utr_number", "processed_at"])
    return payout


def create_payout_batch() -> list:
    """
    Return all pending Payout records so finance staff can review and
    initiate bulk transfers. Does NOT change any state — it is read-only.
    Callers iterate the list and call mark_payout_processed() per record.
    """
    from support_app.models import Payout
    return list(Payout.objects.filter(status="pending").select_related("ticket", "freelancer"))


# ── Helpers ───────────────────────────────────────────────────────

def _get_resolution_payment(ticket):
    """Return the completed resolution_fee Payment for a ticket, or raise."""
    payment = (
        ticket.payments
        .filter(payment_type="resolution_fee", status="completed")
        .order_by("-created_at")
        .first()
    )
    if payment is None:
        raise ValueError(f"No completed resolution_fee payment found for ticket {ticket.ticket_number}")
    return payment


def _get_surcharge(ticket, payment):
    """Extract the severity surcharge from a payment's metadata, falling back to 0."""
    return _infer_surcharge_from_payment(ticket, payment)


def _infer_surcharge_from_payment(ticket, payment):
    """
    Determine the severity surcharge stored in this payment.

    payment_service stores gateway_payment_id as a JSON blob when in sandbox
    mode, but the cleanest way is to re-derive from the service catalog, which
    is authoritative. The resolution_fee Payment.amount is the pre-GST subtotal
    (base + surcharge), so surcharge = amount - base_fee.
    """
    from .service_catalog import RESOLUTION_FEES, SEVERITY_CONFIG

    base_fee  = Decimal(str(RESOLUTION_FEES.get(ticket.service_type, 0)))
    severity_cfg = SEVERITY_CONFIG.get(ticket.severity, {})
    return Decimal(str(severity_cfg.get("surcharge", 0)))
