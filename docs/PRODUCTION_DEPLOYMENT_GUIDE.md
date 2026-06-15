# SupportMitra — Production Deployment Guide
**Phase 10: Production Readiness**
**Date:** 2026-05-20

---

## Overview

This guide walks you through deploying SupportMitra to a real production Ubuntu server. By the end, your app will be live at `https://supportmitra.in` with HTTPS, auto-renewing SSL, and a reverse proxy.

**Architecture:**
```
Internet → nginx (port 443, host) → Docker: backend:8000 (Gunicorn + Django)
                                  → Docker: db (PostgreSQL)
                                  → Docker: redis (Redis)
                                  → Docker: celery (background tasks)
React static files served directly by nginx (no Node.js at runtime)
```

---

## Requirements

- Ubuntu 22.04 LTS server (minimum: 2 vCPU, 4 GB RAM, 20 GB SSD)
- Domain name pointed at the server IP (A record)
- Docker + Docker Compose installed
- Non-root `deploy` user with sudo access

---

## Step 1: Install Dependencies

```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker

# Install Docker Compose plugin
sudo apt install -y docker-compose-plugin

# Install nginx and certbot
sudo apt install -y nginx certbot python3-certbot-nginx

# Install Node.js 20 (for building the frontend)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

---

## Step 2: Clone the Repository

```bash
# Create deployment directory
sudo mkdir -p /home/deploy/supportmitra
sudo chown -R deploy:deploy /home/deploy/supportmitra

# Clone the repo
cd /home/deploy
git clone https://github.com/your-org/supportmitra.git supportmitra
cd supportmitra
```

---

## Step 3: Configure Environment Variables

```bash
# Copy the example env file
cp backend/.env.example backend/.env

# Edit with your real values
nano backend/.env
```

**Critical values to set:**
```bash
# Generate a secure secret key:
python3 -c "import secrets; print(secrets.token_urlsafe(50))"

SECRET_KEY=<paste generated key here>
DEBUG=0
ALLOWED_HOSTS=supportmitra.in,www.supportmitra.in
DATABASE_URL=postgres://supportmitra:<strong-password>@db:5432/supportmitra
REDIS_URL=redis://redis:6379/0
```

Also set the PostgreSQL password in `docker-compose.yml` (or use a `.env` at root level) — make it match `DATABASE_URL`.

---

## Step 4: Build the React Frontend

```bash
cd frontend
npm install
npm run build
# Output: frontend/dist/ — static HTML/CSS/JS files
cd ..
```

---

## Step 5: Configure Nginx

```bash
# Copy the nginx config
sudo cp nginx/nginx.conf /etc/nginx/sites-available/supportmitra

# Edit the path to your frontend dist folder if needed
# The default path is /home/deploy/supportmitra/frontend/dist
sudo nano /etc/nginx/sites-available/supportmitra

# Enable the site (remove the default site first)
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -s /etc/nginx/sites-available/supportmitra /etc/nginx/sites-enabled/

# Add rate-limit zones to the http block in /etc/nginx/nginx.conf
sudo nano /etc/nginx/nginx.conf
```

Add inside the `http { }` block in `/etc/nginx/nginx.conf`:
```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;
limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;
```

Test and reload:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## Step 6: Get an SSL Certificate

```bash
# Temporarily comment out the HTTPS server block and enable only HTTP for verification
# OR use the standalone method:
sudo certbot --nginx -d supportmitra.in -d www.supportmitra.in

# Follow prompts. Certbot will auto-edit nginx.conf to add SSL.
# Test auto-renewal:
sudo certbot renew --dry-run
```

Certbot installs a cron job for automatic renewal every 60 days.

---

## Step 7: Start the Docker Services

```bash
cd /home/deploy/supportmitra

# Start in production mode (uses both compose files)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Run database migrations
docker compose exec backend python manage.py migrate

# Create the superuser (admin account)
docker compose exec backend python manage.py createsuperuser

# Collect static files (WhiteNoise serves them via Gunicorn)
docker compose exec backend python manage.py collectstatic --noinput

