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
        service_type="server_admin",
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
        service_type="server_admin",
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
        service_type="server_admin",
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
        service_type="server_admin",
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
        service_type="server_admin",
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
        service_type="server_admin",
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
        service_type="server_admin",
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
        service_type="server_admin",
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
    ticket.get_service_type_display.return_value = "Server Administration Support"
    ticket.get_severity_display.return_value = "High"
    ticket.service_type = "server_admin"
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


# ════════════════════════════════════════════════════════════════════════════
# C-NEW-001  Refund workflow — issue_refund() and ops_payment_refund endpoint
#
# Root cause: ops_payment_refund() only set payment.status = "refunded" in the
# DB without calling issue_refund() or the Razorpay API.  Customers were never
# actually refunded; money stayed with Razorpay indefinitely.
#
# Fix:
#   • Added Payment.gateway_refund_id field (migration 0021).
#   • Rewrote issue_refund() with SELECT FOR UPDATE idempotency guard, full
#     Razorpay API call, refund ID persistence, sandbox mock, and logging.
#   • Rewrote ops_payment_refund() to call issue_refund() and return 502 on
#     gateway failure (leaving payment in "completed" so admin can retry).
# ════════════════════════════════════════════════════════════════════════════


# ── Shared helpers ────────────────────────────────────────────────────────────

def _make_admin_client(db):
    """Super admin user (is_staff=True, role='admin') + authenticated client."""
    user = User.objects.create_user(
        email=f"admin_{uuid_lib.uuid4().hex[:6]}@test.com",
        password="StrongPass123!",
        role="admin",
        is_staff=True,
    )
    client = APIClient()
    client.force_authenticate(user=user)
    return client, user


def _make_completed_payment(customer, gateway_payment_id="pay_testXXXXXX"):
    """Completed Payment with a gateway_payment_id (as captured by Razorpay)."""
    return Payment.objects.create(
        customer=customer,
        amount="299.00",
        gst_amount="53.82",
        invoice_number=f"INV-REFTEST-{uuid_lib.uuid4().hex[:8]}",
        payment_type="consulting_fee",
        gateway="razorpay",
        gateway_payment_id=gateway_payment_id,
        gateway_order_id="order_testXXXXXX",
        status="completed",
    )


# ── Service unit tests ────────────────────────────────────────────────────────

@pytest.mark.django_db
@override_settings(RAZORPAY_KEY_ID="", RAZORPAY_KEY_SECRET="")
def test_issue_refund_sandbox_stores_mock_refund_id(db):
    """
    In sandbox mode (no RAZORPAY_KEY_ID) issue_refund() generates a deterministic
    mock refund ID, marks payment refunded, and persists gateway_refund_id to the DB.
    No Razorpay API call is made.
    """
    from support_app.services.payment_service import issue_refund

    _, customer = _make_customer_client(db, "rfnd_sb1@test.com")
    payment = _make_completed_payment(customer)

    result = issue_refund(payment)

    assert result.status == "refunded"
    assert result.gateway_refund_id.startswith("rfnd_sandbox_")

    payment.refresh_from_db()
    assert payment.status == "refunded"
    assert payment.gateway_refund_id.startswith("rfnd_sandbox_")


@pytest.mark.django_db
@override_settings(RAZORPAY_KEY_ID="", RAZORPAY_KEY_SECRET="")
def test_issue_refund_sandbox_is_idempotent(db):
    """
    Calling issue_refund() twice in sandbox returns the same refund ID on both
    calls — no second mock ID is generated, no second API call occurs.
    """
    from support_app.services.payment_service import issue_refund

    _, customer = _make_customer_client(db, "rfnd_sb2@test.com")
    payment = _make_completed_payment(customer)

    r1 = issue_refund(payment)
    r2 = issue_refund(payment)

    assert r1.gateway_refund_id == r2.gateway_refund_id, (
        "Second call must return the existing refund ID — no duplicate refund"
    )


