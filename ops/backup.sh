#!/usr/bin/env bash
# DataSphere Innovation — PostgreSQL Backup Script
# Usage: ./ops/backup.sh
# Cron (daily at 3am): 0 3 * * * /app/ops/backup.sh >> /var/log/datasphere-backup.log 2>&1

set -euo pipefail

# ── Config ─────────────────────────────────────────────────────────────────────
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETAIN_DAYS="${RETAIN_DAYS:-14}"            # Keep 14 days of backups
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/datasphere_${TIMESTAMP}.sql.gz"

# Load env if .env.prod exists
if [[ -f .env.prod ]]; then
  source .env.prod 2>/dev/null || true
fi

POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:-datasphere_platform}"
POSTGRES_USER="${POSTGRES_USER:-datasphere}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-}"

# ── Pre-flight ─────────────────────────────────────────────────────────────────
mkdir -p "${BACKUP_DIR}"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting backup of ${POSTGRES_DB}..."

# ── Dump ──────────────────────────────────────────────────────────────────────
PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
  -h "${POSTGRES_HOST}" \
  -p "${POSTGRES_PORT}" \
  -U "${POSTGRES_USER}" \
  -d "${POSTGRES_DB}" \
  --no-password \
  --format=plain \
  --clean \
  --if-exists \
  | gzip > "${BACKUP_FILE}"

SIZE=$(du -sh "${BACKUP_FILE}" | cut -f1)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup complete: ${BACKUP_FILE} (${SIZE})"

# ── Rotate old backups ─────────────────────────────────────────────────────────
DELETED=$(find "${BACKUP_DIR}" -name "datasphere_*.sql.gz" -mtime "+${RETAIN_DAYS}" -delete -print | wc -l)
if [[ $DELETED -gt 0 ]]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Rotated ${DELETED} backup(s) older than ${RETAIN_DAYS} days"
fi

# ── List current backups ───────────────────────────────────────────────────────
TOTAL=$(find "${BACKUP_DIR}" -name "datasphere_*.sql.gz" | wc -l)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Total backups retained: ${TOTAL}"
