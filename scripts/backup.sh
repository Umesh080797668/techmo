#!/usr/bin/env bash
# =============================================================================
#  TechMo – Automated Backup Script
#  Backs up all PostgreSQL databases, uploads to Cloudinary, and pings
#  Healthchecks.io to confirm success (or failure).
#
#  Schedule via cron (daily at 03:00):
#    0 3 * * * /home/deploy/pos/scripts/backup.sh >> /var/log/techmo-backup.log 2>&1
#
#  Required environment variables (set in /etc/environment or .env.backup):
#    DB_USER              – PostgreSQL username       (default: techmo)
#    DB_PASSWORD          – PostgreSQL password
#    CLOUDINARY_CLOUD_NAME
#    CLOUDINARY_API_KEY
#    CLOUDINARY_API_SECRET
#    HEALTHCHECKS_UUID    – Healthchecks.io check UUID (optional)
#    BACKUP_RETENTION_DAYS – How many local backup days to keep (default: 7)
#    SLACK_WEBHOOK_URL     – Optional Slack webhook for notifications
# =============================================================================

set -euo pipefail

# ─── Load .env.backup if it exists ────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env.backup"
[[ -f "$ENV_FILE" ]] && source "$ENV_FILE"

# ─── Configuration ────────────────────────────────────────────────────────────
DB_USER="${DB_USER:-techmo}"
DB_PASSWORD="${DB_PASSWORD:?DB_PASSWORD is required}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/techmo}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
DATE="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
LOG_PREFIX="[TechMo Backup ${DATE}]"

CLOUDINARY_CLOUD="${CLOUDINARY_CLOUD_NAME:?CLOUDINARY_CLOUD_NAME is required}"
CLOUDINARY_KEY="${CLOUDINARY_API_KEY:?CLOUDINARY_API_KEY is required}"
CLOUDINARY_SECRET="${CLOUDINARY_API_SECRET:?CLOUDINARY_API_SECRET is required}"

HEALTHCHECKS_UUID="${HEALTHCHECKS_UUID:-}"
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"

# Databases to back up: name → host:port
declare -A DATABASES=(
  [techmo_auth]="localhost:5432"
  [techmo_product]="localhost:5433"
  [techmo_inventory]="localhost:5434"
  [techmo_order]="localhost:5435"
  [techmo_repair]="localhost:5436"
  [techmo_loyalty]="localhost:5437"
  [techmo_hr]="localhost:5438"
)

# ─── Helpers ──────────────────────────────────────────────────────────────────
log()  { echo "${LOG_PREFIX} $*"; }
warn() { echo "${LOG_PREFIX} WARNING: $*" >&2; }
fail() { echo "${LOG_PREFIX} ERROR: $*" >&2; notify_slack "❌ Backup FAILED: $*"; ping_healthchecks fail; exit 1; }

notify_slack() {
  local msg="$1"
  [[ -z "$SLACK_WEBHOOK_URL" ]] && return 0
  curl -s -X POST "$SLACK_WEBHOOK_URL" \
    -H 'Content-Type: application/json' \
    -d "{\"text\":\"${msg}\"}" >/dev/null || true
}

ping_healthchecks() {
  local status="${1:-}" # "" = success, "fail" = failure, "start" = start
  [[ -z "$HEALTHCHECKS_UUID" ]] && return 0
  local url="https://hc-ping.com/${HEALTHCHECKS_UUID}"
  [[ -n "$status" ]] && url="${url}/${status}"
  curl -fsS --retry 3 --max-time 10 "$url" >/dev/null 2>&1 || true
}

cloudinary_upload() {
  local file="$1"
  local public_id="$2"    # e.g. techmo-backups/2024-01-15T03-00-00Z/techmo_auth

  # Generate SHA-1 signature for authenticated upload
  local timestamp; timestamp="$(date +%s)"
  local str_to_sign="public_id=${public_id}&resource_type=raw&timestamp=${timestamp}${CLOUDINARY_SECRET}"
  local signature; signature="$(echo -n "$str_to_sign" | sha1sum | awk '{print $1}')"

  local response
  response="$(curl -s -X POST \
    "https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/raw/upload" \
    -F "file=@${file}" \
    -F "public_id=${public_id}" \
    -F "resource_type=raw" \
    -F "timestamp=${timestamp}" \
    -F "api_key=${CLOUDINARY_KEY}" \
    -F "signature=${signature}")"

  # Check for error in response
  if echo "$response" | grep -q '"error"'; then
    local err; err="$(echo "$response" | grep -o '"message":"[^"]*"' | head -1)"
    warn "Cloudinary upload failed for ${public_id}: ${err}"
    return 1
  fi

  local secure_url; secure_url="$(echo "$response" | grep -o '"secure_url":"[^"]*"' | head -1 | cut -d'"' -f4)"
  log "  ↑ Uploaded to Cloudinary: ${secure_url}"
  return 0
}

# ─── Main ─────────────────────────────────────────────────────────────────────
main() {
  ping_healthchecks start
  log "Starting backup run…"

  mkdir -p "$BACKUP_DIR"

  local failures=0
  local successes=0
  local summary=""

  for db in "${!DATABASES[@]}"; do
    local host_port="${DATABASES[$db]}"
    local host="${host_port%%:*}"
    local port="${host_port##*:}"
    local dump_file="${BACKUP_DIR}/${db}_${DATE}.sql.gz"

    log "Dumping ${db} @ ${host}:${port}…"

    if PGPASSWORD="$DB_PASSWORD" pg_dump \
        -h "$host" -p "$port" -U "$DB_USER" "$db" \
        --no-password --format=plain --compress=9 \
        > "$dump_file" 2>/dev/null; then

      local size; size="$(du -sh "$dump_file" | cut -f1)"
      log "  ✓ ${dump_file} (${size})"

      # Upload to Cloudinary
      local public_id="techmo-backups/${DATE}/${db}"
      if cloudinary_upload "$dump_file" "$public_id"; then
        (( successes++ )) || true
        summary+="✅ ${db} (${size})\n"
      else
        (( failures++ )) || true
        summary+="⚠ ${db} — uploaded locally only\n"
      fi
    else
      warn "pg_dump failed for ${db}"
      (( failures++ )) || true
      summary+="❌ ${db} — dump FAILED\n"
      rm -f "$dump_file"
    fi
  done

  # ─── Prune old local backups ───────────────────────────────────────────────
  log "Pruning local backups older than ${RETENTION_DAYS} days…"
  find "$BACKUP_DIR" -name "*.sql.gz" -mtime +"$RETENTION_DAYS" -delete

  # ─── Final report ──────────────────────────────────────────────────────────
  log "Backup complete: ${successes} succeeded, ${failures} failed."

  if [[ "$failures" -gt 0 ]]; then
    notify_slack "⚠ TechMo Backup completed with ${failures} failure(s):\n${summary}"
    ping_healthchecks fail
    exit 1
  else
    notify_slack "✅ TechMo Backup successful (${successes} DBs):\n${summary}"
    ping_healthchecks
    log "All backups succeeded."
  fi
}

main "$@"
