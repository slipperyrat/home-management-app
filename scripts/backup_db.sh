#!/usr/bin/env bash

# Nightly database and storage snapshot script
#
# Responsibilities
#  - Perform a logical PostgreSQL dump using pg_dump
#  - Optionally archive and upload Supabase storage buckets or S3 buckets
#  - Calculate checksums for integrity verification
#  - Enforce tiered retention (daily/weekly/monthly) on local artifacts
#  - Emit structured logs that can be shipped to observability stacks
#
# Requirements
#  - bash 5+, pg_dump, gzip, openssl (optional), supabase CLI (optional), aws CLI (optional)
#  - Connection string supplied via SUPABASE_DB_URL or DATABASE_URL
#  - (Optional) `supabase` CLI authenticated via SUPABASE_ACCESS_TOKEN/SUPABASE_PROJECT_REF
#  - (Optional) AWS credentials if using S3 for object storage snapshots

set -euo pipefail

SCRIPT_NAME="$(basename "$0")"
TIMESTAMP_UTC="$(date -u +"%Y%m%dT%H%M%SZ")"
DEFAULT_ROOT="${BACKUP_ROOT:-$(pwd)/backups}"
BACKUP_ROOT="${1:-$DEFAULT_ROOT}"

# Load env overrides if present
if [[ -f ".env.dr" ]]; then
  # shellcheck disable=SC1091
  source .env.dr
fi

DB_URL="${SUPABASE_DB_URL:-${DATABASE_URL:-}}"
if [[ -z "$DB_URL" ]]; then
  echo "[$SCRIPT_NAME] ERROR missing SUPABASE_DB_URL/DATABASE_URL" >&2
  exit 1
fi

# Determine retention tier
DAY_OF_MONTH="$(date -u +%d)"
DAY_OF_WEEK="$(date -u +%u)" # 1..7 (Mon..Sun)
if [[ "$DAY_OF_MONTH" == "01" ]]; then
  RETENTION_TIER="monthly"
  RETENTION_DAYS=${RETENTION_MONTHLY_DAYS:-90}
elif [[ "$DAY_OF_WEEK" == "7" ]]; then
  RETENTION_TIER="weekly"
  RETENTION_DAYS=${RETENTION_WEEKLY_DAYS:-30}
else
  RETENTION_TIER="daily"
  RETENTION_DAYS=${RETENTION_DAILY_DAYS:-7}
fi

TARGET_DIR="$BACKUP_ROOT/$RETENTION_TIER/$TIMESTAMP_UTC"
mkdir -p "$TARGET_DIR"

LOG() {
  local level=$1
  shift
  printf '{"timestamp":"%s","script":"%s","level":"%s","message":"%s"}\n' \
    "$TIMESTAMP_UTC" "$SCRIPT_NAME" "$level" "$*"
}

LOG info "Starting backup tier=$RETENTION_TIER retention=${RETENTION_DAYS}d"

DB_DUMP_FILE="$TARGET_DIR/db.dump"

LOG info "Running pg_dump"
pg_dump --dbname="$DB_URL" \
  --no-owner --no-privileges --format=custom \
  --jobs="${PG_DUMP_JOBS:-4}" \
  --file="$DB_DUMP_FILE"

gzip "$DB_DUMP_FILE"
DB_DUMP_ARCHIVE="$TARGET_DIR/db.dump.gz"

if [[ -n "${BACKUP_PASSPHRASE:-}" ]]; then
  LOG info "Encrypting archive"
  openssl enc -aes-256-cbc -salt -in "$DB_DUMP_ARCHIVE" \
    -out "$DB_DUMP_ARCHIVE.enc" -pass "pass:$BACKUP_PASSPHRASE"
  rm "$DB_DUMP_ARCHIVE"
  DB_DUMP_ARCHIVE="$TARGET_DIR/db.dump.gz.enc"
fi

create_checksum() {
  local file_path="$1"
  local file_dir
  file_dir="$(dirname "$file_path")"
  local file_name
  file_name="$(basename "$file_path")"

  pushd "$file_dir" >/dev/null
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$file_name" > "$file_name.sha256"
  else
    shasum -a 256 "$file_name" > "$file_name.sha256"
  fi
  popd >/dev/null
}

create_checksum "$DB_DUMP_ARCHIVE"

