#!/usr/bin/env bash
# Provisions a fresh server: installs Docker, Nginx, Certbot, jq and creates project directories.
# Designed to run as root (fresh Hetzner VM).

set -euo pipefail

log() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [$1] $2"; }

PROJECT_DIR="${PROJECT_DIR:-/opt/rateukma}"
SSH_USER="${SSH_USER:-root}"

log "provision" "Installing system dependencies"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl gnupg jq nginx certbot python3-certbot-nginx

log "provision" "Installing Docker"
if ! command -v docker &>/dev/null; then
    curl -fsSL https://get.docker.com | sh
else
    log "provision" "Docker already installed: $(docker --version)"
fi

log "provision" "Creating project directories under $PROJECT_DIR"
mkdir -p "$PROJECT_DIR"/{src,static,media}

if [[ "$SSH_USER" != "root" ]]; then
    chown -R "$SSH_USER:$SSH_USER" "$PROJECT_DIR"
fi

log "provision" "Done"
