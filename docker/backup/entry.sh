#!/bin/sh
# cron jobs do not see the container's settings, so save them to a file that backup.sh reads.
set -eu
: > /etc/backup.env
for v in PGHOST PGUSER PGPASSWORD PGDATABASE KEEP_DAYS; do
  eval "val=\${$v:-}"
  printf "export %s='%s'\n" "$v" "$val" >> /etc/backup.env
done
chmod 600 /etc/backup.env
echo "[backup] scheduled daily at 03:00 IST into /backups (kept ${KEEP_DAYS:-14} days)"
exec crond -f -l 8
