"""
Tests for the thread-safe signal actor tracking fix.

Root cause: The previous implementation wrote actor=None in the signal and
patched it afterward with a WHERE actor_id IS NULL filter.  Under concurrent
load, two requests patching the same ticket at the same time could each match
the other's log entry and write the wrong actor.

Fix: The service/view layer sets ``ticket._actor`` (a per-instance Python
attribute) before calling ``ticket.save()``.  The ``log_ticket_changes``
pre_save signal reads it with ``getattr(instance, "_actor", None)`` and writes
the correct actor directly — no post-save patch query is needed.

This is thread-safe because each HTTP request holds its own Ticket Python
object; setting ``_actor`` on it cannot affect any other in-flight request.
"""

import threading
import uuid as uuid_lib

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from support_app.models import (
    Customer,
    Freelancer,
    Payment,
    Ticket,
    TicketActivityLog,
)
from support_app.services.ticket_service import (
    assign_ticket,
    create_ticket,
    unassign_ticket,
    update_status,
)

User = get_user_model()


# ── Shared test helpers ───────────────────────────────────────────

def _make_user(email, role="admin", is_staff=False):
    return User.objects.create_user(
        email=email, password="StrongPass123!", role=role, is_staff=is_staff
    )


def _make_customer(email="cust@signal.test"):
    user = _make_user(email, role="customer")
    Customer.objects.create(user=user, company="Acme")
    return user


def _make_freelancer(email="eng@signal.test"):
    user = _make_user(email, role="freelancer")
    Freelancer.objects.create(user=user, onboarding_status="approved", active=True, skills="linux")
    return user


def _make_ticket(customer_user, status="open"):
    return Ticket.objects.create(
        customer=customer_user.customer_profile,
        title="Test ticket",
        service_type="linux",
        severity="medium",
        status=status,
    )


def _open_ticket(email_suffix=""):
    customer = _make_customer(f"cust_{email_suffix}@signal.test")
    return _make_ticket(customer)


# ── 1. Baseline: single-threaded actor correctness ────────────────

@pytest.mark.django_db
def test_update_status_writes_correct_actor(db):
    """Signal writes the real actor; actor is never None after the fix."""
    customer = _make_customer("baseline@signal.test")
    admin = _make_user("admin_baseline@signal.test", role="admin", is_staff=True)
    ticket = _make_ticket(customer)

    update_status(ticket, "in_progress", actor=admin)

    log = TicketActivityLog.objects.filter(ticket=ticket, action="status_changed").first()
    assert log is not None
    assert log.actor == admin, "actor must be the admin who triggered the change"
    assert log.from_value == "open"
    assert log.to_value == "in_progress"


@pytest.mark.django_db
def test_update_status_note_is_written_by_signal(db):
    """Note from update_status() reaches the log entry via _actor_note."""
    customer = _make_customer("note@signal.test")
    admin = _make_user("admin_note@signal.test", role="admin", is_staff=True)
    ticket = _make_ticket(customer)

    update_status(ticket, "in_progress", actor=admin, note="Starting investigation")

    log = TicketActivityLog.objects.filter(ticket=ticket, action="status_changed").first()
    assert log.note == "Starting investigation"


@pytest.mark.django_db
def test_assign_ticket_signal_has_correct_actor(db):
    """Signal-written status_changed log has the assigning admin's actor."""
    customer = _make_customer("assign_base@signal.test")
    admin = _make_user("admin_assign@signal.test", role="admin", is_staff=True)
    freelancer = _make_freelancer("eng_assign@signal.test")
    ticket = _make_ticket(customer)

    assign_ticket(ticket, freelancer.freelancer_profile, admin)

    status_log = TicketActivityLog.objects.filter(
        ticket=ticket, action="status_changed", to_value="assigned",
    ).first()
    assert status_log is not None
    assert status_log.actor == admin


