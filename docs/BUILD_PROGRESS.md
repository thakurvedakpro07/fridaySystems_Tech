# Build Progress Log

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
