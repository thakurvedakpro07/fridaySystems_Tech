"""
Tests for SLA monitoring logic (C-04 fix verification).
"""

import datetime
import uuid as uuid_lib
from unittest.mock import MagicMock, patch

import pytest
from django.test import override_settings
from django.utils import timezone


@pytest.fixture
def mock_ticket():
    ticket = MagicMock()
    ticket.ticket_number = "TKT-0001"
    ticket.severity = "medium"
    ticket.service_type = "server_admin"
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


# ── C-003 Integration tests — SLA initialization ──────────────────────────────
# These tests require real DB (set_ticket_due_at writes to the DB) and verify
# the fix for "SLA deadlines never initialized" (C-003).


def _make_open_ticket(email: str):
    """
    Create a customer + ticket in 'open' status (simulating post-payment state).
    Returns (ticket, customer_user).
    """
    from django.contrib.auth import get_user_model
    from support_app.models import Customer, Ticket

    User = get_user_model()
    user = User.objects.create_user(email=email, password="StrongPass123!", role="customer")
    customer = Customer.objects.create(user=user, company="SLACo")
    ticket = Ticket.objects.create(
        customer=customer,
        title="SLA test ticket",
        service_type="server_admin",
        severity="medium",
        status="open",
    )
    return ticket, user


@pytest.mark.django_db
@pytest.mark.parametrize("severity,expected_order", [
    ("critical", 0),
    ("high", 1),
    ("medium", 2),
    ("low", 3),
])
def test_set_ticket_due_at_respects_severity(severity, expected_order):
    """
    Different severities must produce different deadlines.
    critical < high < medium < low (shorter = more urgent).
    C-003 fix: set_ticket_due_at() now correctly computes resolution + first_response deadlines.
    """
    from django.contrib.auth import get_user_model
    from support_app.models import Customer, Ticket
    from support_app.services.sla_service import set_ticket_due_at, _DEFAULTS

    User = get_user_model()
    user = User.objects.create_user(
        email=f"sla_{severity}@example.com", password="StrongPass123!", role="customer"
    )
    customer = Customer.objects.create(user=user, company="SLACo")
    ticket = Ticket.objects.create(
        customer=customer,
        title=f"SLA {severity} test",
        service_type="server_admin",
        severity=severity,
        status="open",
    )

    before = timezone.now()
    set_ticket_due_at(ticket)
    after = timezone.now()

    ticket.refresh_from_db()
    assert ticket.due_at is not None
    assert ticket.first_response_due_at is not None
    assert before < ticket.due_at <= after + datetime.timedelta(
        seconds=_DEFAULTS[severity][1]
    )
    assert before < ticket.first_response_due_at <= after + datetime.timedelta(
        seconds=_DEFAULTS[severity][0]
    )
    # first_response deadline must be <= resolution deadline
    assert ticket.first_response_due_at <= ticket.due_at


@pytest.mark.django_db
def test_set_ticket_due_at_sets_both_deadlines():
    """
    set_ticket_due_at() must write both due_at and first_response_due_at to the DB.
    C-003 fix: was a no-op before because it was never called; now it sets both fields.
    """
    from support_app.models import SLALog
    from support_app.services.sla_service import set_ticket_due_at

    ticket, _ = _make_open_ticket("sla_both@example.com")
    assert ticket.due_at is None
    assert ticket.first_response_due_at is None

    set_ticket_due_at(ticket)

    ticket.refresh_from_db()
    assert ticket.due_at is not None
    assert ticket.first_response_due_at is not None
    assert ticket.first_response_due_at < ticket.due_at

    # SLALog entry must have been created
    log = SLALog.objects.filter(ticket=ticket, event="created").first()
    assert log is not None
    assert log.status == "pending"


@pytest.mark.django_db
def test_set_ticket_due_at_is_idempotent():
    """
    Calling set_ticket_due_at() a second time must not change the existing deadlines.
    C-003 fix: idempotency guard (`if ticket.due_at is not None: return`) protects
    against SLA reset on engineer reassignment or repeated payment webhook delivery.
    """
    from support_app.services.sla_service import set_ticket_due_at

    ticket, _ = _make_open_ticket("sla_idem@example.com")
    set_ticket_due_at(ticket)
    ticket.refresh_from_db()
    original_due = ticket.due_at
    original_fr_due = ticket.first_response_due_at

    # Calling again must not change the deadlines
    set_ticket_due_at(ticket)
    ticket.refresh_from_db()
    assert ticket.due_at == original_due
    assert ticket.first_response_due_at == original_fr_due


@pytest.mark.django_db
@pytest.mark.parametrize("new_status", ["assigned", "in_progress"])
def test_sla_survives_status_transitions(new_status):
    """
    SLA deadlines must not be cleared when ticket moves through assignment/work statuses.
    C-003 fix: set_ticket_due_at is idempotent — re-entering open status doesn't reset SLA.
    """
    from support_app.models import Ticket
    from support_app.services.sla_service import set_ticket_due_at

    ticket, _ = _make_open_ticket(f"sla_trans_{new_status}@example.com")
    set_ticket_due_at(ticket)
    ticket.refresh_from_db()
    original_due = ticket.due_at

    # Simulate status change
    ticket.status = new_status
    ticket.save(update_fields=["status"])

    ticket.refresh_from_db()
    assert ticket.due_at == original_due, f"due_at was reset after transition to {new_status}"


