#!/bin/bash
# Weekly off-server copy to Google Drive (runs ON THE SERVER, from cron, as root).
#   - database copies: data/backups  -> Drive, mirrored (Drive keeps the same last 14 days as the server)
#   - photos + KYC scans: data/uploads -> Drive, copy only (a file deleted on the server stays on Drive)
# Everything is ENCRYPTED before it leaves the server (rclone "crypt" remote "jsdrive-crypt"),
# so Google only stores scrambled files. Without the crypt password (in the password manager) nobody,
# including us, can read them.
# One-time setup: docs/SERVER-SETUP.md, section "Google Drive backup".
# Run by hand:  bash /opt/jainsangh/scripts/drive-backup.sh
set -euo pipefail
cd /opt/jainsangh
LOG=/var/log/jainsangh-drive-backup.log
{
  echo "=== $(date -Is) start"
  # fresh database copy first, so the newest data goes to Drive
  docker compose exec -T backup backup.sh
  rclone sync  data/backups jsdrive-crypt:backups --transfers 2 --stats-one-line --stats 0
  rclone copy  data/uploads jsdrive-crypt:uploads --transfers 4 --stats-one-line --stats 0
  echo "=== $(date -Is) done"
} >> "$LOG" 2>&1 || { echo "=== $(date -Is) FAILED (see above)" >> "$LOG"; exit 1; }
