#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# scripts/start.sh — Start all SupportMitra services
#
# Usage:
#   bash scripts/start.sh           # development (default)
#   bash scripts/start.sh prod      # production
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$APP_DIR"

MODE="${1:-dev}"

if [[ "$MODE" == "prod" ]]; then
    echo "[start] Starting in PRODUCTION mode..."
    [[ -f backend/.env ]] || { echo "[start] ERROR: backend/.env not found"; exit 1; }
    docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
    echo "[start] All services started. Logs: docker compose logs -f"
else
    echo "[start] Starting in DEVELOPMENT mode..."
    [[ -f backend/.env ]] || {
        echo "[start] backend/.env not found — copying from .env.example..."
        cp .env.example backend/.env
        echo "[start] Edit backend/.env and re-run this script."
        exit 1
    }
    docker compose up -d
    echo "[start] Services started:"
    echo "  Frontend:  http://localhost:5173"
    echo "  Backend:   http://localhost:8000/api/"
    echo "  Admin:     http://localhost:8000/django-admin/"
    echo ""
    echo "  Logs:      docker compose logs -f"
    echo "  Stop:      bash scripts/stop.sh"
fi
