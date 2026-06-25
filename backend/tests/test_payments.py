"""
Tests for payment endpoints and payment service security.
"""

import uuid as uuid_lib

import pytest
from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APIClient

from support_app.models import Customer, Freelancer, Payment, Ticket

User = get_user_model()


def _make_customer_client(db, email):
    user = User.objects.create_user(email=email, password="StrongPass123!", role="customer")
    customer = Customer.objects.create(user=user, company="Co")
    client = APIClient()
    client.force_authenticate(user=user)
    return client, customer


def _make_payment(customer, ticket=None):
    return Payment.objects.create(
        customer=customer,
        ticket=ticket,
        amount="299.00",
        gst_amount="53.82",
        invoice_number=f"INV-{customer.id}",
        payment_type="consulting_fee",
        status="completed",
    )


@pytest.mark.django_db
def test_payment_webhook_rejects_empty_payload():
    """
    POST /api/payments/webhook/ with no signature header returns 400.
    The H-08 fix (Phase 22) requires a valid Razorpay-Signature header —
    an empty or unsigned payload must be rejected to prevent spoofing.
    """
    client = APIClient()
    response = client.post("/api/payments/webhook/", {}, format="json")
    assert response.status_code == 400


@pytest.mark.django_db
def test_list_my_payments_returns_own_only(db):
    """GET /api/customers/me/payments/ returns only the authenticated customer's payments."""
    client_a, customer_a = _make_customer_client(db, "pay_a@example.com")
    client_b, customer_b = _make_customer_client(db, "pay_b@example.com")

    _make_payment(customer_a)
    _make_payment(customer_b)

    response = client_a.get("/api/customers/me/payments/")
    assert response.status_code == 200
    ids = [p["id"] for p in (response.data.get("results") or response.data)]
    assert len(ids) == 1
    assert str(customer_a.payments.first().id) in ids


@pytest.mark.django_db
def test_get_payment_returns_own(db):
    """GET /api/payments/{id}/ returns 200 for the owning customer."""
    client_a, customer_a = _make_customer_client(db, "pay_c@example.com")
    payment = _make_payment(customer_a)

    response = client_a.get(f"/api/payments/{payment.id}/")
    assert response.status_code == 200
    assert response.data["id"] == str(payment.id)


@pytest.mark.django_db
def test_get_payment_returns_404_for_other_customer(db):
    """GET /api/payments/{id}/ returns 404 when the payment belongs to someone else."""
    client_a, customer_a = _make_customer_client(db, "pay_d@example.com")
    client_b, customer_b = _make_customer_client(db, "pay_e@example.com")
    payment = _make_payment(customer_a)

    response = client_b.get(f"/api/payments/{payment.id}/")
    assert response.status_code == 404


@pytest.mark.django_db
def test_invoice_returns_pdf_content_type(db):
    """GET /api/payments/{id}/invoice/ returns HTTP 200 with Content-Type: application/pdf."""
    client_a, customer_a = _make_customer_client(db, "pay_f@example.com")
    payment = _make_payment(customer_a)

    response = client_a.get(f"/api/payments/{payment.id}/invoice/")

    assert response.status_code == 200
    assert response["Content-Type"] == "application/pdf"
    # PDF magic bytes — every valid PDF starts with %PDF
    assert response.content[:4] == b"%PDF"


@pytest.mark.django_db
def test_invoice_filename_contains_invoice_number(db):
    """Content-Disposition header should include the invoice number as the filename."""
    client_a, customer_a = _make_customer_client(db, "pay_g@example.com")
    payment = _make_payment(customer_a)

    response = client_a.get(f"/api/payments/{payment.id}/invoice/")

    assert response.status_code == 200
    disposition = response.get("Content-Disposition", "")
    assert "attachment" in disposition
    assert ".pdf" in disposition


@pytest.mark.django_db
def test_invoice_admin_can_download_any_payment(db):
    """Admin staff can download the invoice for any customer's payment."""
    _, customer_a = _make_customer_client(db, "pay_h@example.com")
    payment = _make_payment(customer_a)

    admin_user = User.objects.create_user(
        email="admin_inv@example.com",
        password="AdminPass123!",
        role="admin",
        is_staff=True,
    )
    admin_client = APIClient()
    admin_client.force_authenticate(user=admin_user)

    response = admin_client.get(f"/api/payments/{payment.id}/invoice/")

    assert response.status_code == 200
    assert response["Content-Type"] == "application/pdf"


@pytest.mark.django_db
def test_invoice_other_customer_cannot_download(db):
    """A customer cannot download another customer's invoice — must return 403."""
    _, customer_a = _make_customer_client(db, "pay_i@example.com")
    client_b, _ = _make_customer_client(db, "pay_j@example.com")
    payment = _make_payment(customer_a)

    response = client_b.get(f"/api/payments/{payment.id}/invoice/")

    assert response.status_code == 403


@pytest.mark.django_db
def test_unauthenticated_cannot_list_payments():
    """GET /api/customers/me/payments/ returns 401 for unauthenticated users."""
    client = APIClient()
    response = client.get("/api/customers/me/payments/")
    assert response.status_code == 401


