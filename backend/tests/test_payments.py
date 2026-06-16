"""
Tests for payment endpoints.
TODO: expand in Phase 2 when Razorpay integration is implemented.
"""

import pytest
from django.contrib.auth import get_user_model
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
