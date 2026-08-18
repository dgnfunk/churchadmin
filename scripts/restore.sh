#!/bin/sh
set -eu

SOURCE=${1:?Usage: ./scripts/restore.sh ./backups/YYYYMMDD-HHMMSS}
test -f "$SOURCE/database.dump"
test -f "$SOURCE/media.tar.gz"
docker compose exec -T db pg_restore -U churchadmin -d churchadmin --clean --if-exists < "$SOURCE/database.dump"
mkdir -p ./data
tar -xzf "$SOURCE/media.tar.gz" -C ./data
if test -f "$SOURCE/exports.tar.gz"; then tar -xzf "$SOURCE/exports.tar.gz" -C ./data; fi
echo "Restore completed from $SOURCE"
