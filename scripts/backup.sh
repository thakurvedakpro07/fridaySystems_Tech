#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# scripts/backup.sh — Database and media backup script
#
# Creates a timestamped PostgreSQL dump and tars the media files directory.
# Run manually or via cron:
#   # Cron: daily at 2 AM
#   0 2 * * * /opt/supportmitra/scripts/backup.sh >> /var/log/supportmitra_backup.log 2>&1
#
# Usage:
#   bash scripts/backup.sh                  # backs up to ./backups/
#   BACKUP_DIR=/mnt/backup bash scripts/backup.sh
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$APP_DIR"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"   # keep backups for this many days

mkdir -p "$BACKUP_DIR"

echo "[backup] Starting backup at $TIMESTAMP"

# ── 1. PostgreSQL dump ────────────────────────────────────────────────────────
DB_DUMP="$BACKUP_DIR/db_${TIMESTAMP}.sql.gz"
echo "[backup] Dumping PostgreSQL database..."
docker compose exec -T db pg_dump -U supportmitra supportmitra | gzip > "$DB_DUMP"
echo "[backup] Database dump saved: $DB_DUMP ($(du -sh "$DB_DUMP" | cut -f1))"

# ── 2. Media files archive ────────────────────────────────────────────────────
MEDIA_ARCHIVE="$BACKUP_DIR/media_${TIMESTAMP}.tar.gz"
MEDIA_PATH="$APP_DIR/backend/mediafiles"

if [[ -d "$MEDIA_PATH" ]] && [[ -n "$(ls -A "$MEDIA_PATH" 2>/dev/null)" ]]; then
    echo "[backup] Archiving media files..."
    tar -czf "$MEDIA_ARCHIVE" -C "$APP_DIR/backend" mediafiles/
    echo "[backup] Media archive saved: $MEDIA_ARCHIVE ($(du -sh "$MEDIA_ARCHIVE" | cut -f1))"
else
    echo "[backup] No media files to archive — skipping"
fi

# ── 3. Prune old backups ──────────────────────────────────────────────────────
echo "[backup] Removing backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name "db_*.sql.gz"      -mtime "+$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -name "media_*.tar.gz"   -mtime "+$RETENTION_DAYS" -delete

echo "[backup] Backup complete. Files in $BACKUP_DIR:"
ls -lh "$BACKUP_DIR"

# ── Restore instructions ──────────────────────────────────────────────────────
# To restore a database backup:
#   gunzip -c backups/db_TIMESTAMP.sql.gz | docker compose exec -T db psql -U supportmitra supportmitra
#
# To restore media files:
#   tar -xzf backups/media_TIMESTAMP.tar.gz -C backend/
