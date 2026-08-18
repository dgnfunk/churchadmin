#!/bin/sh
set -eu

BACKUP_ROOT=${1:-./backups}
STAMP=$(date +%Y%m%d-%H%M%S)
TARGET="$BACKUP_ROOT/$STAMP"
mkdir -p "$TARGET"
docker compose exec -T db pg_dump -U churchadmin -d churchadmin -Fc > "$TARGET/database.dump"
tar -czf "$TARGET/media.tar.gz" -C ./data media
tar -czf "$TARGET/exports.tar.gz" -C ./data exports
echo "Backup created at $TARGET"
