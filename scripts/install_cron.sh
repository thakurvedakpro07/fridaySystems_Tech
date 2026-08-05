#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# scripts/install_cron.sh — Idempotently install the nightly backup cron job
#
# Previously, cron scheduling for scripts/backup.sh was documented only as a
# comment — nothing ever actually installed it, so backups never ran unless
# someone manually edited crontab on the VPS. This script does that for real,
# and is safe to run repeatedly (checks for its own marker before adding).
#
# Called automatically by scripts/deploy.sh on every deploy, so a fresh VPS
# gets backups scheduled on its very first deploy with no manual step.
#
# Usage:
#   bash scripts/install_cron.sh                      # daily at 2 AM (default)
#   BACKUP_CRON_SCHEDULE="0 */6 * * *" bash scripts/install_cron.sh   # every 6h
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
CRON_SCHEDULE="${BACKUP_CRON_SCHEDULE:-0 2 * * *}"   # daily at 2 AM by default
MARKER="# resolvehq-backup-cron"                     # unique marker so re-runs don't duplicate
CRON_LINE="$CRON_SCHEDULE APP_DIR=$APP_DIR bash $APP_DIR/scripts/backup.sh >> /var/log/resolvehq_backup.log 2>&1 $MARKER"

if ! command -v crontab >/dev/null 2>&1; then
    echo "[install_cron] 'crontab' not available on this system — skipping." >&2
    echo "[install_cron] Install cron (e.g. 'apt-get install -y cron') or schedule" >&2
    echo "[install_cron] scripts/backup.sh via a systemd timer instead." >&2
    exit 0
fi

EXISTING_CRON="$(crontab -l 2>/dev/null || true)"

if echo "$EXISTING_CRON" | grep -qF "$MARKER"; then
    echo "[install_cron] Backup cron job already installed — leaving as-is."
    echo "[install_cron] Current entry:"
    echo "$EXISTING_CRON" | grep -F "$MARKER"
    exit 0
fi

echo "[install_cron] Installing nightly backup cron job (schedule: $CRON_SCHEDULE)"
{
    [[ -n "$EXISTING_CRON" ]] && echo "$EXISTING_CRON"
    echo "$CRON_LINE"
} | crontab -

echo "[install_cron] Done. Verify with: crontab -l"
echo "[install_cron] Backup logs will accumulate at /var/log/resolvehq_backup.log"
