"""
WSGI (Web Server Gateway Interface) entry point.

Gunicorn uses this file to start the Django application.
You don't need to edit this file.
"""
import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "supportmitra.settings")

application = get_wsgi_application()
