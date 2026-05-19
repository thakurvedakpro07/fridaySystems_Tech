# SupportMitra — Daily Startup Guide

## Project Location

```bash
~/Documents/fridaySystems_Tech
```

---

# IMPORTANT

SupportMitra now runs using:

- Docker
- PostgreSQL
- Redis
- Django Backend
- React Frontend
- Celery
- Celery Beat

Always use Docker commands to start the project.

DO NOT USE:

```bash
python3 manage.py runserver
```

OR

```bash
npm run dev
```

unless intentionally using old local setup.

---

# STEP 1 — Open VS Code

Open:

```text
fridaySystems_Tech
```

---

# STEP 2 — Open Terminal

Inside VS Code:

```text
Terminal → New Terminal
```

---

# STEP 3 — Go To Project Root

```bash
cd ~/Documents/fridaySystems_Tech
```

---

# STEP 4 — Enable Docker Permissions

Run:

```bash
newgrp docker
```

This prevents Docker permission errors.

---

# STEP 5 — Start Entire Project

Run:

```bash
docker compose up -d
```

This starts:

- Frontend
- Backend
- PostgreSQL
- Redis
- Celery
- Celery Beat

---

# STEP 6 — Verify Containers

Run:

```bash
docker compose ps
```

Expected:

```text
backend     Up
frontend    Up
db          Up
redis       Up
celery      Up
celerybeat  Up
```

---

# STEP 7 — Open Website

## Frontend

```text
http://localhost:5173
```

## Django Admin

```text
http://127.0.0.1:8000/admin/
```

---

# DAILY DEVELOPMENT WORKFLOW

## Start Project

```bash
cd ~/Documents/fridaySystems_Tech
newgrp docker
docker compose up -d
```

---

## Stop Project

```bash
docker compose down
```

---

## Restart Project

```bash
docker compose restart
```

---

# USEFUL COMMANDS

## Check Running Containers

```bash
docker compose ps
```

---

## View Backend Logs

```bash
docker compose logs backend
```

Live logs:

```bash
docker compose logs -f backend
```

---

## View Frontend Logs

```bash
docker compose logs frontend
```

---

## View All Logs

```bash
docker compose logs -f
```

---

# DJANGO COMMANDS

## Run Migrations

```bash
docker compose exec backend python manage.py migrate
```

---

## Create Superuser

```bash
docker compose exec backend python manage.py createsuperuser
```

---

## Open Django Shell

```bash
docker compose exec backend python manage.py shell
```

---

# GIT WORKFLOW

## Check Changes

```bash
git status
```

---

## Add Changes

```bash
git add .
```

---

## Commit Changes

```bash
git commit -m "your message"
```

Example:

```bash
git commit -m "Fixed Docker backend startup issue"
```

---

## Push Changes

```bash
git push origin master
```

---

# COMMON ERRORS & FIXES

## 1. Docker Permission Denied

Error:

```text
permission denied while trying to connect to docker.sock
```

Fix:

```bash
newgrp docker
```

---

## 2. Port Already In Use

Check port:

```bash
sudo lsof -i :8000
```

Kill process:

```bash
kill -9 PID
```

---

## 3. Backend Not Opening

Check backend logs:

```bash
docker compose logs backend
```

---

## 4. Frontend Not Opening

Check frontend logs:

```bash
docker compose logs frontend
```

---

## 5. Full Clean Restart

```bash
docker compose down
docker compose up --build -d
```

---

# BEFORE SHUTTING DOWN SYSTEM

Recommended:

```bash
docker compose down
```

This prevents corrupted container states.

---

# DAILY CHECKLIST

## Startup

```text
✓ Open VS Code
✓ Open terminal
✓ cd into project
✓ newgrp docker
✓ docker compose up -d
✓ Open localhost:5173
✓ Start development
```

---

## Shutdown

```text
✓ git status
✓ git add .
✓ git commit
✓ git push
✓ docker compose down
✓ Shutdown PC
```