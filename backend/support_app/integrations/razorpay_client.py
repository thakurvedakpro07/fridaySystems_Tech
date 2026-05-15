"""
Razorpay SDK wrapper.

All Razorpay API calls go through this module so we have one
place to configure the client and handle errors.

TODO: implement in Phase 2.
"""
import razorpay
from django.conf import settings


def get_client() -> razorpay.Client:
    """Return an authenticated Razorpay client using settings credentials."""
    return razorpay.Client(
        auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
    )
