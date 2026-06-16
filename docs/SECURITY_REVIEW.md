# SupportMitra — Pre-Deployment Security Review

**Reviewed:** 2026-06-16
**Reviewer:** Claude (security audit — code review, no penetration testing)
**Scope:** Authentication, JWT handling, Permissions, Customer data isolation, Payment security, File upload security, Django settings, Nginx security headers, Secrets management, Docker security
**Method:** Static code review only. Findings are evidence-based (file/line cited); style issues and speculative future enhancements are excluded.

**Classification:**
- **P0** — exploitable immediately, must fix before public deployment
- **P1** — serious risk, fix soon after launch
- **P2** — improvement, not an active exploit

---

## Summary

| ID | Priority | Issue | Status |
|----|----------|-------|--------|
| P0-01 | P0 | Payment signature replay — unlimited free tickets after one real payment | Open |
| P0-02 | P0 | Unauthenticated direct access to customer ticket attachments via nginx `/media/` | Open |
| P0-03 | P0 | `DEBUG=1` active in `.env` | Open (pre-deploy checklist item) |
| ~~P2-01~~ | P2 | `change_password` has no dedicated rate limit, relies on global 100/min throttle | ✅ Fixed |
| ~~P2-02~~ | P2 | CSP allows `'unsafe-inline'` script-src | ✅ Fixed (this phase) — `style-src 'unsafe-inline'` intentionally retained, see below |
| P2-03 | P2 | Alternate frontend Dockerfile lacks security headers | Open |

No real findings in: JWT signing/expiry/refresh handling, permission classes / IDOR, privilege escalation, file-upload content-type/size validation, secrets management (`.env` gitignored, no hardcoded credentials found), Docker image hardening (non-root user, no unnecessary capabilities).

---

## P0 — Exploitable Immediately

### P0-01: Payment signature replay

**Impact:** The Razorpay payment-verification endpoint accepts a previously-used valid `(order_id, payment_id, signature)` triple more than once. An attacker who captures one legitimate signed payment response can replay it to mark unlimited additional tickets as paid, at zero cost.

**Status:** Open — not in scope for this fix; requires invoice/order-id uniqueness enforcement in `verify_payment`. Flagged for a dedicated fix in a future phase.

### P0-02: Unauthenticated direct access to ticket attachments

**Impact:** Nginx serves `/media/` directly from disk with no authentication check. Any user (including unauthenticated) who knows or guesses an attachment URL can download another customer's uploaded files — bypassing the Django-level ticket-ownership permission checks entirely, since the request never reaches Django.

**Status:** Open — requires moving attachment downloads behind an authenticated Django view (e.g. `X-Accel-Redirect`) instead of a public nginx `location /media/`. Not in scope for this fix.

### P0-03: `DEBUG=1` active

**Impact:** `backend/.env` currently has `DEBUG=1`. With `DEBUG=True`, Django serves verbose tracebacks (including settings, SQL, and local variables) on any unhandled exception, and the `DEFAULT_PERMISSION_CLASSES` in `settings.py` fall back to `AllowAny` instead of `IsAuthenticated`. This must be set to `0` before any public deployment.

**Status:** Open — operational/pre-deploy checklist item, not a code defect. No code change required, just `.env` configuration before going live.

---

## P2 — Improvements

### ~~P2-01: `change_password` has no dedicated rate limit~~ — ✅ FIXED

**Original impact:** `POST /api/auth/change-password/` had no `throttle_classes`, relying solely on the global `UserRateThrottle` (100 requests/minute). Combined with `IsAuthenticated`-only protection, a stolen/leaked access token could be used to brute-force a user's *current* password (the field required to set a new one) at up to 100 attempts/minute.