@pytest.mark.django_db
def test_unassign_ticket_signal_has_correct_actor(db):
    """Signal-written status_changed log has the correct actor when unassigning."""
    customer = _make_customer("unassign_base@signal.test")
    admin = _make_user("admin_unassign@signal.test", role="admin", is_staff=True)
    freelancer = _make_freelancer("eng_unassign@signal.test")
    ticket = _make_ticket(customer)

    assign_ticket(ticket, freelancer.freelancer_profile, admin)
    ticket.refresh_from_db()
    unassign_ticket(ticket, actor=admin, note="unavailable")

    # Find the "open" status_changed log from the unassign
    log = TicketActivityLog.objects.filter(
        ticket=ticket, action="status_changed", to_value="open",
    ).order_by("-created_at").first()
    assert log is not None
    assert log.actor == admin


# ── 2. No duplicate log entries ───────────────────────────────────

@pytest.mark.django_db
def test_update_status_produces_exactly_one_log_entry(db):
    """
    After the fix, only the signal writes the log — no explicit duplicate.
    Exactly one status_changed entry per transition.
    """
    customer = _make_customer("nodup@signal.test")
    admin = _make_user("admin_nodup@signal.test", role="admin", is_staff=True)
    ticket = _make_ticket(customer)

    update_status(ticket, "in_progress", actor=admin)

    logs = TicketActivityLog.objects.filter(ticket=ticket, action="status_changed")
    assert logs.count() == 1, f"Expected 1 log, got {logs.count()}"


@pytest.mark.django_db
def test_payment_confirm_produces_exactly_one_log_entry(db):
    """
    admin_payment_confirm should produce exactly one status_changed log entry
    via the signal — the previously-duplicated explicit create is gone.
    """
    from support_app.models import Payment as _Payment

    customer = _make_customer("conf_nodup@signal.test")
    admin = _make_user("admin_conf@signal.test", role="admin", is_staff=True)
    admin.is_staff = True
    admin.save()

    ticket = Ticket.objects.create(
        customer=customer.customer_profile,
        title="Dup test ticket",
        service_type="linux",
        severity="low",
        status="pending_payment",
    )
    payment = _Payment.objects.create(
        customer=customer.customer_profile,
        ticket=ticket,
        amount="299.00",
        gst_amount="53.82",
        invoice_number=f"INV-DUP-{uuid_lib.uuid4().hex[:8]}",
        payment_type="consulting_fee",
        gateway="razorpay",
        status="pending",
    )

    client = APIClient()
    client.force_authenticate(user=admin)
    response = client.post(f"/api/admin/payments/{payment.id}/confirm/")

    assert response.status_code == 200
    ticket.refresh_from_db()
    assert ticket.status == "open"

    logs = TicketActivityLog.objects.filter(ticket=ticket, action="status_changed")
    assert logs.count() == 1, (
        f"Expected exactly 1 status_changed log, got {logs.count()}. "
        "Possible duplicate from old explicit TicketActivityLog.create()."
    )
    assert logs.first().actor == admin


@pytest.mark.django_db
def test_ops_payment_confirm_writes_actor_via_signal(db):
    """ops_payment_confirm now writes actor through _actor attribute on ticket."""
    from support_app.models import Payment as _Payment

    customer = _make_customer("ops_conf@signal.test")
    # ops confirm endpoint requires finance_manager (is_staff=False) or super admin
    ops_user = _make_user("ops@signal.test", role="finance_manager", is_staff=False)

    ticket = Ticket.objects.create(
        customer=customer.customer_profile,
        title="Ops confirm test",
        service_type="linux",
        severity="low",
        status="pending_payment",
    )
    payment = _Payment.objects.create(
        customer=customer.customer_profile,
        ticket=ticket,
        amount="299.00",
        gst_amount="53.82",
        invoice_number=f"INV-OPS-{uuid_lib.uuid4().hex[:8]}",
        payment_type="consulting_fee",
        gateway="razorpay",
        status="pending",
    )

    client = APIClient()
    client.force_authenticate(user=ops_user)
    response = client.post(f"/api/ops/payments/{payment.id}/confirm/")

    assert response.status_code == 200
    log = TicketActivityLog.objects.filter(ticket=ticket, action="status_changed").first()
    assert log is not None
    assert log.actor == ops_user


# ── 3. Celery / system saves produce actor=None ───────────────────

