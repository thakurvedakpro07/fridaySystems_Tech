# ResolveHQ — Daily Startup Guide
_Last audited: 2026-05-20. All systems verified healthy._

---

## ⚠️ GOLDEN RULE — Always Use Docker

> **NEVER run Django or Python commands directly in your terminal.**
> **ALWAYS prefix every Django command with `docker compose exec backend`.**

Why: Without Docker, `python manage.py` has no access to the environment variables in
`backend/.env`. Django silently falls back to a local SQLite file instead of the
PostgreSQL container. Any user you create or password you change there is invisible to
the real database — and vice versa.

**Incident example (2026-05-20):** Ran `python manage.py changepassword` locally.
Django used SQLite. The Docker backend read PostgreSQL. Admin login failed for hours.
Fix: always `docker compose exec backend python manage.py ...`

**The two commands you must never run bare:**
```bash
# WRONG — DO NOT USE THESE
python manage.py <anything>
python manage.py runserver
```

**Always do this instead:**
```bash
docker compose exec backend python manage.py <anything>
```

---

## Project Location

```bash
~/Documents/fridaySystems_Tech
```

---

## Stack Overview

| Service      | Technology              | Port  | Notes                          |
|-------------|------------------------|-------|-------------------------------|
| `backend`   | Django 4.2 + Gunicorn  | 8000  | Static files via WhiteNoise   |
| `frontend`  | React + Vite           | 5173  | HMR hot reload active         |
| `db`        | PostgreSQL 15          | 5432  | Persisted via Docker volume   |
| `redis`     | Redis 7                | 6379  | Celery broker + Django cache  |
| `celery`    | Celery worker          | —     | 5 registered tasks            |
| `celerybeat`| Celery Beat scheduler  | —     | DatabaseScheduler             |

---

## IMPORTANT — Always Use Docker

**Never run these manually:**
```bash
# DO NOT USE
python manage.py runserver
npm run dev
```

Always use `docker compose` commands.

---

## Daily Startup (Step by Step)

### Step 1 — Open Terminal in Project Root

```bash
cd ~/Documents/fridaySystems_Tech
```

### Step 2 — Fix Docker Permissions (if needed)

If you see `permission denied` on Docker commands:
```bash
newgrp docker
```

### Step 3 — Start Everything

```bash
docker compose up -d
```

### Step 4 — Verify All Containers Are Healthy

```bash
docker compose ps
```

Expected output:
```
NAME                 STATUS
backend-1            Up (healthy)
frontend-1           Up
db-1                 Up (healthy)
redis-1              Up (healthy)
celery-1             Up
celerybeat-1         Up
```

> **Note:** `backend` takes ~30-40 seconds to show as `(healthy)` — it runs
> `collectstatic` + `migrate` before gunicorn starts. This is normal.

### Step 5 — Open in Browser

| URL                              | What it is          |
|----------------------------------|---------------------|
| `http://localhost:5173`          | React frontend      |
| `http://127.0.0.1:8000/django-admin/`  | Django admin panel  |

---

## Daily Shutdown

```bash
docker compose down
```

Always shut down properly to prevent corrupted container states.

---

## Full Stop + Wipe (last resort only)

```bash
docker compose down -v    # removes containers AND volumes (DELETES DB DATA)
```

> **Warning:** `-v` deletes the PostgreSQL volume. All database data is lost.
> Only use this if the database is corrupted and needs a fresh start.

---

## Useful Daily Commands

### View logs

```bash
docker compose logs backend          # backend only
docker compose logs -f backend       # follow (live tail) backend
docker compose logs -f               # follow all services
```

### Docker-Safe Django Command Reference

All Django commands must go through `docker compose exec backend`. Never run them bare.

