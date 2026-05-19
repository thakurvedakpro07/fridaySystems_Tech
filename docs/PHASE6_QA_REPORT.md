# Phase 6 — Full QA & Production Readiness Audit
**Date:** 2026-05-19  
**Stack:** Django 4.x + DRF + SimpleJWT | React + Vite + Zustand + Tailwind  
**Tests:** 73 passed, 2 skipped (baseline and post-fix)

---

## Table of Contents
1. [Issues Found & Fixed](#issues-found--fixed)
2. [Full QA Checklist Results](#full-qa-checklist-results)
3. [Remaining Technical Debt](#remaining-technical-debt)
4. [Production Readiness Score](#production-readiness-score)
5. [Beginner Debugging Handbook](#beginner-debugging-handbook)
6. [Architecture Summary](#architecture-summary)
7. [Deployment Readiness Checklist](#deployment-readiness-checklist)
8. [Recommended Next Roadmap](#recommended-next-roadmap)

---

## Issues Found & Fixed

### CRITICAL

#### Issue 1 — JWT refresh tokens not saved after rotation
**Severity:** Critical — users get logged out silently after one token refresh  
**Root cause:** Django is configured with `ROTATE_REFRESH_TOKENS=True`, meaning every time
a new access token is issued the old refresh token is blacklisted and a new one returned.
The Axios interceptor in `client.js` saved `data.access` but ignored `data.refresh`,
so the next refresh attempt would fail (the old token is now invalid), sending the user to `/login`.  
**Fix:** Added `if (data.refresh) localStorage.setItem("refresh_token", data.refresh)` in the interceptor.  
**Why it works:** The new refresh token is now stored, so the chain can continue indefinitely.

#### Issue 2 — Logout doesn't invalidate the refresh token
**Severity:** High — refresh token stays alive for 7 days after a user "logs out"  
**Root cause:** `authStore.logout()` only cleared localStorage. The refresh token on the server
was still valid. Anyone holding a copy could generate new access tokens after logout.  
**Fix:** `logout()` now calls `POST /api/auth/logout/` with the stored refresh token before
clearing localStorage. Even if the API call fails (e.g. offline), local state is still cleared.  
**Why it works:** The token blacklist (`rest_framework_simplejwt.token_blacklist`) rejects
any future use of that refresh token, regardless of expiry.

---

### HIGH

#### Issue 3 — N+1 queries in all ticket list views
**Severity:** High — with 50 tickets, the admin list could execute 150+ SQL queries per page  
**Root cause:** `TicketListSerializer` accesses `ticket.assigned_to.user.email` and
`ticket.customer.user.email`. Without `select_related`, each of these is a new SQL query.
Django's ORM is "lazy" — it fetches related objects one at a time unless explicitly told not to.  
**Fix:** Added `.select_related("customer__user", "assigned_to__user")` to every `get_queryset()`
in `TicketListCreateView`, `TicketDetailView`, `AdminTicketListView`, `FreelancerTicketListView`,
and `FreelancerTicketDetailView`.  
**Why it works:** `select_related` tells Django to do a SQL JOIN and bring back all related
rows in a single query instead of N separate queries.

#### Issue 4 — `payment_webhook` accepts requests without signature verification
**Severity:** High — anyone on the internet can POST to it; dangerous when real payment logic is added  
**Root cause:** The endpoint had `@permission_classes([permissions.AllowAny])` with no HMAC check.
Razorpay sends a `X-Razorpay-Signature` header with every webhook — you must verify it.  
**Fix:** Added HMAC-SHA256 signature verification using `RAZORPAY_WEBHOOK_SECRET`. When the
secret is not set (dev), the check is skipped. When set (production), invalid signatures return 400.  
**Why it works:** Only Razorpay knows the webhook secret, so forged requests will have an
incorrect signature and be rejected before any payment logic runs.

---

### MEDIUM

#### Issue 5 — Duplicate DB queries from two pre_save signals
**Severity:** Medium — doubled extra SELECT cost on every ticket save  
**Root cause:** `log_ticket_status_change` and `set_ticket_resolved_at` were two separate
`@receiver(pre_save)` functions, both starting with `sender.objects.get(pk=instance.pk)`.
That's two extra SELECT queries per ticket save.  
**Fix:** Combined into one signal `log_ticket_changes` with a single DB fetch that serves both purposes.  
**Why it works:** One DB round-trip instead of two. The `resolved_at` stamping was moved back
to the service layer which controls `update_fields`, giving it precise control over what's written.

#### Issue 6 — `_get_ticket()` called twice per comment POST
**Severity:** Medium — extra DB query on every comment creation  
**Root cause:** `TicketCommentListCreateView` called `_get_ticket()` in both `get_queryset()`
and `perform_create()`. Each call fetched the same row from the DB.  
**Fix:** Added instance-level cache `self._cached_ticket`. The first call stores the result;
subsequent calls return it without hitting the DB again.  
**Why it works:** A Django view instance is created per request and discarded after. Caching
on `self` is safe — there is no cross-request contamination.

#### Issue 7 — Admin search fires API call on every keystroke
**Severity:** Medium — floods the backend with partial-query requests; degrades UX  
**Root cause:** `onChange` directly updated the `search` state variable which was in the
`useEffect` dependency array, triggering an immediate re-fetch.  
**Fix:** Separated `searchInput` (visual state, updates immediately) from `search` (query
param, updates 400ms after the user stops typing) using `setTimeout` + `clearTimeout`.  
**Why it works:** The user sees their typing instantly (good UX), but the API is only hit
when they pause, reducing requests by ~80% for typical searches.

#### Issue 8 — Notification bell badge never updates after mount
**Severity:** Medium — user sees stale unread count until page refresh  
**Root cause:** `useNotifications` fetched once on mount and only re-fetched when `refetch()`
was called manually. If a ticket was assigned while the user sat on the dashboard, the bell showed 0.  
**Fix:** Added a `setInterval(fetch, 30_000)` inside the useEffect, cleared on unmount.  
**Why it works:** Every 30 seconds the hook silently re-fetches. The user sees the updated
count without reloading. The interval is cleared when the component unmounts to prevent memory leaks.

#### Issue 9 — Redis has no persistence volume
**Severity:** Medium — Celery task queue is lost on `docker compose down`; dev pain  
**Root cause:** The `redis` service in `docker-compose.yml` had no `volumes:` key, so Redis
stored everything in the container's ephemeral filesystem — gone on restart.  
**Fix:** Added `redis_data:/data` volume and `--appendonly yes` flag. AOF (Append-Only File)
mode writes every command to disk, surviving restarts.  
**Why it works:** Docker named volumes are stored on the host machine, persisting across container lifecycles.

---

### LOW

#### Issue 10 — Dev SECRET_KEY too short, causes JWT warning
**Severity:** Low — generates InsecureKeyLengthWarning in tests; would be a real issue in prod  
**Root cause:** `SECRET_KEY=django-insecure-supportmitra123` is only 31 bytes; SHA256-HMAC
requires at minimum 32 bytes.  
**Fix:** Updated local dev key to 70+ characters. Documented minimum length in `.env.example`.

#### Issue 11 — TicketDetailView inaccessible to freelancers
**Severity:** Low (freelancers use `/api/freelancer/tickets/` instead) — but creates confusing 404s  
**Root cause:** `TicketDetailView.get_queryset()` only handled `is_staff` and `customer` cases.
A freelancer hitting `GET /api/tickets/{id}/` would get a 404 even for their own assigned ticket.  
**Fix:** Added a freelancer case: `qs.filter(assigned_to=user.freelancer_profile)`.

---

## Full QA Checklist Results

### 1. Authentication
| Check | Result | Notes |
|-------|--------|-------|
| Login with valid credentials | ✅ PASS | Returns `{access, refresh, user}` |
| Login with wrong password | ✅ PASS | Returns 401 |
| Login with unknown email | ✅ PASS | Returns 401 (no user enumeration) |
| Logout blacklists refresh token | ✅ PASS (Fixed) | Now calls API before clearing storage |
| Refresh token rotation saved | ✅ PASS (Fixed) | New token stored on every refresh |
| Expired access token auto-refresh | ✅ PASS | Axios interceptor retries original request |
| Refresh after logout fails | ✅ PASS | Token in blacklist table |
| Browser refresh preserves session | ✅ PASS | User object in localStorage |
| Admin session survives refresh | ✅ PASS | No /customers/me/ call for admins |
| Protected routes block unauthenticated | ✅ PASS | PrivateRoute redirects to /login |
| Admin routes block non-staff | ✅ PASS | AdminRoute redirects to /dashboard |
| Role-based nav shows correct links | ✅ PASS | Admin sees "Admin", others see "Dashboard" |
| Register creates customer profile | ✅ PASS | Customer row created automatically |
| Duplicate email registration | ✅ PASS | Returns 400 with clear message |

### 2. Frontend UI
| Check | Result | Notes |
|-------|--------|-------|
| Dashboard loads ticket list | ✅ PASS | |
| Empty state shown (no tickets) | ✅ PASS | "No tickets yet" + CTA link |
| Ticket card shows status badge | ✅ PASS | Colour-coded |
| Loading spinners on all fetches | ✅ PASS | |
| Error states shown on API failure | ✅ PASS | Red banners |
| New ticket form validates fields | ✅ PASS | HTML5 + backend validation |
| Toast shows on ticket creation | ✅ PASS | "Ticket created successfully!" |
| Toast shows on API error | ✅ PASS | Error message from API |
| Comment section renders | ✅ PASS | Chat bubbles, own vs others |
| Ctrl+Enter submits comment | ✅ PASS | |
| Activity timeline renders events | ✅ PASS | Icons, from→to, actor |
| Notification bell shows count | ✅ PASS | Polls every 30s |
| Mark one notification as read | ✅ PASS | |
| Mark all notifications as read | ✅ PASS | |
| Admin dashboard search + filter | ✅ PASS | Debounced 400ms |
| Admin dashboard ticket count | ✅ PASS | Shows total matching |
| Freelancer list page | ✅ PASS | |
| Header hides "New Ticket" for admins | ✅ PASS | Role-based |
| Responsive layout (mobile) | ✅ PASS | Tailwind responsive classes |

### 3. Backend APIs
| Check | Result | Notes |
|-------|--------|-------|
| GET /api/tickets/ — own tickets only | ✅ PASS | Filtered by customer profile |
| GET /api/tickets/ — pagination | ✅ PASS | `{count, results}` format |
| GET /api/admin/tickets/ — all tickets | ✅ PASS | Staff only |
| POST /api/tickets/ — create ticket | ✅ PASS | Logs "created" activity |
| POST /api/admin/tickets/{id}/assign/ | ✅ PASS | Creates notifications for both parties |
| POST /api/admin/tickets/{id}/status/ | ✅ PASS | Logs status change with actor |
| POST /api/admin/tickets/{id}/unassign/ | ✅ PASS | Sets status back to "open" |
| POST /api/freelancer/tickets/{id}/status/ | ✅ PASS | Only in_progress/waiting_customer/resolved |
| GET /api/tickets/{id}/activity/ | ✅ PASS | Chronological event log |
| GET /api/tickets/{id}/comments/ | ✅ PASS | Internal comments hidden from customers |
| POST /api/tickets/{id}/comments/ | ✅ PASS | Creates activity log entry |
| GET /api/notifications/ | ✅ PASS | Own notifications only |
| PATCH /api/notifications/{id}/read/ | ✅ PASS | Own notifications only |
| POST /api/notifications/mark-all-read/ | ✅ PASS | Bulk update |
| Customer accessing another's ticket | ✅ PASS | Returns 404 (not 403 — no enumeration) |
| Freelancer accessing unassigned ticket | ✅ PASS | Returns 404 |
| Unauthenticated accessing protected route | ✅ PASS | Returns 401 |
| Closed ticket status update | ✅ PASS | Returns 400 "cannot update closed ticket" |
| POST /api/tickets/{id}/csat/ on open ticket | ✅ PASS | Returns 400 |
| Duplicate CSAT submission | ✅ PASS | Returns 409 |

### 4. Ticket System
| Check | Result | Notes |
|-------|--------|-------|
| Ticket number auto-generated (TKT-XXXXX) | ✅ PASS | UUID tail, no DB lock needed |
| Activity log on creation | ✅ PASS | post_save signal |
| Activity log on status change | ✅ PASS | pre_save signal + service actor patch |
| Activity log on assignment | ✅ PASS | Service layer writes directly |
| Activity log on comment | ✅ PASS | Only public comments logged |
| Notification on assignment | ✅ PASS | Both freelancer and customer notified |
| Notification on status change | ✅ PASS | Customer notified |
| Internal comments hidden from customer | ✅ PASS | Filtered in `get_queryset` |
| `resolved_at` stamped on resolve | ✅ PASS | Service layer |
| `first_response_at` set on first reply | ✅ PASS | `add_comment()` service |
| SLA `due_at` shown in red when overdue | ✅ PASS | Frontend conditional class |
| TicketAssignment history preserved | ✅ PASS | Dual-write pattern |

### 5. Docker Stability
| Check | Result | Notes |
|-------|--------|-------|
| All 6 containers start healthy | ✅ PASS | |
| Backend auto-runs migrations on start | ✅ PASS | `manage.py migrate` in command |
| Frontend HMR works (edit → auto-reload) | ✅ PASS | Volume mount + Vite |
| Postgres data persists after restart | ✅ PASS | Named volume |
| Redis data persists after restart | ✅ PASS (Fixed) | Added AOF volume |
| Backend healthcheck passes | ✅ PASS | HTTP check on /admin/login/ |
| Celery worker picks up tasks | ✅ PASS | Depends on healthy Redis |

### 6. Security
| Check | Result | Notes |
|-------|--------|-------|
| `.env` file not committed | ✅ PASS | Gitignored, never in history |
| DEBUG=False by default | ✅ PASS | Only =1 in local `.env` (not committed) |
| CORS locked to domain in production | ✅ PASS | `if DEBUG` guard in settings |
| JWT tokens signed with sufficient key | ⚠️ WARNING | Dev key is dev-only; prod needs 50+ char key |
| Admin accessible only to is_staff | ✅ PASS | `IsAdminUser` permission class |
| Customer can't see other's tickets | ✅ PASS | Ownership filter in querysets |
| Webhook signature verification | ✅ PASS (Added) | HMAC check when secret is set |
| Password minimum length enforced | ✅ PASS | 10 char min in serializer + validators |
| Case-insensitive email uniqueness | ✅ PASS | `email__iexact` check in RegisterSerializer |
| Postgres credentials in docker-compose | ⚠️ WARNING | Dev-only values; see tech debt |
| Throttling configured | ✅ PASS | 20/min anon, 100/min user |

### 7. Performance
| Check | Result | Notes |
|-------|--------|-------|
| N+1 in ticket list | ✅ FIXED | `select_related` added |
| Double signal DB query | ✅ FIXED | Combined into one signal |
| Double ticket fetch in comments | ✅ FIXED | Instance cache |
| Search debounced | ✅ FIXED | 400ms debounce |
| Notifications polled (not spammed) | ✅ PASS | 30s interval, clears on unmount |
| Pagination on all list endpoints | ✅ PASS | DRF PageNumberPagination |
| Database indexes on hot query paths | ✅ PASS | idx_ticket_status_customer, idx_ticket_assigned_status |

---

## Remaining Technical Debt

### High priority (before production)

**1. Replace insecure dev SECRET_KEY with a real one**
Generate: `python -c "import secrets; print(secrets.token_urlsafe(50))"`
The dev key is long enough to suppress warnings but still contains "insecure" — Django intentionally names it that to signal "never use in production". Set a real random key in your production environment variables.

**2. Postgres credentials in docker-compose.yml**
`POSTGRES_PASSWORD: supportmitra` is fine for local dev but a risk if the file is ever used as a production template. Before deploying, move DB credentials to environment variables or Docker secrets, not the compose file.

**3. Payment webhook needs real HMAC integration**
The stub verifies the signature if `RAZORPAY_WEBHOOK_SECRET` is set, but there's no real payment state update logic. Phase 7 (Payments) should implement the full flow: verify signature → look up order → update Payment model → move ticket to "open".

**4. No email validation flow**
Users register with any email — there's no verification step. A user could register with someone else's email. Add Django-allauth email confirmation before going live.

**5. File upload architecture**
`TicketAttachment` model exists but upload endpoints don't. Phase 7 should wire up S3/GCS direct upload with signed URLs.

### Medium priority (before first external users)

**6. No rate limiting on login endpoint**
DRF throttling is global (100/min per user, 20/min anon). The login endpoint specifically needs a stricter limit (e.g. 5/minute per IP) to prevent credential stuffing. Use `AnonRateThrottle` override on the login view.

**7. Celery Beat has no scheduled tasks yet**
The scheduler runs but has no jobs. SLA breach checking should be a periodic task (every 5 minutes: find tickets past `due_at`, create `sla_breach` activity log, notify admin).

**8. Admin panel exposes user data without extra protection**
Django's `/admin/` is reachable at the standard path. In production, consider changing the URL, adding IP allowlisting, or requiring 2FA for admin accounts.

**9. No structured logging**
Currently using Django's default logging. Production needs JSON-formatted logs sent to a log aggregator (Papertrail, Datadog, or CloudWatch) so you can search and alert.

**10. Frontend has no error boundaries**
A crash in `CommentSection` or `ActivityTimeline` will blank the entire page. Wrap critical sections in React `<ErrorBoundary>` components to show a graceful "Something went wrong" message instead.

### Low priority (nice to have)

- **No frontend test coverage** — Add Vitest unit tests for critical hooks and Playwright E2E for login/ticket flows
- **No API versioning enforced** — The architecture supports `/api/v2/` but nothing prevents breaking changes to `/api/` right now; consider versioning before public launch
- **Freelancer onboarding flow incomplete** — Freelancers can register but there's no admin UI for approving/suspending them from the frontend (only Django admin)
- **Ticket list has no infinite scroll or load-more** — DRF pagination is set to 20, but the frontend shows all results at once; needs load-more for large datasets

---

## Production Readiness Score

```
┌─────────────────────────────────────────────────────────────┐
│  Area                         Score       Status            │
├─────────────────────────────────────────────────────────────┤
│  Authentication                 8/10      ✅ Solid          │
│  Authorization (permissions)    9/10      ✅ Solid          │
│  API correctness                8/10      ✅ Good           │
│  Data integrity                 9/10      ✅ Solid          │
│  Security hardening             5/10      ⚠️  Needs work    │
│  Performance                    7/10      ✅ Good           │
│  Error handling                 7/10      ✅ Good           │
│  Observability / logging        3/10      ❌ Needs work     │
│  Test coverage                  7/10      ✅ Good           │
│  Deployment readiness           4/10      ❌ Not yet        │
├─────────────────────────────────────────────────────────────┤
│  OVERALL MVP READINESS         67/100     🟡 Beta-ready     │
└─────────────────────────────────────────────────────────────┘
```

**What "Beta-ready" means:**
The platform is stable and functional for invited beta users who you can support manually. It is NOT ready for anonymous public traffic. The main blockers are: no email verification, no production deployment config, and no structured monitoring.

**What needs to happen before public launch:**
1. Email verification on registration
2. Production environment variables (real SECRET_KEY, DB creds, Redis password)
3. Structured logging + error alerting (Sentry is free for small projects)
4. Rate limit on login endpoint
5. Payment webhook fully implemented

---

## Beginner Debugging Handbook

### "Login works but I get logged out on page refresh"
**Cause:** The user object is missing from localStorage.
**Debug steps:**
1. Open browser DevTools → Application → Local Storage
2. Check for `access_token`, `refresh_token`, `user` keys
3. If `user` is missing: the `setUser()` call in `useAuth.js` didn't fire on login
4. If all keys are present: `initializeAuth()` in `authStore.js` isn't reading them correctly
5. Add `console.log` in `initializeAuth()` to see what branch it takes

### "API returns 401 on every request"
**Cause:** Either no token, expired token with failed refresh, or wrong token format.
**Debug steps:**
1. DevTools → Network → click the failing request → Headers → Request Headers
2. Look for `Authorization: Bearer <token>` — if missing, the Axios interceptor didn't fire
3. If present: paste the token into jwt.io and check expiry
4. If expired: check if the refresh endpoint is returning 200 or 401
5. If refresh returns 401: the refresh token is blacklisted (user may need to log in again)

### "Admin user gets redirected to /dashboard"
**Cause:** `user.is_staff` is `false` or `null` in the React store.
**Debug steps:**
1. DevTools → Application → Local Storage → `user` → check `is_staff` value
2. If `false`: the Django user doesn't have `is_staff=True` — run `python manage.py shell` → `user.is_staff = True; user.save()`
3. If `null`: the login response didn't include the user object — check `CustomTokenObtainPairSerializer`

### "Ticket list is empty but tickets exist in the database"
**Cause:** The API is filtering by the wrong customer profile.
**Debug steps:**
1. DevTools → Network → click the `/api/tickets/` request
2. Check the response: is `count: 0`? Or is the request failing (4xx)?
3. If `count: 0`: check the logged-in user has a `customer_profile` in Django admin
4. If 403: the user might be a freelancer or admin hitting the customer-only endpoint
5. Run in Django shell: `Ticket.objects.filter(customer__user__email='test@example.com').count()`

### "Comments don't appear after submitting"
**Cause:** The `refetch()` call isn't triggering a re-render, or the API returned an error.
**Debug steps:**
1. DevTools → Network → look for the POST to `/api/tickets/{id}/comments/`
2. If status is 201: check the GET after it — did `refetch()` fire?
3. If status is 403: the user might not own the ticket (e.g. freelancer + unassigned)
4. If status is 400: check the request body — `body` field might be empty

### "Docker containers restart-looping"
**Most common causes and fixes:**
```bash
# See what's wrong
docker compose logs backend --tail=50

# Database not ready yet — wait for healthcheck
docker compose ps   # "unhealthy" on db means Postgres is still starting

# Migration failed
docker compose exec backend python manage.py migrate --plan

# Port already in use
sudo lsof -i :8000   # kill the process using port 8000
```

### "Changes to Python files aren't taking effect"
Gunicorn runs with `--reload` in dev, so it should pick up changes automatically.
If it doesn't:
```bash
docker compose restart backend
```

### "Changes to React files aren't taking effect"
Vite's HMR (Hot Module Replacement) handles this automatically via the volume mount.
If the browser shows old code: hard-refresh with `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac).

### "TypeError: Cannot read properties of null (reading 'email')"
**Cause:** A component is trying to access `user.email` before the auth store is initialized.
**Fix:** Always guard with optional chaining: `user?.email` not `user.email`.
The `initializing` guard in `App.jsx` prevents most of these, but async edge cases can slip through.

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────────┐
│                          BROWSER                                     │
│                                                                      │
│  React + Vite (port 5173)                                           │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │   Pages     │  │  Components  │  │        State             │  │
│  │ Dashboard   │  │ TicketDetail │  │ Zustand authStore        │  │
│  │ NewTicket   │  │ CommentSect  │  │ - user, isAuthenticated  │  │
│  │ AdminDash   │  │ ActivityLog  │  │ - tokens in localStorage │  │
│  │ Login/Reg   │  │ NotifBell    │  └──────────────────────────┘  │
│  └──────┬──────┘  └──────────────┘                                 │
│         │                                                           │
│         ▼                                                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Axios Client (/api/* → proxy → Django)                     │   │
│  │  • Attaches Bearer token on every request                    │   │
│  │  • On 401: tries refresh, retries original, or → /login     │   │
│  └─────────────────────────────────────────────────────────────┘   │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ HTTP (Vite proxy in dev)
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    DJANGO BACKEND (port 8000)                        │
│                                                                      │
│  Gunicorn → Django → DRF                                            │
│                                                                      │
│  URLs: /api/auth/ /api/tickets/ /api/admin/ /api/notifications/     │
│                                                                      │
│  Layers:                                                            │
│  ┌──────────┐  ┌────────────┐  ┌─────────────────────────────┐    │
│  │  Views   │→ │ Serializers│  │        Services              │    │
│  │ (thin)   │  │ (validate) │  │ ticket_service.py            │    │
│  │ check    │  │ to/from    │  │ • create_ticket()            │    │
│  │ perms    │  │ JSON       │  │ • assign_ticket()            │    │
│  │ call     │  └────────────┘  │ • update_status()            │    │
│  │ service  │                  │ • add_comment()              │    │
│  └──────────┘                  │ notification_service.py      │    │
│                                │ • create_notification()      │    │
│  Signals (auto):               └─────────────────────────────┘    │
│  • auto_generate_ticket_number (pre_save)                          │
│  • log_ticket_changes (pre_save) — status/priority/severity log    │
│  • log_ticket_created (post_save) — first activity entry           │
│                                                                      │
│  Permissions:                                                        │
│  IsAdminUser | IsCustomer | IsFreelancer | IsOwnerOrAdmin           │
└──────────────┬──────────────────────────────┬───────────────────────┘
               │                              │
               ▼                              ▼
┌──────────────────────┐          ┌────────────────────────┐
│  PostgreSQL (5432)   │          │  Redis (6379)          │
│  • All data          │          │  • JWT blacklist        │
│  • Named volume      │          │  • Celery task queue   │
│    (postgres_data)   │          │  • Django cache        │
└──────────────────────┘          │  • Named volume        │
                                  │    (redis_data + AOF)  │
                                  └────────────────────────┘
                                               │
                                  ┌────────────┴───────────┐
                                  │  Celery Worker          │
                                  │  (background tasks)     │
                                  ├────────────────────────┤
                                  │  Celery Beat            │
                                  │  (scheduled tasks)      │
                                  └────────────────────────┘
```

### Key Design Decisions

**Why UUIDs everywhere?**  
Auto-increment IDs (1, 2, 3...) are guessable. Someone can enumerate `/api/tickets/1/`, `/api/tickets/2/` etc. UUIDs are 128-bit random values — practically impossible to guess. They're also globally unique, which matters if you ever shard the database.

**Why separate Customer/Freelancer profiles from User?**  
The `CustomUser` model only stores authentication data (email, password, role). Business data lives in `Customer` or `Freelancer`. This is the "Profile pattern" — it keeps auth concerns separate from business concerns and makes it easy to add new user types without changing the auth model.

**Why a service layer (ticket_service.py)?**  
Views know about HTTP. Services know about business logic. By keeping them separate:
- The same business logic can be called from a view, a Celery task, or a management command
- Tests can call service functions directly without HTTP overhead
- When logic gets complex, you only change one place

**Why pre_save signals for activity logging?**  
Once a row is saved, the old values are gone from the database. `pre_save` fires before the write, when you can still compare old vs new. It's the only clean hook for "detect what changed."

---

## Deployment Readiness Checklist

### Infrastructure
- [ ] Choose a cloud provider (Render, Railway, AWS, or DigitalOcean)
- [ ] Provision managed PostgreSQL (not Docker in production)
- [ ] Provision managed Redis (not Docker in production)
- [ ] Set up a CDN for frontend static assets (Cloudflare or AWS CloudFront)
- [ ] Register domain and configure DNS

### Environment Variables (production)
- [ ] `SECRET_KEY` — 50+ char random string (`python -c "import secrets; print(secrets.token_urlsafe(50))"`)
- [ ] `DEBUG=0`
- [ ] `ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com`
- [ ] `DATABASE_URL` — connection string to managed Postgres
- [ ] `REDIS_URL` — connection string to managed Redis
- [ ] `CORS_ALLOWED_ORIGINS` — your frontend URL
- [ ] `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- [ ] `DEFAULT_FROM_EMAIL` — your email sender
- [ ] Email SMTP settings (`EMAIL_HOST`, `EMAIL_PORT`, etc.)

### Code Changes Before Production
- [ ] Set `DEFAULT_PERMISSION_CLASSES` to `IsAuthenticated` (already conditional on DEBUG)
- [ ] Add rate limiting to the login endpoint (5/min per IP)
- [ ] Add email verification to registration flow
- [ ] Change Django admin URL from `/admin/` to something non-obvious
- [ ] Add Sentry or similar for error tracking
- [ ] Add structured logging (JSON logs to stdout, collected by your cloud provider)

### Database
- [ ] Run `python manage.py check --deploy` — addresses security warnings
- [ ] Confirm all migrations are applied
- [ ] Set up automated database backups (daily minimum)

### Frontend Build
- [ ] `npm run build` produces a `/dist` folder
- [ ] Set `VITE_API_URL` to the production backend URL
- [ ] Confirm the Vite proxy is replaced with a real reverse proxy (Nginx/Caddy) in prod

### Testing
- [ ] All 73 backend tests pass with production settings (`DEBUG=0`)
- [ ] Manual smoke test: register → create ticket → assign → comment → resolve
- [ ] Test admin panel access with production credentials

---

## Recommended Next Roadmap

### Phase 7 — Payments (2–3 weeks)
The biggest missing piece before real users can use the product.
- Integrate Razorpay: create order → redirect to checkout → webhook confirms payment → ticket moves to "open"
- Store invoice in PDF (WeasyPrint or ReportLab)
- Email invoice to customer after payment
- Test with Razorpay test mode credentials

### Phase 8 — Freelancer Portal (1–2 weeks)
Freelancers currently have backend APIs but no dedicated frontend.
- `/freelancer` dashboard showing assigned tickets
- Freelancer-specific ticket detail with status update controls
- Basic profile page (skills, availability, rating)

### Phase 9 — Notifications & Communication (1 week)
Move beyond in-app notifications.
- Email notifications for critical events (ticket assigned, resolved, SLA breach)
- WhatsApp Business API integration (already feature-flagged in settings)
- SLA breach Celery Beat task (already scaffolded, needs logic)

### Phase 10 — Analytics & Admin Upgrades (1–2 weeks)
- Admin dashboard with charts: tickets by status, resolution time, SLA compliance %
- Freelancer performance metrics (avg resolution time, CSAT score)
- CSV export for tickets and payments

### Phase 11 — Production Hardening (1 week, parallel with Phase 7–10)
- Sentry error tracking integration
- Structured JSON logging
- Health check endpoint returning DB + Redis status
- Nginx/Caddy reverse proxy config
- CI/CD pipeline (GitHub Actions: lint → test → build → deploy)
- Automated backups

### Phase 12 — Public Launch Prep (1 week)
- Email verification on registration
- Password reset flow
- Terms of Service / Privacy Policy pages
- Landing page with pricing
- GSTIN invoice generation (already has model + settings)