@pytest.mark.django_db
def test_system_save_without_actor_sets_none(db):
    """
    Saving a ticket without setting _actor (e.g. from a Celery task or the
    Django shell) correctly produces actor=None — not an arbitrary request's user.
    """
    customer = _make_customer("celery@signal.test")
    ticket = _make_ticket(customer)

    # Simulate what a Celery task does: status change with no actor context
    ticket.status = "in_progress"
    ticket.save(update_fields=["status", "updated_at"])

    log = TicketActivityLog.objects.filter(ticket=ticket, action="status_changed").first()
    assert log is not None
    assert log.actor is None, "System-triggered saves must record actor=None"


# ── 4. All role types tracked correctly ──────────────────────────

@pytest.mark.django_db
@pytest.mark.parametrize("role,is_staff", [
    ("admin",               True),
    ("operations_manager",  True),
    ("finance_manager",     False),
    ("support_agent",       False),
])
def test_all_staff_roles_captured_as_actor(db, role, is_staff):
    """Every internal staff role is correctly captured as actor in the log."""
    suffix = f"{role.replace('_', '')}@signal.test"
    customer = _make_customer(f"cust_{suffix}")
    staff_user = _make_user(f"staff_{suffix}", role=role, is_staff=is_staff)
    ticket = _make_ticket(customer)

    update_status(ticket, "in_progress", actor=staff_user)

    log = TicketActivityLog.objects.filter(ticket=ticket, action="status_changed").first()
    assert log is not None
    assert log.actor == staff_user, f"Expected actor={staff_user.email}, got {log.actor}"


@pytest.mark.django_db
def test_freelancer_as_actor(db):
    """Freelancer updating their own ticket status is recorded correctly."""
    customer = _make_customer("cust_fl_actor@signal.test")
    freelancer = _make_freelancer("fl_actor@signal.test")
    admin = _make_user("admin_fl_actor@signal.test", is_staff=True)
    ticket = _make_ticket(customer)
    assign_ticket(ticket, freelancer.freelancer_profile, admin)
    ticket.refresh_from_db()

    update_status(ticket, "in_progress", actor=freelancer)

    log = TicketActivityLog.objects.filter(
        ticket=ticket, action="status_changed", to_value="in_progress"
    ).first()
    assert log is not None
    assert log.actor == freelancer


@pytest.mark.django_db
def test_customer_actor_on_ticket_creation(db):
    """Ticket creation log records the customer as actor."""
    customer = _make_customer("cust_creation@signal.test")
    ticket = create_ticket(
        customer=customer.customer_profile,
        validated_data={"title": "Actor test", "service_type": "linux", "severity": "low"},
    )
    log = TicketActivityLog.objects.filter(ticket=ticket, action="created").first()
    assert log is not None
    assert log.actor == customer


# ── 5. Severity change via API captures actor ────────────────────

@pytest.mark.django_db
def test_severity_patch_via_api_captures_actor(db):
    """
    PATCH /api/tickets/{id}/ with a severity change records the correct actor
    via TicketDetailView.perform_update() → ticket._actor = request.user.
    """
    customer = _make_customer("sev_patch@signal.test")
    ticket = _make_ticket(customer, status="pending_payment")

    client = APIClient()
    client.force_authenticate(user=customer)
    response = client.patch(
        f"/api/tickets/{ticket.id}/",
        {"severity": "high"},
        format="json",
    )

    assert response.status_code == 200
    log = TicketActivityLog.objects.filter(ticket=ticket, action="severity_changed").first()
    assert log is not None
    assert log.actor == customer
    assert log.from_value == "medium"
    assert log.to_value == "high"


# ── 6. Concurrent requests: no cross-contamination ───────────────

