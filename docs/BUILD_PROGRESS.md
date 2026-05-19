# Build Progress Log

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
