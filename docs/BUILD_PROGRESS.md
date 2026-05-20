# Build Progress Log

---

## 2026-05-20 — Phase 10: UX Polish + Security Hardening + Production Readiness

### Completed Today

* Fixed **UX-001** — registration form now surfaces every field-level API error as a bullet list; `registerUser()` in `useAuth.js` iterates all keys in `err.response.data` and accumulates them into an `errors[]` array; `Register.jsx` renders a `<ul>` when `errors.length > 1` and an inline string when it is 1
* Fixed **UX-003** — new ticket form applies the same multi-error unpacking pattern; generic "Failed to create ticket" fallback replaced by exact field names and messages from the DRF response
* Fixed **UX-005** — created `usePageTitle(title)` hook (8 lines) that calls `document.title` inside a `useEffect`; applied to all 7 page components; tab titles now read e.g. "TKT-ABC123 — SupportMitra" on the ticket detail page, "Admin Dashboard — SupportMitra" for admins, and "My Assigned Tickets — SupportMitra" for freelancers
* Added production-grade **secure HTTP headers** to `settings.py` gated by `if not DEBUG` — `SECURE_SSL_REDIRECT`, `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`, `SECURE_HSTS_SECONDS = 31536000`, `SECURE_HSTS_INCLUDE_SUBDOMAINS`, `SECURE_HSTS_PRELOAD`, `SECURE_BROWSER_XSS_FILTER`, `SECURE_CONTENT_TYPE_NOSNIFF`, `X_FRAME_OPTIONS = "DENY"` — none of these affect local development
* Created `backend/.env.example` — complete environment variable reference covering SECRET_KEY, DEBUG, ALLOWED_HOSTS, DATABASE_URL, REDIS_URL, email SMTP, Razorpay, AWS S3, JWT lifetimes, feature flags, timezone; no `.env.example` existed before
* Created `nginx/nginx.conf` — production reverse proxy configuration covering HTTP→HTTPS redirect, SSL/TLS 1.2+, Let's Encrypt certificate paths, HSTS + security headers, gzip compression, rate-limit zones for API and auth endpoints, `/api/` and `/django-admin/` proxy pass to Gunicorn, `/metrics` access restriction (localhost only), React SPA `try_files` routing, and aggressive cache headers for hashed static assets
* Generated 5 production-readiness documentation files (see Files Created)
* Verified frontend build is clean after all changes: `135 modules, 0 errors, 268 KB bundle (84 KB gzip)` — commit `842557f`

---

### Files Created

* `frontend/src/hooks/usePageTitle.js` — 8-line custom hook; calls `document.title` in `useEffect`; cleanup resets to "SupportMitra" on unmount
* `backend/.env.example` — complete commented environment variable reference for new deployments
* `nginx/nginx.conf` — production nginx reverse proxy (HTTP→HTTPS, SSL termination, rate limiting, static file serving, React SPA routing)
* `docs/PRODUCTION_DEPLOYMENT_GUIDE.md` — step-by-step Ubuntu 22.04 server deployment walkthrough: Docker, certbot, nginx, migrations, backups, update process
* `docs/UI_UX_IMPROVEMENT_REPORT.md` — Phase 10 UX changes documented with before/after; full prioritised UX backlog (HIGH/MEDIUM/LOW); confirmed "keep these" patterns
* `docs/PERFORMANCE_AUDIT.md` — backend query analysis (`select_related` confirmed, missing `prefetch_related` for comment authors identified); frontend bundle and render pattern review; baseline metrics table; prioritised optimisation backlog
* `docs/SECURITY_AUDIT.md` — 7-category security scorecard (**8.6/10**); all auth/authz controls verified; Phase 10 header additions documented; identified gaps: CSP header missing, Django admin URL not hardened, no per-user session invalidation on password change
* `docs/FINAL_LAUNCH_CHECKLIST.md` — 80-item pre-launch checklist across infrastructure, env config, Django settings, database, nginx/SSL, security, payments, email, S3, monitoring, smoke tests, and launch-day operations; ✅ marks items already complete in the codebase

---

### Files Modified

* `frontend/src/hooks/useAuth.js` — `registerUser()` catch block rewritten to collect all field errors from `err.response.data` into `errors[]`; returns `{ success: false, message, errors }` (backward-compatible: `message` still present for toast)
* `frontend/src/pages/Register.jsx` — `error: string` state replaced with `errors: string[]`; error box renders inline string for 1 error, `<ul>` bullet list for multiple
* `frontend/src/pages/NewTicket.jsx` — same multi-error unpacking pattern as Register; `error: string` → `errors: string[]`; added `usePageTitle("Open a Ticket")`
* `frontend/src/pages/Login.jsx` — added `usePageTitle("Sign In")`
* `frontend/src/pages/Dashboard.jsx` — added `usePageTitle("My Tickets")` in `CustomerDashboard` inner component
* `frontend/src/pages/TicketDetailPage.jsx` — added `usePageTitle(ticket?.ticket_number ?? "Ticket")` so the ticket number appears in the tab once loaded
* `frontend/src/pages/admin/AdminDashboard.jsx` — added `usePageTitle("Admin Dashboard")`
* `frontend/src/pages/admin/FreelancerList.jsx` — added `usePageTitle("Freelancers")`
* `frontend/src/pages/freelancer/FreelancerDashboard.jsx` — added `usePageTitle("My Assigned Tickets")`
* `backend/supportmitra/settings.py` — added 9 production security header settings under `if not DEBUG` guard

---

### Bugs Fixed

* **UX-001: Register form silently drops all but the first API error** — `registerUser()` used `||` chain to pick the first truthy field; fix: iterate `Object.entries(err.response.data)` and push all messages with field names as prefixes
* **UX-003: New ticket form shows generic error on any backend failure** — only `err.response?.data?.detail` was extracted; fix: same full-error unpacking as Register
* **UX-005: Browser tab always shows "SupportMitra" on every page** — no page set `document.title`; fix: `usePageTitle` hook applied to all 7 pages

---

### Pending Issues

* **Git push blocked** — no SSH key or HTTPS credentials configured in the shell session; commit `842557f` exists locally; run `git push origin master` from a terminal with GitHub auth to complete the push
* **CSP (Content Security Policy) header not yet implemented** — identified in SECURITY_AUDIT.md as Medium priority; requires frontend audit of inline scripts before a `Content-Security-Policy` header can be set without breaking Tailwind
* **Django admin URL still at `/django-admin/`** — should be changed to a non-obvious path before public launch; documented in SECURITY_AUDIT.md
* **`prefetch_related` missing for comment authors** — identified in PERFORMANCE_AUDIT.md; N+1 queries on ticket detail with many comments; Medium priority fix
* **No pagination UI on admin ticket list** — backend paginates at 20 results; frontend has no page navigation controls; acceptable at MVP scale
* **Celery task concurrency** — workers default to 1 process; should be set to `--concurrency 4` in `docker-compose.prod.yml` before production load
* **Razorpay payment flow** — still the highest-impact missing feature; tickets stuck at `pending_payment` until wired
* **File upload API endpoint** — `TicketAttachment` model exists; S3 integration and upload endpoint are Phase 11 work

---

### Architecture Decisions

* **`usePageTitle` as a standalone hook rather than a library** — avoids adding `react-helmet` or `react-helmet-async` as a dependency for an 8-line `useEffect`; the hook is clean enough to extend with description/meta tags if needed later
* **Multi-error accumulator pattern in `registerUser`** — returns both `message` (string, for backward-compat toast) and `errors` (string array, for the UI list); callers that only check `message` continue to work; callers that check `errors` get the full set
* **Secure headers gated by `if not DEBUG`** — `SECURE_SSL_REDIRECT=True` in development would break the local HTTP stack; all 9 headers are production-only; no environment-specific settings files or overrides needed
* **`nginx.conf` uses `limit_req_zone` at http block** — the zones must be declared in `/etc/nginx/nginx.conf` (the global http block), not inside the server block; the site config references them; this is documented in the deployment guide to prevent "zone not found" errors

---

### Next Step

* **Run `git push origin master`** from a terminal with GitHub credentials to publish commit `842557f`
* **Phase 11 — Razorpay payment integration** (highest business value; tickets currently stuck at `pending_payment` indefinitely):
  1. Implement `payment_service.create_consulting_fee_order(ticket, customer)` using Razorpay SDK
  2. Wire into `TicketListCreateView.create()` — return `checkout_url` in the 201 response
  3. `NewTicket.jsx` — `window.location.href = data.checkout_url` after ticket creation
  4. Implement `payment_webhook` view with HMAC-SHA256 signature verification
  5. On verified webhook: transition ticket to `open`, create `Payment` record, trigger email
* **Implement file upload endpoint** (second most visible missing feature):
  1. Configure `django-storages` + S3 bucket
  2. Add `POST /api/tickets/{id}/attachments/` endpoint
  3. Add file picker UI to `TicketDetail.jsx`

---

## 2026-05-20 — Phase 9: Complete Ticket Workflow + Full QA Audit (7 Bugs Fixed)

### Completed Today

