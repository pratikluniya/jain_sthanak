#!/bin/sh
# Dumps the whole database, compresses it and saves it in /backups
# (= /opt/jainsangh/data/backups on the server). Keeps the last $KEEP_DAYS days.
# This protects against mistakes (bad import, deleted family), NOT against losing the server:
# for that, copy the folder off the server every week (scripts/pull-backup.sh on the Mac).
# Run by hand:  docker compose exec backup backup.sh
set -eu
# fail if pg_dump fails, not only if gzip fails (otherwise an empty file would look like a good backup)
set -o pipefail
[ -f /etc/backup.env ] && . /etc/backup.env
STAMP=$(date +%Y-%m-%d_%H%M)
FILE=/backups/jainsangh_$STAMP.sql.gz
pg_dump --no-owner --clean --if-exists | gzip -9 > "$FILE.part" || { rm -f "$FILE.part"; echo "[backup] FAILED: database dump did not complete"; exit 1; }
mv "$FILE.part" "$FILE"
echo "[backup] saved $(basename "$FILE") ($(du -h "$FILE" | cut -f1))"
find /backups -name 'jainsangh_*.sql.gz' -mtime +"${KEEP_DAYS:-14}" -print -delete | sed 's/^/[backup] removed old /'
