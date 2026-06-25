"""
Custom Django validators — password strength and GSTIN format.
"""
import re

from django.core.exceptions import ValidationError
from django.utils.translation import gettext as _


# ── GSTIN format validation ───────────────────────────────────────
# Standard Indian GSTIN: 2-digit state code + PAN (10 chars) + entity number + "Z" + check digit.
# Example: 29ABCDE1234F1Z5
_GSTIN_RE = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$")


def validate_gstin_format(value: str) -> None:
    """
    Validate an Indian GSTIN (15 chars). Blank values are allowed (B2C customers).
    Raises ValidationError if the value is non-empty but malformed.
    """
    if not value:
        return
    if not _GSTIN_RE.match(value.strip().upper()):
        raise ValidationError(
            "Enter a valid 15-character GSTIN (e.g. 29ABCDE1234F1Z5). "
            "Format: 2-digit state code + PAN (10 chars) + entity code + Z + check digit.",
            code="invalid_gstin",
        )


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
