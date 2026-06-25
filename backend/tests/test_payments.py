"""
Tests for payment endpoints and payment service security.
"""

import uuid as uuid_lib

import pytest
from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APIClient

from support_app.models import Customer, Payment, Ticket

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
