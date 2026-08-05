#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# scripts/restore.sh — Restore a database (and optionally media) backup
#
# DESTRUCTIVE: overwrites the live database. Double-check you're pointed at
# the right environment (APP_DIR / docker compose project) before running
# this against production.
#
# Usage:
#   bash scripts/restore.sh backups/db_20260730_020000.sql.gz
#   bash scripts/restore.sh backups/db_20260730_020000.sql.gz backups/media_20260730_020000.tar.gz
#   bash scripts/restore.sh --force backups/db_20260730_020000.sql.gz   # skip confirmation prompt
#
# To restore from the offsite bucket instead of a local file, download the
# object first (bucket/vars per docs/ENVIRONMENT_VARIABLES.md → File Storage):
#   aws s3 cp s3://$AWS_STORAGE_BUCKET_NAME/backups/db_TIMESTAMP.sql.gz .
# then pass the downloaded path to this script as usual.
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$APP_DIR"

FORCE=0
if [[ "${1:-}" == "--force" ]]; then
    FORCE=1
    shift
fi

DB_DUMP="${1:-}"
MEDIA_ARCHIVE="${2:-}"

if [[ -z "$DB_DUMP" ]]; then
    echo "Usage: bash scripts/restore.sh [--force] <db_dump.sql.gz> [media_archive.tar.gz]" >&2
    exit 1
fi

[[ -f "$DB_DUMP" ]] || { echo "[restore] Database dump not found: $DB_DUMP" >&2; exit 1; }
if [[ -n "$MEDIA_ARCHIVE" ]]; then
    [[ -f "$MEDIA_ARCHIVE" ]] || { echo "[restore] Media archive not found: $MEDIA_ARCHIVE" >&2; exit 1; }
fi

if [[ $FORCE -ne 1 ]]; then
    echo "This will OVERWRITE the current database with the contents of:"
    echo "  $DB_DUMP"
    [[ -n "$MEDIA_ARCHIVE" ]] && echo "and replace backend/mediafiles/ with the contents of:" && echo "  $MEDIA_ARCHIVE"
    echo ""
    read -r -p "Type 'yes' to continue: " CONFIRM
    [[ "$CONFIRM" == "yes" ]] || { echo "[restore] Aborted."; exit 1; }
fi

echo "[restore] Restoring database from $DB_DUMP..."
gunzip -c "$DB_DUMP" | docker compose exec -T db psql -U supportmitra supportmitra
echo "[restore] Database restore complete."

if [[ -n "$MEDIA_ARCHIVE" ]]; then
    echo "[restore] Restoring media files from $MEDIA_ARCHIVE..."
    tar -xzf "$MEDIA_ARCHIVE" -C "$APP_DIR/backend"
    echo "[restore] Media restore complete."
fi

echo "[restore] Done. Restart backend/celery so any cached DB state is cleared:"
echo "  docker compose -f docker-compose.yml -f docker-compose.prod.yml restart backend celery celerybeat"
