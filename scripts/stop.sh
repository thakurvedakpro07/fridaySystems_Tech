#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# scripts/stop.sh — Stop all SupportMitra services
#
# Usage:
#   bash scripts/stop.sh            # stop containers, keep volumes
#   bash scripts/stop.sh --clean    # stop + remove containers and networks
#   bash scripts/stop.sh --wipe     # DANGER: stop + remove everything incl. volumes
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$APP_DIR"

OPTION="${1:-}"

case "$OPTION" in
    --clean)
        echo "[stop] Stopping and removing containers..."
        docker compose down --remove-orphans
        ;;
    --wipe)
        echo "[stop] WARNING: this will delete all database data and uploaded files."
        read -r -p "Type 'yes' to confirm: " CONFIRM
        if [[ "$CONFIRM" == "yes" ]]; then
            docker compose down --volumes --remove-orphans
            echo "[stop] All containers and volumes removed."
        else
            echo "[stop] Cancelled."
        fi
        ;;
    *)
        echo "[stop] Stopping containers (volumes preserved)..."
        docker compose stop
        echo "[stop] Done. Restart with: bash scripts/start.sh"
        ;;
esac
