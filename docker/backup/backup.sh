#!/bin/sh
# Dumps the whole database, compresses it and uploads it to s3://$S3_BUCKET/backups/.
# Keeps the last $KEEP_DAYS days of backups; older ones are deleted from the bucket.
# Run by hand:  docker compose exec backup backup.sh
set -eu
[ -f /etc/backup.env ] && . /etc/backup.env
STAMP=$(date +%Y-%m-%d_%H%M)
FILE=/tmp/jainsangh_$STAMP.sql.gz
pg_dump --no-owner --clean --if-exists | gzip -9 > "$FILE"
aws s3 cp "$FILE" "s3://$S3_BUCKET/backups/jainsangh_$STAMP.sql.gz" --only-show-errors
echo "[backup] uploaded jainsangh_$STAMP.sql.gz ($(du -h "$FILE" | cut -f1))"
rm -f "$FILE"

CUTOFF=$(date -d "@$(( $(date +%s) - ${KEEP_DAYS:-30} * 86400 ))" +%Y-%m-%d)
aws s3 ls "s3://$S3_BUCKET/backups/" | awk '{print $4}' | while read -r name; do
  d=$(echo "$name" | sed -n 's/^jainsangh_\([0-9-]*\)_.*/\1/p')
  if [ -n "$d" ] && [ "$d" \< "$CUTOFF" ]; then
    aws s3 rm "s3://$S3_BUCKET/backups/$name" --only-show-errors && echo "[backup] removed old $name"
  fi
done