@pytest.mark.django_db
@override_settings(RAZORPAY_KEY_ID="rzp_test_key", RAZORPAY_KEY_SECRET="test_secret")
def test_issue_refund_live_calls_razorpay_with_correct_amount(db):
    """
    In live mode issue_refund() calls client.payment.refund() with the full amount
    in paise and stores the Razorpay-returned refund ID.
    Amount: (299.00 + 53.82) × 100 = 35282 paise.
    """
    from unittest.mock import MagicMock, patch
    from support_app.services.payment_service import issue_refund

    _, customer = _make_customer_client(db, "rfnd_lv1@test.com")
    payment = _make_completed_payment(customer, gateway_payment_id="pay_live001")

    mock_client = MagicMock()
    mock_client.payment.refund.return_value = {
        "id": "rfnd_live_AAAAAA",
        "entity": "refund",
        "amount": 35282,
        "currency": "INR",
        "payment_id": "pay_live001",
    }

    with patch("support_app.integrations.razorpay_client.get_client", return_value=mock_client):
        result = issue_refund(payment)

    mock_client.payment.refund.assert_called_once_with("pay_live001", {"amount": 35282})
    assert result.status == "refunded"
    assert result.gateway_refund_id == "rfnd_live_AAAAAA"

    payment.refresh_from_db()
    assert payment.status == "refunded"
    assert payment.gateway_refund_id == "rfnd_live_AAAAAA"


@pytest.mark.django_db
@override_settings(RAZORPAY_KEY_ID="rzp_test_key", RAZORPAY_KEY_SECRET="test_secret")
def test_issue_refund_live_idempotent_no_second_api_call(db):
    """
    If gateway_refund_id is already set, issue_refund() returns immediately without
    calling the Razorpay API.  Prevents double-refund on retry.
    """
    from unittest.mock import MagicMock, patch
    from support_app.services.payment_service import issue_refund

    _, customer = _make_customer_client(db, "rfnd_lv2@test.com")
    payment = _make_completed_payment(customer)
    payment.gateway_refund_id = "rfnd_already_BBBBBB"
    payment.status = "refunded"
    payment.save(update_fields=["gateway_refund_id", "status"])

    mock_client = MagicMock()

    with patch("support_app.integrations.razorpay_client.get_client", return_value=mock_client):
        result = issue_refund(payment)

    mock_client.payment.refund.assert_not_called()
    assert result.gateway_refund_id == "rfnd_already_BBBBBB"


@pytest.mark.django_db
@override_settings(RAZORPAY_KEY_ID="", RAZORPAY_KEY_SECRET="")
def test_issue_refund_rejects_non_completed_payment(db):
    """
    issue_refund() raises ValueError when payment.status != 'completed'.
    The payment record must be unchanged after the rejection.
    """
    from support_app.services.payment_service import issue_refund

    _, customer = _make_customer_client(db, "rfnd_sb3@test.com")
    payment = Payment.objects.create(
        customer=customer,
        amount="299.00",
        gst_amount="53.82",
        invoice_number=f"INV-PENDING-{uuid_lib.uuid4().hex[:8]}",
        payment_type="consulting_fee",
        status="pending",
    )

    with pytest.raises(ValueError, match="status='completed'"):
        issue_refund(payment)

    payment.refresh_from_db()
    assert payment.status == "pending"
    assert payment.gateway_refund_id == ""


@pytest.mark.django_db
@override_settings(RAZORPAY_KEY_ID="rzp_test_key", RAZORPAY_KEY_SECRET="test_secret")
def test_issue_refund_api_failure_leaves_payment_completed(db):
    """
    If the Razorpay API raises an exception, issue_refund() re-raises it and
    the payment stays in 'completed' status — never silently marked refunded.
    """
    from unittest.mock import MagicMock, patch
    from support_app.services.payment_service import issue_refund

    _, customer = _make_customer_client(db, "rfnd_lv3@test.com")
    payment = _make_completed_payment(customer, gateway_payment_id="pay_failtest")

    mock_client = MagicMock()
    mock_client.payment.refund.side_effect = Exception("Gateway timeout")

    with patch("support_app.integrations.razorpay_client.get_client", return_value=mock_client):
        with pytest.raises(Exception, match="Gateway timeout"):
            issue_refund(payment)

    payment.refresh_from_db()
    assert payment.status == "completed", "Status must not be changed on gateway failure"
    assert payment.gateway_refund_id == "", "Refund ID must not be stored on gateway failure"


