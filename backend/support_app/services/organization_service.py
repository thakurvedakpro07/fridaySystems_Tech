"""
Organization creation helper — kept out of serializers/views per the
"views are thin" rule (see views.py's module docstring).
"""
from django.utils.text import slugify

from ..models import Organization, OrganizationMembership


def create_organization_for_customer(user, company_name: str) -> Organization:
    """
    Called once, at registration, for every new Customer. Creates a fresh
    Organization named after their company (or a fallback derived from
    their email) and makes them its org_admin — mirrors migration 0029's
    backfill logic for pre-existing customers, so a customer's "first
    organization" looks the same regardless of when their account was
    created.
    """
    base_name = company_name.strip() or f"{user.email.split('@')[0]}'s Organization"
    base_slug = slugify(base_name) or "organization"
    slug = base_slug
    suffix = 1
    while Organization.objects.filter(slug=slug).exists():
        suffix += 1
        slug = f"{base_slug}-{suffix}"

    org = Organization.objects.create(name=base_name, slug=slug)
    OrganizationMembership.objects.create(organization=org, user=user, role="org_admin")
    return org
