"""
Email service for ResolveHQ.

Uses Django's built-in email framework:
  - Development: console backend (prints to terminal) — set by DEBUG=1 in settings
  - Production:  SMTP backend via settings.EMAIL_BACKEND

All public functions are safe to call unconditionally — they silently log
errors rather than raising exceptions, so a broken email config never
breaks a ticket action.

Usage:
    from .services.email_service import send_welcome, send_ticket_created
    send_welcome(user)
    send_ticket_created(ticket)
"""

import logging

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.html import strip_tags

logger = logging.getLogger(__name__)

APP_URL = getattr(settings, "APP_URL", "http://localhost:5173")


def _send(to: str, subject: str, template: str, context: dict) -> None:
    """Render an HTML template and send as a multi-part email."""
    try:
        context.setdefault("app_url", APP_URL)
        html_body  = render_to_string(template, context)
        plain_body = strip_tags(html_body)
        msg = EmailMultiAlternatives(
            subject=subject,
            body=plain_body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[to],
        )
        msg.attach_alternative(html_body, "text/html")
        msg.send(fail_silently=False)
    except Exception:
        logger.exception("Failed to send email '%s' to %s", subject, to)


def send_welcome(user) -> None:
    """Send a welcome email after successful registration."""
    _send(
        to=user.email,
        subject="Welcome to ResolveHQ 🎉",
        template="email/welcome.html",
        context={"email": user.email},
    )


def send_ticket_created(ticket) -> None:
    """Notify the customer that their ticket was successfully submitted."""
    _send(
        to=ticket.customer.user.email,
        subject=f"[{ticket.ticket_number}] Ticket received — ResolveHQ",
        template="email/ticket_created.html",
        context={
            "email": ticket.customer.user.email,
            "ticket_number": ticket.ticket_number,
            "ticket_id": str(ticket.id),
            "title": ticket.title,
            "service_type": ticket.get_service_type_display(),
            "severity": ticket.severity,
        },
    )


def send_ticket_assigned(ticket) -> None:
    """Notify the customer that an engineer has been assigned to their ticket."""
    if not ticket.assigned_to:
        return
    _send(
        to=ticket.customer.user.email,
        subject=f"[{ticket.ticket_number}] Engineer assigned — ResolveHQ",
        template="email/ticket_assigned.html",
        context={
            "email": ticket.customer.user.email,
            "ticket_number": ticket.ticket_number,
            "ticket_id": str(ticket.id),
            "engineer_email": ticket.assigned_to.user.email,
        },
    )


def send_ticket_resolved(ticket) -> None:
    """Notify the customer that their ticket has been resolved."""
    _send(
        to=ticket.customer.user.email,
        subject=f"[{ticket.ticket_number}] Your ticket has been resolved — ResolveHQ",
        template="email/ticket_resolved.html",
        context={
            "email": ticket.customer.user.email,
            "ticket_number": ticket.ticket_number,
            "ticket_id": str(ticket.id),
            "title": ticket.title,
        },
    )


def send_comment_notification(ticket, comment, recipient_user) -> None:
    """Notify a ticket participant that a new (public) comment was added."""
    if comment.is_internal:
        return
    preview = comment.body[:200] + ("…" if len(comment.body) > 200 else "")
    _send(
        to=recipient_user.email,
        subject=f"[{ticket.ticket_number}] New reply — ResolveHQ",
        template="email/comment_added.html",
        context={
            "email": recipient_user.email,
            "ticket_number": ticket.ticket_number,
            "ticket_id": str(ticket.id),
            "commenter_email": comment.author.email if comment.author else "Support Team",
            "comment_preview": preview,
        },
    )


def send_resolution_rejected(ticket, note: str = "") -> None:
    """Notify the assigned engineer that the customer rejected the resolution."""
    if not ticket.assigned_to:
        return
    _send(
        to=ticket.assigned_to.user.email,
        subject=f"[{ticket.ticket_number}] Resolution rejected — customer needs more help",
        template="email/resolution_rejected.html",
        context={
            "email": ticket.assigned_to.user.email,
            "ticket_number": ticket.ticket_number,
            "ticket_id": str(ticket.id),
            "title": ticket.title,
            "customer_email": ticket.customer.user.email,
            "note": note,
        },
    )


def send_verification_email(user) -> None:
    """Send an email verification link after registration."""
    from django.contrib.auth.tokens import default_token_generator
    from django.utils.http import urlsafe_base64_encode
    from django.utils.encoding import force_bytes
    uid = urlsafe_base64_encode(force_bytes(str(user.pk)))
    token = default_token_generator.make_token(user)
    verify_url = f"{APP_URL}/verify-email?uid={uid}&token={token}"
    _send(
        to=user.email,
        subject="Verify your ResolveHQ email address",
        template="email/verify_email.html",
        context={"email": user.email, "verify_url": verify_url},
    )


def send_organization_invitation(invitation) -> None:
    """Send an organization invitation email with an accept link."""
    accept_url = f"{APP_URL}/invitations/{invitation.token}"
    _send(
        to=invitation.email,
        subject=f"You've been invited to join {invitation.organization.name} on ResolveHQ",
        template="email/organization_invitation.html",
        context={
            "email": invitation.email,
            "organization_name": invitation.organization.name,
            "invited_by_email": invitation.invited_by.email if invitation.invited_by else "A team member",
            "role": invitation.get_role_display(),
            "accept_url": accept_url,
        },
    )


def send_password_reset_email(user, uid: str, token: str) -> None:
    """Send a password reset link."""
    reset_url = f"{APP_URL}/reset-password?uid={uid}&token={token}"
    _send(
        to=user.email,
        subject="Reset your ResolveHQ password",
        template="email/password_reset.html",
        context={"email": user.email, "reset_url": reset_url},
    )
