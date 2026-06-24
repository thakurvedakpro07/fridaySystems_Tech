"""
Management command: reset_uat

Resets the ResolveHQ database to a clean UAT state.

KEEPS:
  - 6 system demo accounts (*.resolvehq.dev) and their profiles
  - Role definitions, permissions
  - Service catalog (service_catalog.py — code, not DB rows)
  - SLAPolicy and Service model rows (operational config)
  - RoleChangeAudit log (immutable compliance record)

DELETES:
  - All Payouts
  - All Payments
  - All Subscriptions
  - All Notifications
  - All AuditLog entries
  - All Tickets (cascades: comments, activity logs, assignments,
                  attachments, CSAT surveys, SLA logs)
  - All non-system users (email not ending in @resolvehq.dev)
    and their cascaded Customer / Freelancer profiles

Usage:
    python manage.py reset_uat            # preview → confirm → execute
    python manage.py reset_uat --yes      # skip confirmation prompt
    python manage.py reset_uat --dry-run  # preview only, no changes
"""

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

User = get_user_model()

# ── Accounts that survive the reset ──────────────────────────────
KEEP_EMAILS = {
    "admin@resolvehq.dev",
    "ops@resolvehq.dev",
    "finance@resolvehq.dev",
    "support@resolvehq.dev",
    "engineer@resolvehq.dev",
    "customer@resolvehq.dev",
}

ROLE_LABELS = {
    "admin":               "Super Admin",
    "operations_manager":  "Operations Manager",
    "finance_manager":     "Finance Manager",
    "support_agent":       "Support Agent",
    "freelancer":          "Engineer",
    "customer":            "Customer",
}

SEP = "─" * 60


