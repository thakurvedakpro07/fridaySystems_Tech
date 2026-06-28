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
import logging
import uuid as uuid_lib
from datetime import datetime

from django.conf import settings
from django.db import transaction

from ..models import InvoiceCounter, Payment, Ticket, TicketActivityLog
from .service_catalog import RESOLUTION_FEES, get_resolution_fee

_logger = logging.getLogger(__name__)


# ── Fee schedule ─────────────────────────────────────────────────
CONSULTING_FEE = 299  # ₹299 upfront fee to open any ticket
# RESOLUTION_FEES + get_resolution_fee imported from service_catalog — do not duplicate here


# ── Invoice number generator ─────────────────────────────────────

def _generate_invoice_number() -> str:
    """
    Generate a guaranteed-unique, monotonically-increasing invoice number.

    Uses a per-month InvoiceCounter row locked with SELECT FOR UPDATE to serialize
    concurrent writers. No two requests can receive the same sequence number even
    when they arrive simultaneously.

    Format: INV-YYYYMM-NNNNNN  (e.g. INV-202606-000042)

    A gap in the sequence can occur only when a Payment.objects.create() fails
    after the counter has already been committed (e.g. a DB error between the two
    writes). Gaps are acceptable under GST — gap-free sequences are not required.
    Race-condition duplicates are impossible with this implementation.
    """
    from django.db import IntegrityError

    prefix_month = datetime.now().strftime('%Y%m')

    with transaction.atomic():
        # Lock the existing counter row for this month so concurrent callers queue up.
        counter = (
            InvoiceCounter.objects
            .select_for_update()
            .filter(year_month=prefix_month)
            .first()
        )

        if counter is not None:
            counter.last_seq += 1
            counter.save(update_fields=['last_seq'])
        else:
            # First invoice of this month — create the counter row at sequence 1.
            # Wrap in a savepoint: if two threads race to create the very first
            # row, the slower one gets IntegrityError which rolls back only this
            # savepoint (not the outer atomic block), then falls through to the
            # select_for_update path to safely get the next number.
            try:
                with transaction.atomic():
                    counter = InvoiceCounter.objects.create(
                        year_month=prefix_month,
                        last_seq=1,
                    )
            except IntegrityError:
                # Another thread won the creation race.
                # Lock the now-existing row and increment to claim the next number.
                counter = (
                    InvoiceCounter.objects
                    .select_for_update()
                    .get(year_month=prefix_month)
                )
                counter.last_seq += 1
                counter.save(update_fields=['last_seq'])

    return f"INV-{prefix_month}-{counter.last_seq:06d}"


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

    _live_mode = bool(getattr(settings, "RAZORPAY_KEY_ID", ""))
    if _live_mode:
        key_secret = getattr(settings, "RAZORPAY_KEY_SECRET", "")
        if not key_secret:
            from django.core.exceptions import ImproperlyConfigured
            raise ImproperlyConfigured(
                "RAZORPAY_KEY_SECRET must be set when RAZORPAY_KEY_ID is configured"
            )
        expected = hmac.new(
            key_secret.encode(),
            f"{razorpay_order_id}|{razorpay_payment_id}".encode(),
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(expected, razorpay_signature):
            raise ValueError("Invalid payment signature")

    with transaction.atomic():
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

    # Fast pre-check — avoids acquiring a row lock for events already processed
    pre = (
        Payment.objects
        .filter(gateway_order_id=order_id)
        .values("pk", "status")
        .first()
    )
    if not pre or pre["status"] == "completed":
        return

    with transaction.atomic():
        payment = (
            Payment.objects.select_related("ticket", "customer__user")
            .select_for_update(of=("self",))
            .get(pk=pre["pk"])
        )
        # Re-check under lock: a concurrent delivery may have already processed this
        if payment.status == "completed":
            return

        payment.gateway_payment_id = gateway_payment_id or ""
        payment.status = "completed"
        payment.save(update_fields=["gateway_payment_id", "status"])

        _open_ticket_after_payment(
            payment, actor=None,
            note=f"Payment {payment.invoice_number} confirmed via webhook",
        )


# ── Refund ────────────────────────────────────────────────────────

def issue_refund(payment, refund_amount_paise: int | None = None) -> "Payment":
    """
    Initiate a Razorpay refund for a completed payment and persist the result.

    Idempotent: if ``gateway_refund_id`` is already set (a previous call succeeded),
    returns the payment unchanged without making a second API call.

    Sandbox mode: when ``RAZORPAY_KEY_ID`` is not configured, a deterministic mock
    refund ID is generated so the full refund workflow can be exercised in development
    without a live Razorpay account.

    The database is never updated to ``status="refunded"`` unless the Razorpay API
    (or sandbox) confirms the refund — a gateway exception leaves the payment in its
    original ``"completed"`` state so the caller can retry.

    A row-level lock (``SELECT FOR UPDATE``) serialises concurrent refund attempts on
    the same payment (e.g., two admin tabs clicking Refund simultaneously).  The lock
    is intentionally held during the API call because the alternative — check, release,
    call, re-lock — introduces a window where two threads could both issue a Razorpay
    refund for the same payment.  Refunds are infrequent admin actions; the brief lock
    duration (~1–2 s) is acceptable.

    Args:
        payment:              ``Payment`` instance to refund.  Must have
                              ``status="completed"`` when evaluated under the lock.
        refund_amount_paise:  Optional override in paise for partial refunds.
                              Defaults to the full ``(amount + gst_amount) × 100``.

    Returns:
        The refreshed ``Payment`` instance with ``status="refunded"`` and
        ``gateway_refund_id`` set.

    Raises:
        ValueError:   Payment is not in ``"completed"`` status, or it has no
                      ``gateway_payment_id`` in live mode (cannot refund a payment
                      that was never captured by the gateway).
        Exception:    Any error raised by the Razorpay SDK is logged with full context
                      and re-raised.  The payment record is not modified.
    """
    with transaction.atomic():
        # Re-fetch under a row-level lock to serialise concurrent refund attempts.
        locked = Payment.objects.select_for_update().get(pk=payment.pk)

        # ── Idempotency: already refunded ────────────────────────────
        if locked.gateway_refund_id:
            _logger.info(
                "issue_refund: payment %s already has gateway_refund_id=%s — "
                "returning without a second API call.",
                locked.pk, locked.gateway_refund_id,
            )
            return locked

        if locked.status == "refunded":
            # Refunded status without a refund ID means a previous call succeeded at
            # Razorpay but crashed before saving gateway_refund_id.  Log a warning
            # and return without touching Razorpay again — we do not know the refund
            # ID and a second API call could issue a duplicate refund.
            _logger.warning(
                "issue_refund: payment %s has status='refunded' but no gateway_refund_id. "
                "A previous refund attempt may have partially succeeded.  "
                "Inspect the Razorpay dashboard for payment %s to confirm.",
                locked.pk, locked.gateway_payment_id,
            )
            return locked

        # ── Pre-condition ────────────────────────────────────────────
        if locked.status != "completed":
            raise ValueError(
                f"Cannot refund payment {locked.pk}: expected status='completed', "
                f"got '{locked.status}'."
            )

        # ── Compute refund amount ────────────────────────────────────
        full_paise = int((locked.amount + locked.gst_amount) * 100)
        amount_paise = refund_amount_paise if refund_amount_paise is not None else full_paise
        is_partial = amount_paise < full_paise

        _logger.info(
            "issue_refund: initiating %s refund | payment=%s | invoice=%s | "
            "amount=%d paise | gateway_payment_id=%s",
            "partial" if is_partial else "full",
            locked.pk, locked.invoice_number, amount_paise,
            locked.gateway_payment_id or "(none — sandbox)",
        )

        # ── Call Razorpay or generate a sandbox mock ID ──────────────
        if getattr(settings, "RAZORPAY_KEY_ID", ""):
            if not locked.gateway_payment_id:
                raise ValueError(
                    f"Payment {locked.pk} has no gateway_payment_id. "
                    "A Razorpay refund requires a captured payment ID."
                )
            try:
                from ..integrations.razorpay_client import get_client
                client = get_client()
                response = client.payment.refund(
                    locked.gateway_payment_id,
                    {"amount": amount_paise},
                )
                refund_id = response["id"]
                _logger.info(
                    "issue_refund: Razorpay refund created | payment=%s | "
                    "razorpay_refund_id=%s | amount=%d paise",
                    locked.pk, refund_id, amount_paise,
                )
            except Exception as exc:
                _logger.exception(
                    "issue_refund: Razorpay API call failed | payment=%s | "
                    "gateway_payment_id=%s | amount=%d paise | error=%s",
                    locked.pk, locked.gateway_payment_id, amount_paise, exc,
                )
                raise  # payment.status intentionally left as "completed"
        else:
            # Sandbox / dev: no live keys configured.
            # Generate a deterministic mock refund ID so the full admin workflow
            # (view → service → DB) can be exercised without a Razorpay account.
            refund_id = f"rfnd_sandbox_{uuid_lib.uuid4().hex[:16]}"
            _logger.info(
                "issue_refund: sandbox mode — simulated refund | payment=%s | "
                "mock_refund_id=%s",
                locked.pk, refund_id,
            )

        # ── Persist only after confirmed success ─────────────────────
        # Both fields are written in one save() call inside the same atomic block
        # that holds the SELECT FOR UPDATE lock, preventing any gap between the
        # API success and the DB update.
        locked.gateway_refund_id = refund_id
        locked.status = "refunded"
        locked.save(update_fields=["gateway_refund_id", "status", "updated_at"])

        _logger.info(
            "issue_refund: payment %s marked refunded | invoice=%s | refund_id=%s",
            locked.pk, locked.invoice_number, refund_id,
        )

    return locked


# ── Resolution fee order creation ────────────────────────────────

def create_resolution_order_for_ticket(ticket) -> dict:
    """
    Create (or retrieve) the pending resolution_fee Payment for this ticket,
    then create a Razorpay order for the full amount (subtotal + GST).

    Idempotent — if a pending resolution_fee Payment already exists for this
    ticket, it is reused.  Raises ValueError if no freelancer is assigned or
    the ticket is not in 'resolved' status.

    Returns the same shape as create_order_for_ticket() plus fee breakdown:
      order_id, payment_db_id, amount, amount_paise, currency,
      key_id, invoice_number, mode, fee_breakdown (base_fee, severity_surcharge,
      subtotal, gst_amount, total)
    """
    if ticket.status != "resolved":
        raise ValueError(f"Ticket {ticket.ticket_number} must be in 'resolved' status to pay resolution fee (is: {ticket.status})")

    # Idempotency: reuse an existing pending resolution_fee payment
    payment = Payment.objects.filter(
        ticket=ticket,
        customer=ticket.customer,
        payment_type="resolution_fee",
        status="pending",
    ).first()

    fee = get_resolution_fee(ticket.service_type, ticket.severity)

    if not payment:
        payment = Payment.objects.create(
            customer=ticket.customer,
            ticket=ticket,
            amount=fee["subtotal"],
            gst_amount=fee["gst_amount"],
            payment_type="resolution_fee",
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
                "payment_type": "resolution_fee",
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
            "fee_breakdown": fee,
        }

    # Sandbox / dev
    if not payment.gateway_order_id:
        payment.gateway_order_id = f"order_res_mock_{uuid_lib.uuid4().hex[:16]}"
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
        "fee_breakdown": fee,
    }


