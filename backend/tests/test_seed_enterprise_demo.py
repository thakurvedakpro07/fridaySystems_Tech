"""
Tests for the seed_enterprise_demo management command: runs cleanly,
--flush is idempotent, signals are reconnected even on a mid-run failure,
and generated data passes basic integrity checks.
"""

import pytest
from django.core.management import call_command
from django.db.models.signals import post_save, pre_save

from support_app import signals as app_signals
from support_app.models import Payment, Ticket


@pytest.mark.django_db
def test_seed_runs_cleanly_at_small_scale():
    call_command("seed_enterprise_demo", scale="small")

    assert Ticket.objects.filter(customer__user__email__endswith="@entdemo.local").count() >= 150
    assert Payment.objects.filter(invoice_number__startswith="INV-ENT-").exists()


@pytest.mark.django_db
def test_flush_is_idempotent():
    call_command("seed_enterprise_demo", scale="small")
    first_count = Ticket.objects.filter(customer__user__email__endswith="@entdemo.local").count()

    call_command("seed_enterprise_demo", scale="small", flush=True)
    second_count = Ticket.objects.filter(customer__user__email__endswith="@entdemo.local").count()

    # Fixed random seed → same volume regenerated, no duplicate-key errors.
    assert second_count == first_count


@pytest.mark.django_db
def test_signals_reconnected_after_success():
    call_command("seed_enterprise_demo", scale="small")

    receivers = pre_save._live_receivers(sender=Ticket)
    assert app_signals.log_ticket_changes in receivers
    post_receivers = post_save._live_receivers(sender=Ticket)
    assert app_signals.log_ticket_created in post_receivers


@pytest.mark.django_db
def test_signals_reconnected_after_mid_run_failure(monkeypatch):
    from support_app.management.commands.seed_enterprise_demo import Command

    def _boom(self, *args, **kwargs):
        raise RuntimeError("simulated failure mid-seed")

    monkeypatch.setattr(Command, "_seed_tickets", _boom)

    with pytest.raises(RuntimeError):
        call_command("seed_enterprise_demo", scale="small")

    receivers = pre_save._live_receivers(sender=Ticket)
    assert app_signals.log_ticket_changes in receivers
    post_receivers = post_save._live_receivers(sender=Ticket)
    assert app_signals.log_ticket_created in post_receivers


@pytest.mark.django_db
def test_no_pending_payment_ticket_has_resolved_at():
    call_command("seed_enterprise_demo", scale="small")

    bad = Ticket.objects.filter(
        customer__user__email__endswith="@entdemo.local",
        status="pending_payment",
        resolved_at__isnull=False,
    )
    assert not bad.exists()


@pytest.mark.django_db
def test_invoice_numbers_are_unique():
    call_command("seed_enterprise_demo", scale="small")

    invoice_numbers = list(
        Payment.objects.filter(invoice_number__startswith="INV-ENT-").values_list("invoice_number", flat=True)
    )
    assert len(invoice_numbers) == len(set(invoice_numbers))


@pytest.mark.django_db
def test_flush_removes_only_entdemo_data(django_user_model):
    from support_app.models import Customer

    other = django_user_model.objects.create_user(
        email="untouched@resolvehq.dev", password="Pass123!", role="customer",
    )
    Customer.objects.create(user=other, company="Should Survive")

    call_command("seed_enterprise_demo", scale="small")
    call_command("seed_enterprise_demo", scale="small", flush=True)

    assert django_user_model.objects.filter(email="untouched@resolvehq.dev").exists()