```bash
# ── Migrations ───────────────────────────────────────────────────
# Generate new migration files after editing models.py
docker compose exec backend python manage.py makemigrations

# Apply all pending migrations to PostgreSQL
docker compose exec backend python manage.py migrate

# Check for unapplied migrations (shows nothing = all applied)
docker compose exec backend python manage.py showmigrations


# ── Users ────────────────────────────────────────────────────────
# Create a new Django admin superuser (interactive prompt)
docker compose exec backend python manage.py createsuperuser

# Change any user's password by email
docker compose exec backend python manage.py changepassword <email>
# Example: docker compose exec backend python manage.py changepassword admin@supportmitra.in


# ── Shell ────────────────────────────────────────────────────────
# Interactive Python shell with Django models loaded
docker compose exec backend python manage.py shell

# Example: verify a user exists in the real database
# >>> from support_app.models import CustomUser
# >>> CustomUser.objects.filter(email="admin@supportmitra.in").first()


# ── Static Files ─────────────────────────────────────────────────
# Collect all static files (runs automatically on startup via docker-compose command)
docker compose exec backend python manage.py collectstatic --noinput


# ── Tests ────────────────────────────────────────────────────────
# Run the full test suite (73 tests)
docker compose exec backend python -m pytest tests/ -v

# Run a specific test file
docker compose exec backend python -m pytest tests/test_tickets.py -v


# ── Logs ─────────────────────────────────────────────────────────
docker compose logs backend             # show backend logs
docker compose logs -f backend          # live-follow backend logs
docker compose logs -f                  # live-follow all services


# ── Restart / Rebuild ────────────────────────────────────────────
docker compose restart backend          # restart backend only
docker compose restart celery celerybeat

# Full rebuild (after changing requirements.txt or Dockerfiles)
docker compose down
docker compose up --build -d
```

### Restart a single service

```bash
docker compose restart backend
docker compose restart celery
docker compose restart frontend
```

### Rebuild after dependency changes

```bash
docker compose down
docker compose up --build -d
```

Use `--build` whenever you change:
- `requirements.txt`
- `Dockerfile.backend` or `Dockerfile.frontend`
- `package.json`

---

## Hot Reload — How It Works

### Backend (Python/Django)
- `./backend/` is mounted live into the backend container
- Gunicorn runs with `--reload` — it detects `.py` file changes and restarts automatically
- **No Docker restart needed** when editing Python files

### Frontend (React/Vite)
- `./frontend/src/` and `./frontend/index.html` are mounted live
- Vite HMR reflects changes in the browser within milliseconds
- **No Docker restart needed** when editing `.jsx`, `.js`, `.css` files

---

## Git Workflow

```bash
# Check what changed
git status
git diff

# Stage and commit
git add -p                          # stage interactively (recommended over git add .)
git commit -m "describe what changed"

# Push
git push origin master
```

### What is git-ignored (never committed)
- `backend/.env` — secrets, never commit this
- `backend/staticfiles/` — auto-generated on startup
- `frontend/node_modules/` — installed inside Docker image
- `backend/.venv/` — local virtualenv, not used by Docker
- `backend/db.sqlite3` — local SQLite fallback, Docker uses PostgreSQL

---

## Troubleshooting

### Problem: `failed to bind host port 0.0.0.0:6379 — address already in use`

**Cause:** Ubuntu's system Redis is occupying port 6379.

**Fix:**
```bash
sudo systemctl stop redis-server
sudo systemctl disable redis-server   # prevent it auto-starting on reboot
docker compose up -d
```

---

### Problem: Django admin has no CSS styling

**Cause:** Static files not collected, or WhiteNoise not in middleware.

**Fix:**
```bash
docker compose exec backend python manage.py collectstatic --noinput
docker compose restart backend
```

---

### Problem: `ERR_SOCKET_NOT_CONNECTED` at `127.0.0.1:8000`

**Cause:** Gunicorn bound to container loopback (`127.0.0.1`) instead of all interfaces (`0.0.0.0`).

**Check:**
```bash
docker compose logs backend | grep "Listening at"
```

Expected: `Listening at: http://0.0.0.0:8000`

**Fix:** The `command:` in `docker-compose.yml` must pass `--bind 0.0.0.0:8000` on a **single line** (never multi-line YAML with `>`).

---

### Problem: Backend shows `Up` but `/django-admin/` still doesn't load

