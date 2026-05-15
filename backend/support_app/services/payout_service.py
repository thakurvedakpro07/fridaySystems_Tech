"""
Freelancer payout logic.

TODO: implement in Phase 4.
"""


def calculate_payout(ticket) -> float:
    """
    Calculate the freelancer's share for a resolved ticket.
    Formula: resolution_fee × payout_percentage (60–70%)
    """
    raise NotImplementedError


def create_payout_batch() -> None:
    """
    Collect all closed tickets with pending payouts and
    group them into a batch for admin review and disbursement.
    """
    raise NotImplementedError


def mark_payout_processed(payout_id: str, utr_number: str) -> None:
    """Mark a payout as disbursed and record the UTR transfer reference."""
    raise NotImplementedError
