"""
Production settings for SupportMitra.

Imported on top of settings.py on the production server.
Usage: DJANGO_SETTINGS_MODULE=supportmitra.settings_prod

Key production differences from dev:
  • DEBUG is off — errors return JSON, not HTML stack traces
  • ALLOWED_HOSTS locked to the real domain
  • SECURE_PROXY_SSL_HEADER set — prevents infinite redirect loop behind Nginx
  • REST API defaults to IsAuthenticated (not AllowAny)
  • Production-grade logging (structured, no debug noise)
"""

from .settings import *  # noqa: F401, F403

# ── Core ──────────────────────────────────────────────────────────────────────
DEBUG = False

# Only accept requests for the real domain.
# Add the VPS internal IP if you use health checks via the private interface.
ALLOWED_HOSTS = [
    "resolvehq.in",
    "www.resolvehq.in",
]

# ── Proxy / SSL ───────────────────────────────────────────────────────────────
# CRITICAL: Django sits behind Nginx which terminates SSL.
# Nginx forwards HTTP on port 8000 but sets X-Forwarded-Proto: https.
# Without this header setting, SECURE_SSL_REDIRECT causes an infinite loop:
#   Browser → HTTPS → Nginx → HTTP:8000 → Django sees HTTP → redirects → loop.
# With this header, Django treats X-Forwarded-Proto=https as a secure request.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
USE_X_FORWARDED_HOST = True

# ── Security flags (safe now that SECURE_PROXY_SSL_HEADER is set) ─────────────
SECURE_SSL_REDIRECT = True               # HTTP → HTTPS redirect (Django-side fallback)
SESSION_COOKIE_SECURE = True             # session cookie only over HTTPS
CSRF_COOKIE_SECURE = True                # CSRF cookie only over HTTPS
CSRF_COOKIE_HTTPONLY = False             # React needs to read the CSRF token
SECURE_HSTS_SECONDS = 31536000          # tell browsers: HTTPS only for 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"

# ── API permissions ───────────────────────────────────────────────────────────
# Enforce authentication on every endpoint in production.
# Dev uses AllowAny so the API browser works without logging in.
REST_FRAMEWORK["DEFAULT_PERMISSION_CLASSES"] = [  # noqa: F405
    "rest_framework.permissions.IsAuthenticated",
]

# ── CORS ──────────────────────────────────────────────────────────────────────
# Override the dev CORS_ALLOW_ALL_ORIGINS = True from base settings.
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = [
    "https://resolvehq.in",
    "https://www.resolvehq.in",
]

# ── Production logging ────────────────────────────────────────────────────────
# Output goes to stdout/stderr so Docker's logging driver captures it.
# Add a container log forwarder (Loki, CloudWatch, etc.) at the infra level
# rather than writing to files inside the container — containers are ephemeral.
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "[{asctime}] {levelname} {name} {process:d} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "WARNING",
    },
    "loggers": {
        "support_app": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "django.request": {
            "handlers": ["console"],
            "level": "WARNING",
            "propagate": False,
        },
        "django.security": {
            "handlers": ["console"],
            "level": "WARNING",
            "propagate": False,
        },
        "celery": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "celery.task": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
    },
}

# ── Sentry (optional — set SENTRY_DSN in prod .env to enable) ────────────────
import logging as _logging  # noqa: E402
import os as _os  # noqa: E402

_SENTRY_DSN = _os.getenv("SENTRY_DSN", "")
_SENTRY_ENVIRONMENT = _os.getenv("SENTRY_ENVIRONMENT", "production")

if _SENTRY_DSN:
    import sentry_sdk  # noqa: E402
    from sentry_sdk.integrations.django import DjangoIntegration  # noqa: E402
    from sentry_sdk.integrations.celery import CeleryIntegration  # noqa: E402

    sentry_sdk.init(
        dsn=_SENTRY_DSN,
        environment=_SENTRY_ENVIRONMENT,
        integrations=[DjangoIntegration(), CeleryIntegration()],
        traces_sample_rate=0.1,   # capture 10% of transactions for performance
        send_default_pii=False,   # never send user PII to Sentry
    )
else:
    # Not fatal (unlike _REQUIRED_PROD_VARS above) — Sentry being unset shouldn't
    # block a production deploy. But it must be loud, not silent: this exact gap
    # (SENTRY_DSN blank, nobody noticing) has already shipped to production once.
    # Uses the stdlib logging default handler directly, since Django's LOGGING
    # dictConfig hasn't been applied yet at settings-module-import time.
    _logging.getLogger("support_app").warning(
        "SENTRY_DSN is not set — running in production with NO error tracking. "
        "Set SENTRY_DSN in backend/.env (see docs/ENVIRONMENT_VARIABLES.md) to fix this."
    )
