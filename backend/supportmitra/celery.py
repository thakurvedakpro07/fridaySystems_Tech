"""
Celery application configuration for ResolveHQ.

Celery handles background tasks like:
- Sending emails and WhatsApp messages
- Running SLA breach checks on a schedule
- Processing payout batches
"""
import os

from celery import Celery

# Tell Celery which Django settings file to use
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "supportmitra.settings")

app = Celery("supportmitra")

# Read Celery config from Django settings (keys starting with CELERY_)
app.config_from_object("django.conf:settings", namespace="CELERY")

# Auto-discover tasks.py files in all installed Django apps
app.autodiscover_tasks()