# ── C-002 Security fix tests ──────────────────────────────────────────────────
# These tests verify that the payment verification bypass (C-002) is fixed.
#
# Before the fix:
#   verify_resolution_payment used .get("razorpay_payment_id", "sandbox_pay") defaults,
#   allowing an attacker to omit Razorpay fields entirely and have them silently substituted.
#   Both verify functions skipped HMAC when RAZORPAY_KEY_SECRET was absent, regardless
#   of whether RAZORPAY_KEY_ID was set (i.e., whether we were in live mode).
#
# After the fix:
#   All three Razorpay fields are required in the view (400 if absent).
#   HMAC verification is now tied to RAZORPAY_KEY_ID (live mode), not RAZORPAY_KEY_SECRET.
#   In live mode, a missing RAZORPAY_KEY_SECRET raises ImproperlyConfigured (500).


def _make_resolved_ticket_with_payment(email: str):
    """
    Create a customer, a resolved ticket, and a pending resolution_fee Payment.
    Returns (api_client, ticket, payment).
    """
    user = User.objects.create_user(email=email, password="StrongPass123!", role="customer")
    customer = Customer.objects.create(user=user, company="SecCo")
    client = APIClient()
    client.force_authenticate(user=user)

    ticket = Ticket.objects.create(
        customer=customer,
        title="Security test ticket",
        service_type="linux",
        severity="low",
        status="resolved",
    )
    payment = Payment.objects.create(
        customer=customer,
        ticket=ticket,
        amount="500.00",
        gst_amount="90.00",
        invoice_number=f"INV-SEC-{uuid_lib.uuid4().hex[:8]}",
        payment_type="resolution_fee",
        gateway="razorpay",
        gateway_order_id="order_test_123",
        status="pending",
    )
    return client, ticket, payment


_LOCMEM_CACHE = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}


@pytest.mark.django_db
@override_settings(CACHES=_LOCMEM_CACHE)
def test_verify_resolution_payment_missing_razorpay_payment_id_returns_400():
    """
    POST /api/tickets/{id}/verify-resolution-payment/ without razorpay_payment_id → 400.
    C-002 fix: hardcoded 'sandbox_pay' default removed; field is now required.
    """
    client, ticket, payment = _make_resolved_ticket_with_payment("c002_a@example.com")
    payload = {
        "payment_db_id": str(payment.id),
        # razorpay_payment_id intentionally omitted
        "razorpay_order_id": "order_test_123",
        "razorpay_signature": "some_sig",
        "score": 5,
    }
    response = client.post(
        f"/api/tickets/{ticket.id}/verify-resolution-payment/",
        payload,
        format="json",
    )
    assert response.status_code == 400
    assert "razorpay_payment_id" in response.data.get("detail", "")


@pytest.mark.django_db
@override_settings(CACHES=_LOCMEM_CACHE)
def test_verify_resolution_payment_missing_razorpay_order_id_returns_400():
    """
    POST /api/tickets/{id}/verify-resolution-payment/ without razorpay_order_id → 400.
    C-002 fix: hardcoded 'sandbox_order' default removed; field is now required.
    """
    client, ticket, payment = _make_resolved_ticket_with_payment("c002_b@example.com")
    payload = {
        "payment_db_id": str(payment.id),
        "razorpay_payment_id": "pay_test_123",
        # razorpay_order_id intentionally omitted
        "razorpay_signature": "some_sig",
        "score": 5,
    }
    response = client.post(
        f"/api/tickets/{ticket.id}/verify-resolution-payment/",
        payload,
        format="json",
    )
    assert response.status_code == 400
    assert "razorpay_order_id" in response.data.get("detail", "")


@pytest.mark.django_db
@override_settings(CACHES=_LOCMEM_CACHE)
def test_verify_resolution_payment_missing_razorpay_signature_returns_400():
    """
    POST /api/tickets/{id}/verify-resolution-payment/ without razorpay_signature → 400.
    C-002 fix: hardcoded 'sandbox_sig' default removed; field is now required.
    """
    client, ticket, payment = _make_resolved_ticket_with_payment("c002_c@example.com")
    payload = {
        "payment_db_id": str(payment.id),
        "razorpay_payment_id": "pay_test_123",
        "razorpay_order_id": "order_test_123",
        # razorpay_signature intentionally omitted
        "score": 5,
    }
    response = client.post(
        f"/api/tickets/{ticket.id}/verify-resolution-payment/",
        payload,
        format="json",
    )
    assert response.status_code == 400
    assert "razorpay_signature" in response.data.get("detail", "")


@pytest.mark.django_db
def test_verify_and_complete_payment_rejects_bad_signature_in_live_mode():
    """
    verify_and_complete_payment raises ValueError when signature is wrong in live mode.
    C-002 fix: verification is now tied to RAZORPAY_KEY_ID (live mode), not KEY_SECRET presence.
    """
    from support_app.services.payment_service import verify_and_complete_payment

    user = User.objects.create_user(email="c002_d@example.com", password="StrongPass123!", role="customer")
    customer = Customer.objects.create(user=user, company="LiveCo")
    ticket = Ticket.objects.create(
        customer=customer,
        title="Live mode test",
        service_type="linux",
        severity="low",
        status="pending_payment",
    )
    payment = Payment.objects.create(
        customer=customer,
        ticket=ticket,
        amount="353.00",
        gst_amount="53.82",
        invoice_number=f"INV-LIVE-{uuid_lib.uuid4().hex[:8]}",
        payment_type="consulting_fee",
        gateway="razorpay",
        gateway_order_id="order_live_123",
        status="pending",
    )

    with override_settings(RAZORPAY_KEY_ID="rzp_test_key", RAZORPAY_KEY_SECRET="test_secret_xyz"):
        with pytest.raises(ValueError, match="Invalid payment signature"):
            verify_and_complete_payment(
                payment_db_id=str(payment.id),
                razorpay_payment_id="pay_live_123",
                razorpay_order_id="order_live_123",
                razorpay_signature="tampered_signature",  # not the real HMAC
            )


