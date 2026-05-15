"""
Ticket business logic.

Views call functions in this file instead of putting logic in views.py.
This keeps views thin and easy to test.

TODO: implement these functions in Phase 2.
"""


def create_ticket(customer, validated_data: dict) -> "Ticket":
    """
    Create a ticket, generate ticket number, and create the consulting
    fee payment order with Razorpay.
    Returns the saved Ticket and a checkout_url.
    """
    raise NotImplementedError


def assign_ticket(ticket, freelancer) -> None:
    """
    Assign a ticket to a freelancer, update status to 'assigned',
    and send notifications.
    """
    raise NotImplementedError


def resolve_ticket(ticket, freelancer) -> None:
    """
    Mark ticket as resolved, capture resolution fee, and send CSAT survey.
    """
    raise NotImplementedError


def close_ticket(ticket) -> None:
    """
    Close the ticket, queue the freelancer payout, and update their rating.
    """
    raise NotImplementedError
