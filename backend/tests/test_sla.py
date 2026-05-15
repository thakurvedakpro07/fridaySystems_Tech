"""
Tests for SLA monitoring logic.
TODO: implement when SLA service is built in Phase 3.
"""

import pytest


@pytest.mark.skip(reason="SLA service not implemented yet — Phase 3")
def test_sla_breach_detected_after_threshold():
    """When a ticket exceeds its SLA window, a breach should be logged."""
    pass


@pytest.mark.skip(reason="SLA service not implemented yet — Phase 3")
def test_sla_met_when_resolved_in_time():
    """When a ticket is resolved before the SLA deadline, status should be 'met'."""
    pass
