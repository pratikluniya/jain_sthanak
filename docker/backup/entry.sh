#!/bin/sh
# cron jobs do not see the container's settings, so save them to a file that backup.sh reads.
set -eu
: > /etc/backup.env
for v in PGHOST PGUSER PGPASSWORD PGDATABASE S3_BUCKET AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_DEFAULT_REGION S3_ENDPOINT KEEP_DAYS; do
  eval "val=\${$v:-}"
  printf "export %s='%s'\n" "$v" "$val" >> /etc/backup.env
done
chmod 600 /etc/backup.env
echo "[backup] scheduled daily at 03:00 IST to s3://${S3_BUCKET}/backups/"
exec crond -f -l 8
