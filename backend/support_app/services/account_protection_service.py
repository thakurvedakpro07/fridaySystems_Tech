"""
Generic, identifier-based brute-force protection: failed-attempt counting
with a temporary lockout and progressive backoff on repeat offenses.

Cache/Redis-only by design — no new CustomUser fields, no migration for the
counters themselves, self-expires via TTL with zero cleanup job needed. This
mirrors the resend-verification cooldown primitive in views.py
(`cache.add(f"verify-resend-cooldown:...", 1, timeout=60)`), just extended
from a boolean gate to a counter + escalating lockout.

Not login-specific: `identifier` is any string the caller chooses — a
lowercased email for login, `f"reset-token:{uid}"` for password-reset-confirm
guessing, etc. Enumeration-safety is the CALLER's responsibility: always
derive `identifier` from raw user input *before* checking whether it maps to
a real record, so lockout state/timing never differs based on record
existence (see CustomTokenObtainPairSerializer.validate() for the reference
implementation).
"""
import logging
import time
from dataclasses import dataclass

from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

_FAIL_PREFIX = "bfp:fails"
_STRIKES_PREFIX = "bfp:strikes"
_LOCKOUT_PREFIX = "bfp:lockout"


@dataclass
class LockoutState:
    locked: bool
    retry_after_seconds: int = 0


def _fail_key(identifier: str) -> str:
    return f"{_FAIL_PREFIX}:{identifier}"


def _strikes_key(identifier: str) -> str:
    return f"{_STRIKES_PREFIX}:{identifier}"


def _lockout_key(identifier: str) -> str:
    return f"{_LOCKOUT_PREFIX}:{identifier}"


def _incr_with_expiry(key: str, window_seconds: int) -> int:
    """
    cache.incr() raises ValueError if the key is absent (standard Django
    cache behavior — the same primitive DRF's own SimpleRateThrottle relies
    on). On that, create it at 1 with a fresh TTL. Two concurrent first-hits
    can both hit the ValueError branch and both write 1 (a benign race,
    under-counting by at most one) — not a security-relevant gap, since it
    only ever delays a lockout by a single request, never prevents one.
    """
    try:
        return cache.incr(key)
    except ValueError:
        cache.set(key, 1, timeout=window_seconds)
        return 1


def is_locked(identifier: str) -> LockoutState:
    """Check current lockout state for `identifier` without recording anything."""
    if not settings.BRUTE_FORCE_PROTECTION_ENABLED:
        return LockoutState(locked=False)

    unlock_at = cache.get(_lockout_key(identifier))
    if unlock_at is None:
        return LockoutState(locked=False)

    remaining = int(unlock_at - time.time())
    if remaining <= 0:
        return LockoutState(locked=False)
    return LockoutState(locked=True, retry_after_seconds=remaining)


def record_failed_attempt(identifier: str) -> LockoutState:
    """
    Record one failed attempt for `identifier`. Returns the resulting lockout
    state — `locked=True` exactly on the call that crosses the threshold
    (callers are expected to check `is_locked()` first and never reach this
    function again for the same identifier until the lockout expires, so
    "locked=True" here always means "just triggered", not "still locked").
    """
    if not settings.BRUTE_FORCE_PROTECTION_ENABLED:
        return LockoutState(locked=False)

    count = _incr_with_expiry(_fail_key(identifier), settings.LOGIN_LOCKOUT_WINDOW_SECONDS)
    if count < settings.LOGIN_LOCKOUT_THRESHOLD:
        return LockoutState(locked=False)

    # Progressive backoff: each lockout within the strike window doubles the
    # duration off the base, capped at LOGIN_LOCKOUT_MAX_DURATION_SECONDS.
    strikes = _incr_with_expiry(_strikes_key(identifier), settings.LOGIN_LOCKOUT_STRIKE_WINDOW_SECONDS)
    duration = min(
        settings.LOGIN_LOCKOUT_BASE_DURATION_SECONDS * (2 ** (strikes - 1)),
        settings.LOGIN_LOCKOUT_MAX_DURATION_SECONDS,
    )

    unlock_at = time.time() + duration
    cache.set(_lockout_key(identifier), unlock_at, timeout=duration)
    # Reset the fail-streak so the window starts clean once this lockout
    # expires, instead of re-locking instantly on the first next attempt.
    cache.delete(_fail_key(identifier))

    logger.warning(
        "Brute-force lockout triggered: identifier=%s strikes=%s duration_seconds=%s",
        identifier, strikes, duration,
    )
    return LockoutState(locked=True, retry_after_seconds=int(duration))


def clear_attempts(identifier: str) -> None:
    """
    Call on a successful attempt — resets the current fail-streak only. The
    longer-lived strikes counter deliberately persists until its own TTL: a
    since-fixed login shouldn't erase evidence of a recent attack pattern
    that progressive backoff needs to remember.
    """
    cache.delete(_fail_key(identifier))