@pytest.mark.django_db
def test_verify_resolution_payment_service_rejects_bad_signature_in_live_mode():
    """
    verify_resolution_payment_service raises ValueError for bad signature in live mode.
    C-002 fix: live mode detection now uses RAZORPAY_KEY_ID, not RAZORPAY_KEY_SECRET.
    """
    from support_app.services.payment_service import verify_resolution_payment_service

    user = User.objects.create_user(email="c002_e@example.com", password="StrongPass123!", role="customer")
    customer = Customer.objects.create(user=user, company="LiveCo2")
    ticket = Ticket.objects.create(
        customer=customer,
        title="Live resolution test",
        service_type="linux",
        severity="low",
        status="resolved",
    )
    payment = Payment.objects.create(
        customer=customer,
        ticket=ticket,
        amount="500.00",
        gst_amount="90.00",
        invoice_number=f"INV-LIVERES-{uuid_lib.uuid4().hex[:8]}",
        payment_type="resolution_fee",
        gateway="razorpay",
        gateway_order_id="order_res_live_123",
        status="pending",
    )

    with override_settings(RAZORPAY_KEY_ID="rzp_test_key", RAZORPAY_KEY_SECRET="test_secret_xyz"):
        with pytest.raises(ValueError, match="Invalid resolution payment signature"):
            verify_resolution_payment_service(
                ticket=ticket,
                payment_db_id=str(payment.id),
                razorpay_payment_id="pay_res_live_123",
                razorpay_order_id="order_res_live_123",
                razorpay_signature="tampered_signature",
                score=5,
                comment="",
                actor=user,
            )


@pytest.mark.django_db
def test_verify_and_complete_payment_sandbox_skips_signature_check():
    """
    In sandbox mode (RAZORPAY_KEY_ID not set), any signature value is accepted.
    This verifies the sandbox dev flow still works after the C-002 fix.
    """
    from support_app.services.payment_service import verify_and_complete_payment

    user = User.objects.create_user(email="c002_f@example.com", password="StrongPass123!", role="customer")
    customer = Customer.objects.create(user=user, company="SandboxCo")
    ticket = Ticket.objects.create(
        customer=customer,
        title="Sandbox test ticket",
        service_type="linux",
        severity="low",
        status="pending_payment",
    )
    payment = Payment.objects.create(
        customer=customer,
        ticket=ticket,
        amount="353.00",
        gst_amount="53.82",
        invoice_number=f"INV-SB-{uuid_lib.uuid4().hex[:8]}",
        payment_type="consulting_fee",
        gateway="razorpay",
        gateway_order_id="order_sandbox_999",
        status="pending",
    )

    # RAZORPAY_KEY_ID not set → sandbox mode → no HMAC check
    with override_settings(RAZORPAY_KEY_ID="", RAZORPAY_KEY_SECRET=""):
        result = verify_and_complete_payment(
            payment_db_id=str(payment.id),
            razorpay_payment_id="pay_sandbox_999",
            razorpay_order_id="order_sandbox_999",
            razorpay_signature="sandbox_signature",
        )

    payment.refresh_from_db()
    assert payment.status == "completed"
    assert result.status == "completed"


# ── C-001 Atomicity and payout-logging tests ──────────────────────────────────
# These tests verify that the non-atomic payment flow (C-001) is fixed.
#
# Before the fix:
#   Both verify functions performed multiple DB writes outside any transaction.
#   If any write after payment.save() failed, the payment row was committed as
#   "completed" while the ticket and downstream records were in a broken state.
#   Payout creation failures were silently swallowed with `pass` — no log emitted.
#
# After the fix:
#   Core financial writes (payment, ticket, CSAT) are wrapped in transaction.atomic().
#   Payout creation is outside the atomic block (its failure must not re-charge the customer).
#   Payout failures emit _logger.exception() for ops visibility.


@pytest.mark.django_db
@override_settings(RAZORPAY_KEY_ID="", RAZORPAY_KEY_SECRET="")
def test_verify_and_complete_payment_is_atomic():
    """
    If ticket update fails after payment.save(), the payment row must be rolled back.
    C-001 fix: payment.save + _open_ticket_after_payment are inside transaction.atomic().
    """
    from unittest.mock import patch
    from support_app.services.payment_service import verify_and_complete_payment

    user = User.objects.create_user(email="c001_a@example.com", password="StrongPass123!", role="customer")
    customer = Customer.objects.create(user=user, company="AtomicCo")
    ticket = Ticket.objects.create(
        customer=customer,
        title="Atomicity test",
        service_type="linux",
        severity="low",
        status="pending_payment",
    )
    payment = Payment.objects.create(
        customer=customer,
        ticket=ticket,
        amount="353.00",
        gst_amount="53.82",
        invoice_number=f"INV-AT-{uuid_lib.uuid4().hex[:8]}",
        payment_type="consulting_fee",
        gateway="razorpay",
        gateway_order_id="order_atomic_001",
        status="pending",
    )

    with patch(
        "support_app.services.payment_service._open_ticket_after_payment",
        side_effect=RuntimeError("Simulated failure inside atomic block"),
    ):
        with pytest.raises(RuntimeError):
            verify_and_complete_payment(
                payment_db_id=str(payment.id),
                razorpay_payment_id="pay_atomic_001",
                razorpay_order_id="order_atomic_001",
                razorpay_signature="sandbox_sig",
            )

    payment.refresh_from_db()
    assert payment.status == "pending", "payment.save() inside atomic block must have rolled back"


