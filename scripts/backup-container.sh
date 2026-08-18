#!/bin/sh
set -eu

BACKUP_ROOT=${BACKUP_STORAGE_PATH:-/backups}
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}
mkdir -p "$BACKUP_ROOT"

while true; do
  now=$(date +%s)
  next=$(date -d 'tomorrow 02:00' +%s)
  sleep $((next - now))
  stamp=$(date +%Y%m%d-%H%M%S)
  target="$BACKUP_ROOT/$stamp"
  mkdir -p "$target"
  pg_dump -h db -U churchadmin -d churchadmin -Fc > "$target/database.dump"
  tar -czf "$target/media.tar.gz" -C /data media
  tar -czf "$target/exports.tar.gz" -C /data exports
  sha256sum "$target"/* > "$target/SHA256SUMS"
  find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -mtime "+$RETENTION_DAYS" -exec rm -rf {} +
  echo "$(date -Iseconds) backup_complete $target"
done