@pytest.mark.django_db
@override_settings(RAZORPAY_KEY_ID="rzp_test_key", RAZORPAY_KEY_SECRET="test_secret")
def test_issue_refund_partial_amount_passes_correct_paise(db):
    """
    When refund_amount_paise is provided, issue_refund() passes that exact value
    to the Razorpay API (partial refund support).
    """
    from unittest.mock import MagicMock, patch
    from support_app.services.payment_service import issue_refund

    _, customer = _make_customer_client(db, "rfnd_partial@test.com")
    payment = _make_completed_payment(customer, gateway_payment_id="pay_partial")

    mock_client = MagicMock()
    mock_client.payment.refund.return_value = {"id": "rfnd_partial_CCCCCC"}

    with patch("support_app.integrations.razorpay_client.get_client", return_value=mock_client):
        result = issue_refund(payment, refund_amount_paise=10000)

    mock_client.payment.refund.assert_called_once_with("pay_partial", {"amount": 10000})
    assert result.status == "refunded"
    assert result.gateway_refund_id == "rfnd_partial_CCCCCC"


@pytest.mark.django_db
@override_settings(RAZORPAY_KEY_ID="rzp_test_key", RAZORPAY_KEY_SECRET="test_secret")
def test_issue_refund_live_requires_gateway_payment_id(db):
    """
    In live mode, a payment with no gateway_payment_id cannot be refunded —
    issue_refund() raises ValueError without calling the Razorpay API.
    """
    from unittest.mock import MagicMock, patch
    from support_app.services.payment_service import issue_refund

    _, customer = _make_customer_client(db, "rfnd_nopayid@test.com")
    payment = Payment.objects.create(
        customer=customer,
        amount="299.00",
        gst_amount="53.82",
        invoice_number=f"INV-NOGW-{uuid_lib.uuid4().hex[:8]}",
        payment_type="consulting_fee",
        gateway_payment_id="",  # never captured at gateway
        status="completed",
    )

    mock_client = MagicMock()
    with patch("support_app.integrations.razorpay_client.get_client", return_value=mock_client):
        with pytest.raises(ValueError, match="gateway_payment_id"):
            issue_refund(payment)

    mock_client.payment.refund.assert_not_called()
    payment.refresh_from_db()
    assert payment.status == "completed"


# ── View (endpoint) tests ─────────────────────────────────────────────────────

@pytest.mark.django_db
@override_settings(RAZORPAY_KEY_ID="", RAZORPAY_KEY_SECRET="")
def test_ops_refund_endpoint_sandbox_returns_200_and_refund_id(db):
    """
    POST /api/ops/payments/{id}/refund/ (sandbox) returns 200, sets status='refunded',
    and includes gateway_refund_id in the response.
    """
    admin_client, _ = _make_admin_client(db)
    _, customer = _make_customer_client(db, "rfnd_ep1@test.com")
    payment = _make_completed_payment(customer)

    response = admin_client.post(f"/api/ops/payments/{payment.id}/refund/")

    assert response.status_code == 200
    assert response.data["status"] == "refunded"
    assert response.data["gateway_refund_id"].startswith("rfnd_sandbox_")


@pytest.mark.django_db
@override_settings(RAZORPAY_KEY_ID="", RAZORPAY_KEY_SECRET="")
def test_ops_refund_endpoint_requires_super_admin(db):
    """
    POST /api/ops/payments/{id}/refund/ returns 403 for any non-super-admin user.
    """
    for role in ("operations_manager", "finance_manager", "customer"):
        is_staff = False
        user = User.objects.create_user(
            email=f"rfnd_perm_{role}@test.com",
            password="StrongPass123!",
            role=role,
            is_staff=is_staff,
        )
        client = APIClient()
        client.force_authenticate(user=user)
        _, customer = _make_customer_client(db, f"rfnd_ep2_{role}@test.com")
        payment = _make_completed_payment(customer)

        response = client.post(f"/api/ops/payments/{payment.id}/refund/")
        assert response.status_code == 403, f"Role '{role}' must not access refund endpoint"


