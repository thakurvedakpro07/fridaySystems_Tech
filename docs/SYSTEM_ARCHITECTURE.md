# ResolveHQ — System Architecture

---

## High-level overview

ResolveHQ is a three-tier web application (React SPA → Django REST API → PostgreSQL).
Background tasks (emails, SLA checks, WhatsApp notifications) run asynchronously via Celery.

```
┌──────────────────────────────────────────────────────────────────┐
│ Browser                                                          │
│   React 18 SPA (Vite build, served as static files)             │
│   Zustand state management, Axios HTTP, React Router v6         │
└───────────────────────┬──────────────────────────────────────────┘
                        │ HTTPS
                        ▼
┌──────────────────────────────────────────────────────────────────┐
│ Nginx (host process on Ubuntu VPS)                               │
│   SSL termination (Let's Encrypt / certbot)                      │
│   /api/*         → proxy_pass Django (127.0.0.1:8000)           │
│   /static/       → serve from disk (collectstatic output)       │
│   /media/        → serve from disk (user uploads)               │
│   /*             → serve frontend/dist/ (React SPA)             │
└───────────────────────┬──────────────────────────────────────────┘
                        │ HTTP (internal)
                        ▼
┌──────────────────────────────────────────────────────────────────┐
│ Docker Compose — private bridge network                         │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ backend (Django 4.2 + Gunicorn)             port 8000   │    │
│  │   - JWT auth (SimpleJWT)                                │    │
│  │   - DRF REST API                                        │    │
│  │   - Razorpay payment processing                         │    │
│  │   - WhiteNoise static serving (dev/fallback)            │    │
│  │   - django-prometheus metrics                           │    │
│  └────────┬──────────────────────────┬────────────────────┘    │
│           │ SQL queries               │ Celery tasks            │
│           ▼                           ▼                         │
│  ┌─────────────────┐       ┌──────────────────────────────┐    │
│  │ db (Postgres 15) │       │ redis (Redis 7)              │    │
│  │   All app data   │       │   Celery broker + results    │    │
│  │   Ticket history │       │   Django cache + throttle    │    │
│  │   Payment records│       └───────────┬──────────────────┘    │
│  │   JWT blacklist  │                   │                       │
│  └─────────────────┘       ┌────────────▼───────────────────┐   │
│                             │ celery (Celery worker)         │   │
│                             │   Email notifications          │   │
│                             │   SLA breach alerts            │   │
│                             │   WhatsApp notifications       │   │
│                             └────────────────────────────────┘   │
│                             ┌──────────────────────────────────┐  │
│                             │ celerybeat (Celery Beat)         │  │
│                             │   Recurring SLA check (5 min)   │  │
│                             │   Daily report generation       │  │
│                             └──────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Component details

### React frontend (SPA)

| Item | Detail |
|------|--------|
| Framework | React 18 + Vite 5 |
| Styling | Tailwind CSS 3 |
| State | Zustand |
| Routing | React Router v6 |
| HTTP | Axios (with JWT interceptor + auto-refresh) |
| Auth | JWT stored in localStorage; refresh token rotated on each use |
| API base | `/api` (proxied to Django in dev, same-origin in prod via nginx) |

**User roles:**
- **Customer** — create tickets, view status, pay, submit CSAT
- **Freelancer** — accept tickets, add comments, close tickets
- **Admin** — full CRUD, assign tickets, analytics, billing

### Django backend

| Item | Detail |
|------|--------|
| Framework | Django 4.2 LTS |
| API layer | Django REST Framework |
| Auth | JWT (SimpleJWT) + django-allauth (Google OAuth) |
| Database ORM | Django ORM → PostgreSQL |
| File uploads | Django FileField → local mediafiles/ (S3 optional) |
| Static files | WhiteNoise (serves collectstatic output from Gunicorn) |
| Payments | Razorpay Python SDK |
| Background tasks | Celery 5 + Redis |
| Monitoring | django-prometheus → /metrics |
| Error tracking | Sentry SDK (opt-in via SENTRY_DSN env var) |

**Custom user model:** `support_app.CustomUser` (email-only, no username field)

**Key apps:**
- `support_app` — all business logic (tickets, payments, comments, CSAT, SLA)
- `supportmitra` — project config (settings, urls, wsgi, celery, gunicorn)

### Nginx (host process)

Nginx terminates TLS and acts as a reverse proxy. It never runs inside Docker — it's installed directly on the Ubuntu host so certbot can manage Let's Encrypt certificates easily.

**Why not Nginx in Docker?** Certbot's `--nginx` plugin modifies nginx.conf in-place and handles cert renewal automatically. Running nginx in a container requires a more complex cert renewal setup (certbot container + shared volumes). The host approach is simpler and just as secure for a single-server deployment.

### PostgreSQL (Docker)

- Version: 15-alpine (small, well-tested)
- Port 5432 is **not** exposed to the host in production (internal Docker network only)
- Data persisted via named Docker volume `postgres_data`
- Backups: `scripts/backup.sh` produces `.sql.gz` dumps

### Redis (Docker)

- Version: 7-alpine
- Append-only persistence enabled (`--appendonly yes`)
- Used for three things: Celery broker, Celery result backend, Django cache
- Port 6379 is **not** exposed to the host in production

### Celery workers (Docker)

- **celery** (worker): processes tasks from the Redis queue — emails, SLA checks, WhatsApp
- **celerybeat** (scheduler): fires periodic tasks on a cron schedule using `django_celery_beat.schedulers.DatabaseScheduler` (schedules stored in PostgreSQL)

---

## Request flow (ticket creation)

```
1. Customer clicks "Create Ticket" in React SPA
2. React sends POST /api/tickets/ with JWT Authorization header
3. Nginx receives HTTPS request, forwards HTTP to Django on 8000
   (sets X-Forwarded-Proto: https so Django knows it's secure)
4. Django verifies JWT, validates form data, saves ticket to PostgreSQL
5. Django fires send_ticket_opened_email.delay() → task queued in Redis
6. Django returns 201 JSON to nginx → nginx returns to browser
7. (Async) Celery worker picks up task, sends email via SendGrid
```

---

## Data flows

```
Ticket created → Celery: send email to customer
Ticket assigned → Celery: send email to freelancer
SLA approaching → celerybeat: fires every 5 min → checks tickets → alerts
Payment completed → Razorpay webhook → Django: verify signature → update ticket
```

---

## Security model

| Layer | Control |
|-------|---------|
| Transport | TLS 1.2/1.3 (Let's Encrypt) |
| Authentication | JWT (15-min access tokens, 7-day rotating refresh) |
| Authorization | Role-based (Customer / Freelancer / Admin) checked per-view |
| Rate limiting | Nginx: 30 req/s API, 5 req/min auth; DRF: 100/min user, 20/min anon |
| Secrets | Environment variables only — never in code or Docker images |
| Containers | Non-root user (`django`) inside backend image |
| Database | Not exposed to internet (Docker internal network) |
| Redis | Not exposed to internet (Docker internal network) |
| File uploads | Restricted to authenticated users; stored outside webroot |

---

## Scalability path

Current setup handles ~50 concurrent users on a 2-core VPS comfortably.

To scale:

1. **More gunicorn workers** — set in `gunicorn.conf.py` (auto-calculated from CPU count)
2. **More Celery workers** — `docker compose scale celery=3`
3. **Read replicas** — add `DATABASE_URL_REPLICA` and route GET queries there
4. **S3 for media** — set AWS_ vars in `.env` to move uploads off local disk
5. **Redis cluster** — for very high Celery throughput
6. **Separate frontend CDN** — upload `frontend/dist/` to CloudFlare Pages or Netlify
7. **Horizontal backend scaling** — add a load balancer in front of multiple VPS instances
