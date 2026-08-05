"""
Purpose-scoped password-reset-style tokens.

Django's default_token_generator is a *singleton* shared by password reset
and (previously) email verification, with a fixed key_salt. That meant a
token minted for one purpose was cryptographically valid for the other
purpose too, as long as the hashed user state still matched it (cross-purpose
token reuse). EmailVerificationTokenGenerator gets its own key_salt (changes
the HMAC input, so tokens are not interchangeable) and its own expiry window,
independent of settings.PASSWORD_RESET_TIMEOUT (which must keep governing
password reset only).
"""
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.utils.crypto import constant_time_compare
from django.utils.http import base36_to_int


class EmailVerificationTokenGenerator(PasswordResetTokenGenerator):
    key_salt = "support_app.tokens.EmailVerificationTokenGenerator"

    # Independent of settings.PASSWORD_RESET_TIMEOUT (Django default 3 days) —
    # matches the "expires in 24 hours" copy already in email/verify_email.html.
    VERIFY_TIMEOUT_SECONDS = 60 * 60 * 24  # 24h

    def check_token(self, user, token):
        """Same parse/HMAC-compare as the base class, but checks against
        VERIFY_TIMEOUT_SECONDS instead of settings.PASSWORD_RESET_TIMEOUT —
        the base class hardcodes that setting inside check_token, so a
        subclass can't override just the timeout without overriding this."""
        if not (user and token):
            return False
        try:
            ts_b36, _ = token.split("-")
            ts = base36_to_int(ts_b36)
        except ValueError:
            return False

        for secret in [self.secret, *self.secret_fallbacks]:
            if constant_time_compare(self._make_token_with_timestamp(user, ts, secret), token):
                break
        else:
            return False

        if (self._num_seconds(self._now()) - ts) > self.VERIFY_TIMEOUT_SECONDS:
            return False
        return True

    def classify_failure(self, user, token) -> str:
        """Call only after check_token() has returned False.

        Distinguishes a tampered/wrong-user/garbage token ("invalid_link")
        from a well-formed but time-expired one ("expired_link"), by redoing
        the HMAC compare without the timeout check.
        """
        if not (user and token):
            return "invalid_link"
        try:
            ts_b36, _ = token.split("-")
            ts = base36_to_int(ts_b36)
        except ValueError:
            return "invalid_link"

        hmac_ok = any(
            constant_time_compare(self._make_token_with_timestamp(user, ts, secret), token)
            for secret in [self.secret, *self.secret_fallbacks]
        )
        return "expired_link" if hmac_ok else "invalid_link"


email_verification_token_generator = EmailVerificationTokenGenerator()