**Ticket Workflow — Admin Actions**
* Built `AdminTicketActions.jsx` — amber-bordered panel with three modals: (1) Assign Freelancer — loads `listFreelancers()` on demand, renders email dropdown; (2) Change Status — uses `STATUS_TRANSITIONS` map to show only valid next states; (3) Unassign — with optional note field; all three call `onUpdate()` on success so the ticket detail refreshes
* Added `assignTicket`, `adminUpdateStatus`, `unassignTicket`, `adminListTickets`, `adminGetTicket`, `listFreelancers` API functions to `api/tickets.js`

**Ticket Workflow — Freelancer Portal**
* Built `FreelancerDashboard.jsx` at `/freelancer` — search + status filter with 400ms debounce; calls `freelancerListTickets(params)`; "No tickets assigned to you yet." empty state
* Built `FreelancerTicketActions.jsx` — green-bordered panel; `FREELANCER_TRANSITIONS` map (`assigned→in_progress`, `in_progress→waiting_customer/resolved`, `waiting_customer→in_progress/resolved`); modal with note field before each status change
* Added `FreelancerRoute` guard in `App.jsx`; registered `/freelancer` route

**Ticket Workflow — Customer CSAT**
* Built `CSATWidget.jsx` — 5-emoji rating (😄😊😐😕😞); only shown for `resolved`/`closed` tickets; checks `ticket.csat_score != null` to show "already rated" view; calls `submitCSAT` API; optional comment field

**Role-Aware Ticket Detail**
* Extended `TicketDetailPage.jsx` with `useRoleTicketFetcher(id)` hook — returns the correct fetch function and `role` label based on `user.is_staff` / `user.role`; passes `role` prop to `TicketDetail`
* Extended `TicketDetail.jsx` to render role-specific action panels between header and tabs: `AdminTicketActions` (amber) for admin, `FreelancerTicketActions` (green) for freelancer, `CSATWidget` (blue) for customer

**Phase 9 QA — 7 Bugs Found and Fixed (commit eca45b2)**
* Executed 90+ live API tests via curl across all three user flows; found 3 Critical, 3 High, 1 Low severity bugs; all fixed in the same session

**Documentation (4 QA docs)**
* Generated `docs/COMPLETE_MANUAL_TEST_REPORT.md`, `docs/BUG_REPORT.md`, updated `docs/UX_IMPROVEMENT_REPORT.md`, `docs/FINAL_MVP_STABILITY_SCORE.md` (8.2/10)

---

### Files Created

* `frontend/src/components/tickets/AdminTicketActions.jsx` — admin action panel with three modals (assign/status/unassign)
* `frontend/src/components/tickets/FreelancerTicketActions.jsx` — freelancer status update panel with note modal
* `frontend/src/components/tickets/CSATWidget.jsx` — 5-emoji CSAT rating widget for customers
* `frontend/src/pages/freelancer/FreelancerDashboard.jsx` — freelancer assigned-ticket list with search + status filter
* `docs/COMPLETE_MANUAL_TEST_REPORT.md` — 90+ E2E test results across all three user roles
* `docs/BUG_REPORT.md` — 7 bugs documented with root cause, reproduction steps, and fix (all resolved)
* `docs/FINAL_MVP_STABILITY_SCORE.md` — weighted 8.2/10 scorecard; beta launch assessment

---

### Files Modified

* `frontend/src/api/tickets.js` — added 7 new API functions: `assignTicket`, `adminUpdateStatus`, `unassignTicket`, `adminListTickets`, `adminGetTicket`, `freelancerListTickets`, `freelancerGetTicket`, `freelancerUpdateStatus`, `listFreelancers`, `submitCSAT`
* `frontend/src/components/tickets/TicketDetail.jsx` — now accepts `ticket`, `role`, `onUpdate` props; renders role-appropriate action panel
* `frontend/src/pages/TicketDetailPage.jsx` — added `useRoleTicketFetcher` hook; passes `role` and `onUpdate={loadTicket}` to `TicketDetail`
* `frontend/src/pages/Dashboard.jsx` — freelancer gets `<Navigate to="/freelancer">` instead of placeholder; added customer search input + status filter with debounce
* `frontend/src/App.jsx` — added `FreelancerRoute` guard; added `/freelancer` route; added `/freelancer/tickets/:id` route
* `frontend/src/components/layout/Header.jsx` — (QA fix) freelancer sees "My Tickets" → `/freelancer`; `+ New Ticket` hidden for `role === "freelancer"`
* `frontend/src/components/ui/Badge.jsx` — (QA fix) added `if (!label) return null` guard
* `backend/support_app/serializers.py` — (QA fix) `TicketDetailSerializer` now includes `csat_score = SerializerMethodField()` reading `obj.csat_survey.score`; added to `fields` and `read_only_fields`
* `backend/support_app/views.py` — (QA fix) `FreelancerTicketListView.get_queryset()` now handles `?search=` via `Q(title__icontains=search) | Q(ticket_number__icontains=search)`
* `docs/UX_IMPROVEMENT_REPORT.md` — updated for Phase 9 (new admin/freelancer/CSAT UX sections, 10-item backlog)

---

### Bugs Fixed

* **BUG-C1 (Critical): `adminUpdateStatus` sent `{ status: newStatus }` — backend expected `new_status`** — every admin status change returned `{"new_status": ["This field is required."]}` (400); fix: changed payload field name to `new_status` in `api/tickets.js`
* **BUG-C2 (Critical): `freelancerUpdateStatus` same field name mismatch** — same 400 error on every freelancer status update; fix: same field rename
* **BUG-C3 (Critical): `adminGetTicket` called non-existent `/admin/tickets/{id}/` endpoint** — admin ticket detail always showed "Could not load ticket" (404); fix: changed to `/tickets/${id}/` — `TicketDetailView` already handles `is_staff=True`
* **BUG-H1 (High): `csat_score` missing from `TicketDetailSerializer`** — `CSATWidget` always showed the rating form on refresh even after submission because `ticket.csat_score` was always `undefined`; fix: added `SerializerMethodField` returning `obj.csat_survey.score`
* **BUG-H2 (High): Freelancer dashboard search silently ignored** — `FreelancerTicketListView` had no `?search=` handling; all tickets always returned; fix: added `Q` filter on `title` and `ticket_number`
* **BUG-H3 (High): Header showed wrong nav links for freelancers** — "Dashboard" link pointed to `/dashboard` (causing redirect confusion); `+ New Ticket` button visible despite freelancers not being able to create tickets; fix: role-aware header logic
* **BUG-L1 (Low): `Badge.jsx` crashed on `null` label** — `label.replaceAll("_", " ")` threw `TypeError` when `ticket.severity` or `ticket.priority` was null; fix: `if (!label) return null`

---

### Pending Issues

* **Payment integration** — tickets created at `pending_payment` status; admin must manually transition them until Razorpay is wired
* **File upload** — `TicketAttachment` model exists in DB; no S3/API endpoint; customers cannot attach screenshots
* **Freelancer historical tickets** — freelancer dashboard only shows currently assigned tickets; resolved/closed tickets disappear
* **Freelancer internal notes** — no way for freelancers to post `is_internal=true` comments; backend supports it but no UI toggle
* **Customer ticket reopen button** — backend state machine supports reopen; no customer-facing UI button
* **Admin analytics** — no metrics or reporting dashboard for admins
* **No pagination UI on any list** — backend paginates at PAGE_SIZE=20 but no page controls in the frontend

---

### Architecture Decisions

* **`useRoleTicketFetcher` hook in `TicketDetailPage`** — single page component serves all three roles by selecting the correct API function and role label at runtime; avoids three separate page components for admin/freelancer/customer ticket detail
* **`STATUS_TRANSITIONS` map in `AdminTicketActions`** — hardcoded valid next-states per current state; keeps the transition logic readable and co-located with the UI; mirrors the backend's state machine without a round-trip
* **Role-specific action panel colour coding** — amber = admin, green = freelancer, blue = CSAT; consistent visual language makes the role context immediately clear; defined in panel background class, not a theme system

---

### Next Step

* **Phase 10 — Production hardening + UX polish** (see Phase 10 entry above — completed same day)

---

## 2026-05-20 — Django Admin Login Debugging + Root Cause Fix

### Completed Today

* Performed a 10-step systematic authentication investigation to diagnose why admin login was failing despite a successful password reset
* Confirmed all auth code is correct: `AUTH_USER_MODEL`, `USERNAME_FIELD`, `REQUIRED_FIELDS`, `AUTHENTICATION_BACKENDS`, `CustomUserAdmin` fieldsets — all verified healthy
* Confirmed all user DB flags are correct: `admin@supportmitra.in` has `is_staff=True`, `is_superuser=True`, `is_active=True`, valid PBKDF2 password hash, no duplicates
* Ran live `authenticate()` in Django shell — returned the user object correctly; authentication backend pipeline is not the problem
* Simulated a real HTTP admin login (CSRF token fetch → POST → session cookie check → dashboard GET) — received `302` + `200` + "Site administration | Django site admin" title, confirming the full web-layer flow works
* **Root cause identified:** User ran `python manage.py changepassword` outside Docker; without `DATABASE_URL` set, Django falls back to the local `backend/db.sqlite3` file; the Docker backend uses PostgreSQL; the two are completely independent databases — password was reset in the wrong one
* Set a verified, correctly hashed admin password for `admin@supportmitra.in` in PostgreSQL via `docker compose exec backend` — authentication confirmed end-to-end
* Added the "Wrong database" debugging scenario to `docs/COMPLETE_BEGINNER_GUIDE.md` Section 10 with root cause, diagnosis commands, fix, and the rule: "Every `manage.py` command must be prefixed with `docker compose exec backend`"

