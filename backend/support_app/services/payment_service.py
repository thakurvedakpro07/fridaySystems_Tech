"""
Payment business logic — wraps Razorpay SDK calls.

TODO: implement in Phase 2.
"""


def create_consulting_fee_order(ticket) -> dict:
    """
    Create a Razorpay order for the ₹299 consulting fee.
    Returns: { "order_id": ..., "amount": 299, "currency": "INR" }
    """
    raise NotImplementedError


def create_resolution_fee_order(ticket) -> dict:
    """Create a Razorpay order for the resolution fee (varies by service type)."""
    raise NotImplementedError


def verify_webhook_signature(payload: bytes, signature: str) -> bool:
    """
    Verify the HMAC-SHA256 signature on an incoming Razorpay webhook.
    Returns True if valid, False otherwise.
    NEVER process a webhook that fails this check.
    """
    raise NotImplementedError


def process_payment_webhook(event: dict) -> None:
    """
    Handle a verified Razorpay webhook event.
    Updates Payment status and triggers downstream actions.
    """
    raise NotImplementedError


def issue_refund(payment) -> None:
    """Call Razorpay refund API and update the Payment record."""
    raise NotImplementedError
