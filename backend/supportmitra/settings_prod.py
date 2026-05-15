"""
Production settings — imported ON TOP of settings.py on the server.

Usage: set DJANGO_SETTINGS_MODULE=supportmitra.settings_prod
"""
from .settings import *  # noqa: F401, F403 — import everything from base settings

# Enforce authentication on every endpoint in production
REST_FRAMEWORK["DEFAULT_PERMISSION_CLASSES"] = [
    "rest_framework.permissions.IsAuthenticated",
]

# Never show error details to end users
DEBUG = False

# Only serve requests for the real domain
ALLOWED_HOSTS = ["supportmitra.in", "www.supportmitra.in"]

# Django security hardening flags
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000          # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