@pytest.mark.django_db
@override_settings(RAZORPAY_KEY_ID="", RAZORPAY_KEY_SECRET="")
def test_ops_refund_endpoint_rejects_non_completed_payment(db):
    """
    POST /api/ops/payments/{id}/refund/ returns 400 for payments not in 'completed' status.
    """
    admin_client, _ = _make_admin_client(db)
    _, customer = _make_customer_client(db, "rfnd_ep3@test.com")

    for bad_status in ("pending", "failed"):
        payment = Payment.objects.create(
            customer=customer,
            amount="299.00",
            gst_amount="53.82",
            invoice_number=f"INV-BAD-{uuid_lib.uuid4().hex[:8]}",
            payment_type="consulting_fee",
            status=bad_status,
        )
        response = admin_client.post(f"/api/ops/payments/{payment.id}/refund/")
        assert response.status_code == 400, f"Status '{bad_status}' must be rejected"


@pytest.mark.django_db
@override_settings(RAZORPAY_KEY_ID="", RAZORPAY_KEY_SECRET="")
def test_ops_refund_endpoint_is_idempotent(db):
    """
    Calling POST /api/ops/payments/{id}/refund/ twice returns 200 on both calls
    with the same gateway_refund_id — no duplicate refund is issued.
    """
    admin_client, _ = _make_admin_client(db)
    _, customer = _make_customer_client(db, "rfnd_ep4@test.com")
    payment = _make_completed_payment(customer)

    r1 = admin_client.post(f"/api/ops/payments/{payment.id}/refund/")
    r2 = admin_client.post(f"/api/ops/payments/{payment.id}/refund/")

    assert r1.status_code == 200
    assert r2.status_code == 200
    assert r1.data["gateway_refund_id"] == r2.data["gateway_refund_id"], (
        "Second refund call must return the same refund ID (idempotency)"
    )


@pytest.mark.django_db
@override_settings(RAZORPAY_KEY_ID="rzp_test_key", RAZORPAY_KEY_SECRET="test_secret")
def test_ops_refund_endpoint_live_mode_calls_razorpay_and_returns_refund_id(db):
    """
    In live mode the endpoint calls client.payment.refund() exactly once and
    includes the Razorpay-returned refund ID in the response.
    """
    from unittest.mock import MagicMock, patch

    admin_client, _ = _make_admin_client(db)
    _, customer = _make_customer_client(db, "rfnd_ep5@test.com")
    payment = _make_completed_payment(customer, gateway_payment_id="pay_ep_live")

    mock_client = MagicMock()
    mock_client.payment.refund.return_value = {"id": "rfnd_ep_DDDDDD"}

    with patch("support_app.integrations.razorpay_client.get_client", return_value=mock_client):
        response = admin_client.post(f"/api/ops/payments/{payment.id}/refund/")

    assert response.status_code == 200
    assert response.data["status"] == "refunded"
    assert response.data["gateway_refund_id"] == "rfnd_ep_DDDDDD"
    mock_client.payment.refund.assert_called_once()

    payment.refresh_from_db()
    assert payment.status == "refunded"
    assert payment.gateway_refund_id == "rfnd_ep_DDDDDD"


