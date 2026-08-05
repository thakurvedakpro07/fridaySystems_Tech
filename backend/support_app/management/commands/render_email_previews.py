"""
Management command: render_email_previews

Renders every transactional email template to a standalone static HTML file
using realistic dummy context (matching the shape each email_service.py
send_*() function actually passes), so the redesigned templates can be
reviewed/screenshotted without sending real email or touching the database.

Dev tooling only — does not send email, does not touch SMTP/Celery/tokens.

Usage:
    python manage.py render_email_previews --out /path/to/output/dir
"""

import os

from django.conf import settings
from django.core.management.base import BaseCommand
from django.template.loader import render_to_string


def _context(extra: dict, template: str = None) -> dict:
    base = {
        "app_url": getattr(settings, "APP_URL", "http://localhost:5173"),
        "support_email": getattr(settings, "BUSINESS_SUPPORT_EMAIL", "") or settings.DEFAULT_FROM_EMAIL,
        "_template": template,
    }
    base.update(extra)
    return base


EMAILS = {
    "welcome": _context({"email": "priya.sharma@example.in"}),
    "verify_email": _context({
        "email": "priya.sharma@example.in",
        "verify_url": "http://localhost:5173/verify-email?uid=MQ&token=abc123",
    }),
    "password_reset": _context({
        "email": "priya.sharma@example.in",
        "reset_url": "http://localhost:5173/reset-password?uid=MQ&token=abc123",
        "requested_at": "29 Jul 2026, 03:41 PM IST",
    }),
    "ticket_created": _context({
        "email": "priya.sharma@example.in",
        "ticket_number": "TKT-20260729-0042",
        "ticket_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "title": "Windows Server won't boot after patch",
        "service_type": "Windows Server Support",
        "severity": "High",
    }),
    "ticket_assigned": _context({
        "email": "priya.sharma@example.in",
        "ticket_number": "TKT-20260729-0042",
        "ticket_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "engineer_email": "arjun.rao@resolvehq.in",
    }),
    "ticket_resolved": _context({
        "email": "priya.sharma@example.in",
        "ticket_number": "TKT-20260729-0042",
        "ticket_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "title": "Windows Server won't boot after patch",
    }),
    "comment_added": _context({
        "email": "priya.sharma@example.in",
        "ticket_number": "TKT-20260729-0042",
        "ticket_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "commenter_email": "arjun.rao@resolvehq.in",
        "comment_preview": "I've rolled back the last Windows Update and the server is booting normally now. Can you confirm you're back up on your end?",
    }),
    "resolution_rejected": _context({
        "email": "arjun.rao@resolvehq.in",
        "ticket_number": "TKT-20260729-0042",
        "ticket_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "title": "Windows Server won't boot after patch",
        "customer_email": "priya.sharma@example.in",
        "note": "Server booted, but the print spooler service is still failing to start.",
    }),
    "organization_invitation": _context({
        "email": "invitee@example.in",
        "organization_name": "Sharma Textiles Pvt Ltd",
        "invited_by_email": "priya.sharma@example.in",
        "role": "Organization Admin",
        "accept_url": "http://localhost:5173/invitations/abcdef1234567890",
    }),
    "staff_invitation_engineer": _context({
        "email": "invitee@example.in",
        "invited_by_email": "priya.sharma@resolvehq.in",
        "role": "Engineer",
        "accept_url": "http://localhost:5173/staff-invitations/abcdef1234567890",
    }, template="staff_invitation"),
    "staff_invitation_admin": _context({
        "email": "invitee@example.in",
        "invited_by_email": "priya.sharma@resolvehq.in",
        "role": "Super Admin",
        "accept_url": "http://localhost:5173/staff-invitations/abcdef1234567890",
    }, template="staff_invitation"),
}


class Command(BaseCommand):
    help = "Render every transactional email template to static HTML for preview/screenshotting."

    def add_arguments(self, parser):
        parser.add_argument("--out", required=True, help="Output directory for rendered .html files")

    def handle(self, *args, **options):
        out_dir = options["out"]
        os.makedirs(out_dir, exist_ok=True)

        for name, context in EMAILS.items():
            template_name = context.pop("_template", None) or name
            html = render_to_string(f"email/{template_name}.html", context)
            out_path = os.path.join(out_dir, f"{name}.html")
            with open(out_path, "w") as f:
                f.write(html)
            self.stdout.write(self.style.SUCCESS(f"Rendered {out_path}"))
