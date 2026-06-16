# ResolveHQ — Deployment Guide

This guide walks you through deploying ResolveHQ to a DigitalOcean VPS (or any Ubuntu 22.04 server) from scratch.

---

## Overview

**Architecture:**
```
Internet
   ↓ HTTPS (443)
Nginx (host — Ubuntu)
   ├── /api/*         → Django/Gunicorn (Docker, port 8000)
   ├── /django-admin/ → Django/Gunicorn (Docker, port 8000)
   ├── /static/       → disk (collectstatic output)
   ├── /media/        → disk (user uploads)
   └── /*             → React SPA (frontend/dist/)

Docker Compose (5 containers on private network)
   backend     — Django + Gunicorn (port 8000 → host)
   celery      — Celery worker (background tasks)
   celerybeat  — Celery Beat (scheduled tasks)
   db          — PostgreSQL 15 (internal only)
   redis       — Redis 7 (internal only)
```

**Deploy time:** ~20 minutes for first setup, ~2 minutes for updates.

---

## Step 1 — Provision the VPS

**Minimum specs (dev/staging):** 2 vCPUs, 2 GB RAM, 25 GB SSD
**Recommended (production):** 2 vCPUs, 4 GB RAM, 50 GB SSD

On DigitalOcean, create a Droplet with Ubuntu 22.04 LTS.

---

## Step 2 — Initial server setup

```bash
# As root (or with sudo)
apt update && apt upgrade -y
apt install -y git curl ufw nginx certbot python3-certbot-nginx nodejs npm

# Install Docker
curl -fsSL https://get.docker.com | sh
systemctl enable docker && systemctl start docker

# Create deploy user
useradd -m -s /bin/bash deploy
usermod -aG docker deploy
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/  # reuse root's SSH key
chown -R deploy:deploy /home/deploy/.ssh

# Firewall
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
ufw enable
```

---

## Step 3 — Clone the repository

```bash
su - deploy
mkdir -p /opt/supportmitra
cd /opt/supportmitra
git clone https://github.com/your-org/supportmitra.git .
```

---

## Step 4 — Configure environment variables

```bash
cp .env.example backend/.env
nano backend/.env   # fill in every REQUIRED value (see docs/ENVIRONMENT_VARIABLES.md)
```

**Critical values to set:**
- `SECRET_KEY` — 50+ random chars (generate with the command in the file)
- `DATABASE_URL` — keep as-is for Docker Compose
- `REDIS_URL` — keep as-is for Docker Compose
- `DEBUG=0`
- `ALLOWED_HOSTS=supportmitra.in,www.supportmitra.in`
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- `SENDGRID_API_KEY`

---

## Step 5 — Start Docker services

```bash
cd /opt/supportmitra

# Start database and redis first (backend depends on them being healthy)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d db redis

# Wait ~10 seconds, then start everything else
sleep 10
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Verify all 5 containers are running
docker compose ps
```

---

## Step 6 — Database setup (first deploy only)

```bash
# Run migrations
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  exec backend python manage.py migrate

# Create superuser (admin account)
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  exec backend python manage.py createsuperuser

# Create initial data (service tiers, etc.) if you have fixtures
# docker compose exec backend python manage.py loaddata initial_data.json
```

---

## Step 7 — Build the React frontend

```bash
cd /opt/supportmitra/frontend
npm ci
npm run build
# Output: frontend/dist/ — static files served directly by Nginx
```

---

## Step 8 — Configure Nginx

```bash
# Copy the nginx config
sudo cp /opt/supportmitra/nginx/nginx.conf /etc/nginx/nginx.conf

# Test the config (ignore SSL errors before cert exists)
sudo nginx -t

# Get SSL certificate from Let's Encrypt
sudo certbot --nginx -d supportmitra.in -d www.supportmitra.in

# Reload nginx with the SSL config certbot generated
sudo systemctl reload nginx
```

---

## Step 9 — Verify the deployment

```bash
cd /opt/supportmitra
bash scripts/health_check.sh prod
```

Expected output:
```
  [OK]   API health — HTTP 200
  [OK]   Auth register — HTTP 405
  [OK]   Auth login — HTTP 405
  [OK]   Tickets list — HTTP 401
  [OK]   My profile — HTTP 401
  [OK]   Frontend (SPA) — HTTP 200
  [OK]   HTTPS redirect — HTTP 301
```

---

## Updating the application

For every future deployment, just run:

```bash
cd /opt/supportmitra
bash scripts/deploy.sh
```

This pulls latest code, rebuilds the frontend, runs migrations, and restarts services.

---

## Backups

Set up automated daily backups with cron:

```bash
# As deploy user, add to crontab:
crontab -e

# Add this line (runs every day at 2 AM):
0 2 * * * /opt/supportmitra/scripts/backup.sh >> /var/log/supportmitra_backup.log 2>&1
```

Backups are saved to `/opt/supportmitra/backups/` and kept for 7 days by default.

**To restore a backup:**
```bash
# Database
gunzip -c backups/db_TIMESTAMP.sql.gz | \
  docker compose exec -T db psql -U supportmitra supportmitra

# Media files
tar -xzf backups/media_TIMESTAMP.tar.gz -C backend/
```

---

## SSL Certificate Renewal

Let's Encrypt certs expire every 90 days. Certbot auto-renews them. Verify:

```bash
sudo certbot renew --dry-run
```

If it fails, check:
1. Port 80 is open: `ufw status`
2. Nginx is running: `systemctl status nginx`
3. Cron is set up: `crontab -l -u root`

---

## Common operations

**View logs:**
```bash
docker compose logs -f backend       # Django/Gunicorn logs
docker compose logs -f celery        # Background task logs
docker compose logs -f db            # PostgreSQL logs
```

**Restart a service:**
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart backend
```

**Run a Django management command:**
```bash
docker compose exec backend python manage.py shell
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py createsuperuser
```

**Connect to the database:**
```bash
docker compose exec db psql -U supportmitra supportmitra
```

**Full restart after VPS reboot:**
```bash
cd /opt/supportmitra
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
sudo systemctl start nginx
```

> **Note:** Docker containers have `restart: unless-stopped` so they start automatically after a VPS reboot. Nginx also has `systemctl enable nginx` from the setup step.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `502 Bad Gateway` from nginx | Backend container not running | `docker compose logs backend` |
| Infinite HTTPS redirect loop | Missing `SECURE_PROXY_SSL_HEADER` in Django | Already fixed in `settings_prod.py` |
| `500` on all API endpoints | `DEBUG=0` + missing env var | Check logs, verify `backend/.env` |
| Frontend shows blank page | `npm run build` failed or dist/ empty | Run `npm run build` in `frontend/` |
| Celery tasks not running | Redis unreachable | `docker compose logs redis celery` |
| Database connection refused | PostgreSQL container not healthy | `docker compose ps db` |