class Command(BaseCommand):
    help = (
        "UAT reset: delete all transactional data while keeping the "
        "6 system demo accounts and operational config."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--yes",
            action="store_true",
            default=False,
            help="Skip the confirmation prompt and execute immediately.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            default=False,
            help="Show what would be deleted without making any changes.",
        )

    # ── Entry point ───────────────────────────────────────────────────

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        skip_confirm = options["yes"]

        self._print_header(dry_run)

        counts = self._collect_counts()
        self._print_preview(counts)

        if dry_run:
            self.stdout.write(
                self.style.WARNING("\n[DRY RUN] No changes were made.\n")
            )
            return

        if not skip_confirm and not self._confirm():
            self.stdout.write(self.style.WARNING("\nAborted — no changes made.\n"))
            return

        self.stdout.write("")
        self._execute_reset(counts)
        self.stdout.write("")
        self._print_verification_report()

    # ── Preview ───────────────────────────────────────────────────────

    def _collect_counts(self):
        """Return a dict of {label: count} for everything that will be deleted."""
        from support_app.models import (
            AuditLog, Customer, Freelancer, Notification, Payment, Payout,
            Subscription, Ticket, TicketActivityLog, TicketAssignment,
            TicketAttachment, TicketComment,
        )
        from django.apps import apps
        CSATSurvey = apps.get_model("support_app", "CSATSurvey")
        SLALog     = apps.get_model("support_app", "SLALog")

        non_system_users = User.objects.exclude(email__in=KEEP_EMAILS)

        return {
            "Payouts":             Payout.objects.count(),
            "Payments":            Payment.objects.count(),
            "Subscriptions":       Subscription.objects.count(),
            "Notifications":       Notification.objects.count(),
            "Audit log entries":   AuditLog.objects.count(),
            "Tickets":             Ticket.objects.count(),
            "  └ Comments":        TicketComment.objects.count(),
            "  └ Activity logs":   TicketActivityLog.objects.count(),
            "  └ Assignments":     TicketAssignment.objects.count(),
            "  └ Attachments":     TicketAttachment.objects.count(),
            "  └ CSAT surveys":    CSATSurvey.objects.count(),
            "  └ SLA logs":        SLALog.objects.count(),
            "Non-system users":    non_system_users.count(),
            "  └ Customer profiles": Customer.objects.exclude(
                user__email__in=KEEP_EMAILS).count(),
            "  └ Engineer profiles": Freelancer.objects.exclude(
                user__email__in=KEEP_EMAILS).count(),
        }

    def _print_preview(self, counts):
        self.stdout.write(f"\n{SEP}")
        self.stdout.write(self.style.MIGRATE_HEADING("  WHAT WILL BE DELETED"))
        self.stdout.write(SEP)
        for label, count in counts.items():
            color = self.style.WARNING if count > 0 else self.style.SUCCESS
            self.stdout.write(f"  {label:<30} {color(str(count))}")

        self.stdout.write(f"\n{SEP}")
        self.stdout.write(self.style.MIGRATE_HEADING("  WHAT WILL BE KEPT"))
        self.stdout.write(SEP)
        for email in sorted(KEEP_EMAILS):
            try:
                u = User.objects.get(email=email)
                label = ROLE_LABELS.get(u.role, u.role)
                self.stdout.write(
                    f"  {self.style.SUCCESS('✓')}  {label:<26}  {email}"
                )
            except User.DoesNotExist:
                self.stdout.write(
                    f"  {self.style.ERROR('✗')}  {'(not found)':<26}  {email}"
                )
        self.stdout.write(SEP)

    # ── Confirmation ──────────────────────────────────────────────────

    def _confirm(self):
        self.stdout.write(
            self.style.WARNING(
                "\n  ⚠  This will permanently delete ALL transactional data.\n"
                "     This is a LOCAL/UAT operation only — never run on production.\n"
            )
        )
        answer = input("  Type 'yes' to continue, anything else to abort: ").strip().lower()
        return answer == "yes"

    # ── Execution ─────────────────────────────────────────────────────

    def _execute_reset(self, counts):
        """Delete everything in dependency-safe order inside one transaction."""
        from support_app.models import (
            AuditLog, Notification, Payment, Payout,
            Subscription, Ticket,
        )
        from django.apps import apps
        CSATSurvey = apps.get_model("support_app", "CSATSurvey")

        with transaction.atomic():
            # 1. Payouts first — PROTECT FK on Ticket and Payment
            n = Payout.objects.count()
            Payout.objects.all().delete()
            self._log_deleted("Payouts", n)

            # 2. Payments — PROTECT FK on Customer
            n = Payment.objects.count()
            Payment.objects.all().delete()
            self._log_deleted("Payments", n)

            # 3. Subscriptions — PROTECT FK on Customer
            n = Subscription.objects.count()
            Subscription.objects.all().delete()
            self._log_deleted("Subscriptions", n)

            # 4. Notifications — CASCADE FK on recipient User, SET_NULL on Ticket
            n = Notification.objects.count()
            Notification.objects.all().delete()
            self._log_deleted("Notifications", n)

            # 5. Audit log
            n = AuditLog.objects.count()
            AuditLog.objects.all().delete()
            self._log_deleted("Audit log entries", n)

            # 6. Tickets — cascades: TicketComment, TicketActivityLog,
            #    TicketAssignment, TicketAttachment, CSATSurvey, SLALog
            n = Ticket.objects.count()
            ticket_detail = {
                "comments":      __import__(
                    "support_app.models", fromlist=["TicketComment"]
                ).TicketComment.objects.count(),
                "activity_logs": __import__(
                    "support_app.models", fromlist=["TicketActivityLog"]
                ).TicketActivityLog.objects.count(),
                "assignments":   __import__(
                    "support_app.models", fromlist=["TicketAssignment"]
                ).TicketAssignment.objects.count(),
                "csat":          CSATSurvey.objects.count(),
            }
            Ticket.objects.all().delete()
            self._log_deleted(
                f"Tickets (+ {ticket_detail['comments']} comments, "
                f"{ticket_detail['activity_logs']} logs, "
                f"{ticket_detail['assignments']} assignments, "
                f"{ticket_detail['csat']} CSAT surveys)",
                n,
            )

            # 7. Non-system users — CASCADE deletes Customer + Freelancer profiles
            non_system = User.objects.exclude(email__in=KEEP_EMAILS)
            n = non_system.count()
            non_system.delete()
            self._log_deleted("Non-system users (+ profiles)", n)

        self.stdout.write(
            self.style.SUCCESS("\n  ✓ Reset complete — all changes committed.\n")
        )

    def _log_deleted(self, label, count):
        if count:
            self.stdout.write(
                f"  {self.style.WARNING('DELETED')}  {label:<55} ({count})"
            )
        else:
            self.stdout.write(
                f"  {self.style.SUCCESS('SKIP')}     {label:<55} (0 rows)"
            )

    # ── Verification report ───────────────────────────────────────────

    def _print_verification_report(self):
        from support_app.models import (
            Customer, Freelancer, Notification, Payment, Payout, Ticket,
        )
        from django.apps import apps
        CSATSurvey = apps.get_model("support_app", "CSATSurvey")

        self.stdout.write(f"{SEP}")
        self.stdout.write(self.style.MIGRATE_HEADING("  POST-RESET VERIFICATION"))
        self.stdout.write(SEP)

        # ── Users by role ─────────────────────────────────────────────
        self.stdout.write(self.style.MIGRATE_HEADING("\n  Users by role:"))
        for email in sorted(KEEP_EMAILS):
            try:
                u = User.objects.get(email=email)
                label = ROLE_LABELS.get(u.role, u.role)
                self.stdout.write(
                    f"    {self.style.SUCCESS('✓')}  {label:<26}  {email}"
                )
            except User.DoesNotExist:
                self.stdout.write(
                    f"    {self.style.ERROR('✗ MISSING')}  {email}"
                )

        extra_users = User.objects.exclude(email__in=KEEP_EMAILS).count()
        extra_label = (
            self.style.SUCCESS("0") if extra_users == 0
            else self.style.ERROR(str(extra_users))
        )
        self.stdout.write(f"\n  Extra (non-system) users: {extra_label}")

        # ── Record counts ─────────────────────────────────────────────
        self.stdout.write(self.style.MIGRATE_HEADING("\n  Record counts (all must be 0):"))

        checks = [
            ("Tickets",             Ticket.objects.count()),
            ("Payments",            Payment.objects.count()),
            ("Payouts",             Payout.objects.count()),
            ("CSAT surveys",        CSATSurvey.objects.count()),
            ("Notifications",       Notification.objects.count()),
            ("Customer profiles",   Customer.objects.exclude(user__email__in=KEEP_EMAILS).count()),
            ("Engineer profiles",   Freelancer.objects.exclude(user__email__in=KEEP_EMAILS).count()),
        ]

        all_clean = True
        for label, count in checks:
            if count == 0:
                marker = self.style.SUCCESS("✓  0")
            else:
                marker = self.style.ERROR(f"✗  {count}  ← NOT CLEAN")
                all_clean = False
            self.stdout.write(f"    {label:<30} {marker}")

        # ── Revenue ───────────────────────────────────────────────────
        from django.db.models import Sum
        revenue = Payment.objects.filter(status="completed").aggregate(
            total=Sum("amount")
        )["total"] or 0
        rev_label = (
            self.style.SUCCESS("₹0") if revenue == 0
            else self.style.ERROR(f"₹{revenue}  ← NOT CLEAN")
        )
        self.stdout.write(f"    {'Revenue (completed payments)':<30} {rev_label}")
        if revenue != 0:
            all_clean = False

        # ── Final verdict ─────────────────────────────────────────────
        self.stdout.write("")
        self.stdout.write(SEP)
        if all_clean:
            self.stdout.write(
                self.style.SUCCESS(
                    "  ✓  CLEAN — system is ready for UAT.\n"
                )
            )
        else:
            self.stdout.write(
                self.style.ERROR(
                    "  ✗  WARNING: some records were not fully cleaned.\n"
                    "     Review the output above and investigate.\n"
                )
            )
        self.stdout.write(SEP)
        self.stdout.write(
            "\n  To reseed demo data:  python manage.py seed_demo_data\n"
            "  To reseed users only: python manage.py seed_demo_users\n"
        )

    # ── Header ────────────────────────────────────────────────────────

    def _print_header(self, dry_run):
        mode = "DRY RUN — NO CHANGES" if dry_run else "UAT DATABASE RESET"
        self.stdout.write(f"\n{'═' * 60}")
        self.stdout.write(
            self.style.MIGRATE_HEADING(f"  ResolveHQ  ·  {mode}")
        )
        self.stdout.write(f"{'═' * 60}")
        if not dry_run:
            self.stdout.write(
                self.style.WARNING(
                    "  LOCAL / DEVELOPMENT USE ONLY — do not run on production."
                )
            )