@pytest.mark.django_db(transaction=True)
def test_concurrent_status_changes_have_correct_actors():
    """
    Two threads simultaneously change two DIFFERENT tickets' status.
    Each log entry must reference the actor from its own request — no swapping.

    This test proves that per-instance _actor is thread-safe: Thread A's actor
    cannot pollute Thread B's log and vice versa.
    """
    customer_a = _make_customer("conc_a@signal.test")
    customer_b = _make_customer("conc_b@signal.test")
    admin_a = _make_user("admin_conc_a@signal.test", is_staff=True)
    admin_b = _make_user("admin_conc_b@signal.test", is_staff=True)
    ticket_a = _make_ticket(customer_a)
    ticket_b = _make_ticket(customer_b)

    errors = []
    barrier = threading.Barrier(2)

    def change_a():
        try:
            barrier.wait()  # synchronise both threads to start together
            update_status(ticket_a, "in_progress", actor=admin_a)
        except Exception as exc:
            errors.append(exc)

    def change_b():
        try:
            barrier.wait()
            update_status(ticket_b, "in_progress", actor=admin_b)
        except Exception as exc:
            errors.append(exc)

    t1 = threading.Thread(target=change_a)
    t2 = threading.Thread(target=change_b)
    t1.start()
    t2.start()
    t1.join(timeout=10)
    t2.join(timeout=10)

    assert not errors, f"Thread raised exception: {errors}"

    log_a = TicketActivityLog.objects.filter(ticket=ticket_a, action="status_changed").first()
    log_b = TicketActivityLog.objects.filter(ticket=ticket_b, action="status_changed").first()

    assert log_a is not None
    assert log_b is not None
    assert log_a.actor == admin_a, f"Ticket A log actor wrong: {log_a.actor}"
    assert log_b.actor == admin_b, f"Ticket B log actor wrong: {log_b.actor}"
    assert log_a.actor != log_b.actor, "Actors must not be swapped between threads"


@pytest.mark.django_db(transaction=True)
def test_concurrent_same_ticket_different_users_no_actor_swap():
    """
    Two threads race to change the SAME ticket's status (unlikely but possible
    in the admin UI if an admin double-submits). Each thread's own log entry
    should have its own actor.

    With the old patch approach, one thread's patch could update both log rows.
    With the new _actor approach, each row is written correctly on insert.
    """
    customer = _make_customer("race_same@signal.test")
    admin_x = _make_user("admin_x@signal.test", is_staff=True)
    admin_y = _make_user("admin_y@signal.test", is_staff=True)
    ticket = _make_ticket(customer)

    errors = []
    logs_written = []
    barrier = threading.Barrier(2)

    def change_x():
        try:
            # Each thread fetches its own ticket object — thread-local ownership
            t = Ticket.objects.get(pk=ticket.pk)
            barrier.wait()
            try:
                update_status(t, "in_progress", actor=admin_x)
            except Exception:
                pass  # second writer may fail on closed-ticket or DB constraint
        except Exception as exc:
            errors.append(exc)

    def change_y():
        try:
            t = Ticket.objects.get(pk=ticket.pk)
            barrier.wait()
            try:
                update_status(t, "in_progress", actor=admin_y)
            except Exception:
                pass
        except Exception as exc:
            errors.append(exc)

    t1 = threading.Thread(target=change_x)
    t2 = threading.Thread(target=change_y)
    t1.start()
    t2.start()
    t1.join(timeout=10)
    t2.join(timeout=10)

    assert not errors, f"Setup raised exception: {errors}"

    logs = list(
        TicketActivityLog.objects.filter(ticket=ticket, action="status_changed")
        .select_related("actor")
        .order_by("created_at")
    )
    # Each log that was written must reference a known admin — no None or wrong actor
    for log in logs:
        assert log.actor in (admin_x, admin_y), (
            f"Log actor {log.actor} is not one of the expected admins"
        )


# ── 7. Transaction rollback: log not left behind ─────────────────

@pytest.mark.django_db(transaction=True)
def test_rollback_does_not_leave_orphan_log():
    """
    If the transaction wrapping ticket.save() is rolled back, the
    TicketActivityLog row written by the signal must also be rolled back —
    because the signal runs inside the same DB transaction as the save.
    """
    from django.db import transaction as _tx
    from unittest.mock import patch

    customer = _make_customer("rollback@signal.test")
    admin = _make_user("admin_rollback@signal.test", is_staff=True)
    ticket = _make_ticket(customer)
    initial_log_count = TicketActivityLog.objects.filter(ticket=ticket).count()

    try:
        with _tx.atomic():
            ticket._actor = admin
            ticket.status = "in_progress"
            ticket.save(update_fields=["status", "updated_at"])
            # Signal fires here → creates TicketActivityLog inside this transaction
            mid_count = TicketActivityLog.objects.filter(ticket=ticket).count()
            assert mid_count == initial_log_count + 1, "Log should exist mid-transaction"
            raise RuntimeError("Force rollback")
    except RuntimeError:
        pass

    final_count = TicketActivityLog.objects.filter(ticket=ticket).count()
    assert final_count == initial_log_count, (
        "Rolled-back transaction must not leave orphan TicketActivityLog rows"
    )
    ticket.refresh_from_db()
    assert ticket.status == "open", "Ticket status must also be rolled back"