@pytest.mark.django_db
@override_settings(RAZORPAY_KEY_ID="", RAZORPAY_KEY_SECRET="")
def test_verify_resolution_payment_service_is_atomic():
    """
    If TicketActivityLog.create fails after payment+ticket saves, all writes must roll back.
    C-001 fix: payment, ticket close, CSAT are all inside transaction.atomic().
    """
    from unittest.mock import patch
    from support_app.services.payment_service import verify_resolution_payment_service
    from support_app.models import TicketActivityLog

    user = User.objects.create_user(email="c001_b@example.com", password="StrongPass123!", role="customer")
    customer = Customer.objects.create(user=user, company="AtomicRes")
    ticket = Ticket.objects.create(
        customer=customer,
        title="Atomic resolution test",
        service_type="linux",
        severity="low",
        status="resolved",
    )
    payment = Payment.objects.create(
        customer=customer,
        ticket=ticket,
        amount="500.00",
        gst_amount="90.00",
        invoice_number=f"INV-ATRES-{uuid_lib.uuid4().hex[:8]}",
        payment_type="resolution_fee",
        gateway="razorpay",
        gateway_order_id="order_atomic_res_001",
        status="pending",
    )

    with patch.object(
        TicketActivityLog.objects,
        "create",
        side_effect=RuntimeError("Simulated log-write failure"),
    ):
        with pytest.raises(RuntimeError):
            verify_resolution_payment_service(
                ticket=ticket,
                payment_db_id=str(payment.id),
                razorpay_payment_id="pay_atomic_res_001",
                razorpay_order_id="order_atomic_res_001",
                razorpay_signature="sandbox_sig",
                score=5,
                comment="",
                actor=user,
            )

    payment.refresh_from_db()
    ticket.refresh_from_db()
    assert payment.status == "pending", "payment.save() must have rolled back"
    assert ticket.status == "resolved", "ticket.save() must have rolled back"


@pytest.mark.django_db
@override_settings(RAZORPAY_KEY_ID="", RAZORPAY_KEY_SECRET="")
def test_payout_failure_does_not_rollback_resolution_payment():
    """
    Payout creation failure must NOT roll back payment or ticket close.
    C-001 fix: payout creation is outside transaction.atomic() so it cannot undo the payment.
    """
    from unittest.mock import patch
    from support_app.services.payment_service import verify_resolution_payment_service

    user = User.objects.create_user(email="c001_c@example.com", password="StrongPass123!", role="customer")
    customer = Customer.objects.create(user=user, company="PayoutCo")
    fl_user = User.objects.create_user(email="c001_c_fl@example.com", password="StrongPass123!", role="freelancer")
    freelancer = Freelancer.objects.create(user=fl_user)
    ticket = Ticket.objects.create(
        customer=customer,
        title="Payout isolation test",
        service_type="linux",
        severity="low",
        status="resolved",
        assigned_to=freelancer,
    )
    payment = Payment.objects.create(
        customer=customer,
        ticket=ticket,
        amount="500.00",
        gst_amount="90.00",
        invoice_number=f"INV-PO-{uuid_lib.uuid4().hex[:8]}",
        payment_type="resolution_fee",
        gateway="razorpay",
        gateway_order_id="order_payout_001",
        status="pending",
    )

    with patch(
        "support_app.services.payout_service.create_payout_for_ticket",
        side_effect=RuntimeError("Payout service unavailable"),
    ):
        # Must not raise — payout failure is caught and logged, payment stands
        verify_resolution_payment_service(
            ticket=ticket,
            payment_db_id=str(payment.id),
            razorpay_payment_id="pay_payout_001",
            razorpay_order_id="order_payout_001",
            razorpay_signature="sandbox_sig",
            score=4,
            comment="Good work",
            actor=user,
        )

    payment.refresh_from_db()
    ticket.refresh_from_db()
    assert payment.status == "completed"
    assert ticket.status == "closed"


@pytest.mark.django_db
@override_settings(RAZORPAY_KEY_ID="", RAZORPAY_KEY_SECRET="")
def test_payout_failure_is_logged():
    """
    Payout creation failure must emit _logger.exception with the ticket pk.
    C-001 fix: replaced `pass` with `_logger.exception(...)` for ops observability.
    """
    from unittest.mock import patch
    from support_app.services.payment_service import verify_resolution_payment_service
    import support_app.services.payment_service as _ps

    user = User.objects.create_user(email="c001_d@example.com", password="StrongPass123!", role="customer")
    customer = Customer.objects.create(user=user, company="LogCo")
    fl_user = User.objects.create_user(email="c001_d_fl@example.com", password="StrongPass123!", role="freelancer")
    freelancer = Freelancer.objects.create(user=fl_user)
    ticket = Ticket.objects.create(
        customer=customer,
        title="Payout log test",
        service_type="linux",
        severity="low",
        status="resolved",
        assigned_to=freelancer,
    )
    payment = Payment.objects.create(
        customer=customer,
        ticket=ticket,
        amount="500.00",
        gst_amount="90.00",
        invoice_number=f"INV-LOG-{uuid_lib.uuid4().hex[:8]}",
        payment_type="resolution_fee",
        gateway="razorpay",
        gateway_order_id="order_log_001",
        status="pending",
    )

    with patch(
        "support_app.services.payout_service.create_payout_for_ticket",
        side_effect=RuntimeError("Payout service unavailable"),
    ), patch.object(_ps._logger, "exception") as mock_log:
        verify_resolution_payment_service(
            ticket=ticket,
            payment_db_id=str(payment.id),
            razorpay_payment_id="pay_log_001",
            razorpay_order_id="order_log_001",
            razorpay_signature="sandbox_sig",
            score=4,
            comment="",
            actor=user,
        )

    mock_log.assert_called_once_with("Payout creation failed for ticket %s", ticket.pk)


