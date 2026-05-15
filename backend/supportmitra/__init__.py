# This empty file tells Python that `supportmitra` is a package.
# It also makes Celery available as the default app so Django management
# commands can find it.
from .celery import app as celery_app

__all__ = ("celery_app",)