**Fix (this phase):**
- Added `PasswordChangeRateThrottle` (`backend/support_app/views.py`) — a `UserRateThrottle` subclass with `scope = "password_change"`, overriding `parse_rate()` to enforce a fixed **5 requests per 15-minute window (900s)** per authenticated user (falls back to per-IP for anonymous callers, consistent with DRF's default `UserRateThrottle` behaviour).
  - DRF's `SimpleRateThrottle.parse_rate()` only understands whole second/minute/hour/day periods, so a literal "5 per 15 minutes" window isn't expressible as a plain rate string — the override returns the exact `(5, 900)` tuple instead of approximating with `/hour`.
- Applied via `@throttle_classes_dec([PasswordChangeRateThrottle])` to `change_password` only. The login/registration `AuthRateThrottle` (`scope="auth"`, 10/minute) was left untouched, per requirement to not affect those flows.
- `password_reset_request` (sends a reset email) continues to use the shared `auth` scope unchanged. `password_reset_confirm` (sets a new password via emailed uid/token, `AllowAny`) was deliberately left out of this dedicated throttle's scope — brute-forcing it requires a valid signed token tied to a specific user, which is the actual security boundary there, not request volume; it remains covered by the global `AnonRateThrottle` (20/minute).
- Added `"password_change": "5/15min"` to `DEFAULT_THROTTLE_RATES` in `backend/supportmitra/settings.py` for documentation purposes (the value is not parsed at runtime since `parse_rate()` is overridden, but keeps the rate visible alongside `anon`/`user`/`auth`/`analytics`).
- The standard DRF `Throttled` exception (HTTP 429 + `Retry-After` header) flows through unchanged — the project's custom exception handler (`support_app/exceptions.py`) only reshapes the body into `{"detail", "errors", "status"}`, it doesn't intercept or suppress throttle responses.

**Tests added** (`backend/tests/test_auth.py`):
- `test_change_password_success` — a valid password change still returns 200.
- `test_change_password_rate_limit_reached` — 5 requests are accepted (regardless of success/failure of the underlying change), the 6th returns 429 with a `Retry-After` header and a `"throttled"` detail message.
- `test_change_password_throttle_resets_after_window` — after the cache-backed throttle bucket is cleared (simulating the 15-minute window elapsing), a subsequent request succeeds again.

**Verified:**
```
backend/tests/test_auth.py — 24/24 passed
Full suite — 106/107 passed (1 pre-existing, unrelated failure in
test_sla.py::test_payment_invoice_no_longer_returns_501 — a stale
source-inspection test from before the Phase 23 PDF-invoice refactor;
confirmed present before this change via git stash, untouched by this work)
```

### ~~P2-02: CSP allows `'unsafe-inline'` script-src~~ — ✅ FIXED

**Original impact:** The Content-Security-Policy header permitted `'unsafe-inline'` for `script-src`, which weakened XSS mitigation — an injected `<script>` tag would still execute.

**Investigation:** Checked every source of script content under this CSP for inline `<script>` blocks, inline event-handler attributes (`onclick=`, etc.), and `javascript:` URIs:
- **Razorpay checkout.js** (`https://checkout.razorpay.com/v1/checkout.js`) — downloaded and inspected the live production bundle directly. Zero inline-script indicators. It does load a secondary script (`https://cdn.razorpay.com/static/cx/razorpay-risk-detection/bundle.js`) via `document.createElement("script")` + `src=`, which is governed by the `script-src` host allowlist, not `'unsafe-inline'` — `cdn.razorpay.com` was missing from the allowlist and has been added.
- **React/Vite production build** (`frontend/dist/`) — `vite.config.js` confirms all JS/CSS output is external, hashed files; nothing is inlined into `index.html` at build time. `frontend/index.html` itself contains no inline `<script>` content.
- **Django admin** (Django 4.2) — built-in admin templates pass dynamic values via `data-*` attributes on external `<script src>` tags (a deliberate upstream Django 3.1+ change for strict-CSP compatibility), not inline script bodies.

**Fix:** Removed `'unsafe-inline'` from `script-src` in `nginx/nginx.conf`; added `https://cdn.razorpay.com` (newly discovered requirement, previously silently broken/unused). `style-src 'unsafe-inline'` is intentionally **retained** — see justification below — along with adding `https://fonts.googleapis.com` (`style-src`) and `https://fonts.gstatic.com` (`font-src`) for the Google Fonts `<link>` in `index.html`, which was already in use but not previously allowlisted.

**Why `style-src 'unsafe-inline'` could not be removed:** Direct inspection of Razorpay's checkout.js bundle found at least one `element.setAttribute("style", <dynamically computed string>)` call used for widget positioning/theming. This is third-party code we don't control, the value isn't static (so a hash-based CSP source can't cover it), and the script has no concept of CSP nonces (zero `nonce` references anywhere in the bundle) — so neither a nonce-based nor hash-based replacement is possible for this directive. React's own inline `style={{...}}` usage throughout the app does **not** require `'unsafe-inline'`: React sets style properties individually via the element's CSSOM (`element.style.propertyName = value`), not via the `style` attribute string, which is the mechanism CSP's `style-src` restriction actually governs.

**Verified** (manual, browser-driven, against a CSP-hardened nginx test proxy fronting the real dev backend):
- Login (customer + admin), Dashboard, Billing pages — rendered correctly, zero console CSP violations.
- Razorpay payment flow — created a `pending_payment` test ticket, clicked "Pay", and confirmed the real Razorpay TEST-mode checkout modal opens and renders fully (branding, payment methods, contact-details step) under the new `script-src` with no `'unsafe-inline'` — zero CSP violations.
- Django admin — logged in, opened the Users changelist (search, filters, sidebar nav) and a user detail/change form (fieldsets, checkboxes, select widgets) — zero CSP violations.

### P2-03: Alternate frontend Dockerfile lacks security headers

**Impact:** A secondary/alternate frontend `Dockerfile` does not configure the same nginx security headers (CSP, X-Frame-Options, etc.) as the primary one. If ever used for a deployment, it would ship without that hardening.

**Status:** Open — not in scope for this fix.

---

## Areas Reviewed — No Real Findings

- **JWT handling** — `SimpleJWT` with rotation + blacklist-after-rotation enabled; access/refresh lifetimes are reasonable; logout blacklists the refresh token; expired/blacklisted/garbled tokens correctly rejected with 401.
- **Permissions / IDOR** — cross-role access (customer → admin endpoints, freelancer → admin endpoints, customer → other customer's tickets/payments) consistently returns 403/404; verified via existing test suite (`test_tickets.py`, `test_api_phase4.py`, `test_payments.py`).
- **Privilege escalation** — no endpoint allows a non-staff user to set `is_staff`/`role` on themselves or others.
- **File upload validation** — attachment uploads validate content-type and size before storage.
- **Secrets management** — `backend/.env` is gitignored; no hardcoded credentials found in tracked source.
- **Docker security** — containers run as non-root; no unnecessary host capabilities or privileged mode.

---

## Out of Scope

Per the original audit instructions, style issues and speculative future enhancements were excluded from this report. P0-01 and P0-02 remain open and are the highest-priority items for the next security-focused phase.
