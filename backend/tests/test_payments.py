"""
Tests for payment endpoints.
TODO: expand in Phase 2 when Razorpay integration is implemented.
"""

import pytest
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_payment_webhook_returns_200():
    """
    POST /api/payments/webhook/ should return 200 (even with empty payload).
    HMAC verification will be added in Phase 2.
    """
    client = APIClient()
    response = client.post("/api/payments/webhook/", {}, format="json")
    assert response.status_code == 200
