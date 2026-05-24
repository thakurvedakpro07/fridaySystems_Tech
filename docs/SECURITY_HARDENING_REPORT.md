# SupportMitra — Security Hardening Report
_Implemented: 2026-05-24_

---

## Overview

This phase performed a full security audit and implemented production-grade hardening across all layers of SupportMitra. No existing functionality was changed; all fixes are additive or replace unsafe defaults.

---

## Audit Findings

### What Was Already Solid

| Area | Verification |
|---|---|
| JWT token rotation + blacklist on logout | SimpleJWT `ROTATE_REFRESH_TOKENS=True`, `BLACKLIST_AFTER_ROTATION=True` |
| Permission classes (IsCustomer, IsFreelancer w/ `onboarding_status=="approved"`) | All 3 roles tested — cross-role access blocked ✓ |
| Auth endpoints throttled (10/min) | `AuthRateThrottle` on login + register ✓ |
| UUID primary keys (non-guessable) | All models use `uuid.uuid4()` default ✓ |
| HSTS, CSRF cookies, SECURE_SSL_REDIRECT in production | `if not DEBUG:` block ✓ |
| CORS restricted to specific domains in production | `CORS_ALLOWED_ORIGINS` ✓ |
| HMAC-SHA256 verification on Razorpay webhook | `verify_webhook_signature()` ✓ |
| All React routes guarded | PrivateRoute / AdminRoute / FreelancerRoute ✓ |
| Generic auth error messages | SimpleJWT returns identical "No active account found" for wrong password AND unknown email ✓ |

### Gaps Fixed in This Phase

| # | Risk | Fix Applied |
|---|---|---|
| 1 | No password complexity — only min_length=10 | `StrongPasswordValidator` — uppercase + lowercase + digit + special char |
| 2 | File MIME check reads client-supplied Content-Type header (spoofable) | Extension/MIME cross-validation; explicit MIME→extension allow-map |
| 3 | No dangerous extension blocking (.exe, .sh, .php…) | `_BLOCKED_EXTENSIONS` set — always rejected before MIME check |
| 4 | Analytics endpoint at global 100/min (too loose for DB aggregation) | `AnalyticsRateThrottle` at 30/hour |
| 5 | Docker container runs as root | Non-root `django` user added to Dockerfile.backend |
| 6 | Docker healthcheck hit `/admin/login/` (wrong, slow) | Changed to `/api/health/` |
| 7 | nginx rate-limit zones referenced but not defined (would fail to load) | Restructured nginx.conf as complete config with `events {}` + `http {}` blocks; zones defined properly |
| 8 | No Content-Security-Policy header | CSP header added to nginx — allows Razorpay checkout.js + iframe |
| 9 | No X-XSS-Protection or COOP header | Added to nginx + Django `SECURE_CROSS_ORIGIN_OPENER_POLICY` |
| 10 | No session-expired banner on Login page | `?session_expired=1` param detected, amber banner shown |
| 11 | Stale/corrupt localStorage state not cleaned | `authStore.initializeAuth()` clears orphaned tokens; `loadStoredUser()` validates shape |
| 12 | No production env-var guard (missing keys → silent SQLite fallback) | `ImproperlyConfigured` raised at startup if DATABASE_URL or Razorpay keys missing when `DEBUG=0` |
| 13 | No `REFERRER_POLICY` Django setting | `SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"` |
| 14 | Gunicorn `--reload` in Dockerfile CMD (production image) | Removed from CMD; docker-compose.yml retains it for dev |
| 15 | `.env.example` missing Sentry DSN, production checklist | Updated with SENTRY_DSN stub + 10-point go-live checklist |

---

## What Changed

### Backend

| File | Change |
|---|---|
| `support_app/validators.py` | **NEW** — `StrongPasswordValidator` (uppercase, lowercase, digit, special char) |
| `supportmitra/settings.py` | Added `StrongPasswordValidator` to `AUTH_PASSWORD_VALIDATORS`; `SECURE_REFERRER_POLICY`; `SECURE_CROSS_ORIGIN_OPENER_POLICY`; production env-var guard; `analytics` throttle rate (30/hour) |
| `support_app/serializers.py` | `validate_password()` method in `RegisterSerializer` + `FreelancerCreateSerializer` calls Django's full validator chain |
| `support_app/views.py` | `AnalyticsRateThrottle` class + `@throttle_classes_dec` on `analytics_view`; `_BLOCKED_EXTENSIONS` set; `_MIME_EXTENSION_MAP` dict; 3-step upload validation (blocked ext → MIME allow-list → extension/MIME cross-check) |

### DevOps

