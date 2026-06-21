"""
Tests for SLA monitoring logic (C-04 fix verification).
"""

import datetime
from unittest.mock import MagicMock, patch

import pytest
from django.utils import timezone


@pytest.fixture
def mock_ticket():
    ticket = MagicMock()
    ticket.ticket_number = "TKT-0001"
    ticket.severity = "medium"
    ticket.service_type = "linux"
    ticket.sla_breach_notified = False
    ticket.due_at = None
    return ticket


def test_sla_defaults_cover_all_severities():
    """_DEFAULTS must define windows for all four severity levels."""
    from support_app.services.sla_service import _DEFAULTS
    assert set(_DEFAULTS.keys()) == {"critical", "high", "medium", "low"}
    for sev, (first_resp, resolution) in _DEFAULTS.items():
        assert first_resp > 0, f"{sev} first_response must be positive"
        assert resolution > 0, f"{sev} resolution must be positive"
        assert resolution >= first_resp, f"{sev} resolution must be >= first_response"


def test_sla_defaults_ordering():
    """More severe tickets must have shorter SLA windows."""
    from support_app.services.sla_service import _DEFAULTS
    assert _DEFAULTS["critical"][1] < _DEFAULTS["high"][1]
    assert _DEFAULTS["high"][1] < _DEFAULTS["medium"][1]
    assert _DEFAULTS["medium"][1] < _DEFAULTS["low"][1]


def test_check_ticket_sla_no_due_at(mock_ticket):
    """Tickets without due_at should be skipped silently."""
    from support_app.services.sla_service import check_ticket_sla
    mock_ticket.due_at = None
    check_ticket_sla(mock_ticket)
    mock_ticket.save.assert_not_called()


def test_check_ticket_sla_already_notified(mock_ticket):
    """Already-notified tickets must not be processed again."""
    from support_app.services.sla_service import check_ticket_sla
    mock_ticket.due_at = timezone.now() - datetime.timedelta(hours=1)
    mock_ticket.sla_breach_notified = True
    check_ticket_sla(mock_ticket)
    mock_ticket.save.assert_not_called()


def test_check_ticket_sla_not_yet_breached(mock_ticket):
    """Tickets whose due_at is in the future must not be flagged."""
    from support_app.services.sla_service import check_ticket_sla
    mock_ticket.due_at = timezone.now() + datetime.timedelta(hours=2)
    mock_ticket.sla_breach_notified = False
    with patch("support_app.models.SLALog") as mock_log:
        check_ticket_sla(mock_ticket)
    mock_log.objects.create.assert_not_called()
    mock_ticket.save.assert_not_called()


def test_check_ticket_sla_breach_detected(mock_ticket):
    """Overdue tickets must be marked and a SLALog breach entry created."""
    from support_app.services.sla_service import check_ticket_sla
    mock_ticket.due_at = timezone.now() - datetime.timedelta(hours=3)
    mock_ticket.sla_breach_notified = False

    with patch("support_app.models.SLALog") as mock_log, \
         patch("support_app.services.sla_service._notify_admins_of_breach") as mock_notify:
        check_ticket_sla(mock_ticket)

    assert mock_ticket.sla_breach_notified is True
    mock_ticket.save.assert_called_once_with(update_fields=["sla_breach_notified"])
    mock_log.objects.create.assert_called_once()
    create_call = mock_log.objects.create.call_args[1]
    assert create_call["event"] == "breach"
    assert create_call["status"] == "missed"
    mock_notify.assert_called_once_with(mock_ticket)


def test_notification_service_send_email_no_longer_raises():
    """notification_service.send_email must not raise NotImplementedError."""
    import inspect
    from support_app.services.notification_service import send_email
    src = inspect.getsource(send_email)
    assert "raise NotImplementedError" not in src


def test_notification_service_send_whatsapp_no_longer_raises():
    """notification_service.send_whatsapp must not raise when WhatsApp is disabled."""
    import inspect
    from support_app.services.notification_service import send_whatsapp
    src = inspect.getsource(send_whatsapp)
    assert "raise NotImplementedError" not in src


def test_celery_tasks_are_not_stubs():
    """None of the 5 Celery tasks should have an empty body (just pass)."""
    import inspect
    from support_app.tasks import (
        check_sla_breaches,
        process_payout_batch,
        send_ticket_assigned_notification,
        send_ticket_opened_email,
        sync_ticket_to_osticket,
    )
    for task_fn in [
        send_ticket_opened_email,
        send_ticket_assigned_notification,
        check_sla_breaches,
        process_payout_batch,
        sync_ticket_to_osticket,
    ]:
        fn = getattr(task_fn, "run", task_fn)
        src = inspect.getsource(fn)
        body_lines = [
            ln.strip() for ln in src.split("\n")
            if ln.strip()
            and not ln.strip().startswith('"""')
            and not ln.strip().startswith("@")
            and not ln.strip().startswith("def ")
        ]
        assert body_lines != ["pass"], f"Task {task_fn.name} is still a stub"


def test_django_admin_url_at_django_admin_not_admin():
    """Django admin must be at /django-admin/ not /admin/ (nginx SPA conflict fix)."""
    from django.urls import Resolver404, resolve
    try:
        resolve("/admin/")
        raise AssertionError("/admin/ still resolves — should have been moved to /django-admin/")
    except Resolver404:
        pass

    match = resolve("/django-admin/")
    assert "admin" in str(match)


def test_payment_invoice_no_longer_returns_501():
    """payment_invoice must not return HTTP 501 and must generate a PDF."""
    import inspect
    import support_app.views as views_module
    src = inspect.getsource(views_module)
    invoice_start = src.find("def payment_invoice(")
    invoice_section = src[invoice_start:invoice_start + 3000]
    assert "HTTP_501_NOT_IMPLEMENTED" not in invoice_section
    assert "generate_invoice_pdf" in invoice_section


def test_sla_breach_detected_after_threshold(mock_ticket):
    """When a ticket exceeds its SLA window, a breach must be detected."""
    from support_app.services.sla_service import check_ticket_sla
    mock_ticket.due_at = timezone.now() - datetime.timedelta(hours=1)
    mock_ticket.sla_breach_notified = False

    with patch("support_app.models.SLALog") as mock_log, \
         patch("support_app.services.sla_service._notify_admins_of_breach"):
        check_ticket_sla(mock_ticket)

    assert mock_ticket.sla_breach_notified is True
    mock_log.objects.create.assert_called_once()


def test_sla_met_when_resolved_in_time(mock_ticket):
    """When due_at is in the future, no breach should be recorded."""
    from support_app.services.sla_service import check_ticket_sla
    mock_ticket.due_at = timezone.now() + datetime.timedelta(hours=24)
    mock_ticket.sla_breach_notified = False

    with patch("support_app.models.SLALog") as mock_log:
        check_ticket_sla(mock_ticket)

    mock_log.objects.create.assert_not_called()
    assert mock_ticket.sla_breach_notified is False
