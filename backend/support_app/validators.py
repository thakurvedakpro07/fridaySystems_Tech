"""
Custom Django password validators.
Added to AUTH_PASSWORD_VALIDATORS in settings.py alongside the built-in validators.
"""
import re

from django.core.exceptions import ValidationError
from django.utils.translation import gettext as _


class StrongPasswordValidator:
    """
    Rejects passwords that don't contain at least one character from each
    required category: uppercase letter, lowercase letter, digit, special char.

    Complements Django's MinimumLengthValidator (min_length=10 in settings.py)
    so both checks run together.

    Registered in settings.py:
        {"NAME": "support_app.validators.StrongPasswordValidator"}
    """

    CATEGORIES = [
        (r"[A-Z]", _("one uppercase letter (A-Z)")),
        (r"[a-z]", _("one lowercase letter (a-z)")),
        (r"\d",    _("one digit (0-9)")),
        (r'[!@#$%^&*()\-_=+\[\]{};:\'",.<>?/\\|`~]', _("one special character (!@#$…)")),
    ]

    def validate(self, password, user=None):
        missing = [label for pattern, label in self.CATEGORIES if not re.search(pattern, password)]
        if missing:
            raise ValidationError(
                _("Password must contain at least %(missing)s."),
                code="password_too_weak",
                params={"missing": ", ".join(missing)},
            )

    def get_help_text(self):
        return _(
            "Your password must contain at least one uppercase letter, "
            "one lowercase letter, one digit, and one special character."
        )
