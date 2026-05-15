#!/usr/bin/env python
"""
Django's command-line utility for administrative tasks.

Common commands:
  python manage.py runserver       — start the dev server
  python manage.py migrate         — apply database migrations
  python manage.py createsuperuser — create an admin login
  python manage.py shell           — open an interactive Python shell
"""
import os
import sys


def main():
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "supportmitra.settings")
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Make sure it's installed and your "
            "virtual environment is activated."
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