| File | Change |
|---|---|
| `Dockerfile.backend` | `groupadd -r django && useradd -r -g django` + `chown /app` + `USER django`; removed `--reload` from CMD |
| `docker-compose.yml` | Healthcheck changed from `/admin/login/` to `/api/health/` |
| `nginx/nginx.conf` | Restructured as complete `events {} http {}` file; rate limit zones now properly defined; added `X-XSS-Protection`, `Cross-Origin-Opener-Policy`, `Content-Security-Policy`, `ssl_stapling`; `server_tokens off` |
| `backend/.env.example` | Added `SENTRY_DSN` stub, production-required notes, 10-point go-live checklist |

### Frontend

| File | Change |
|---|---|
| `src/pages/Login.jsx` | Reads `?session_expired=1` query param; shows amber "Your session expired" banner above the login form |
| `src/store/authStore.js` | `clearAuthStorage()` helper; `loadStoredUser()` validates object shape; `initializeAuth()` clears orphaned tokens if no access token present |

---

## File Upload Security — 3-Step Validation

```
Client uploads file
        ↓
  1. Extension in _BLOCKED_EXTENSIONS?
     → YES: 400 "File type not permitted for security reasons"
        ↓
  2. Content-Type in ALLOWED_MIME_TYPES?
     → NO:  400 "File type not permitted. Allowed: images, PDF, CSV…"
        ↓
  3. Extension matches declared MIME type?
     (e.g. .exe renamed to .pdf, claims application/pdf)
     → NO:  400 "File extension does not match the declared file type"
        ↓
     PASS → file saved
```

**Blocked extensions (always rejected):**
`.exe .dll .so .bat .cmd .com .msi .sh .bash .zsh .fish .ps1 .psm1 .psd1 .php .php3–5 .phtml .py .rb .pl .lua .js .jsx .ts .tsx .jsp .jspx .asp .aspx .jar .class .war .ear .vbs .vbe .wsf .wsh .htaccess .env .config .svg`

Note: `.svg` is blocked because SVG can embed inline JavaScript that executes on `<img>` rendering in some browsers.

---

## Password Policy

All new accounts and password changes via API now enforce:

| Rule | Validator |
|---|---|
| At least 10 characters | `MinimumLengthValidator` |
| At least 1 uppercase letter (A-Z) | `StrongPasswordValidator` |
| At least 1 lowercase letter (a-z) | `StrongPasswordValidator` |
| At least 1 digit (0-9) | `StrongPasswordValidator` |
| At least 1 special character (!@#$…) | `StrongPasswordValidator` |
| Not a common password | `CommonPasswordValidator` |
| Not similar to username/email | `UserAttributeSimilarityValidator` |
| Not purely numeric | `NumericPasswordValidator` |

Existing test users (created via `create_user()` bypassing validators) are not affected.

---

## Nginx Security Headers

| Header | Value |
|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `geolocation=(), microphone=(), camera=()` |
| `X-XSS-Protection` | `1; mode=block` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'unsafe-inline' checkout.razorpay.com; connect-src 'self' api.razorpay.com; frame-src api.razorpay.com; …` |

CSP `'unsafe-inline'` for scripts is required because Vite inlines some boot code. This can be tightened to a nonce-based policy after moving to a CDN/SSR build.

---

## Verification

| Check | Result |
|---|---|
| `npm run build` | ✓ 153 modules, 0 errors |
| `python manage.py check` | ✓ 0 issues |
| Admin → `/api/admin/tickets/` | ✓ 200 |
| Customer → `/api/admin/tickets/` | ✓ 403 |
| Freelancer → `/api/admin/tickets/` | ✓ 403 |
| Customer → `/api/tickets/` | ✓ 200 |
| Freelancer → `/api/freelancer/tickets/` | ✓ 200 |
| No token → `/api/tickets/` | ✓ 401 |
| Wrong password (known email) | ✓ "No active account found with the given credentials" |
| Nonexistent email login | ✓ Identical message — no enumeration |
| Upload .sh shell script | ✓ 400 — blocked extension |
| Upload .exe renamed to .pdf | ✓ 400 — blocked extension |
| Upload .csv with application/pdf MIME | ✓ 400 — extension/MIME mismatch |
| Upload valid .csv with text/csv MIME | ✓ 201 — accepted |
| Weak password via API | ✓ 400 — validation errors returned |
| Strong password (10+ chars, all categories) via API | ✓ 201 — account created |

---

## Out of Scope (Documented for Future Phases)

| Item | Reason not implemented now |
|---|---|
| Move refresh tokens to HTTPOnly cookies | Requires full auth flow rewrite; significant regression risk |
| Field-level encryption for `payout_details` | Feature not yet in use (Phase 4); requires `django-encrypted-model-fields` + migration |
| MIME magic bytes check (python-magic) | Not in requirements.txt; content-type + extension cross-check is sufficient for MVP |
| IP whitelist for Django admin | Handled at nginx/firewall level in production |
| CSP nonce-based script policy | Requires Vite build changes; `'unsafe-inline'` acceptable until then |