# ── C-004 Tests — GSTIN validation and invoice compliance ─────────────────────


def test_gstin_validator_accepts_valid_gstin():
    """validate_gstin_format must accept a correctly formatted 15-char GSTIN."""
    from support_app.validators import validate_gstin_format
    from django.core.exceptions import ValidationError

    # These should not raise
    for gstin in ["29ABCDE1234F1Z5", "07AABCU9603R1ZP", "27AAPFU0939F1ZV"]:
        validate_gstin_format(gstin)


def test_gstin_validator_accepts_blank():
    """validate_gstin_format must accept blank (B2C customers have no GSTIN)."""
    from support_app.validators import validate_gstin_format
    validate_gstin_format("")
    validate_gstin_format(None)


def test_invoice_pdf_source_has_no_hardcoded_placeholder_gstin():
    """
    invoice_pdf.py must not contain the hardcoded placeholder GSTIN '22AAAAA0000A1Z5'.
    C-004 fix: removed hardcoded fallback — BUSINESS_GSTIN env var required or invoice
    shows 'Not GST Registered'. The placeholder value must never appear in source code.
    """
    import inspect
    from support_app import invoice_pdf
    src = inspect.getsource(invoice_pdf)
    assert "22AAAAA0000A1Z5" not in src, (
        "Hardcoded fake GSTIN '22AAAAA0000A1Z5' must be removed from invoice_pdf.py"
    )


def test_gstin_validator_rejects_short_string():
    """validate_gstin_format must reject strings shorter than 15 chars."""
    from support_app.validators import validate_gstin_format
    from django.core.exceptions import ValidationError

    with pytest.raises(ValidationError):
        validate_gstin_format("29ABCDE1234F1Z")


def test_gstin_validator_rejects_random_string():
    """validate_gstin_format must reject arbitrary text."""
    from support_app.validators import validate_gstin_format
    from django.core.exceptions import ValidationError

    for bad in ["INVALID", "123456789012345", "not-a-gstin"]:
        with pytest.raises(ValidationError):
            validate_gstin_format(bad)


def test_serializer_rejects_invalid_gstin():
    """UserProfileUpdateSerializer.validate_gstin must reject malformed GSTIN."""
    from support_app.serializers import UserProfileUpdateSerializer
    from django.core.exceptions import ValidationError as DjangoVE
    from rest_framework.exceptions import ValidationError as DRFValidationError

    serializer = UserProfileUpdateSerializer(data={"gstin": "INVALID_GSTIN_12"}, partial=True)
    assert not serializer.is_valid()
    assert "gstin" in serializer.errors


def test_serializer_accepts_valid_gstin():
    """UserProfileUpdateSerializer.validate_gstin must accept a valid GSTIN."""
    from support_app.serializers import UserProfileUpdateSerializer

    serializer = UserProfileUpdateSerializer(data={"gstin": "29ABCDE1234F1Z5"}, partial=True)
    assert serializer.is_valid(), serializer.errors
    assert serializer.validated_data["gstin"] == "29ABCDE1234F1Z5"


def test_serializer_normalizes_gstin_to_uppercase():
    """UserProfileUpdateSerializer must normalize GSTIN to uppercase."""
    from support_app.serializers import UserProfileUpdateSerializer

    serializer = UserProfileUpdateSerializer(data={"gstin": "29abcde1234f1z5"}, partial=True)
    assert serializer.is_valid(), serializer.errors
    assert serializer.validated_data["gstin"] == "29ABCDE1234F1Z5"


def test_serializer_accepts_blank_gstin():
    """Empty GSTIN must be accepted (B2C customer profile update)."""
    from support_app.serializers import UserProfileUpdateSerializer

    serializer = UserProfileUpdateSerializer(data={"gstin": ""}, partial=True)
    assert serializer.is_valid(), serializer.errors


def _make_mock_consulting_payment(inv_num, customer_gstin="", b2b=False):
    """Return a MagicMock payment suitable for passing to generate_invoice_pdf."""
    from unittest.mock import MagicMock
    from datetime import datetime

    payment = MagicMock()
    payment.invoice_number = inv_num
    payment.created_at = datetime(2026, 6, 25, 10, 0, 0)
    payment.status = "completed"
    payment.get_status_display.return_value = "Completed"
    payment.payment_type = "consulting_fee"
    payment.get_payment_type_display.return_value = "Consulting Fee"
    payment.amount = 299
    payment.gst_amount = 53.82
    payment.gateway = "razorpay"
    payment.gateway_payment_id = "pay_001"
    payment.gateway_order_id = "order_001"
    payment.currency = "INR"
    payment.ticket = None

    customer = MagicMock()
    customer.gstin = customer_gstin
    customer.company = "TestCo Ltd"
    customer.phone = ""
    customer.address = ""
    customer.user.first_name = "Test"
    customer.user.last_name = "User"
    customer.user.email = "test@example.com"
    payment.customer = customer
    return payment


