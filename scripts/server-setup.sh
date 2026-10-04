#!/bin/bash
# One-time setup of a fresh DigitalOcean Ubuntu 24.04 Droplet for the Jain Sangh app.
# Run it ON THE SERVER as root:   bash server-setup.sh
# It is safe to run again; steps already done are skipped.
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "Run as root"; exit 1; }

echo "== 1. Updates and automatic security updates"
apt-get update -y
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y
DEBIAN_FRONTEND=noninteractive apt-get install -y unattended-upgrades ca-certificates curl ufw
dpkg-reconfigure -f noninteractive unattended-upgrades

echo "== 2. Docker (from Ubuntu's own packages)"
DEBIAN_FRONTEND=noninteractive apt-get install -y docker.io docker-compose-v2 docker-buildx
systemctl enable --now docker
# "deploy" = the user GitHub Actions logs in as. It can run Docker but has no password and no sudo.
id deploy >/dev/null 2>&1 || adduser --disabled-password --gecos "" deploy
usermod -aG docker deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
touch /home/deploy/.ssh/authorized_keys && chown deploy:deploy /home/deploy/.ssh/authorized_keys && chmod 600 /home/deploy/.ssh/authorized_keys

echo "== 3. 2 GB swap file (extra memory on disk, so a busy moment cannot crash the 2 GB server)"
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' | tee -a /etc/fstab
fi

echo "== 4. Firewall: only SSH, HTTP and HTTPS"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "== 5. App folder"
mkdir -p /opt/jainsangh
chown deploy:deploy /opt/jainsangh
# data/uploads = form photos + KYC scans (written by the app, which runs as user id 1001 inside its container)
# data/backups = nightly database copies
mkdir -p /opt/jainsangh/data/uploads /opt/jainsangh/data/backups
chown 1001:1001 /opt/jainsangh/data/uploads
chmod 711 /opt/jainsangh/data   # others may pass through (Docker run by "deploy" needs it) but not list it
chmod 700 /opt/jainsangh/data/uploads /opt/jainsangh/data/backups

echo "== 6. rclone (weekly encrypted copy to Google Drive) + weekly schedule"
DEBIAN_FRONTEND=noninteractive apt-get install -y rclone
mkdir -p /opt/jainsangh/scripts
chown deploy:deploy /opt/jainsangh/scripts   # GitHub Actions (user deploy) copies scripts here on every deploy
# Every Sunday 04:00 India time (server clock is UTC: Saturday 22:30 UTC). Does nothing useful until
# rclone is configured (docs/SERVER-SETUP.md, "Google Drive backup"); failures are written to the log.
echo "30 22 * * 6 root bash /opt/jainsangh/scripts/drive-backup.sh" > /etc/cron.d/jainsangh-drive-backup
chmod 644 /etc/cron.d/jainsangh-drive-backup

echo "== 7. Docker log size limit (logs cannot fill the disk)"
if [ ! -f /etc/docker/daemon.json ]; then
  echo '{ "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "3" } }' | tee /etc/docker/daemon.json
  systemctl restart docker
fi

echo
echo "Done. Next (see docs/SERVER-SETUP.md):"
echo "  1. create /opt/jainsangh/.env (owner deploy, chmod 600)"
echo "  2. add the GitHub deploy key to /home/deploy/.ssh/authorized_keys"