**Cause:** Startup sequence still running (`collectstatic` + `migrate` take ~20-30s).

**Fix:** Wait for the health check to pass:
```bash
docker compose logs -f backend
# Wait for: "Listening at: http://0.0.0.0:8000"
```

---

### Problem: Database connection refused

```bash
docker compose ps db          # is db (healthy)?
docker compose logs db        # any PostgreSQL errors?
docker compose restart db
docker compose restart backend
```

---

### Problem: Celery tasks not running

```bash
docker compose logs celery --tail=30
# Look for: "celery@... ready."

docker compose restart celery celerybeat
```

---

### Problem: Frontend blank screen

```bash
docker compose logs frontend --tail=20

# Verify the Vite proxy target
docker compose exec frontend env | grep VITE
# Expected: VITE_API_TARGET=http://backend:8000
```

---

### Problem: `docker compose` permission denied

```bash
newgrp docker
```

Permanent fix (requires logout/login):
```bash
sudo usermod -aG docker $USER
```

---

### Problem: Containers in a restart loop

```bash
docker compose logs backend --tail=50   # find the error
docker compose down
docker compose up --build -d            # force full rebuild
```

---

## Known Non-Critical Warnings (Safe to Ignore in Dev)

| Warning | Source | Why Safe |
|---------|--------|----------|
| `WARNING Memory overcommit must be enabled` | Redis startup | Kernel setting; no data loss risk in dev |
| Django security warnings `W004 W008 W009 W012 W016 W018` | `manage.py check --deploy` | Production-only settings, not relevant for dev |
| `django-insecure-` prefix on SECRET_KEY | Django | Fine for dev — **must be replaced before production** |

---

## Full Recovery — When Everything Is Broken

```bash
# 1. Stop conflicting system services
sudo systemctl stop redis-server
sudo systemctl stop postgresql

# 2. Tear down the Docker stack completely
docker compose down

# 3. Rebuild and restart
docker compose up --build -d

# 4. Watch backend startup (takes ~40s)
docker compose logs -f backend
# Wait for: "Listening at: http://0.0.0.0:8000"

# 5. Verify everything
docker compose ps
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8000/django-admin/login/
# Expected: 200

curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173
# Expected: 200
```

---

## Common Beginner Mistakes

| Mistake | What Goes Wrong | Correct Approach |
|---------|----------------|-----------------|
| `python manage.py createsuperuser` (bare) | Creates user in SQLite, invisible to Docker PostgreSQL | `docker compose exec backend python manage.py createsuperuser` |
| `python manage.py changepassword` (bare) | Resets password in SQLite; Django backend still reads old PostgreSQL password | `docker compose exec backend python manage.py changepassword <email>` |
| `python manage.py migrate` (bare) | Migrates SQLite; PostgreSQL stays behind; containers fail | `docker compose exec backend python manage.py migrate` |
| Editing backend code then wondering why changes don't appear | Forgot Docker is running; or Gunicorn hasn't reloaded yet | File changes auto-reload via Gunicorn `--reload`. Wait 2-3 seconds. |
| `docker compose down -v` to "fix" a login problem | `-v` deletes the entire PostgreSQL volume — ALL DATA LOST | Only use `-v` as a last resort after backing up |
| Changing `SECRET_KEY` in `.env` on a running system | Invalidates all existing sessions and tokens | Never change SECRET_KEY in dev; replace before production only |
| Running `pip install` locally to add a dependency | Package installs on your machine, not in the Docker image | Add to `requirements.txt`, then `docker compose up --build -d` |

---

## Daily Development Checklist

### Startup
```
[ ] cd ~/Documents/fridaySystems_Tech
[ ] docker compose up -d
[ ] docker compose ps  →  all containers Up / healthy
[ ] http://localhost:5173  →  frontend loads
[ ] http://127.0.0.1:8000/django-admin/  →  admin styled and working
[ ] Start coding
```

### Before Shutdown
```
[ ] git status
[ ] git add -p  (stage your changes)
[ ] git commit -m "meaningful message"
[ ] git push origin master
[ ] docker compose down
```
