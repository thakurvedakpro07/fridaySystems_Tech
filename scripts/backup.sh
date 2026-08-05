#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# scripts/backup.sh — Database and media backup script
#
# Creates a timestamped PostgreSQL dump and tars the media files directory,
# then (if AWS_* credentials are set in backend/.env) uploads both to an
# offsite S3-compatible bucket, so a VPS disk failure doesn't take out the
# live data AND every local backup at once.
#
# Scheduling is handled by scripts/install_cron.sh (installs this on a cron
# schedule idempotently) — see that script rather than adding a crontab entry
# by hand. scripts/deploy.sh calls it automatically on every deploy.
#
# Usage:
#   bash scripts/backup.sh                  # backs up to ./backups/
#   BACKUP_DIR=/mnt/backup bash scripts/backup.sh
#
# To restore a backup, use scripts/restore.sh — do not restore by hand.
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

# ── 3. Offsite upload (optional — enabled by setting AWS_* in backend/.env) ───
# Reuses the same AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY/AWS_STORAGE_BUCKET_NAME/
# AWS_S3_ENDPOINT_URL/AWS_S3_REGION_NAME variables documented for optional S3
# media storage (docs/ENVIRONMENT_VARIABLES.md → File Storage) — you do NOT
# need to actually migrate media serving to S3 to use this, it's a separate
# concern. Leave AWS_ACCESS_KEY_ID unset to skip and keep backups local-only.
#
# Only the AWS_* lines are read, not `source`d wholesale — backend/.env has
# other unquoted values containing spaces (e.g. BUSINESS_NAME), which break
# `source`/`set -a` since bash word-splits and tries to run the extra words.
if [[ -f "$APP_DIR/backend/.env" ]]; then
    while IFS='=' read -r _key _value; do
        case "$_key" in
            AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|AWS_STORAGE_BUCKET_NAME|AWS_S3_ENDPOINT_URL|AWS_S3_REGION_NAME)
                export "$_key=$_value"
                ;;
        esac
    done < <(grep -E '^AWS_[A-Z_]+=' "$APP_DIR/backend/.env")
fi

upload_to_s3() {
    local FILE="$1"
    local DEST="s3://${AWS_STORAGE_BUCKET_NAME}/backups/$(basename "$FILE")"
    local EXTRA_ARGS=()
    [[ -n "${AWS_S3_ENDPOINT_URL:-}" ]] && EXTRA_ARGS+=(--endpoint-url "$AWS_S3_ENDPOINT_URL")
    [[ -n "${AWS_S3_REGION_NAME:-}" ]] && EXTRA_ARGS+=(--region "$AWS_S3_REGION_NAME")

    if aws s3 cp "$FILE" "$DEST" "${EXTRA_ARGS[@]}"; then
        echo "[backup] Offsite upload OK: $DEST"
    else
        # Non-fatal: the local backup already succeeded above, so a transient
        # network/credentials issue here shouldn't fail the whole backup run.
        echo "[backup] WARNING: offsite upload FAILED for $FILE — local copy is still safe at $FILE" >&2
    fi
}

if [[ -n "${AWS_ACCESS_KEY_ID:-}" && -n "${AWS_STORAGE_BUCKET_NAME:-}" ]]; then
    if command -v aws >/dev/null 2>&1; then
        echo "[backup] Uploading to offsite bucket s3://${AWS_STORAGE_BUCKET_NAME}/backups/..."
        upload_to_s3 "$DB_DUMP"
        [[ -f "$MEDIA_ARCHIVE" ]] && upload_to_s3 "$MEDIA_ARCHIVE"
    else
        echo "[backup] WARNING: AWS_* credentials are set but the 'aws' CLI is not installed —" >&2
        echo "[backup]          skipping offsite upload. Install: apt-get install -y awscli" >&2
    fi
else
    echo "[backup] AWS_ACCESS_KEY_ID/AWS_STORAGE_BUCKET_NAME not set — skipping offsite upload (local-only backup)."
fi

# ── 4. Prune old local backups ─────────────────────────────────────────────────
echo "[backup] Removing local backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name "db_*.sql.gz"      -mtime "+$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -name "media_*.tar.gz"   -mtime "+$RETENTION_DAYS" -delete
# Note: offsite copies in S3/Spaces are NOT pruned by this script — configure
# a bucket lifecycle rule if you want offsite retention/expiry too.

echo "[backup] Backup complete. Files in $BACKUP_DIR:"
ls -lh "$BACKUP_DIR"

# ── Restore ────────────────────────────────────────────────────────────────────
# Use scripts/restore.sh — do not restore by hand:
#   bash scripts/restore.sh backups/db_TIMESTAMP.sql.gz backups/media_TIMESTAMP.tar.gz