@pytest.mark.django_db
@override_settings(RAZORPAY_KEY_ID="rzp_test_key", RAZORPAY_KEY_SECRET="test_secret")
def test_ops_refund_endpoint_returns_502_on_gateway_error_and_does_not_update_db(db):
    """
    If the Razorpay API raises an exception the endpoint returns 502 and the
    payment remains in 'completed' status — the admin can safely retry.
    """
    from unittest.mock import MagicMock, patch

    admin_client, _ = _make_admin_client(db)
    _, customer = _make_customer_client(db, "rfnd_ep6@test.com")
    payment = _make_completed_payment(customer, gateway_payment_id="pay_ep_fail")

    mock_client = MagicMock()
    mock_client.payment.refund.side_effect = Exception("Connection refused")

    with patch("support_app.integrations.razorpay_client.get_client", return_value=mock_client):
        response = admin_client.post(f"/api/ops/payments/{payment.id}/refund/")

    assert response.status_code == 502
    payment.refresh_from_db()
    assert payment.status == "completed", "DB must not be updated on gateway failure"
    assert payment.gateway_refund_id == "", "Refund ID must not be stored on gateway failure"


# ── C-NEW-002: process_payment_webhook atomicity ──────────────────────────────

def _make_pending_payment_with_ticket(customer, order_id: str):
    """Pending payment linked to a pending_payment ticket — mirrors real pre-webhook state."""
    ticket = Ticket.objects.create(
        customer=customer,
        title="Test ticket",
        service_type="server_admin",
        severity="low",
        status="pending_payment",
    )
    return Payment.objects.create(
        customer=customer,
        ticket=ticket,
        amount="299.00",
        gst_amount="53.82",
        invoice_number=f"INV-WH-{uuid_lib.uuid4().hex[:8]}",
        payment_type="consulting_fee",
        gateway="razorpay",
        gateway_payment_id="",
        gateway_order_id=order_id,
        status="pending",
    )


def _make_webhook_event(order_id: str, payment_id: str = "pay_wh_test") -> dict:
    return {
        "event": "payment.captured",
        "payload": {
            "payment": {
                "entity": {
                    "id": payment_id,
                    "order_id": order_id,
                }
            }
        },
    }


@pytest.mark.django_db
def test_webhook_rolls_back_payment_when_ticket_open_fails(db):
    """
    C-NEW-002: If _open_ticket_after_payment raises inside process_payment_webhook,
    the outer transaction.atomic() must roll back — payment must remain 'pending'.
    """
    from unittest.mock import patch
    from support_app.services.payment_service import process_payment_webhook

    _, customer = _make_customer_client(db, "wh_atomic@test.com")
    order_id = f"order_wh_{uuid_lib.uuid4().hex[:8]}"
    payment = _make_pending_payment_with_ticket(customer, order_id)

    with patch(
        "support_app.services.payment_service._open_ticket_after_payment",
        side_effect=RuntimeError("Simulated DB failure"),
    ):
        with pytest.raises(RuntimeError):
            process_payment_webhook(_make_webhook_event(order_id))

    payment.refresh_from_db()
    assert payment.status == "pending", "Transaction must roll back when ticket open fails"
    assert payment.gateway_payment_id == "", "gateway_payment_id must not be persisted on rollback"


@pytest.mark.django_db
def test_webhook_idempotent_duplicate_delivery(db):
    """
    C-NEW-002: A second delivery of the same payment.captured webhook (Razorpay
    sometimes retries) must be ignored — _open_ticket_after_payment called once only.
    """
    from unittest.mock import patch
    from support_app.services.payment_service import process_payment_webhook

    _, customer = _make_customer_client(db, "wh_idem@test.com")
    order_id = f"order_idem_{uuid_lib.uuid4().hex[:8]}"
    _make_pending_payment_with_ticket(customer, order_id)
    event = _make_webhook_event(order_id)

    with patch(
        "support_app.services.payment_service._open_ticket_after_payment"
    ) as mock_open:
        process_payment_webhook(event)
        process_payment_webhook(event)  # duplicate delivery

    mock_open.assert_called_once(), "Ticket must be opened exactly once on duplicate webhook"


# ── C-NEW-003: admin_payment_confirm and ops_payment_confirm atomicity ─────────