snapshot_supabase_bucket() {
  local bucket="$1"
  [[ -n "$bucket" ]] || return 0

  if ! command -v supabase >/dev/null 2>&1; then
    LOG warn "Supabase CLI not available; skipping bucket snapshot"
    return 0
  fi
  if [[ -z "${SUPABASE_PROJECT_REF:-}" ]]; then
    LOG warn "SUPABASE_PROJECT_REF not set; skipping bucket snapshot"
    return 0
  fi

  local destination="$2"
  local tmp="$destination/storage"
  local archive="$destination/storage.tar.gz"

  LOG info "Downloading bucket $bucket via supabase CLI"
  mkdir -p "$tmp"
  supabase storage download "$bucket" "$tmp" >/dev/null 2>&1 || {
    LOG error "Failed to download bucket $bucket"
    rm -rf "$tmp"
    return 1
  }

  tar -C "$tmp" -czf "$archive" .
  rm -rf "$tmp"
  create_checksum "$archive"
}

snapshot_s3_prefix() {
  local bucket="$1"
  local prefix="$2"
  [[ -n "$bucket" ]] || return 0

  if ! command -v aws >/dev/null 2>&1; then
    LOG warn "AWS CLI not available; skipping S3 snapshot"
    return 0
  fi

  local destination="$3"
  local tmp="$destination/s3"
  local archive="$destination/storage-s3.tar.gz"

  LOG info "Syncing S3 bucket s3://$bucket/$prefix"
  mkdir -p "$tmp"
  aws s3 sync "s3://$bucket/$prefix" "$tmp" >/dev/null
  tar -C "$tmp" -czf "$archive" .
  rm -rf "$tmp"
  create_checksum "$archive"
}

snapshot_supabase_bucket "${SUPABASE_STORAGE_BUCKET:-}" "$TARGET_DIR"
snapshot_s3_prefix "${AWS_S3_BUCKET:-}" "${AWS_S3_PREFIX:-}" "$TARGET_DIR"

upload_artifacts() {
  local path="$1"
  local remote_prefix="$2"

  if command -v supabase >/dev/null 2>&1 && [[ -n "${SUPABASE_PROJECT_REF:-}" ]]; then
    LOG info "Uploading artifacts to Supabase storage"
    supabase storage cp "$path" "$remote_prefix" >/dev/null
  elif command -v aws >/dev/null 2>&1 && [[ -n "${AWS_S3_BUCKET:-}" ]]; then
    LOG info "Uploading artifacts to S3"
    aws s3 cp "$path" "$remote_prefix" >/dev/null
  else
    LOG info "No remote upload configured"
  fi
}

REMOTE_ROOT="${REMOTE_BACKUP_PREFIX:-}"
if [[ -n "$REMOTE_ROOT" ]]; then
  upload_artifacts "$DB_DUMP_ARCHIVE" "$REMOTE_ROOT/$(basename "$DB_DUMP_ARCHIVE")"
  upload_artifacts "$DB_DUMP_ARCHIVE.sha256" "$REMOTE_ROOT/$(basename "$DB_DUMP_ARCHIVE").sha256"
  if [[ -f "$TARGET_DIR/storage.tar.gz" ]]; then
    upload_artifacts "$TARGET_DIR/storage.tar.gz" "$REMOTE_ROOT/storage.tar.gz"
    upload_artifacts "$TARGET_DIR/storage.tar.gz.sha256" "$REMOTE_ROOT/storage.tar.gz.sha256"
  fi
  if [[ -f "$TARGET_DIR/storage-s3.tar.gz" ]]; then
    upload_artifacts "$TARGET_DIR/storage-s3.tar.gz" "$REMOTE_ROOT/storage-s3.tar.gz"
    upload_artifacts "$TARGET_DIR/storage-s3.tar.gz.sha256" "$REMOTE_ROOT/storage-s3.tar.gz.sha256"
  fi
fi

LOG info "Backup complete at $TARGET_DIR"

# Retention cleanup (local)
cleanup_retention() {
  local tier_dir="$BACKUP_ROOT/$1"
  local retain_days=$2
  [[ -d "$tier_dir" ]] || return 0
  find "$tier_dir" -mindepth 1 -maxdepth 1 -type d -mtime "+$retain_days" -print0 |
    while IFS= read -r -d '' old_dir; do
      LOG info "Removing expired backup $old_dir"
      rm -rf "$old_dir"
    done
}

cleanup_retention daily "${RETENTION_DAILY_DAYS:-7}"
cleanup_retention weekly "${RETENTION_WEEKLY_DAYS:-30}"
cleanup_retention monthly "${RETENTION_MONTHLY_DAYS:-90}"

LOG info "Retention cleanup complete"