def verify_resolution_payment_service(
    ticket,
    payment_db_id: str,
    razorpay_payment_id: str,
    razorpay_order_id: str,
    razorpay_signature: str,
    score: int,
    comment: str,
    actor,
) -> Payment:
    """
    Verify the resolution fee payment, close the ticket, save CSAT, and
    create the engineer payout.

    Idempotent — if the payment is already completed, returns early without
    re-creating CSAT or Payout records.

    Steps:
      1. Fetch and validate the Payment record
      2. Verify Razorpay HMAC signature (skipped in sandbox)
      3. Mark payment completed
      4. Close the ticket (resolved → closed), set resolved_at
      5. Save CSATSurvey
      6. Create Payout (65% / 35% split)
      7. Log activity
      8. Notify freelancer of payout created
    """
    from django.utils import timezone
    from ..models import CSATSurvey
    from .notification_service import create_notification
    from .payout_service import create_payout_for_ticket

    payment = (
        Payment.objects.select_related("ticket", "customer__user")
        .get(id=payment_db_id)
    )

    if payment.status == "completed":
        return payment

    if payment.payment_type != "resolution_fee":
        raise ValueError(f"Payment {payment_db_id} is not a resolution_fee payment")

    # Signature verification — required in live mode, skipped in sandbox (no RAZORPAY_KEY_ID)
    _live_mode = bool(getattr(settings, "RAZORPAY_KEY_ID", ""))
    if _live_mode:
        key_secret = getattr(settings, "RAZORPAY_KEY_SECRET", "")
        if not key_secret:
            from django.core.exceptions import ImproperlyConfigured
            raise ImproperlyConfigured(
                "RAZORPAY_KEY_SECRET must be set when RAZORPAY_KEY_ID is configured"
            )
        expected = hmac.new(
            key_secret.encode(),
            f"{razorpay_order_id}|{razorpay_payment_id}".encode(),
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(expected, razorpay_signature):
            raise ValueError("Invalid resolution payment signature")

    with transaction.atomic():
        payment.gateway_payment_id = razorpay_payment_id
        payment.status = "completed"
        payment.save(update_fields=["gateway_payment_id", "status"])

        # Close ticket
        ticket = payment.ticket
        if ticket and ticket.status == "resolved":
            ticket.status = "closed"
            ticket.resolved_at = timezone.now()
            ticket.save(update_fields=["status", "resolved_at"])

            TicketActivityLog.objects.create(
                ticket=ticket,
                actor=actor,
                action="closed",
                from_value="resolved",
                to_value="closed",
                note=f"Resolution fee {payment.invoice_number} confirmed; ticket closed",
            )

        # Save CSAT
        if ticket and score and not CSATSurvey.objects.filter(ticket=ticket).exists():
            CSATSurvey.objects.create(
                ticket=ticket,
                customer=ticket.customer,
                score=score,
                comment=comment or "",
            )

    # Payout is outside the atomic block — its failure must not roll back a confirmed payment.
    # The customer has already paid; losing the payment record would be worse than a missing payout.
    if ticket and ticket.assigned_to:
        try:
            create_payout_for_ticket(ticket, payment)
        except Exception:
            _logger.exception("Payout creation failed for ticket %s", ticket.pk)

    # Notify freelancer (outside atomic — notification failure must not roll back payment)
    if ticket and ticket.assigned_to:
        create_notification(
            recipient=ticket.assigned_to.user,
            category="payment_confirmed",
            title=f"Payout pending — #{ticket.ticket_number}",
            body=f"Customer accepted and paid. Your payout is being processed.",
            ticket=ticket,
        )

    return payment


# ── Internal helper ───────────────────────────────────────────────

def _open_ticket_after_payment(payment, actor, note: str) -> None:
    """Move a pending_payment ticket to open, log the event, initialize SLA, notify customer."""
    from .notification_service import create_notification
    from .sla_service import set_ticket_due_at

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

    # Initialize SLA deadlines inside an isolated savepoint so a failure here
    # cannot roll back the payment confirmation already written above.
    try:
        with transaction.atomic():
            set_ticket_due_at(ticket)
    except Exception:
        _logger.exception("Failed to initialize SLA deadline for ticket %s", ticket.ticket_number)

    create_notification(
        recipient=payment.customer.user,
        category="payment_confirmed",
        title=f"Payment confirmed — #{ticket.ticket_number}",
        body=f"₹{int(payment.amount + payment.gst_amount)} received. Your ticket is now open.",
        ticket=ticket,
    )
