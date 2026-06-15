"""
Payment business logic — Razorpay-ready order creation, signature verification,
webhook processing, and audit trail.

Sandbox / dev mode:
  When RAZORPAY_KEY_ID is not set, all Razorpay SDK calls are skipped.
  A deterministic mock order is returned instead so the full payment flow
  can be exercised in development.  The frontend detects mode="sandbox" and
  shows a "Simulate Payment" button that calls the verify endpoint directly.

Live mode:
  Set RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, and RAZORPAY_WEBHOOK_SECRET in
  backend/.env to switch to real Razorpay calls.
"""
import hashlib
import hmac
import uuid as uuid_lib
from datetime import datetime

from django.conf import settings

from ..models import Payment, Ticket, TicketActivityLog


# ── Fee schedule ─────────────────────────────────────────────────
CONSULTING_FEE = 299  # ₹299 upfront fee to open any ticket

RESOLUTION_FEES = {
    "desktop":  499,
    "linux":    999,
    "windows":  999,
    "patching": 799,
    "security": 1499,
    "vmware":   1299,
    "sap":      1999,
}


# ── Invoice number generator ─────────────────────────────────────

def _generate_invoice_number() -> str:
    prefix = f"INV-{datetime.now().strftime('%Y%m')}"
    last = (
        Payment.objects.filter(invoice_number__startswith=prefix)
        .order_by("-invoice_number")
        .first()
    )
    if last and last.invoice_number:
        try:
            seq = int(last.invoice_number.rsplit("-", 1)[-1]) + 1
        except (ValueError, IndexError):
            seq = 1
    else:
        seq = 1
    return f"{prefix}-{seq:06d}"


# ── Order creation ────────────────────────────────────────────────

def create_order_for_ticket(ticket) -> dict:
    """
    Create (or retrieve) the pending Payment for this ticket, then create a
    Razorpay order.  Idempotent — calling twice returns the same order.

    Returns a dict consumed directly by the frontend checkout component:
      order_id, payment_db_id, amount (₹), amount_paise, currency,
      key_id (None in sandbox), invoice_number, mode ("live"|"sandbox")
    """
    # Re-use existing pending payment for idempotency
    payment = Payment.objects.filter(
        ticket=ticket, customer=ticket.customer, status="pending"
    ).first()

    if not payment:
        base_amount = CONSULTING_FEE
        gst_rate = float(getattr(settings, "GST_RATE", 0.18))
        gst_amount = round(base_amount * gst_rate)
        payment = Payment.objects.create(
            customer=ticket.customer,
            ticket=ticket,
            amount=base_amount,
            gst_amount=gst_amount,
            payment_type="consulting_fee",
            gateway="razorpay",
            invoice_number=_generate_invoice_number(),
            status="pending",
        )

    total_paise = int((payment.amount + payment.gst_amount) * 100)

    if getattr(settings, "RAZORPAY_KEY_ID", ""):
        from ..integrations.razorpay_client import get_client
        client = get_client()
        order = client.order.create({
            "amount": total_paise,
            "currency": "INR",
            "receipt": str(payment.id),
            "notes": {
                "ticket_number": ticket.ticket_number,
                "invoice_number": payment.invoice_number,
            },
        })
        if not payment.gateway_order_id:
            payment.gateway_order_id = order["id"]
            payment.save(update_fields=["gateway_order_id"])
        return {
            "order_id": order["id"],
            "payment_db_id": str(payment.id),
            "amount": int(payment.amount + payment.gst_amount),
            "amount_paise": total_paise,
            "currency": "INR",
            "key_id": settings.RAZORPAY_KEY_ID,
            "invoice_number": payment.invoice_number,
            "mode": "live",
        }

    # Sandbox / dev: deterministic mock order, no Razorpay API call
    if not payment.gateway_order_id:
        payment.gateway_order_id = f"order_mock_{uuid_lib.uuid4().hex[:16]}"
        payment.save(update_fields=["gateway_order_id"])

    return {
        "order_id": payment.gateway_order_id,
        "payment_db_id": str(payment.id),
        "amount": int(payment.amount + payment.gst_amount),
        "amount_paise": total_paise,
        "currency": "INR",
        "key_id": None,
        "invoice_number": payment.invoice_number,
        "mode": "sandbox",
    }


