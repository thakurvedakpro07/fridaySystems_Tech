import logging
import traceback

from django.http import Http404
from django.core.exceptions import PermissionDenied
from rest_framework import status
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger("support_app")


def custom_exception_handler(exc, context):
    """
    DRF exception handler that normalises all error responses to:
        {"detail": "<human message>", "errors": {...}, "status": <http_code>}

    5xx errors are logged with full tracebacks. 4xx errors are logged as warnings
    so they're visible in dev without flooding production logs.
    """
    # Let DRF convert Http404 / PermissionDenied to its own exceptions first
    if isinstance(exc, Http404):
        from rest_framework.exceptions import NotFound
        exc = NotFound()
    elif isinstance(exc, PermissionDenied):
        from rest_framework.exceptions import PermissionDenied as DRFPermissionDenied
        exc = DRFPermissionDenied()

    response = exception_handler(exc, context)

    if response is not None:
        status_code = response.status_code
        data = response.data

        # Build a consistent shape regardless of what DRF returned
        detail = _extract_detail(data, exc)
        errors = _extract_errors(data)

        # Log 5xx as errors (with traceback), 4xx as warnings (no traceback needed)
        if status_code >= 500:
            view = context.get("view")
            request = context.get("request")
            logger.error(
                "5xx %s on %s %s (view=%s)\n%s",
                status_code,
                getattr(request, "method", "?"),
                getattr(request, "path", "?"),
                view.__class__.__name__ if view else "?",
                traceback.format_exc(),
            )
        elif status_code >= 400:
            request = context.get("request")
            logger.warning(
                "4xx %s on %s %s — %s",
                status_code,
                getattr(request, "method", "?"),
                getattr(request, "path", "?"),
                detail,
            )

        response.data = {"detail": detail, "errors": errors, "status": status_code}
        return response

    # Unhandled exception — DRF returned None, meaning it doesn't know about this exc
    logger.error(
        "Unhandled exception in view %s\n%s",
        context.get("view", "?"),
        traceback.format_exc(),
    )
    return Response(
        {"detail": "An unexpected error occurred.", "errors": {}, "status": 500},
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )


# ── helpers ────────────────────────────────────────────────────

def _extract_detail(data, exc):
    """Return a single human-readable message string."""
    if isinstance(exc, ValidationError):
        # Flatten first validation message to a single string
        errors = data if isinstance(data, dict) else {}
        for field, messages in errors.items():
            if isinstance(messages, list) and messages:
                msg = messages[0]
                return str(msg) if field == "non_field_errors" else f"{field}: {msg}"
            if isinstance(messages, str):
                return f"{field}: {messages}"
        return "Validation error."

    if isinstance(data, dict):
        detail = data.get("detail")
        if detail:
            return str(detail)

    if isinstance(data, list) and data:
        return str(data[0])

    return str(exc) or "An error occurred."


def _extract_errors(data):
    """Return a dict of field → [messages] for validation errors; empty dict otherwise."""
    if not isinstance(data, dict):
        return {}
    # Remove 'detail' — that's already in the top-level key
    return {k: v for k, v in data.items() if k != "detail"}