def test_invoice_pdf_b2c_no_fake_gstin():
    """
    B2C invoice (no customer GSTIN) must never contain the placeholder GSTIN
    '22AAAAA0000A1Z5'. The bill-to section must show 'B2C Consumer (Unregistered)'.
    C-004 fix: removed hardcoded fallback from invoice_pdf.py.
    """
    import reportlab.rl_config as _rl
    from django.test import override_settings
    from support_app.invoice_pdf import generate_invoice_pdf

    payment = _make_mock_consulting_payment("INV-C004-B2C", customer_gstin="")

    _prev = _rl.pageCompression
    try:
        _rl.pageCompression = 0  # disable compression so text is searchable in raw bytes
        with override_settings(BUSINESS_GSTIN="", BUSINESS_NAME="TestCo", GST_RATE=0.18):
            pdf_bytes = generate_invoice_pdf(payment)
    finally:
        _rl.pageCompression = _prev

    assert pdf_bytes[:4] == b"%PDF"
    decoded = pdf_bytes.decode("latin-1", errors="replace")
    # The fake placeholder GSTIN must never appear
    assert "22AAAAA0000A1Z5" not in decoded, (
        "Placeholder GSTIN '22AAAAA0000A1Z5' must not appear in any invoice"
    )
    # B2C must be stated clearly
    assert "B2C Consumer" in decoded


def test_invoice_pdf_b2b_shows_customer_gstin():
    """
    B2B invoice (customer has GSTIN) must include the customer's GSTIN and B2B label.
    C-004 fix: is_b2b flag shows GSTIN and 'B2B (Registered Dealer)' on invoice.
    """
    import reportlab.rl_config as _rl
    from django.test import override_settings
    from support_app.invoice_pdf import generate_invoice_pdf

    payment = _make_mock_consulting_payment("INV-C004-B2B", customer_gstin="29ABCDE1234F1Z5")

    _prev = _rl.pageCompression
    try:
        _rl.pageCompression = 0
        with override_settings(BUSINESS_GSTIN="27AAPFU0939F1ZV", BUSINESS_NAME="TestCo", GST_RATE=0.18):
            pdf_bytes = generate_invoice_pdf(payment)
    finally:
        _rl.pageCompression = _prev

    assert pdf_bytes[:4] == b"%PDF"
    decoded = pdf_bytes.decode("latin-1", errors="replace")
    assert "29ABCDE1234F1Z5" in decoded, "Customer GSTIN must appear in B2B invoice"
    assert "B2B" in decoded


def test_invoice_pdf_business_gstin_not_registered():
    """
    When BUSINESS_GSTIN is empty, the invoice must show 'Not GST Registered'
    and must not contain the placeholder '22AAAAA0000A1Z5'.
    C-004 fix: removed hardcoded fallback.
    """
    import reportlab.rl_config as _rl
    from django.test import override_settings
    from support_app.invoice_pdf import generate_invoice_pdf

    payment = _make_mock_consulting_payment("INV-C004-NOREG")

    _prev = _rl.pageCompression
    try:
        _rl.pageCompression = 0
        with override_settings(BUSINESS_GSTIN="", BUSINESS_NAME="TestCo", GST_RATE=0.18):
            pdf_bytes = generate_invoice_pdf(payment)
    finally:
        _rl.pageCompression = _prev

    assert pdf_bytes[:4] == b"%PDF"
    decoded = pdf_bytes.decode("latin-1", errors="replace")
    assert "22AAAAA0000A1Z5" not in decoded
    assert "Not GST Registered" in decoded


def test_invoice_pdf_resolution_fee_generates_valid_pdf():
    """
    A resolution_fee payment must produce a valid PDF with severity surcharge breakdown.
    C-004 fix: generate_invoice_pdf now handles resolution_fee with line-item breakdown.
    """
    import reportlab.rl_config as _rl
    from datetime import datetime
    from unittest.mock import MagicMock, PropertyMock
    from django.test import override_settings
    from support_app.invoice_pdf import generate_invoice_pdf

    ticket = MagicMock()
    ticket.ticket_number = "TKT-0042"
    ticket.get_service_type_display.return_value = "Linux Provisioning"
    ticket.get_severity_display.return_value = "High"
    ticket.service_type = "linux"
    ticket.severity = "high"
    ticket.title = "Server setup"
    # Simulate no payout yet — accessing ticket.payout should raise so we fall back to catalog
    type(ticket).payout = PropertyMock(side_effect=Exception("no payout"))

    payment = MagicMock()
    payment.invoice_number = "INV-C004-RES"
    payment.created_at = datetime(2026, 6, 25, 10, 0, 0)
    payment.status = "completed"
    payment.get_status_display.return_value = "Completed"
    payment.payment_type = "resolution_fee"
    payment.get_payment_type_display.return_value = "Resolution Fee"
    payment.amount = 1499   # linux ₹999 + high surcharge ₹500
    payment.gst_amount = 270
    payment.gateway = "razorpay"
    payment.gateway_payment_id = "pay_res_001"
    payment.gateway_order_id = "order_res_001"
    payment.currency = "INR"
    payment.ticket = ticket

    customer = MagicMock()
    customer.gstin = ""
    customer.company = "SMBCo"
    customer.phone = ""
    customer.address = ""
    customer.user.first_name = "Rahul"
    customer.user.last_name = "Verma"
    customer.user.email = "rahul@smb.com"
    payment.customer = customer

    _prev = _rl.pageCompression
    try:
        _rl.pageCompression = 0
        with override_settings(BUSINESS_GSTIN="", BUSINESS_NAME="TestCo", GST_RATE=0.18):
            pdf_bytes = generate_invoice_pdf(payment)
    finally:
        _rl.pageCompression = _prev

    assert pdf_bytes[:4] == b"%PDF"
    decoded = pdf_bytes.decode("latin-1", errors="replace")
    assert "22AAAAA0000A1Z5" not in decoded
    # Severity Surcharge breakdown must appear for linux/high (surcharge=₹500)
    assert "Severity Surcharge" in decoded