# ── 8. Webhook ticket-open: actor=None is correct ────────────────

@pytest.mark.django_db
def test_webhook_ticket_open_records_actor_none(db):
    """
    When the Razorpay webhook opens a ticket, actor should be None (system action).
    The _open_ticket_after_payment function passes actor=None for webhook calls.
    """
    from support_app.models import Payment as _Payment
    from support_app.services.payment_service import _open_ticket_after_payment

    customer = _make_customer("webhook_actor@signal.test")
    ticket = Ticket.objects.create(
        customer=customer.customer_profile,
        title="Webhook test",
        service_type="linux",
        severity="low",
        status="pending_payment",
    )
    inv_num = f"INV-WA-{uuid_lib.uuid4().hex[:8]}"
    payment = _Payment.objects.create(
        customer=customer.customer_profile,
        ticket=ticket,
        amount="299.00",
        gst_amount="53.82",
        invoice_number=inv_num,
        payment_type="consulting_fee",
        gateway="razorpay",
        status="completed",
    )
    # Refresh so amount/gst_amount are Decimal objects (not strings) for arithmetic
    payment.refresh_from_db()

    _open_ticket_after_payment(
        payment, actor=None, note=f"Payment {inv_num} confirmed via webhook"
    )

    log = TicketActivityLog.objects.filter(ticket=ticket, action="status_changed").first()
    assert log is not None
    assert log.actor is None, "Webhook-triggered log must have actor=None"
    assert log.note == f"Payment {inv_num} confirmed via webhook"
    assert log.to_value == "open"


# ── 9. Resolution-fee confirm writes correct actor ───────────────

@pytest.mark.django_db
def test_resolution_confirm_log_has_correct_actor_and_note(db):
    """
    Confirming a resolution fee payment closes the ticket (resolved → closed)
    with the correct actor and note written by the signal.
    """
    from support_app.services.payment_service import verify_resolution_payment_service

    customer = _make_customer("res_confirm@signal.test")
    admin = _make_user("admin_res@signal.test", is_staff=True)

    # No freelancer assignment — skips payout creation code path
    ticket = Ticket.objects.create(
        customer=customer.customer_profile,
        title="Resolution confirm test",
        service_type="linux",
        severity="low",
        status="resolved",
    )
    from support_app.models import Payment as _Payment
    payment = _Payment.objects.create(
        customer=customer.customer_profile,
        ticket=ticket,
        amount="499.00",
        gst_amount="89.82",
        invoice_number=f"INV-RC-{uuid_lib.uuid4().hex[:8]}",
        payment_type="resolution_fee",
        gateway="razorpay",
        gateway_payment_id="pay_res_test",
        gateway_order_id="order_res_test",
        status="pending",
    )
    inv_number = payment.invoice_number

    # Disable live-mode signature verification (RAZORPAY_KEY_ID="" → sandbox path)
    from django.test import override_settings

    # Signature: (ticket, payment_db_id, razorpay_payment_id, razorpay_order_id,
    #              razorpay_signature, score, comment, actor)
    with override_settings(RAZORPAY_KEY_ID=""):
        verify_resolution_payment_service(
            ticket,
            payment.id,
            "pay_res_test",
            "order_res_test",
            "ignored_in_sandbox",
            5,
            "Great job",
            admin,
        )

    log = TicketActivityLog.objects.filter(ticket=ticket, action="closed").first()
    assert log is not None
    assert log.actor == admin
    assert inv_number in log.note

    # Only ONE "closed" log entry (not two)
    closed_count = TicketActivityLog.objects.filter(ticket=ticket, action="closed").count()
    assert closed_count == 1, f"Expected 1 closed log, got {closed_count}"