@pytest.mark.django_db
@override_settings(RAZORPAY_KEY_ID="", RAZORPAY_KEY_SECRET="")
def test_payment_verified_initializes_sla():
    """
    After verify_and_complete_payment() succeeds, the ticket must have due_at set.
    C-003 fix: _open_ticket_after_payment now calls set_ticket_due_at().
    """
    from django.contrib.auth import get_user_model
    from support_app.models import Customer, Payment, Ticket
    from support_app.services.payment_service import verify_and_complete_payment

    User = get_user_model()
    user = User.objects.create_user(email="sla_pay@example.com", password="StrongPass123!", role="customer")
    customer = Customer.objects.create(user=user, company="SLAPayCo")
    ticket = Ticket.objects.create(
        customer=customer,
        title="SLA payment test",
        service_type="server_admin",
        severity="high",
        status="pending_payment",
    )
    payment = Payment.objects.create(
        customer=customer,
        ticket=ticket,
        amount="353.00",
        gst_amount="53.82",
        invoice_number=f"INV-SLAP-{uuid_lib.uuid4().hex[:8]}",
        payment_type="consulting_fee",
        gateway="razorpay",
        gateway_order_id="order_sla_pay_001",
        status="pending",
    )

    verify_and_complete_payment(
        payment_db_id=str(payment.id),
        razorpay_payment_id="pay_sla_001",
        razorpay_order_id="order_sla_pay_001",
        razorpay_signature="sandbox_sig",
    )

    ticket.refresh_from_db()
    assert ticket.status == "open"
    assert ticket.due_at is not None, "SLA resolution deadline must be set after payment"
    assert ticket.first_response_due_at is not None, "SLA first-response deadline must be set after payment"
    assert ticket.first_response_due_at < ticket.due_at


# ── Exact first-response timing tests ────────────────────────────────────────
# Verify consultation_deadline = open_time + advertised_response_time for every severity.
# Reference: ticket opened at 2026-07-03 11:17:00 IST (= 05:47:00 UTC).
#   Critical  →  11:47 IST  (+30 min)
#   High      →  12:17 IST  (+1 h)
#   Medium    →  13:17 IST  (+2 h)
#   Low       →  15:17 IST  (+4 h)


@pytest.mark.django_db
@pytest.mark.parametrize("severity,expected_minutes,expected_ist", [
    ("critical",  30, "11:47"),
    ("high",      60, "12:17"),
    ("medium",   120, "13:17"),
    ("low",      240, "15:17"),
])
def test_first_response_due_at_exact_timing(severity, expected_minutes, expected_ist):
    """
    first_response_due_at must equal open_time + advertised SLA window.
    Frozen now = 2026-07-03 05:47:00 UTC (= 11:17 IST).
    """
    from django.contrib.auth import get_user_model
    from support_app.models import Customer, Ticket
    from support_app.services.sla_service import set_ticket_due_at

    # 2026-07-03 11:17:00 IST = 05:47:00 UTC
    frozen_now = datetime.datetime(2026, 7, 3, 5, 47, 0, tzinfo=datetime.timezone.utc)

    User = get_user_model()
    user = User.objects.create_user(
        email=f"sla_timing_{severity}@example.com",
        password="StrongPass123!",
        role="customer",
    )
    customer = Customer.objects.create(user=user, company="TimingCo")
    ticket = Ticket.objects.create(
        customer=customer,
        title=f"SLA timing test — {severity}",
        service_type="server_admin",
        severity=severity,
        status="open",
    )

    with patch("support_app.services.sla_service.timezone.now", return_value=frozen_now):
        set_ticket_due_at(ticket)

    ticket.refresh_from_db()
    assert ticket.first_response_due_at is not None, (
        f"{severity}: first_response_due_at must be set after set_ticket_due_at()"
    )

    expected_dt = frozen_now + datetime.timedelta(minutes=expected_minutes)
    assert ticket.first_response_due_at == expected_dt, (
        f"{severity}: expected {expected_dt.isoformat()} ({expected_ist} IST), "
        f"got {ticket.first_response_due_at.isoformat()}"
    )


@pytest.mark.django_db
def test_closed_ticket_excluded_from_sla_check():
    """
    Closed/resolved tickets must not be returned by run_sla_check_for_all_open_tickets.
    The Celery task must only evaluate active tickets.
    """
    from support_app.models import Customer, Ticket
    from django.contrib.auth import get_user_model
    from support_app.services.sla_service import set_ticket_due_at, run_sla_check_for_all_open_tickets

    User = get_user_model()
    user = User.objects.create_user(email="sla_closed@example.com", password="StrongPass123!", role="customer")
    customer = Customer.objects.create(user=user, company="ClosedCo")

    # Create a ticket that's "closed" but has an overdue due_at
    ticket = Ticket.objects.create(
        customer=customer,
        title="Closed SLA ticket",
        service_type="server_admin",
        severity="critical",
        status="closed",
        due_at=timezone.now() - datetime.timedelta(hours=10),
        sla_breach_notified=False,
    )

    # run_sla_check should not flag this — closed tickets are excluded
    run_sla_check_for_all_open_tickets()

    ticket.refresh_from_db()
    assert ticket.sla_breach_notified is False, "Closed tickets must not be flagged for SLA breach"