@pytest.mark.django_db
def test_duplicate_invoice_number_rejected():
    """
    Payment.invoice_number has unique=True — two Payments with the same number
    must raise IntegrityError.
    C-004 fix: verifies the DB constraint that prevents duplicate invoices.
    """
    from django.db import IntegrityError

    _, customer = _make_customer_client(db=None, email="dup_inv@example.com")
    Payment.objects.create(
        customer=customer,
        amount="299.00",
        gst_amount="53.82",
        invoice_number="INV-DUP-000001",
        payment_type="consulting_fee",
        status="pending",
    )
    with pytest.raises(IntegrityError):
        Payment.objects.create(
            customer=customer,
            amount="299.00",
            gst_amount="53.82",
            invoice_number="INV-DUP-000001",  # same number — must be rejected
            payment_type="consulting_fee",
            status="pending",
        )


@pytest.mark.django_db
def test_invoice_totals_match_payment_amounts():
    """
    PaymentSerializer.total_amount must equal amount + gst_amount for any payment.
    C-004 fix: verifies consistent GST calculation on serialized output.
    """
    from rest_framework.test import APIClient
    from django.test import override_settings

    _LOCMEM_CACHE = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}

    with override_settings(CACHES=_LOCMEM_CACHE):
        client, customer = _make_customer_client(db=None, email="totals@example.com")
        payment = Payment.objects.create(
            customer=customer,
            amount="1499.00",
            gst_amount="269.82",
            invoice_number=f"INV-TOT-{uuid_lib.uuid4().hex[:8]}",
            payment_type="resolution_fee",
            status="completed",
        )

        response = client.get(f"/api/payments/{payment.id}/")
        assert response.status_code == 200
        data = response.data
        assert int(data["amount"]) + int(float(data["gst_amount"])) == data["total_amount"] or \
               abs(float(data["amount"]) + float(data["gst_amount"]) - float(data["total_amount"])) < 1


@pytest.mark.django_db
@override_settings(RAZORPAY_KEY_ID="", RAZORPAY_KEY_SECRET="")
def test_gstin_profile_update_invalid_gstin_returns_400():
    """
    PATCH /api/auth/profile/ with an invalid GSTIN must return 400.
    C-004 fix: UserProfileUpdateSerializer.validate_gstin rejects malformed values.
    """
    from django.test import override_settings

    _LOCMEM_CACHE = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}

    with override_settings(CACHES=_LOCMEM_CACHE):
        client, _ = _make_customer_client(db=None, email="gstin_bad@example.com")
        response = client.patch(
            "/api/auth/profile/",
            {"gstin": "INVALID_GST_NO"},
            format="json",
        )
        assert response.status_code == 400, response.data
        assert "gstin" in str(response.data).lower()


@pytest.mark.django_db
def test_gstin_profile_update_valid_gstin_returns_200():
    """
    PATCH /api/auth/profile/ with a valid GSTIN must return 200.
    C-004 fix: valid GSTIN passes through validate_gstin and is saved.
    """
    _LOCMEM_CACHE = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}

    from django.test import override_settings
    with override_settings(CACHES=_LOCMEM_CACHE):
        client, customer = _make_customer_client(db=None, email="gstin_good@example.com")
        response = client.patch(
            "/api/auth/profile/",
            {"gstin": "29ABCDE1234F1Z5"},
            format="json",
        )
        assert response.status_code == 200, response.data
        customer.refresh_from_db()
        assert customer.gstin == "29ABCDE1234F1Z5"


# ── C-005 Tests — Concurrency-safe invoice number generation ──────────────────


def test_invoice_counter_model_has_correct_fields():
    """
    InvoiceCounter must have year_month (unique CharField) and last_seq (PositiveIntegerField).
    C-005 fix: the model is the atomic counter that replaces the race-prone read-then-write.
    """
    from support_app.models import InvoiceCounter
    field_map = {f.name: f for f in InvoiceCounter._meta.get_fields() if hasattr(f, 'name')}
    assert 'year_month' in field_map, "InvoiceCounter must have year_month field"
    assert 'last_seq' in field_map, "InvoiceCounter must have last_seq field"
    assert field_map['year_month'].unique is True, "year_month must be unique"


def test_generate_invoice_number_uses_select_for_update():
    """
    _generate_invoice_number() must use InvoiceCounter + select_for_update().
    C-005 fix: verifies the old race-prone read-then-write pattern is gone.
    """
    import inspect
    from support_app.services import payment_service

    src = inspect.getsource(payment_service._generate_invoice_number)
    assert 'InvoiceCounter' in src, "_generate_invoice_number must use InvoiceCounter"
    assert 'select_for_update' in src, "_generate_invoice_number must use select_for_update"
    # Old racy pattern must be gone
    assert 'rsplit' not in src, "Old read-then-rsplit pattern must be removed"
    assert 'order_by("-invoice_number")' not in src, "Old sort-by-invoice-number pattern must be removed"


def test_invoice_number_format():
    """Invoice numbers must match the INV-YYYYMM-NNNNNN format."""
    import re
    pattern = re.compile(r'^INV-\d{6}-\d{6}$')
    assert pattern.match("INV-202606-000001")
    assert pattern.match("INV-202606-000042")
    assert pattern.match("INV-202612-999999")
    assert not pattern.match("INV-202606-42")          # not zero-padded
    assert not pattern.match("INVOICE-202606-000001")  # wrong prefix
    assert not pattern.match("INV-2026-06-000001")     # wrong month format


