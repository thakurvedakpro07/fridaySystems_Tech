#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# scripts/deploy.sh — Production deployment script
#
# Run this on the VPS to deploy a new version of ResolveHQ.
# Safe to run repeatedly — each step is idempotent.
#
# Usage:
#   ssh deploy@your-vps "cd /opt/supportmitra && bash scripts/deploy.sh"
#   OR run directly on the VPS:
#   cd /opt/supportmitra && bash scripts/deploy.sh
#
# What it does:
#   1. Pulls latest code from git
#   2. Builds the React frontend
#   3. Rebuilds Docker images (backend only if Dockerfile or requirements changed)
#   4. Runs database migrations
#   5. Collects static files
#   6. Restarts backend, celery, celerybeat containers (zero-downtime rolling)
#   7. Runs a health check to verify the deployment succeeded
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail   # exit on error, undefined variable, or pipe failure

# ── Configuration ─────────────────────────────────────────────────────────────
APP_DIR="${APP_DIR:-/opt/supportmitra}"
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"
HEALTH_URL="${HEALTH_URL:-https://supportmitra.in/api/health/}"
HEALTH_RETRIES=10
HEALTH_WAIT=5   # seconds between retries

# ── Colours (optional — falls back gracefully if terminal doesn't support them)
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'  # no colour

log()  { echo -e "${GREEN}[deploy]${NC} $*"; }
warn() { echo -e "${YELLOW}[deploy]${NC} $*"; }
fail() { echo -e "${RED}[deploy]${NC} $*" >&2; exit 1; }

# ── Pre-flight checks ─────────────────────────────────────────────────────────
cd "$APP_DIR" || fail "App directory not found: $APP_DIR"
[[ -f backend/.env ]] || fail "Missing backend/.env — copy .env.example and fill in secrets"
command -v docker >/dev/null  || fail "docker not found"
command -v node   >/dev/null  || warn "node not found — frontend build will be skipped"

log "Starting deployment from $APP_DIR"

# ── 1. Pull latest code ───────────────────────────────────────────────────────
log "Pulling latest code..."
git fetch origin
git pull origin master

# ── 2. Build frontend ─────────────────────────────────────────────────────────
if command -v node >/dev/null; then
    log "Building React frontend..."
    (cd frontend && npm ci --prefer-offline && npm run build)
    log "Frontend built → frontend/dist/"
else
    warn "Skipping frontend build (node not available on VPS)"
    warn "Make sure frontend/dist/ was deployed separately (rsync or CI artifact)"
fi

# ── 3. Rebuild backend Docker image ───────────────────────────────────────────
log "Rebuilding backend image (skipped if nothing changed)..."
$COMPOSE build backend

# ── 4. Run database migrations (before restarting gunicorn) ──────────────────
log "Running database migrations..."
$COMPOSE run --rm --no-deps backend python manage.py migrate --noinput

# ── 5. Collect static files ───────────────────────────────────────────────────
log "Collecting static files..."
$COMPOSE run --rm --no-deps backend python manage.py collectstatic --noinput --clear

# ── 6. Restart services ───────────────────────────────────────────────────────
log "Restarting backend, celery, celerybeat..."
$COMPOSE up -d --no-deps --remove-orphans backend celery celerybeat

# ── 7. Health check ───────────────────────────────────────────────────────────
log "Waiting for backend to become healthy..."
for i in $(seq 1 $HEALTH_RETRIES); do
    if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
        log "Health check passed on attempt $i"
        break
    fi
    if [[ $i -eq $HEALTH_RETRIES ]]; then
        fail "Health check failed after $HEALTH_RETRIES attempts. Check: docker compose logs backend"
    fi
    warn "Attempt $i/$HEALTH_RETRIES failed — retrying in ${HEALTH_WAIT}s..."
    sleep $HEALTH_WAIT
done

log "Deployment complete."
log "Version: $(git rev-parse --short HEAD) — $(git log -1 --format='%s')"