# ── Payment verification ──────────────────────────────────────────

def verify_and_complete_payment(
    payment_db_id: str,
    razorpay_payment_id: str,
    razorpay_order_id: str,
    razorpay_signature: str,
) -> Payment:
    """
    Verify Razorpay HMAC-SHA256 signature, mark payment completed, and
    move the associated ticket from pending_payment → open.

    Idempotent: safe to call twice for the same payment (returns early if
    already completed).  Raises ValueError on bad signature.
    """
    from .notification_service import create_notification

    payment = (
        Payment.objects.select_related("ticket", "customer__user")
        .get(id=payment_db_id)
    )

    if payment.status == "completed":
        return payment

    key_secret = getattr(settings, "RAZORPAY_KEY_SECRET", "")
    if key_secret:
        expected = hmac.new(
            key_secret.encode(),
            f"{razorpay_order_id}|{razorpay_payment_id}".encode(),
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(expected, razorpay_signature):
            raise ValueError("Invalid payment signature")

    payment.gateway_payment_id = razorpay_payment_id
    payment.status = "completed"
    payment.save(update_fields=["gateway_payment_id", "status"])

    _open_ticket_after_payment(payment, actor=None, note=f"Payment {payment.invoice_number} confirmed")
    return payment


# ── Webhook processing ────────────────────────────────────────────

def verify_webhook_signature(payload: bytes, signature: str) -> bool:
    """Verify HMAC-SHA256 on an incoming Razorpay webhook payload."""
    import logging as _logging
    _logger = _logging.getLogger(__name__)
    secret = getattr(settings, "RAZORPAY_WEBHOOK_SECRET", "")
    if not secret:
        _logger.warning(
            "verify_webhook_signature: RAZORPAY_WEBHOOK_SECRET is not configured. "
            "Rejecting webhook — set the secret to process Razorpay webhooks."
        )
        return False
    expected = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


def process_payment_webhook(event: dict) -> None:
    """
    Handle a verified Razorpay payment.captured webhook.
    Marks the Payment completed and moves the ticket to open.
    """
    if event.get("event") != "payment.captured":
        return

    payment_entity = event.get("payload", {}).get("payment", {}).get("entity", {})
    order_id = payment_entity.get("order_id")
    gateway_payment_id = payment_entity.get("id")

    if not order_id:
        return

    payment = (
        Payment.objects.select_related("ticket", "customer__user")
        .filter(gateway_order_id=order_id)
        .first()
    )
    if not payment or payment.status == "completed":
        return

    payment.gateway_payment_id = gateway_payment_id or ""
    payment.status = "completed"
    payment.save(update_fields=["gateway_payment_id", "status"])

    _open_ticket_after_payment(
        payment, actor=None,
        note=f"Payment {payment.invoice_number} confirmed via webhook",
    )


# ── Refund ────────────────────────────────────────────────────────

def issue_refund(payment) -> None:
    """Initiate a Razorpay refund for a completed payment."""
    if not getattr(settings, "RAZORPAY_KEY_ID", ""):
        raise NotImplementedError("Razorpay not configured — cannot issue refund")
    from ..integrations.razorpay_client import get_client
    client = get_client()
    client.payment.refund(
        payment.gateway_payment_id,
        {"amount": int((payment.amount + payment.gst_amount) * 100)},
    )
    payment.status = "refunded"
    payment.save(update_fields=["status"])


# ── Internal helper ───────────────────────────────────────────────

def _open_ticket_after_payment(payment, actor, note: str) -> None:
    """Move a pending_payment ticket to open, log the event, notify customer."""
    from .notification_service import create_notification

    ticket = payment.ticket
    if not ticket or ticket.status != "pending_payment":
        return

    old_status = ticket.status
    ticket.status = "open"
    ticket.save(update_fields=["status"])

    TicketActivityLog.objects.create(
        ticket=ticket,
        actor=actor,
        action="status_changed",
        from_value=old_status,
        to_value="open",
        note=note,
    )

    create_notification(
        recipient=payment.customer.user,
        category="payment_confirmed",
        title=f"Payment confirmed — #{ticket.ticket_number}",
        body=f"₹{int(payment.amount + payment.gst_amount)} received. Your ticket is now open.",
        ticket=ticket,
    )
