#!/bin/bash
# One-time setup of a fresh AWS Lightsail Ubuntu 24.04 server for the Jain Sangh app.
# Run it ON THE SERVER as the "ubuntu" user:   bash server-setup.sh
# It is safe to run again; steps already done are skipped.
set -euo pipefail

echo "== 1. Updates and automatic security updates"
sudo apt-get update -y
sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -y
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y unattended-upgrades ca-certificates curl ufw
sudo dpkg-reconfigure -f noninteractive unattended-upgrades

echo "== 2. Docker (from Ubuntu's own packages)"
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y docker.io docker-compose-v2 docker-buildx
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"

echo "== 3. 2 GB swap file (extra memory on disk, so a busy moment cannot crash the 2 GB server)"
if [ ! -f /swapfile ]; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi

echo "== 4. Firewall: only SSH, HTTP and HTTPS"
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

echo "== 5. App folder"
sudo mkdir -p /opt/jainsangh
sudo chown "$USER":"$USER" /opt/jainsangh

echo "== 6. Docker log size limit (logs cannot fill the disk)"
if [ ! -f /etc/docker/daemon.json ]; then
  echo '{ "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "3" } }' | sudo tee /etc/docker/daemon.json
  sudo systemctl restart docker
fi

echo
echo "Done. Log out and log in again (so the docker group applies), then:"
echo "  1. put the .env file in /opt/jainsangh (see docs/AWS-SETUP.md)"
echo "  2. run the GitHub Action 'test-build-deploy' (or push to main)"
