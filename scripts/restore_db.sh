#!/usr/bin/env bash

# Restore script for Supabase/Postgres backups.
# Supports dry runs, target environment selection (dev/staging),
# and optional point-in-time recovery using WAL archives.

set -euo pipefail

usage() {
  cat <<EOF
Usage: $(basename "$0") -i <backup-dir> -t <target-env> [--dry-run] [--force] [--db-url <url>]

Options:
  -i, --input       Path to backup directory containing db.dump(.gz|.enc)
  -t, --target      Target environment identifier (dev|staging|custom)
  -d, --db-url      Override DATABASE_URL/SUPABASE_DB_URL
      --wal-dir     Directory containing WAL segments for PITR
      --pitr        Point-in-time recovery timestamp (UTC, e.g. 2025-09-27T10:00:00Z)
      --dry-run     Print actions without executing destructive commands
      --force       Skip confirmation prompt
  -h, --help        Show this help
EOF
}

INPUT_DIR=""
TARGET_ENV=""
DB_URL_OVERRIDE=""
WAL_DIR=""
PITR_TIMESTAMP=""
DRY_RUN=false
FORCE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    -i|--input)
      INPUT_DIR="$2"; shift 2;;
    -t|--target)
      TARGET_ENV="$2"; shift 2;;
    -d|--db-url)
      DB_URL_OVERRIDE="$2"; shift 2;;
    --wal-dir)
      WAL_DIR="$2"; shift 2;;
    --pitr)
      PITR_TIMESTAMP="$2"; shift 2;;
    --dry-run)
      DRY_RUN=true; shift;;
    --force)
      FORCE=true; shift;;
    -h|--help)
      usage; exit 0;;
    *)
      echo "Unknown option $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$INPUT_DIR" || -z "$TARGET_ENV" ]]; then
  echo "Missing required arguments" >&2
  usage
  exit 1
fi

if [[ ! -d "$INPUT_DIR" ]]; then
  echo "Input directory not found: $INPUT_DIR" >&2
  exit 1
fi

if [[ -f ".env.dr" ]]; then
  # shellcheck disable=SC1091
  source .env.dr
fi

DB_URL="${DB_URL_OVERRIDE:-${RESTORE_DB_URL:-${SUPABASE_DB_URL:-${DATABASE_URL:-}}}}"
if [[ -z "$DB_URL" ]]; then
  echo "No database URL provided." >&2
  exit 1
fi

echo "Preparing to restore backup from $INPUT_DIR to $TARGET_ENV"
echo "Database URL: ${DB_URL%%://*}://*** (masked)"

if [[ "$DRY_RUN" == "true" ]]; then
  echo "DRY RUN mode enabled"
fi

if [[ "$FORCE" == "false" ]]; then
  read -rp "Continue with restore? (y/N): " response
  if [[ ! "$response" =~ ^[Yy]$ ]]; then
    echo "Restore aborted"
    exit 0
  fi
fi

verify_checksum() {
  local archive="$1"
  local checksum_file="$2"
  if [[ ! -f "$checksum_file" ]]; then
    echo "Checksum file not found; skipping verification"
    return 0
  fi

  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum -c "$checksum_file"
  else
    shasum -a 256 -c "$checksum_file"
  fi
}

# Locate dump archive
ARCHIVE=""
if [[ -f "$INPUT_DIR/db.dump.enc" ]]; then
  ARCHIVE="$INPUT_DIR/db.dump.enc"
elif [[ -f "$INPUT_DIR/db.dump.gz" ]]; then
  ARCHIVE="$INPUT_DIR/db.dump.gz"
else
  echo "No db.dump archive found in $INPUT_DIR" >&2
  exit 1
fi

if [[ "$DRY_RUN" == "false" ]]; then
  verify_checksum "$ARCHIVE" "$ARCHIVE.sha256"
fi

DECRYPTED="$INPUT_DIR/db.dump"

if [[ "$ARCHIVE" == *.enc ]]; then
  if [[ -z "${BACKUP_PASSPHRASE:-}" ]]; then
    echo "Encrypted archive requires BACKUP_PASSPHRASE" >&2
    exit 1
  fi
  if [[ "$DRY_RUN" == "false" ]]; then
    openssl enc -d -aes-256-cbc -in "$ARCHIVE" -out "$DECRYPTED.gz" -pass "pass:$BACKUP_PASSPHRASE"
    gunzip -f "$DECRYPTED.gz"
  else
    echo "Would decrypt and unzip $ARCHIVE"
  fi
else
  if [[ "$DRY_RUN" == "false" ]]; then
    gunzip -f -k "$ARCHIVE"
  else
    echo "Would gunzip $ARCHIVE"
  fi
fi

if [[ "$DRY_RUN" == "false" ]]; then
  echo "Dropping existing connections"
  psql "$DB_URL" -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid();"

  echo "Restoring database"
  pg_restore --clean --if-exists --no-owner --no-privileges \
    --jobs="${PG_RESTORE_JOBS:-4}" \
    --dbname="$DB_URL" "$DECRYPTED"

  if [[ -n "$PITR_TIMESTAMP" && -n "$WAL_DIR" ]]; then
    echo "Applying WAL segments for PITR up to $PITR_TIMESTAMP"
    # Placeholder: actual PITR would require recovery.conf in managed service. Documented in DR guide.
    echo "PITR requested but full automation depends on infrastructure. Review docs/DR.md."
  fi

  echo "Restore complete"
else
  echo "Dry run complete"
fi

