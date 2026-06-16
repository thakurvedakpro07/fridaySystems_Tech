# ResolveHQ — Error Handling & Resilience Report
_Implemented: 2026-05-24_

---

## Overview

This phase added a complete, production-grade error handling and resilience layer to ResolveHQ. All API errors now produce consistent JSON shapes from the backend. The frontend extracts clean messages from any error type, shows type-differentiated toast durations, catches React crashes with an error boundary, detects offline/reconnect state globally, and provides proper 404/403 pages instead of silent redirects.

---

## What Changed

### Backend

| File | Change |
|---|---|
| `supportmitra/settings.py` | Added `LOGGING` config (support_app DEBUG/INFO, django.request ERROR); confirmed `EXCEPTION_HANDLER` points to custom handler |
| `support_app/exceptions.py` | **NEW** — `custom_exception_handler`: normalises all DRF error responses; logs 5xx with full traceback, 4xx as warnings |

### Frontend

| File | Change |
|---|---|
| `src/utils/apiError.js` | **NEW** — `extractErrorMessage`, `extractFieldErrors`, `isUnauthorized`, `isForbidden` |
| `src/api/client.js` | Added `timeout: 10000`; session expiry redirects to `/login?session_expired=1` via `window.location.replace` |
| `src/context/ToastContext.jsx` | Type-based auto-close durations: success=3s, info=4s, warning=5s, error=6s |
| `src/components/ui/ErrorBoundary.jsx` | **NEW** — React class-based error boundary with "Try again" / "Reload page" actions; DEV-only stack trace |
| `src/components/ui/OfflineBanner.jsx` | **NEW** — global offline (dark) + reconnected (green) banner; auto-dismisses after 3s on reconnect |
| `src/pages/NotFoundPage.jsx` | **NEW** — 404 page with role-aware "Go home" link and "Go back" button |
| `src/pages/ForbiddenPage.jsx` | **NEW** — 403 page with role-aware "Go home / Sign in" link |
| `src/App.jsx` | Wrapped app in `<ErrorBoundary>`; mounted `<OfflineBanner />`; added `/403` route; `path="*"` → `<NotFoundPage />` instead of silent redirect |

---

## Architecture

### Standardised backend error shape

Every DRF error response now conforms to:

```json
{
  "detail": "Human-readable message",
  "errors": { "field_name": ["Error message"] },
  "status": 400
}
```

- **`detail`** — single string suitable for display in a toast or card
- **`errors`** — field → messages dict for form validation; empty `{}` for non-validation errors
- **`status`** — mirrors the HTTP status code (redundant but avoids an extra header lookup)

### Frontend error extraction

`extractErrorMessage(error)` follows this priority chain:

1. `error.response.data.detail` (standardised backend shape)
2. First field-level message from `error.response.data.errors`
3. Plain string body
4. HTTP status code fallback (401 → "Session expired", 403 → "You don't have permission", etc.)
5. Network/timeout detection (`ECONNABORTED`, no `error.response`)
6. Static fallback string

### Session expiry flow

```
API returns 401
    → interceptor tries token refresh
    → refresh succeeds → original request retried transparently
    → refresh fails (token blacklisted or expired)
        → localStorage cleared
        → window.location.replace("/login?session_expired=1")
        → (future) Login page can read ?session_expired=1 and show "Your session expired" banner
```

`window.location.replace` (not `href=`) is used so the page that triggered the 401 is removed from browser history — pressing Back after re-login won't re-trigger the 401 cycle.

### React error boundary coverage

The top-level `<ErrorBoundary>` in `App.jsx` catches any uncaught throw from any page or component. It renders a card with "Try again" (resets boundary state, re-mounts subtree) and "Reload page". In development, the raw error message is shown below the card to speed up debugging.

---

## Logging

| Logger | Level (dev) | Level (prod) | What it captures |
|---|---|---|---|
| `support_app` | DEBUG | INFO | All application events, warnings, errors |
| `django.request` | ERROR | ERROR | Unhandled Django view exceptions |
| `django.security` | WARNING | WARNING | CSRF, host header attacks, etc. |
| root | WARNING | WARNING | Everything else (third-party libs) |

5xx errors logged by `custom_exception_handler` include:
- HTTP method and path
- View class name
- Full `traceback.format_exc()` output

4xx errors are logged as warnings with method, path, and the `detail` message only — no stack trace, to avoid log noise in production.

---

## Verification

| Check | Result |
|---|---|
| `npm run build` | ✓ 153 modules, 0 errors |
| `python manage.py check` | ✓ 0 issues |
| EXCEPTION_HANDLER registered in settings | ✓ |
| LOGGING registered in settings | ✓ |
| `custom_exception_handler` normalises 400 validation error | ✓ shape: `{detail, errors, status}` |
| `custom_exception_handler` logs 5xx with traceback | ✓ |
| `custom_exception_handler` logs 4xx as warning | ✓ |
| Axios timeout 10s | ✓ |
| Session expiry → `/login?session_expired=1` | ✓ |
| Toast durations: error=6s, warning=5s, info=4s, success=3s | ✓ |
| ErrorBoundary shows fallback on crash | ✓ |
| OfflineBanner shows on `offline` event | ✓ |
| OfflineBanner auto-dismisses 3s after `online` event | ✓ |
| `/403` route renders ForbiddenPage | ✓ |
| Unknown URL renders NotFoundPage (not redirect) | ✓ |
| 404 "Go home" uses role-aware destination | ✓ |

---

## Not Changed (by design)

- Payment logic and Razorpay integration
- Analytics dashboards
- Auth system (JWT, allauth, permissions)
- Dashboard layouts and page designs
- Existing toast call sites (backward compatible — `addToast(msg, type)` unchanged)
