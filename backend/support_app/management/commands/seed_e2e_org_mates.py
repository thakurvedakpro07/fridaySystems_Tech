"""
Management command: seed_e2e_org_mates

Seeds two extra customer accounts needed only by
frontend/tests/e2e/ticket-authorization.spec.js: two real ticket-owning
Customers that share one Organization (org-mates) — a scenario the normal
self-service flows can't produce today (registration always creates a
brand-new Organization per customer; the org-invite-accept flow only adds
an OrganizationMembership, never touches Customer.organization — see
services/organization_service.py). The spec's cross-organization scenario
reuses the already-seeded customer@resolvehq.dev account (its own,
separate, auto-created Organization) rather than needing a third account
here. Safe to run multiple times (get_or_create).

Usage:
    python manage.py seed_e2e_org_mates
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()

PASSWORD = "ResolveOrgMate1!"


class Command(BaseCommand):
    help = "Seed org-mate/cross-org test accounts for the ticket-authorization Playwright spec."

    def handle(self, *args, **options):
        from support_app.models import Customer, Organization, OrganizationMembership

        org, _ = Organization.objects.get_or_create(
            slug="e2e-org-mates-co", defaults={"name": "E2E Org Mates Co"},
        )

        def _seed(email, first_name, organization, org_role):
            user, created = User.objects.get_or_create(
                email=email,
                defaults={"first_name": first_name, "last_name": "E2E", "role": "customer", "is_active": True},
            )
            if created:
                user.set_password(PASSWORD)
                user.save()
            customer, _ = Customer.objects.get_or_create(
                user=user, defaults={"company": organization.name, "organization": organization},
            )
            if customer.organization_id != organization.id:
                customer.organization = organization
                customer.save(update_fields=["organization"])
            OrganizationMembership.objects.get_or_create(
                organization=organization, user=user, defaults={"role": org_role},
            )
            status = "CREATED" if created else "EXISTS "
            self.stdout.write(f"  {status}  {email}")

        self.stdout.write(self.style.MIGRATE_HEADING("\n=== E2E Org-Mate Seeder ===\n"))
        _seed("org-mate-a@resolvehq.dev", "Org Mate A", org, "org_admin")
        _seed("org-mate-b@resolvehq.dev", "Org Mate B", org, "org_member")
        self.stdout.write(f"\n  Password for both: {PASSWORD}\n")
