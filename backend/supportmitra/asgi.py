"""
ASGI (Asynchronous Server Gateway Interface) entry point.

Needed for future WebSocket support (real-time ticket updates).
Not used at MVP — Gunicorn uses wsgi.py instead.
"""
import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "supportmitra.settings")

application = get_asgi_application()