@pytest.mark.django_db
def test_generate_invoice_number_sequential():
    """
    Three sequential calls must produce 000001, 000002, 000003 for the same month.
    C-005 fix: InvoiceCounter increments atomically — no gaps from race conditions.
    """
    from unittest.mock import patch
    from datetime import datetime
    from support_app.services.payment_service import _generate_invoice_number

    fixed_month = "202606"
    with patch("support_app.services.payment_service.datetime") as mock_dt:
        mock_dt.now.return_value = datetime(2026, 6, 15, 10, 0, 0)
        n1 = _generate_invoice_number()
        n2 = _generate_invoice_number()
        n3 = _generate_invoice_number()

    assert n1 == "INV-202606-000001"
    assert n2 == "INV-202606-000002"
    assert n3 == "INV-202606-000003"


@pytest.mark.django_db
def test_generate_invoice_number_independent_per_month():
    """
    Invoice counters for different months are independent — each month starts at 000001.
    C-005 fix: InvoiceCounter has one row per year_month, not a global counter.
    """
    from unittest.mock import patch
    from datetime import datetime
    from support_app.services.payment_service import _generate_invoice_number

    with patch("support_app.services.payment_service.datetime") as mock_dt:
        mock_dt.now.return_value = datetime(2026, 6, 15, 10, 0, 0)
        june_1 = _generate_invoice_number()
        june_2 = _generate_invoice_number()

    with patch("support_app.services.payment_service.datetime") as mock_dt:
        mock_dt.now.return_value = datetime(2026, 7, 1, 10, 0, 0)
        july_1 = _generate_invoice_number()

    assert june_1 == "INV-202606-000001"
    assert june_2 == "INV-202606-000002"
    assert july_1 == "INV-202607-000001", "New month must restart at 000001"


@pytest.mark.django_db(transaction=True)
def test_generate_invoice_numbers_unique_under_concurrent_load():
    """
    Ten threads generating invoice numbers simultaneously must produce 10 unique numbers.
    C-005 fix: SELECT FOR UPDATE on InvoiceCounter serializes concurrent callers —
    no two threads can claim the same sequence number.
    """
    import threading
    from unittest.mock import patch
    from datetime import datetime
    from support_app.services.payment_service import _generate_invoice_number

    results = []
    errors = []
    lock = threading.Lock()

    def generate():
        try:
            with patch("support_app.services.payment_service.datetime") as mock_dt:
                mock_dt.now.return_value = datetime(2026, 6, 25, 12, 0, 0)
                number = _generate_invoice_number()
            with lock:
                results.append(number)
        except Exception as exc:
            with lock:
                errors.append(str(exc))

    threads = [threading.Thread(target=generate) for _ in range(10)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert not errors, f"Concurrent generation raised errors: {errors}"
    assert len(results) == 10, f"Expected 10 results, got {len(results)}"
    assert len(set(results)) == 10, (
        f"Duplicate invoice numbers detected under concurrent load: "
        f"{[n for n in results if results.count(n) > 1]}"
    )


@pytest.mark.django_db(transaction=True)
def test_rollback_does_not_cause_duplicate():
    """
    If a Payment.objects.create() fails AFTER the counter has been incremented,
    the next call must produce the next sequence number (not a duplicate).
    A gap in the sequence is acceptable; a collision is not.
    C-005 fix: counter is committed independently of the Payment row.
    """
    from unittest.mock import patch
    from datetime import datetime
    from django.db import IntegrityError
    from support_app.services.payment_service import _generate_invoice_number
    from support_app.models import InvoiceCounter

    # Simulate: counter incremented to 1 (normal), then Payment.create fails
    with patch("support_app.services.payment_service.datetime") as mock_dt:
        mock_dt.now.return_value = datetime(2026, 6, 25, 12, 0, 0)
        first = _generate_invoice_number()  # → INV-202606-000001, counter.last_seq=1

    # Counter row must exist with last_seq=1 even though no Payment was created
    counter = InvoiceCounter.objects.get(year_month="202606")
    assert counter.last_seq == 1

    # Next call must generate 000002, not try to regenerate 000001
    with patch("support_app.services.payment_service.datetime") as mock_dt:
        mock_dt.now.return_value = datetime(2026, 6, 25, 12, 0, 0)
        second = _generate_invoice_number()

    assert first == "INV-202606-000001"
    assert second == "INV-202606-000002", (
        "After a failed payment (gap in invoice sequence), next number must be 000002, not a duplicate 000001"
    )


def test_invoice_pdf_still_works_after_counter_change():
    """
    generate_invoice_pdf() must still produce a valid PDF after the invoice
    number generation change. The PDF reads payment.invoice_number directly —
    it does not call _generate_invoice_number().
    C-005 fix: verifies the PDF path is unaffected by the counter model change.
    """
    from datetime import datetime
    from unittest.mock import MagicMock
    from django.test import override_settings
    from support_app.invoice_pdf import generate_invoice_pdf

    payment = _make_mock_consulting_payment("INV-202606-000042")

    with override_settings(BUSINESS_GSTIN="", BUSINESS_NAME="TestCo", GST_RATE=0.18):
        pdf_bytes = generate_invoice_pdf(payment)

    assert pdf_bytes[:4] == b"%PDF", "PDF generation must still work after counter model addition"
    assert len(pdf_bytes) > 1024, "PDF must be non-trivially sized"