# Copy static files to the location nginx expects
cp -r backend/staticfiles /home/deploy/supportmitra/backend/staticfiles
```

---

## Step 8: Verify Everything Works

```bash
# Check all containers are running
docker compose ps

# Check Django is healthy
curl -I http://localhost:8000/django-admin/login/

# Check nginx is serving HTTPS
curl -I https://supportmitra.in/

# Check the API responds
curl https://supportmitra.in/api/auth/login/ -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"wrongpassword"}'
# Should return 401, NOT 502 (502 = nginx can't reach Django)
```

---

## Step 9: Set Up Log Monitoring

```bash
# Django logs (inside Docker)
docker compose logs -f backend

# Nginx access logs
sudo tail -f /var/log/nginx/access.log

# Nginx error logs
sudo tail -f /var/log/nginx/error.log

# Optional: install Sentry for error monitoring
# Add SENTRY_DSN=https://your-key@sentry.io/123 to backend/.env
# Add sentry-sdk to requirements.txt and configure in settings.py
```

---

## Step 10: Set Up Database Backups

```bash
# Create a daily backup script
cat > /home/deploy/backup-db.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/home/deploy/backups
mkdir -p $BACKUP_DIR
docker compose -f /home/deploy/supportmitra/docker-compose.yml exec -T db \
  pg_dump -U supportmitra supportmitra | gzip > $BACKUP_DIR/db_$DATE.sql.gz
# Keep only last 30 days of backups
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
EOF

chmod +x /home/deploy/backup-db.sh

# Schedule daily at 2am
echo "0 2 * * * deploy /home/deploy/backup-db.sh" | sudo tee -a /etc/cron.d/supportmitra-backup
```

---

## Deployment Update Process

When you push new code:

```bash
cd /home/deploy/supportmitra

# Pull latest code
git pull origin master

# Rebuild frontend
cd frontend && npm install && npm run build && cd ..

# Restart backend with new code
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build backend

# Run any new migrations
docker compose exec backend python manage.py migrate

# Collect new static files if any changed
docker compose exec backend python manage.py collectstatic --noinput
```

---

## Environment Variable Reference

| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| `SECRET_KEY` | YES | 50+ random chars | Never commit this |
| `DEBUG` | YES | `0` | Must be `0` in production |
| `ALLOWED_HOSTS` | YES | `supportmitra.in,www.supportmitra.in` | Your domain(s) |
| `DATABASE_URL` | YES | `postgres://user:pass@db:5432/supportmitra` | PostgreSQL connection string |
| `REDIS_URL` | YES | `redis://redis:6379/0` | Redis connection string |
| `RAZORPAY_KEY_ID` | Payment | `rzp_live_...` | Get from Razorpay dashboard |
| `RAZORPAY_KEY_SECRET` | Payment | `...` | Get from Razorpay dashboard |
| `RAZORPAY_WEBHOOK_SECRET` | Payment | `...` | Set in Razorpay webhook config |
| `EMAIL_HOST_PASSWORD` | Email | SendGrid API key | Needed for transactional emails |
| `AWS_ACCESS_KEY_ID` | Uploads | `...` | Needed for file upload feature |
| `AWS_STORAGE_BUCKET_NAME` | Uploads | `supportmitra-uploads` | S3 bucket name |

---

## Common Issues

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| 502 Bad Gateway | Django not running | `docker compose ps` → restart backend |
| 500 Internal Server Error | Check Django logs | `docker compose logs backend` |
| Static files missing (CSS broken) | `collectstatic` not run | `docker compose exec backend python manage.py collectstatic --noinput` |
| Can't log in (password fails) | Wrong database (SQLite vs PostgreSQL) | Make sure `DATABASE_URL` is set in `.env` |
| SSL not working | Certbot didn't run | Re-run `sudo certbot --nginx -d your-domain.com` |
| CORS error in browser | Wrong `CORS_ALLOWED_ORIGINS` | Set `ALLOWED_HOSTS` and `CORS_ALLOWED_ORIGINS` to your domain |