---

### Files Created

* None (operational fix — no new code files required)

---

### Files Modified

* `docs/COMPLETE_BEGINNER_GUIDE.md` — added new debugging scenario: "admin login fails after password reset" with full root-cause explanation, diagnosis commands, and prevention rule

---

### Bugs Fixed

* **Django admin login failing after password reset** — root cause: `python manage.py changepassword` was run locally (outside Docker), hitting `backend/db.sqlite3` (SQLite fallback) instead of the PostgreSQL database that the Docker backend reads from; the password was changed in the wrong database; fix: run all management commands via `docker compose exec backend python manage.py ...`

---

### Pending Issues

* Admin password `SupportMitra@Admin2026` is a reset credential — **change it immediately** after first login via `Admin → Users → admin@supportmitra.in → Password → Change Password`
* The stale `backend/db.sqlite3` file still exists on disk (it is gitignored so it won't be committed); it is safe to delete to prevent future confusion: `rm backend/db.sqlite3`
* All previously documented pending issues from Phase 8 remain (SECRET_KEY, DEBUG=0, SENTRY_DSN, Razorpay payment flow, Celery stubs, frontend tests, CI pipeline)

---

### Architecture Decisions

* **Confirmed: never run `manage.py` commands outside Docker when Docker is running** — this should be treated as a firm rule for the project; `docker compose exec backend python manage.py <command>` is the only safe invocation; local invocation silently hits SQLite instead of PostgreSQL and produces no error, making the discrepancy invisible until something stops working
* **`backend/db.sqlite3` is a latent hazard** — it exists as the Django default fallback when `DATABASE_URL` is not in the environment; since the project always uses Docker + PostgreSQL, this file is never intentionally used; it should be deleted and its existence treated as a warning sign that a command was run outside Docker

---

### Next Step

* **Change the admin password immediately:** open `http://127.0.0.1:8000/admin/`, log in with `admin@supportmitra.in` / `SupportMitra@Admin2026`, navigate to Users → admin@supportmitra.in → set a personal password
* **Delete the stale SQLite file:** `rm /home/vedak/Documents/fridaySystems_Tech/backend/db.sqlite3`
* **Phase 9:** Begin Razorpay consulting fee payment integration (highest-impact next feature — tickets currently stuck at `pending_payment` status indefinitely)

---

## 2026-05-19 — Phase 7: Zero-Bug Stabilization + Phase 8: Manual E2E Testing + Docs

### Completed Today

**Phase 7 — Zero-Bug Stabilization (8 critical/high-severity engineering fixes)**

* Fixed double-logout race condition — `useAuth.js` was calling `logoutApi()` twice (once explicitly, once inside `storeLogout()`), causing a second blacklist attempt on an already-invalidated token; removed the duplicate call and added `await storeLogout()` so the success toast fires after auth state is fully cleared
* Added `transaction.atomic()` to all multi-step service operations — `assign_ticket`, `unassign_ticket`, `add_comment`, and `update_status` in `ticket_service.py` now execute atomically; any partial failure rolls back all changes, preventing inconsistent DB state
* Created `FreelancerPublicSerializer` to prevent internal field leakage — original `FreelancerSerializer` exposed `contract_signed`, `onboarding_status`, and `active` to any authenticated user; new serializer exposes only `id`, `email`, `skills`, `availability`, `rating`; wired into `TicketDetailSerializer.assigned_to`
* Added `list_select_related` to Django admin — `TicketAdmin` and `TicketActivityLogAdmin` were firing N+1 queries (one per row) on every admin list page; `list_select_related = ["customer__user", "assigned_to__user"]` reduces this to a single JOIN; also made `TicketCommentInline` fully read-only (`can_delete = False`, all fields in `readonly_fields`)
* Protected `/metrics/` endpoint — Prometheus metrics were publicly accessible; wrapped with `staff_member_required` decorator so non-staff users receive a 302 redirect to the admin login page
* Added composite database indexes — `TicketActivityLog(ticket, action)` and `Notification(recipient, is_read)` were missing indexes; the two most-used query patterns both filter on two columns, making single-column indexes insufficient; created via `0004_phase7_composite_indexes.py` migration
* Added `safeLocalStorage()` wrapper in `authStore.js` — `localStorage.getItem()` throws `DOMException` in Safari private browsing mode; wrapped in try/catch that returns `null` on failure, preventing app crash on initialization
* Extended ticket number from 5 to 8 hex characters — 5 chars = ~1M unique values; birthday-paradox collision probability becomes significant after ~1,000 tickets; 8 chars = ~4B values; collision-safe at any realistic MVP scale

**Phase 8 — Full Manual End-to-End Testing (70 test scenarios, 3 user roles)**

* Ran 70 E2E test scenarios across auth, customer workflow, admin workflow, freelancer workflow, permission boundaries, failure states, notification flow, and DB consistency checks — 66/70 passed on first run
* Fixed BUG-001: `POST /api/tickets/` returned only write fields (no `id` or `ticket_number`) — `TicketListCreateView.perform_create` set `serializer.instance = ticket` but the serializer was `TicketCreateSerializer` which has no read fields; overrode `create()` to explicitly return `TicketListSerializer(ticket).data` in the HTTP 201 response
* Fixed BUG-002: `NewTicket.jsx` navigated to `/dashboard` after creation instead of the new ticket's detail page — `navigate("/dashboard")` was hardcoded and the API response was discarded; changed to `const { data } = await createTicket(formData); navigate(\`/tickets/${data.id}\`)`
* Fixed BUG-004: `assign_ticket` left `actor=None` on the auto-generated `status_changed` activity log — when `assign_ticket` called `ticket.save()` directly, `log_ticket_changes` pre_save signal fired with no actor context; added an actor-patch query immediately after `ticket.save()` to back-fill the actor, mirroring the existing pattern in `update_status`
* Fixed BUG-005: `resolved_at` persisted on the ticket after it was reopened — `update_status` only set `resolved_at` when transitioning *to* `resolved`; added `elif new_status not in ("resolved", "closed") and old_status == "resolved": ticket.resolved_at = None` to clear it on reopen
* Fixed BUG-006: `TicketForm.jsx` had no priority field — all tickets were created with `priority="medium"` regardless of urgency because the `priority` form field was initialised in state but never rendered; added `PRIORITIES` constant and a `<select>` dropdown between Severity and Description
* Fixed BUG-007: Freelancers hit `403 Forbidden` on `/dashboard` — `Dashboard.jsx` calls `GET /api/tickets/` which has `IsCustomer` permission; freelancers always got a raw Axios error; added a role guard (`if user?.role === "freelancer"`) that renders a clean "Freelancer Portal — coming soon" placeholder instead
* BUG-003 documented as non-blocking — `GET /api/admin/tickets/{id}/` returns 404 (no admin-specific detail endpoint exists); admins can use `/api/tickets/{id}/` instead as `TicketDetailView` already allows `is_staff`; noted for Phase 9 API cleanup
* All 73 pytest tests pass after Phase 7 + Phase 8 fixes — zero regressions
* Generated final MVP Stability Score: **8.15 / 10 — Ready for Controlled Beta Launch**

**Documentation Update**

* Updated `docs/COMPLETE_BEGINNER_GUIDE.md` — merged all Phase 5–8 content into existing structure without rewriting; added Sections 17–20 (Authentication Architecture, Production Engineering, QA & Testing Workflow, Project Status & Roadmap); updated models table (11 → 14), signals explanation (5 → 8 hex chars), service layer (stubs → implemented), component hierarchy (full tree), hooks table, request flow (transaction.atomic + correct redirect); expanded glossary by 22 terms; added test commands to cheat sheet (+538 lines total)

---

### Files Created

* `docs/COMPLETE_MANUAL_TEST_REPORT.md` — 70 E2E test cases with pass/fail results, all 7 bugs documented with root cause and fix, DB consistency checks
* `docs/UX_IMPROVEMENT_REPORT.md` — full UX audit across loading states, empty states, error messages, forms, navigation, mobile, notifications, accessibility; 13 issues with effort/priority ratings; 10 UX patterns confirmed working well
* `docs/FINAL_MVP_STABILITY_SCORE.md` — 8-category weighted stability scorecard (8.15 / 10), "must fix before public launch" checklist, phase progress summary, full bug history across Phases 6–8
* `backend/support_app/migrations/0004_phase7_composite_indexes.py` — migration that applies `idx_activity_log_ticket_action` and `idx_notif_recipient_read` composite indexes

---

### Files Modified

**Phase 7:**
* `frontend/src/hooks/useAuth.js` — removed duplicate `logoutApi()` call; changed `storeLogout()` → `await storeLogout()`; removed unused `logoutApi` import
* `backend/support_app/services/ticket_service.py` — added `transaction.atomic()` to `assign_ticket`, `unassign_ticket`, `add_comment`, `update_status`; added actor-patch logic in `assign_ticket`; added `resolved_at` clear on reopen in `update_status`
* `backend/support_app/serializers.py` — added `FreelancerPublicSerializer`; updated `TicketDetailSerializer` to use it for `assigned_to`; removed `notes` from `TicketDetailSerializer.fields`
* `backend/support_app/admin.py` — added `list_select_related` to `TicketAdmin` and `TicketActivityLogAdmin`; made `TicketCommentInline` fully read-only
* `backend/supportmitra/urls.py` — wrapped `prometheus_exports.ExportToDjangoView` with `staff_member_required`
* `backend/support_app/models.py` — added `idx_activity_log_ticket_action` and `idx_notif_recipient_read` index definitions to model `Meta`
* `backend/support_app/signals.py` — extended ticket number from `[-5:]` to `[-8:]`
* `frontend/src/store/authStore.js` — added `safeLocalStorage()` and `loadStoredUser()` helpers; updated `isAuthenticated` initialiser to use `safeLocalStorage`

**Phase 8:**
* `backend/support_app/views.py` — replaced `perform_create()` with full `create()` override in `TicketListCreateView`; returns `TicketListSerializer(ticket).data` in HTTP 201 response
* `frontend/src/pages/NewTicket.jsx` — changed to capture `data` from `createTicket()` response; redirects to `/tickets/${data.id}` instead of `/dashboard`
* `frontend/src/components/tickets/TicketForm.jsx` — added `PRIORITIES` constant; added `priority: "medium"` to initial form state; added priority `<select>` dropdown
* `frontend/src/pages/Dashboard.jsx` — added `useAuthStore` import and `user` selector; added freelancer role guard rendering placeholder

**Documentation:**
* `docs/COMPLETE_BEGINNER_GUIDE.md` — merged all Phase 5–8 architecture content (see above)

---

### Bugs Fixed

* **Double-logout race condition** — `logoutApi()` called twice; second call hit an already-blacklisted token; removed duplicate; `await storeLogout()` ensures sequential execution
* **No transaction safety on multi-step DB operations** — a crash in step 3 of a 4-step assignment would leave the ticket partially updated; all service functions now use `transaction.atomic()`
* **Freelancer internal data exposed in API** — `contract_signed`, `onboarding_status`, `active` were visible to any authenticated user via `TicketDetailSerializer`; replaced with `FreelancerPublicSerializer`
* **N+1 queries in Django admin list views** — each row in the admin ticket list fired a separate `SELECT` for the customer and freelancer; fixed with `list_select_related`
* **`/metrics/` publicly accessible** — Prometheus metrics endpoint had no authentication; any visitor could view request counts, latency, DB query counts; protected with `staff_member_required`
* **Missing composite indexes** — queries on `(ticket, action)` and `(recipient, is_read)` were doing full-table scans; two composite indexes added
* **`localStorage` throws in private browsing** — Safari's private mode raises `DOMException` on any `localStorage` access; `safeLocalStorage()` wrapper catches and returns `null`
* **Ticket number collision risk** — 5 hex chars (~1M space); birthday-paradox collision likely after ~1,000 tickets; extended to 8 chars (~4B space)
* **BUG-001: `POST /api/tickets/` returned no `id`** — wrong serializer class used in response; overrode `create()` to return `TicketListSerializer`
* **BUG-002: Ticket creation redirected to dashboard** — `navigate("/dashboard")` hardcoded; fixed to `navigate(\`/tickets/${data.id}\`)`
* **BUG-004: Activity log `actor=None` on assignment** — `assign_ticket` bypassed `update_status` actor-patching; added post-save actor-patch query
* **BUG-005: `resolved_at` not cleared on reopen** — `update_status` only set, never cleared; added `elif` branch
* **BUG-006: No priority field in ticket form** — `priority` initialised in state but never rendered; added `<select>` dropdown
* **BUG-007: Freelancers saw 403 on dashboard** — no role guard; added early return with "coming soon" placeholder

---

### Pending Issues

* **`SECRET_KEY` is still `django-insecure-...`** — must be replaced with a 50+ char random string before any real users are onboarded
* **`DEBUG=1` in backend `.env`** — must be set to `0` in production; currently exposes stack traces on 500 errors
* **`SENTRY_DSN` not configured** — `sentry-sdk` is installed but `SENTRY_DSN` is blank; production errors will go undetected without it
* **`structlog` installed but unconfigured** — structured logging middleware is a stub; not producing structured output yet
* **No frontend tests** — zero Cypress or Playwright tests; no browser-level regression protection
* **No CI pipeline** — GitHub Actions file exists but is not functional; tests are not run automatically on push
* **Celery tasks are all stubs** — `send_ticket_opened_email`, `check_sla_breaches`, etc. all contain `pass`; background work does not happen
* **Razorpay payment flow not wired** — tickets remain at `pending_payment` status indefinitely without a real payment integration
* **Freelancer dashboard is a placeholder** — `Dashboard.jsx` shows "coming soon" for freelancers; no real assigned-ticket view exists
* **BUG-003 (documented, non-blocking)** — `GET /api/admin/tickets/{id}/` returns 404; admins use `/api/tickets/{id}/` as a workaround; API cleanup deferred to Phase 9
* **`ALLOWED_HOSTS` must be restricted** — currently `localhost,127.0.0.1,backend`; must be set to the exact production domain before deployment
* **HTTPS not configured** — JWT tokens sent over plain HTTP in production would be interceptable

---

### Architecture Decisions

* **`FreelancerPublicSerializer` as a separate class** — rather than adding conditional field exclusion logic to one serializer, a dedicated read-only public serializer is cheaper and clearer; it is impossible to accidentally expose a private field when the serializer never declares it
* **Actor-patch pattern for signal-triggered activity logs** — Django's `pre_save` signal has no caller context, so service functions that call `ticket.save()` directly must immediately query and back-fill the `actor` field on the just-created log entry; this is an accepted pattern given that the alternative (passing actor into every signal) would require monkey-patching Django internals
* **`transaction.atomic()` as the default for service functions** — every service function that touches more than one table is wrapped; functions that touch only one table (simple reads) are exempt; this is the minimum correct policy for a transactional support workflow
* **`safeLocalStorage()` as the only access point for localStorage** — all future reads from localStorage should go through this wrapper; raw `localStorage.getItem()` calls should not be introduced elsewhere in the codebase
* **`TicketListSerializer` used in `create()` response** — `TicketCreateSerializer` is write-only by design; using it in the response would require adding read fields to a write serializer, blurring its responsibility; a clean `create()` override that returns a different serializer is the correct DRF pattern
* **Stability score methodology** — 8 weighted categories (not a single pass/fail verdict) allow targeted investment: a 6.0 in Observability doesn't block beta, but it clearly identifies the next area to improve

---

### Next Step

* **Phase 9 — Razorpay consulting fee payment integration** (highest business value increment):
  1. Implement `payment_service.create_consulting_fee_order(ticket, customer)` using Razorpay SDK
  2. Wire into `TicketListCreateView.create()` — call after ticket save, return `checkout_url` in the 201 response
  3. In `NewTicket.jsx` — change from `navigate(\`/tickets/${data.id}\`)` to `window.location.href = data.checkout_url`
  4. Implement `payment_webhook` view with HMAC-SHA256 signature verification
  5. On verified webhook: transition ticket to `open` status, create `Payment` record
  6. Add tests for full payment + webhook flow

* **Pre-beta production hardening** (run before any real user onboards):
  1. Replace `SECRET_KEY` with a random 50+ char key
  2. Set `DEBUG=0`, `ALLOWED_HOSTS=<production-domain>`, configure HTTPS
  3. Set `SENTRY_DSN` for error tracking
  4. Tune DRF throttle rates

---

## 2026-05-19 — Docker Infrastructure Stabilisation + Full Environment Audit

### Completed Today

* Diagnosed and resolved system Redis port conflict — Ubuntu's `redis-server.service` was auto-starting at boot and holding port 6379, blocking Docker Redis from binding
* Root-caused gunicorn binding to `127.0.0.1` (loopback) instead of `0.0.0.0` — traced to a YAML `>` folded scalar bug in `docker-compose.yml` where indented continuation lines preserved literal `\n` characters, causing `sh -c` to treat `--bind 0.0.0.0:8000` as a separate shell command that never reached gunicorn
* Fixed Django admin CSS/JS not loading — gunicorn does not serve static files; added WhiteNoise middleware to serve them directly from the WSGI process without nginx
* Added `collectstatic --noinput` to backend startup command so static files are always rebuilt on container start
* Added `DJANGO_SETTINGS_MODULE=supportmitra.settings` to `Dockerfile.backend` ENV so gunicorn, celery, and management commands all find the same settings without extra flags
* Fixed `docker-compose.yml` `env_file` path — was pointing at a non-existent root-level `.env`; corrected to `backend/.env`
* Added `celerybeat` as a 6th Docker service (was missing from compose file)
* Fixed Vite proxy target — added `VITE_API_TARGET: http://backend:8000` env var so the frontend container's proxy forwards `/api/*` to the Django container, not to `localhost` (which resolves to the frontend container itself)
* Added frontend volume mounts (`./frontend/src`, `./frontend/index.html`) for live Vite HMR
* Created `.dockerignore` to exclude `.venv`, `node_modules`, `staticfiles`, `.git` from Docker build context
* Conducted a 13-point full environment audit — all services verified healthy (backend, frontend, db, redis, celery, celerybeat, static files, migrations, CORS, hot reload, git hygiene)
* Fixed Celery 6.0 deprecation warning — added `CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True` to settings
* Added Python urllib healthcheck to backend service so Docker knows when Django is actually ready to serve
* Updated `frontend.depends_on` to `condition: service_healthy` so the frontend container waits for Django before starting
* Completely rewrote `docs/DAILY_STARTUP_GUIDE.md` — added stack table, hot reload explanation, troubleshooting section for every known failure mode, known warnings table, full recovery sequence, and shutdown checklist

### Files Created

* `.dockerignore` — excludes `.venv`, `node_modules`, `staticfiles`, `.git`, `dist`, local DB files from build context
* `docs/DAILY_STARTUP_GUIDE.md` — comprehensive daily reference with startup/shutdown, troubleshooting, recovery, and hot reload explanation (replaces the old startup guide)

### Files Modified

* `Dockerfile.backend` — added `ENV DJANGO_SETTINGS_MODULE=supportmitra.settings`
* `backend/requirements.txt` — added `whitenoise==6.7.0`
* `backend/supportmitra/settings.py` — added `WhiteNoiseMiddleware` (position: immediately after `SecurityMiddleware`); added `CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True`
* `docker-compose.yml` — fixed `env_file` path; fixed gunicorn `--bind` flag (YAML single-line command); added `collectstatic` to startup; added `celerybeat` service; fixed celery `depends_on` to use `service_healthy`; added `VITE_API_TARGET`; added frontend HMR volume mounts; added backend healthcheck; updated frontend `depends_on` to `condition: service_healthy`
* `frontend/vite.config.js` — Vite proxy `target` now reads `process.env.VITE_API_TARGET` with `http://localhost:8000` fallback (works both in Docker and bare local dev)
* `docs/How To Start Guide.md` — renamed to `docs/How To Start Guide_OLD_version.md`

### Bugs Fixed

* **Redis port 6379 occupied at startup** — Ubuntu installs `redis-server` as a systemd service set to `enabled`, so it claims port 6379 before Docker starts. Fix: `sudo systemctl stop redis-server && sudo systemctl disable redis-server`. Root cause: two Redis processes cannot bind the same port simultaneously.
* **`ERR_SOCKET_NOT_CONNECTED` on `127.0.0.1:8000`** — YAML `>` (folded block scalar) preserves newlines on lines that are indented more than the first content line. The multi-line gunicorn command had `--bind 0.0.0.0:8000` on a more-indented line, so it was parsed as a separate shell command rather than a flag. Gunicorn started without `--bind`, defaulted to `127.0.0.1:8000` (container loopback), and Docker's port mapping from the bridge network could not reach it. Fix: single-line command string.
* **Django admin unstyled (no CSS/JS)** — Gunicorn is a pure WSGI server; it does not serve static files. `django.contrib.staticfiles` only serves files when using `runserver`. Fix: WhiteNoise middleware wraps the WSGI app and intercepts all `/static/` requests before they reach Django. `collectstatic` must run first to populate `STATIC_ROOT`.
* **`env_file` pointing at non-existent file** — `docker-compose.yml` referenced `- .env` (project root) but the actual file is `backend/.env`. All env vars (SECRET_KEY, DATABASE_URL, REDIS_URL) were silently absent, forcing Django to use insecure defaults.
* **Frontend proxy pointing at itself** — Vite proxy `target: "http://localhost:8000"` inside a Docker container resolves `localhost` to the frontend container's own loopback, not the Django container. Fix: use Docker service name `http://backend:8000` via `VITE_API_TARGET` env var.
* **Celery `CPendingDeprecationWarning` on startup** — `broker_connection_retry` setting will be removed in Celery 6.0. Fix: explicit `CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True` in settings.

### Pending Issues

* **`SECRET_KEY` is `django-insecure-supportmitra123`** — acceptable for local dev (`.env` is git-ignored) but must be replaced with a 50+ character random key before any staging or production deployment
* **JWT refresh token in `localStorage`** — XSS-vulnerable; must move to `httpOnly` cookie in Phase 5 (security hardening)
* **Redis `vm.overcommit_memory` kernel warning** — non-critical for dev; requires `sudo sysctl vm.overcommit_memory=1` on the host to suppress
* **No `npm audit` run** — frontend dependencies not security-scanned
* **Consulting fee Razorpay checkout not wired** — Phase 2 (next priority)

### Architecture Decisions

* **WhiteNoise over nginx for dev** — adding nginx as a sidecar just to serve static files in development is over-engineering. WhiteNoise handles it with two lines of config, works identically in dev and production, and removes the nginx-vs-Django routing complexity entirely.
* **Backend healthcheck via Python urllib** — curl is not installed in the `python:3.11-slim` image. Using `python -c "import urllib.request; urllib.request.urlopen(...)"` avoids adding a system-level dependency just for health checks.
* **Single-line docker-compose command** — multi-line `sh -c` via YAML `>` (folded scalar) is unsafe because indented continuation lines preserve newlines, breaking argument parsing. Convention: always write the full command as a single quoted string.
* **`VITE_API_TARGET` environment variable** — decouples the Vite proxy target from the build. Inside Docker it is `http://backend:8000`; outside Docker it falls back to `http://localhost:8000`. Zero code change needed between the two environments.

### Next Step

* **Phase 2 — Razorpay consulting fee integration** (environment is now stable enough to build on):
  1. Implement `payment_service.create_consulting_fee_order(ticket, customer)` using the Razorpay SDK
  2. Wire into `TicketListCreateView.perform_create` — call after ticket save, return `checkout_url`
  3. In `NewTicket.jsx` — redirect to `checkout_url` after successful ticket creation
  4. Implement `payment_webhook` view with HMAC-SHA256 signature verification
  5. On successful webhook: set ticket status `open`, generate GST invoice PDF via ReportLab, send email via SendGrid

---

## 2026-05-18 — MVP Auth + Ticketing Stabilisation (First Full Run)

### Completed Today

* Created the first Django migration (`0001_initial.py`) — all 11 models written to the PostgreSQL schema for the first time; database is now functional
* Fixed `AdminRoute always blocks` bug — `CustomTokenObtainPairView` and `CustomTokenObtainPairSerializer` added to return `{id, email, is_staff}` in the login response; without `is_staff`, the frontend `AdminRoute` guard always redirected admins to the login page
* Added `is_staff` to `RegisterView` response — ensures new admin accounts also receive the flag on first registration
* Implemented proper `logout_view` — POSTs the refresh token to the SimpleJWT blacklist; previously there was no logout endpoint and tokens lived indefinitely
* Fixed `TicketDetailView` admin crash — `get_queryset` was calling `request.user.customer_profile` which raises `RelatedObjectDoesNotExist` for staff users; added `if self.request.user.is_staff: return Ticket.objects.all()` guard
* Fixed `TicketCommentListCreateView` — replaced direct queryset filter with `_get_ticket()` helper that correctly handles staff (all tickets), customers (own tickets only), and other roles (403)
* Fixed `TicketDetail.jsx` `assigned_to` path — was rendering `ticket.assigned_to?.user?.email` but serializer returns `ticket.assigned_to?.email`; silent bug until assignment feature is built
* Added `initializeAuth()` action to Zustand auth store — on page refresh the app re-fetches the user's profile to rehydrate `{id, email, is_staff}` from a valid stored token; without this, `user` was always `null` after refresh even when logged in, breaking all auth-gated UI
* Added `initializing` flag to auth store — `App.jsx` now waits for `initializeAuth()` to complete before rendering routes, preventing a flash of the login page on refresh for authenticated users
* Added `getMyProfile()` API function (`api/auth.js`) called by `initializeAuth`
* Created `backend/support_app/apps.py` — `AppConfig` subclass that registers signals in `ready()`; without this, `signals.py` was never imported and ticket numbers were not auto-generated
* Added `/api/auth/logout/` and wired login to `CustomTokenObtainPairView` in `urls.py`
* Substantially expanded the test suite — `test_auth.py`, `test_tickets.py` (+227 lines), `test_payments.py` all updated to cover the fixed flows end-to-end
* Created `docs/How To Start Guide.md` and `docs/SupportMitra_Startup_Guide.pdf` — first written startup documentation for the project
* Added prompt templates to `prompts/` directory for structured Claude sessions

### Files Created

* `backend/support_app/migrations/0001_initial.py` — initial database migration for all 11 models
* `backend/support_app/apps.py` — `SupportAppConfig` with `ready()` signal registration
* `frontend/src/pages/TicketDetailPage.jsx` — page wrapper at `/tickets/:id` (reads `useParams`, fetches ticket, renders `TicketDetail`)
* `docs/How To Start Guide.md` — first startup guide (later superseded by `DAILY_STARTUP_GUIDE.md`)
* `docs/SupportMitra_Startup_Guide.pdf` — PDF version of startup guide
* `docs/Git commit changes guide.md` — git workflow reference
* `prompts/MASTER_BUG_AUDIT_PROMPT step-1.md` — structured bug audit prompt template
* `prompts/Bug fixing step-2.md` — structured bug fixing prompt template

### Files Modified

* `backend/support_app/views.py` — added `CustomTokenObtainPairSerializer`, `CustomTokenObtainPairView`, `logout_view`; fixed `TicketDetailView.get_queryset`; fixed `TicketCommentListCreateView` with `_get_ticket()` helper
* `backend/support_app/serializers.py` — minor updates to align with view changes
* `backend/support_app/urls.py` — added `/api/auth/logout/`; wired `/api/auth/login/` to `CustomTokenObtainPairView`
* `backend/supportmitra/settings.py` — minor update (signal / app registration)
* `backend/requirements.txt` — added `django-prometheus==2.3.1`
* `backend/tests/test_auth.py` — expanded auth flow coverage
* `backend/tests/test_tickets.py` — major expansion (+227 lines) covering ticket CRUD, ownership, admin access
* `backend/tests/test_payments.py` — expanded webhook and payment flow tests
* `frontend/src/App.jsx` — added `TicketDetailPage` route (`/tickets/:id`); added `initializeAuth()` call on mount
* `frontend/src/api/auth.js` — added `getMyProfile()` function
* `frontend/src/store/authStore.js` — added `initializing` state and `initializeAuth()` async action
* `frontend/src/hooks/useAuth.js` — updated to consume `initializeAuth` and `initializing`
* `frontend/src/components/tickets/TicketDetail.jsx` — fixed `assigned_to` email path
* `frontend/src/components/tickets/TicketForm.jsx` — refactored API call pattern
* `frontend/src/components/ui/Badge.jsx` — minor status colour fix
* `frontend/src/pages/admin/AdminDashboard.jsx` — minor update
* `docs/BUILD_PROGRESS.md` — added 2026-05-15 Session 4 entry

### Bugs Fixed

* **`AdminRoute` always redirects to login** — `is_staff` was absent from the login/register API response, so `user?.is_staff` was always `undefined` (falsy) in the Zustand store. `AdminRoute` correctly blocked every user including real admins. Fixed by implementing `CustomTokenObtainPairSerializer` that extends SimpleJWT's default serializer to inject `{id, email, is_staff}` into every login response.
* **`TicketDetailView` crashes for staff** — `get_queryset` called `self.request.user.customer_profile` which raises `RelatedObjectDoesNotExist` for `is_staff` users who have no `Customer` record. Fixed by adding an early `if self.request.user.is_staff: return Ticket.objects.all()` guard.
* **`TicketDetail.jsx` renders blank assigned freelancer** — path was `ticket.assigned_to?.user?.email` but the `FreelancerSerializer` exposes email at `ticket.assigned_to?.email`. No visible impact yet but corrected before Phase 3 assignment feature.
* **Auth state lost on page refresh** — Zustand store was initialised with `user: null` on every load. Even with a valid token in `localStorage`, the `user` object (and therefore `is_staff`) was not available until the next login. Fixed by `initializeAuth()` which fetches `/api/profile/me/` on app mount and rehydrates the store, or clears stale tokens on failure.
* **Signal handler never ran** — `signals.py` (ticket number generator) was never imported because `apps.py` did not exist. Ticket numbers were not being auto-generated. Fixed by creating `SupportAppConfig.ready()` with `import support_app.signals`.
* **No logout endpoint** — there was no way to blacklist a refresh token server-side. Added `POST /api/auth/logout/` which blacklists the token and returns 204.

### Pending Issues

* **Docker never successfully started** — `env_file: .env` points at a root-level file that does not exist; gunicorn command had YAML multi-line bug; no `.dockerignore`; celerybeat missing from compose. These blockers were resolved in the 2026-05-19 session.
* **Consulting fee checkout not wired** — Phase 2
* **Ticket number not truly sequential** — UUID tail approach; collision risk at scale; Phase 2 fix
* **JWT refresh token in `localStorage`** — Phase 5 security hardening

### Architecture Decisions

* **`CustomTokenObtainPairSerializer` pattern** — extending SimpleJWT's serializer rather than writing a custom login view keeps JWT token generation logic inside the library. Only the response payload is extended. This approach is the official SimpleJWT recommendation for enriching login responses.
* **`initializeAuth` in Zustand + `initializing` flag** — prevents the "flash of login page" on refresh by blocking route rendering until the auth state is known. The flag starts `true` and is set `false` when the profile fetch settles, regardless of outcome.
* **`_get_ticket()` helper in comment view** — consolidates the ownership-check logic that would otherwise be duplicated between `get_queryset` and `perform_create`. Single point of truth for "which users can see this ticket's comments."

### Next Step

* Fix Docker environment (all startup blockers — addressed 2026-05-19)
* Then Phase 2: Razorpay consulting fee integration

---

## 2026-05-15 (Session 4)

### Completed Today

* Fixed bug: clicking a TicketCard on the Dashboard or Admin Dashboard now correctly navigates to the ticket detail page instead of redirecting to home
* Created `TicketDetailPage.jsx` — a page wrapper that reads the ticket ID from the URL, fetches the ticket from the API, handles loading/error states, and renders the existing `TicketDetail` component
* Added `/tickets/:id` route to `App.jsx` — 1 import line + 1 route block; all other routes and guards unchanged

### Files Created

* `frontend/src/pages/TicketDetailPage.jsx` — page at `/tickets/:id`; uses `useParams` to read the ID, `getTicket(id)` to fetch, and renders `<TicketDetail />` with the result

### Files Modified

* `frontend/src/App.jsx` — added `import TicketDetailPage` and `<Route path="/tickets/:id">` wrapped in `PrivateRoute`

### Bugs Fixed

* **Ticket card click goes to home page** — `TicketCard.jsx` linked to `/tickets/:id` but no such route existed in `App.jsx`. React Router's catch-all (`*`) was silently redirecting every ticket click to `/`. Fixed by registering the route and creating the missing page.

### Pending Issues

* **`.env` file not created** — `manage.py` will not start without `SECRET_KEY`. Must create `backend/.env` from `.env.example` before running Docker.
* **No migration files** — `makemigrations` has never been run. Database tables do not exist. Run before testing any API.
* **AdminRoute always blocks** — `user?.is_staff` is always `undefined` because neither `TokenObtainPairView` nor `RegisterView` returns `is_staff` in the response. Admin pages unreachable through the browser UI.
* **`TicketDetailView` admin crash** — `get_queryset` calls `request.user.customer_profile` which raises `RelatedObjectDoesNotExist` for staff users.
* **`TicketDetail.jsx` assigned_to path wrong** — renders `ticket.assigned_to?.user?.email` but the serializer returns `ticket.assigned_to?.email` (email is a top-level field on the nested serializer). No visible impact until Phase 3 adds assignment, but should be corrected then.
* **No payment redirect after ticket creation** — Phase 2.
* **Ticket number collision risk** — UUID tail approach, not sequential. Phase 2.

### Architecture Decisions

* **Page wrapper pattern** — `TicketDetail.jsx` remains a pure display component that accepts a `ticket` prop. The new `TicketDetailPage.jsx` owns data fetching. This preserves the existing three-tier model (page → domain component → UI primitive) and keeps `TicketDetail.jsx` reusable if it ever needs to appear embedded somewhere else.
* **`navigate(-1)` for back button** — sends the user back to whatever page they came from (Dashboard or Admin Dashboard) without hardcoding a path.

### Next Step

* **Fix the two setup blockers** — create `.env` from `.env.example` and run `makemigrations` + `migrate` so the app can actually start
* **Fix AdminRoute** — add `is_staff` to the login/register API response so admin users can reach `/admin`
* **Fix TicketDetailView admin crash** — one-line guard in `views.py`
* **Then start Phase 2** — Razorpay consulting fee integration

---

## 2026-05-15 (Session 3)

### Completed Today

* Conducted a full file-by-file audit of the existing Django backend (37 files): confirmed all models, serializers, views, URL routing, permissions, signals, services stubs, integrations, and tests are correctly structured and match the `PROJECT_DOCUMENTATION.md` spec
* Conducted a full file-by-file audit of the existing React/Vite/Tailwind frontend (30 files): confirmed all pages, layout components, UI primitives, ticket components, hooks, Axios client, Zustand store, and route guards are correctly structured
* Produced a comprehensive beginner-friendly architecture reference covering: layered data-flow diagram, every `requirements.txt` dependency explained, every `package.json` dependency explained, Django model design decisions (UUID PKs, `on_delete` choices, `related_name`), DRF serializer patterns (multiple serializers per model, `write_only`, `read_only_fields`, `source`), DRF permission classes (`has_permission` vs `has_object_permission`), React component tiers (page / domain / UI primitive), Zustand vs Redux vs Context trade-offs, Axios interceptor JWT-refresh pattern, and Vite dev proxy explained
* Correctly identified that two "implement from scratch" requests referred to already-existing code — responded with explanations of the existing code rather than regenerating files, preventing accidental rewrites

### Files Created

* None — this was a review and documentation session; all code was already in place from Sessions 1 and 2

### Files Modified

* `docs/BUILD_PROGRESS.md` — added Session 3 entry (this update)

### Bugs Fixed

* None — all code-level bugs in scope were resolved in Session 2

### Pending Issues

* **Consulting fee checkout not wired** — `TicketListCreateView.perform_create` sets status to `pending_payment` but does not call Razorpay or return a `checkout_url`. This is the top Phase 2 blocker.
* **`TicketDetailView.get_queryset` fails for admin users** — filters by `request.user.customer_profile`, which raises `RelatedObjectDoesNotExist` for `is_staff` users. Fix needed before admin ticket-detail views are used.
* **Ticket number not truly sequential** — `signals.py` uses UUID tail (`TKT-XXXXX`), not a PostgreSQL `SEQUENCE`. Collision risk at scale. Replace in Phase 2.
* **JWT refresh token in `localStorage`** — XSS-vulnerable. Must move to `httpOnly` cookie in Phase 5.
* **No `npm audit` run** — frontend dependencies not security-scanned. Run before any public deployment.
* **No database seed fixtures** — `README.md` references `fixtures/seed.json`; file does not exist.
* **Tests not yet run against PostgreSQL** — tests use SQLite fallback locally. Run `docker compose exec backend pytest tests/ -v` to validate against real PostgreSQL before starting Phase 2.

### Architecture Decisions

* **No rewrites of existing code** — both the Django backend and React frontend skeletons were confirmed correct and complete. The safe policy is: never regenerate a working file; always read it first and edit only what needs to change.
* **Three-tier React component model confirmed** — pages (smart, call hooks), domain components (display, receive props), UI primitives (no domain knowledge). This boundary must be maintained as Phase 2 adds payment and invoice UI.
* **Services layer is the correct Phase 2 target** — all business logic (Razorpay calls, invoice generation, email dispatch) belongs in `services/`, not in views. Views must remain thin HTTP wrappers.

### Next Step

* **Start Phase 2 — Razorpay consulting fee integration** (the single most valuable increment):
  1. Implement `backend/support_app/services/payment_service.py` → `create_consulting_fee_order(ticket, customer)` using the Razorpay SDK
  2. Wire into `TicketListCreateView.perform_create` — call the service after saving the ticket
  3. Return `checkout_url` in the `POST /tickets/` response (add to `TicketCreateSerializer` output)
  4. In `frontend/src/pages/NewTicket.jsx` — after ticket creation, `window.location.href = data.checkout_url`
  5. Implement `payment_webhook` with HMAC-SHA256 verification + set ticket status to `open` on success
  6. Write `test_payments.py` integration test for the full flow

---

## 2026-05-15 (Session 2)

### Completed Today

* Fixed blocking bug: added `"django.contrib.sites"` to `INSTALLED_APPS` in `settings.py` — without this, `django-allauth` (which requires `SITE_ID = 1`) caused `python manage.py migrate` to fail
* Fixed blocking bug: created `backend/pytest.ini` with `DJANGO_SETTINGS_MODULE = supportmitra.settings` — without this, `pytest tests/` crashed with a Django import error before running a single test
* Created `backend/conftest.py` with three shared fixtures: `api_client`, `make_user` (factory), `auth_api_client` — individual test files can now reuse these instead of copy-pasting setup code

### Files Created

* `backend/pytest.ini` — pytest-django settings configuration
* `backend/conftest.py` — shared fixtures: `api_client`, `make_user`, `auth_api_client`

### Files Modified

* `backend/supportmitra/settings.py` — added `"django.contrib.sites"` to `INSTALLED_APPS` (line 41)

### Bugs Fixed

* **`django.contrib.sites` missing** — `django-allauth` requires `django.contrib.sites` in `INSTALLED_APPS` because it uses Django's `Site` model to know which domain it's running on. Without it, the `allauth` migrations cannot be applied and `manage.py migrate` exits with an error. Fixed by adding `"django.contrib.sites"` to `INSTALLED_APPS`.
* **No pytest configuration** — `pytest-django` needs to know which Django settings module to load before it can import any project code. Without `pytest.ini` (or `conftest.py` setting `django_settings_module`), running `pytest tests/` crashes immediately with `django.core.exceptions.ImproperlyConfigured`. Fixed by creating `backend/pytest.ini`.

### Pending Issues

* **Ticket number not truly sequential** — `signals.py` generates `TKT-XXXXX` from the last 5 hex chars of the UUID. Replace with a PostgreSQL `SEQUENCE` in Phase 2.
* **JWT refresh token in localStorage** — `api/client.js` reads `refresh_token` from `localStorage`, which is vulnerable to XSS. Move to `httpOnly` cookie in Phase 5 (security hardening).
* **Consulting fee checkout not wired** — `TicketListCreateView.perform_create` creates the ticket but does not generate a Razorpay order or return `checkout_url`. Phase 2 work.
* **No `npm audit` run** — Frontend dependencies have not been security-scanned.
* **No database seed fixtures** — `README.md` references `fixtures/seed.json` but that file does not exist yet.
* **`TicketDetailView.get_queryset` fails for admin users** — calls `self.request.user.customer_profile` which doesn't exist on admin/staff users. Phase 2 fix.

### Architecture Decisions

* **`pytest.ini` over `conftest.py` for settings** — The cleanest approach is `pytest.ini` because it's a static config file, not Python code. It's visible to any developer who opens the `backend/` folder and immediately explains the test setup. The `conftest.py` is reserved for fixtures, not configuration.
* **`make_user` as a factory fixture** — Rather than duplicating `User.objects.create_user()` + `Customer.objects.create()` across every test file, the `make_user` factory in `conftest.py` creates a user+customer pair in one call with sensible defaults that tests can override.

### Next Step

* **Phase 2: Razorpay consulting fee integration**
  1. Implement `payment_service.create_consulting_fee_order()` using the Razorpay SDK
  2. Wire it into `TicketListCreateView.perform_create`
  3. Return `checkout_url` in the ticket creation API response
  4. Implement `payment_webhook` view with HMAC-SHA256 signature verification
  5. On successful webhook: set ticket status `open`, generate GST invoice PDF, send email

---

## 2026-05-15

### Completed Today

* Set up the entire initial repository skeleton for SupportMitra — 68 files created from scratch
* Defined all 11 database models in `models.py`: Customer, Freelancer, Ticket, TicketComment, TicketAttachment, Payment, Subscription, SLAPolicy, SLALog, CSATSurvey, AuditLog
* All models use UUID primary keys and proper `choices` enumerations
* Written DRF serializers for all models (list, detail, create variants where needed)
* Implemented skeleton API views: health check, register, customer profile, services catalog, ticket CRUD, payment webhook stub, admin ticket list, admin freelancer list
* Wired URL routing: root `supportmitra/urls.py` → `support_app/urls.py` under `/api/` prefix
* Configured Django settings with full env-var loading via `python-dotenv` and `dj-database-url`
* Added production settings override in `settings_prod.py` (DEBUG=False, HTTPS enforcement, strict CORS)
* Configured Celery with Redis broker and `django-celery-beat` DatabaseScheduler
* Created 5 service layer stubs (ticket, payment, sla, notification, payout) — all raise `NotImplementedError` as placeholder
* Created 3 integration stubs (Razorpay client, osTicket, Zammad)
* Created 4 Celery task stubs in `tasks.py`
* Written `signals.py`: auto-generates `TKT-XXXXX` ticket number on first save
* Built 3 custom DRF permission classes: `IsAdminUser`, `IsCustomer`, `IsFreelancer`, `IsOwnerOrAdmin`
* Registered all models in Django admin with useful `list_display` and `search_fields`
* Set up React + Vite + Tailwind CSS frontend with full project structure
* Implemented Axios API client with JWT request interceptor and auto-refresh response interceptor
* Created Zustand auth store (`authStore.js`) for global login state
* Created `useAuth` and `useTickets` custom hooks
* Built reusable UI components: `Button`, `Badge` (with status/severity colour mapping), `Modal`
* Built layout components: `Header` (with auth-aware nav), `Footer`
* Built ticket components: `TicketCard`, `TicketForm` (loads services from API), `TicketDetail`
* Built 7 pages: Landing, Login, Register, Dashboard, NewTicket, AdminDashboard, FreelancerList
* Implemented React Router with `PrivateRoute` and `AdminRoute` guards
* Configured Vite dev proxy: `/api/*` → `http://localhost:8000` (no hardcoded backend URLs)
* Created Docker Compose for local dev (5 services: db, redis, backend, celery, celerybeat, frontend)
* Created `docker-compose.prod.yml` production overrides (no volume mounts, more Gunicorn workers, frontend excluded)
* Created `Dockerfile.backend` (Python 3.11-slim + Gunicorn) and `Dockerfile.frontend` (Node 20-alpine + Vite dev server)
* Created `.env.example` with every variable documented
* Created `.gitignore` covering Python, Node, Docker, and IDE files
* Created `README.md` with Quick Start, Manual Start, test instructions, and env variable reference
* Created CI pipeline (`ci.yml`): lint (flake8, black, eslint), bandit security scan, pytest, frontend build
* Created deploy pipeline (`deploy.yml`): SSH to VPS, docker compose pull/up, migrate, collectstatic, health check, Slack notify
* Written 3 real test files covering auth, ticket creation, and payment webhook
* `test_sla.py` stubs created and marked `@pytest.mark.skip` until Phase 3

### Files Created

**Root level**
* `.gitignore`
* `.env.example`
* `README.md`
* `docker-compose.yml`
* `docker-compose.prod.yml`
* `Dockerfile.backend`
* `Dockerfile.frontend`

**Backend — Django project config**
* `backend/manage.py`
* `backend/requirements.txt`
* `backend/requirements-dev.txt`
* `backend/supportmitra/__init__.py`
* `backend/supportmitra/settings.py`
* `backend/supportmitra/settings_prod.py`
* `backend/supportmitra/celery.py`
* `backend/supportmitra/urls.py`
* `backend/supportmitra/wsgi.py`
* `backend/supportmitra/asgi.py`

**Backend — core app**
* `backend/support_app/__init__.py`
* `backend/support_app/models.py`
* `backend/support_app/serializers.py`
* `backend/support_app/views.py`
* `backend/support_app/urls.py`
* `backend/support_app/admin.py`
* `backend/support_app/permissions.py`
* `backend/support_app/tasks.py`
* `backend/support_app/signals.py`
* `backend/support_app/migrations/__init__.py`

**Backend — services layer**
* `backend/support_app/services/__init__.py`
* `backend/support_app/services/ticket_service.py`
* `backend/support_app/services/payment_service.py`
* `backend/support_app/services/sla_service.py`
* `backend/support_app/services/notification_service.py`
* `backend/support_app/services/payout_service.py`

**Backend — integrations**
* `backend/support_app/integrations/__init__.py`
* `backend/support_app/integrations/razorpay_client.py`
* `backend/support_app/integrations/osticket.py`
* `backend/support_app/integrations/zammad.py`

**Backend — tests**
* `backend/tests/__init__.py`
* `backend/tests/test_auth.py`
* `backend/tests/test_tickets.py`
* `backend/tests/test_payments.py`
* `backend/tests/test_sla.py`

**Frontend**
* `frontend/index.html`
* `frontend/package.json`
* `frontend/vite.config.js`
* `frontend/tailwind.config.js`
* `frontend/postcss.config.js`
* `frontend/src/index.css`
* `frontend/src/main.jsx`
* `frontend/src/App.jsx`
* `frontend/src/api/client.js`
* `frontend/src/api/auth.js`
* `frontend/src/api/tickets.js`
* `frontend/src/api/payments.js`
* `frontend/src/store/authStore.js`
* `frontend/src/hooks/useAuth.js`
* `frontend/src/hooks/useTickets.js`
* `frontend/src/components/ui/Button.jsx`
* `frontend/src/components/ui/Badge.jsx`
* `frontend/src/components/ui/Modal.jsx`
* `frontend/src/components/layout/Header.jsx`
* `frontend/src/components/layout/Footer.jsx`
* `frontend/src/components/tickets/TicketCard.jsx`
* `frontend/src/components/tickets/TicketForm.jsx`
* `frontend/src/components/tickets/TicketDetail.jsx`
* `frontend/src/pages/Landing.jsx`
* `frontend/src/pages/Login.jsx`
* `frontend/src/pages/Register.jsx`
* `frontend/src/pages/Dashboard.jsx`
* `frontend/src/pages/NewTicket.jsx`
* `frontend/src/pages/admin/AdminDashboard.jsx`
* `frontend/src/pages/admin/FreelancerList.jsx`

**GitHub Actions**
* `.github/workflows/ci.yml`
* `.github/workflows/deploy.yml`

### Files Modified

* `docs/BUILD_PROGRESS.md` — populated for the first time (was a blank template comment)

### Bugs Fixed

* None — this was a greenfield skeleton build. No pre-existing bugs to fix.

### Pending Issues

* **No `conftest.py` for pytest** — `pytest-django` requires `DJANGO_SETTINGS_MODULE` to be set. Without a `conftest.py` or `pytest.ini`, running `pytest` will fail with an import error. Must be created before tests can run. Recommended fix: add `backend/conftest.py` with `django_settings = "supportmitra.settings"`.
* **Ticket number not truly sequential** — `signals.py` generates `TKT-XXXXX` from the last 5 hex chars of the UUID. This is readable but not sequential and has a theoretical collision risk at scale. Must be replaced with a PostgreSQL `SEQUENCE` in Phase 2.
* **JWT refresh token in localStorage** — The Axios client reads `refresh_token` from `localStorage`, which is vulnerable to XSS. In production this must be moved to an `httpOnly` cookie. Flagged for Phase 5 (security hardening).
* **Consulting fee checkout not wired** — `views.py → TicketListCreateView.perform_create` creates the ticket but does not generate a Razorpay order or return a `checkout_url`. The frontend's `NewTicket.jsx` has a `// TODO` comment where the redirect should happen. This is intentional — Phase 2 work.
* **No `npm audit` run** — Frontend dependencies have not been security-scanned. Run `cd frontend && npm audit` before any public deployment.
* **No database seed fixtures** — `README.md` references `fixtures/seed.json` but that file does not exist yet. Fixture creation is Phase 1 backlog.
* **`allauth` SITE_ID=1 requires `django_sites` migration** — `django-allauth` depends on Django's `sites` framework. The `django.contrib.sites` app is not in `INSTALLED_APPS`. This will cause a migration error. Must add `django.contrib.sites` to `INSTALLED_APPS` before first `migrate`.
* **`docker-compose.prod.yml` frontend profile** — The `profiles: ["dev-only"]` key on the frontend service is valid in Compose v2 but should be tested to confirm it correctly excludes the service in production.

### Architecture Decisions

* **Monorepo** — `backend/` and `frontend/` live in the same repository. Simplifies CI, Docker Compose orchestration, and deployment for a solo/small team. Can be split later if teams diverge.
* **Single Django app (`support_app`)** — All models and business logic live in one app rather than multiple (e.g. `tickets`, `payments`, `accounts`). Correct for MVP; avoids premature abstraction. Will split in Phase 5+ if the app grows too large.
* **UUID primary keys on all models** — Using `UUIDField` instead of integer auto-increment prevents enumeration attacks (attackers cannot guess `TKT-1`, `TKT-2`, etc.) and makes future data migrations and merges safer.
* **Services layer pattern** — Views are thin wrappers; all business logic (ticket creation, payment processing, SLA evaluation) lives in `services/`. This makes unit testing possible without spinning up a full HTTP server.
* **`settings.py` + `settings_prod.py` split** — Base settings load from `.env` and work for development. Production overrides are applied by setting `DJANGO_SETTINGS_MODULE=supportmitra.settings_prod`. Avoids environment-specific conditionals scattered throughout one large settings file.
* **Celery Beat with DatabaseScheduler** — Periodic tasks (SLA checks every 5 min, payout batches weekly) are stored in the database via `django-celery-beat`. Admin can modify schedules without redeploying code.
* **Vite dev proxy** — Frontend never hardcodes `http://localhost:8000`. All API calls use `/api/` prefix, proxied to Django in dev and served behind Nginx in production. Zero config change needed between environments.
* **Axios interceptor for JWT refresh** — Token refresh logic lives in `api/client.js` once, not in every API call. On any 401, the interceptor transparently refreshes and retries. Components never need to handle token expiry manually.
* **Zustand for auth state** — Chosen over Redux (too heavy) and plain React Context (re-renders entire tree). Zustand is minimal, hook-based, and has no boilerplate.

### Next Step

* **Fix the `conftest.py` issue first** — Create `backend/conftest.py` and `backend/pytest.ini` so that `pytest tests/ -v` runs without errors. This unblocks all future test-driven development.
* **Add `django.contrib.sites` to `INSTALLED_APPS`** — Required by `django-allauth`. Without it, `python manage.py migrate` will fail.
* **Then start Phase 2: Razorpay consulting fee integration** — Implement `payment_service.create_consulting_fee_order()`, wire it into `TicketListCreateView.perform_create`, return `checkout_url` in the API response, and handle the webhook in `payment_webhook` view with HMAC verification.

---

<!-- This becomes your memory system.

Every day update:

-what was completed
-bugs
-current architecture
-pending work
-decisions taken -->
