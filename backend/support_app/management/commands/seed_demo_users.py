"""
Management command: seed_demo_users

Creates one demo account for every role in the system.
Safe to run multiple times — uses get_or_create so existing accounts are
never overwritten or duplicated.

Usage:
    python manage.py seed_demo_users
    python manage.py seed_demo_users --reset-passwords   # re-set passwords even if users exist
"""

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()

DEMO_USERS = [
    {
        "email":      "admin@resolvehq.dev",
        "password":   "ResolveAdmin1!",
        "first_name": "Super",
        "last_name":  "Admin",
        "role":       "admin",
        "is_staff":   True,
        "is_superuser": True,
        "profile":    None,
    },
    {
        "email":      "ops@resolvehq.dev",
        "password":   "ResolveOps1!",
        "first_name": "Operations",
        "last_name":  "Manager",
        "role":       "operations_manager",
        "is_staff":   False,
        "is_superuser": False,
        "profile":    None,
    },
    {
        "email":      "finance@resolvehq.dev",
        "password":   "ResolveFinance1!",
        "first_name": "Finance",
        "last_name":  "Manager",
        "role":       "finance_manager",
        "is_staff":   False,
        "is_superuser": False,
        "profile":    None,
    },
    {
        "email":      "support@resolvehq.dev",
        "password":   "ResolveSupport1!",
        "first_name": "Support",
        "last_name":  "Agent",
        "role":       "support_agent",
        "is_staff":   False,
        "is_superuser": False,
        "profile":    None,
    },
    {
        "email":      "engineer@resolvehq.dev",
        "password":   "ResolveEngineer1!",
        "first_name": "Demo",
        "last_name":  "Engineer",
        "role":       "freelancer",
        "is_staff":   False,
        "is_superuser": False,
        "profile":    "freelancer",
    },
    {
        "email":      "customer@resolvehq.dev",
        "password":   "ResolveCustomer1!",
        "first_name": "Demo",
        "last_name":  "Customer",
        "role":       "customer",
        "is_staff":   False,
        "is_superuser": False,
        "profile":    "customer",
    },
]

ROLE_LABELS = {
    "admin":               "Super Admin",
    "operations_manager":  "Operations Manager",
    "finance_manager":     "Finance Manager",
    "support_agent":       "Support Agent",
    "freelancer":          "Engineer (Freelancer)",
    "customer":            "Customer",
}


class Command(BaseCommand):
    help = "Seed one demo user account for every role. Safe to run multiple times."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset-passwords",
            action="store_true",
            default=False,
            help="Re-apply the default demo password even if the user already exists.",
        )

    def handle(self, *args, **options):
        from support_app.models import Customer, Freelancer

        reset = options["reset_passwords"]
        created_count = 0
        skipped_count = 0

        self.stdout.write(self.style.MIGRATE_HEADING("\n=== ResolveHQ Demo User Seeder ===\n"))

        for spec in DEMO_USERS:
            email      = spec["email"]
            password   = spec["password"]
            label      = ROLE_LABELS[spec["role"]]

            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    "first_name":   spec["first_name"],
                    "last_name":    spec["last_name"],
                    "role":         spec["role"],
                    "is_staff":     spec["is_staff"],
                    "is_superuser": spec["is_superuser"],
                    "is_active":    True,
                },
            )

            if created:
                user.set_password(password)
                user.save()
                created_count += 1
                status_msg = self.style.SUCCESS("CREATED")
            else:
                if reset:
                    user.set_password(password)
                    user.save()
                    status_msg = self.style.WARNING("UPDATED (password reset)")
                else:
                    status_msg = "EXISTS   (skipped)"
                    skipped_count += 1

            self.stdout.write(f"  {status_msg}  {label:<28} {email}")

            # Create linked profile if required and not yet present
            if spec["profile"] == "customer":
                _, p_created = Customer.objects.get_or_create(
                    user=user,
                    defaults={"company": "Demo Company Pvt Ltd", "phone": "+91-9800000001"},
                )
                if p_created:
                    self.stdout.write(f"    {self.style.SUCCESS('+ Customer profile created')}")

            elif spec["profile"] == "freelancer":
                _, p_created = Freelancer.objects.get_or_create(
                    user=user,
                    defaults={
                        "skills":            "server_admin,aws,database",
                        "availability":      "full_time",
                        "onboarding_status": "approved",
                        "active":            True,
                    },
                )
                if p_created:
                    self.stdout.write(f"    {self.style.SUCCESS('+ Freelancer profile created (approved)')}")

        self.stdout.write("")
        self.stdout.write(
            self.style.MIGRATE_HEADING(
                f"Done. {created_count} created, {skipped_count} already existed."
            )
        )
        if not reset and skipped_count:
            self.stdout.write(
                self.style.WARNING(
                    "  Tip: run with --reset-passwords to restore default passwords.\n"
                )
            )

        self.stdout.write(self.style.MIGRATE_HEADING("\nLogin credentials:\n"))
        for spec in DEMO_USERS:
            label = ROLE_LABELS[spec["role"]]
            self.stdout.write(f"  {label:<28} {spec['email']:<35} {spec['password']}")
        self.stdout.write("")