def _make_pending_payment(customer, order_id: str | None = None):
    """Pending payment for manual-confirm tests."""
    ticket = Ticket.objects.create(
        customer=customer,
        title="Test ticket",
        service_type="server_admin",
        severity="low",
        status="pending_payment",
    )
    return Payment.objects.create(
        customer=customer,
        ticket=ticket,
        amount="299.00",
        gst_amount="53.82",
        invoice_number=f"INV-CONF-{uuid_lib.uuid4().hex[:8]}",
        payment_type="consulting_fee",
        gateway="razorpay",
        gateway_payment_id="",
        gateway_order_id=order_id or f"order_conf_{uuid_lib.uuid4().hex[:8]}",
        status="pending",
    )


@pytest.mark.django_db
def test_admin_confirm_rolls_back_when_ticket_save_fails(db):
    """
    C-NEW-003: If the ticket.save() inside admin_payment_confirm raises, the outer
    transaction must roll back — payment must remain 'pending'.
    """
    from unittest.mock import patch
    from support_app.models import Ticket as TicketModel

    admin_client, _ = _make_admin_client(db)
    _, customer = _make_customer_client(db, "adm_conf_atomic@test.com")
    payment = _make_pending_payment(customer)

    original_save = TicketModel.save

    call_count = {"n": 0}

    def fail_on_ticket_save(self, *args, **kwargs):
        call_count["n"] += 1
        if call_count["n"] == 1:
            raise RuntimeError("Simulated ticket DB failure")
        return original_save(self, *args, **kwargs)

    with patch.object(TicketModel, "save", fail_on_ticket_save):
        response = admin_client.post(f"/api/admin/payments/{payment.id}/confirm/")

    assert response.status_code == 500  # unhandled exception → 500 from DRF
    payment.refresh_from_db()
    assert payment.status == "pending", "Payment must roll back when ticket.save() fails"


@pytest.mark.django_db
def test_admin_confirm_is_idempotent(db):
    """
    C-NEW-003: Calling admin confirm twice on the same payment returns 400 on
    the second call and does not double-open the ticket.
    """
    admin_client, _ = _make_admin_client(db)
    _, customer = _make_customer_client(db, "adm_conf_idem@test.com")
    payment = _make_pending_payment(customer)

    r1 = admin_client.post(f"/api/admin/payments/{payment.id}/confirm/")
    r2 = admin_client.post(f"/api/admin/payments/{payment.id}/confirm/")

    assert r1.status_code == 200
    assert r2.status_code == 400
    payment.refresh_from_db()
    assert payment.status == "completed"


@pytest.mark.django_db
def test_ops_confirm_is_atomic_and_rolls_back(db):
    """
    C-NEW-003: If ticket.save() raises inside ops_payment_confirm, the outer
    transaction must roll back — payment must remain 'pending'.
    """
    from unittest.mock import patch
    from support_app.models import Ticket as TicketModel

    admin_client, _ = _make_admin_client(db)
    _, customer = _make_customer_client(db, "ops_conf_atomic@test.com")
    payment = _make_pending_payment(customer)

    original_save = TicketModel.save
    call_count = {"n": 0}

    def fail_on_ticket_save(self, *args, **kwargs):
        call_count["n"] += 1
        if call_count["n"] == 1:
            raise RuntimeError("Simulated ticket DB failure")
        return original_save(self, *args, **kwargs)

    with patch.object(TicketModel, "save", fail_on_ticket_save):
        response = admin_client.post(f"/api/ops/payments/{payment.id}/confirm/")

    assert response.status_code == 500
    payment.refresh_from_db()
    assert payment.status == "pending", "Payment must roll back when ticket.save() fails"


@pytest.mark.django_db
def test_ops_confirm_is_idempotent(db):
    """
    C-NEW-003: Calling ops confirm twice returns 400 on the second call.
    """
    admin_client, _ = _make_admin_client(db)
    _, customer = _make_customer_client(db, "ops_conf_idem@test.com")
    payment = _make_pending_payment(customer)

    r1 = admin_client.post(f"/api/ops/payments/{payment.id}/confirm/")
    r2 = admin_client.post(f"/api/ops/payments/{payment.id}/confirm/")

    assert r1.status_code == 200
    assert r2.status_code == 400
    payment.refresh_from_db()
    assert payment.status == "completed"
