#!/usr/bin/env bash
# Obtains a TLS certificate and switches nginx to HTTPS. Run after DNS cutover.

set -euo pipefail

log() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [$1] $2"; }

: "${SERVER_NAME:?SERVER_NAME is required}"
: "${CERTBOT_EMAIL:?CERTBOT_EMAIL is required}"
PROJECT_DIR="${PROJECT_DIR:-/opt/rateukma}"

TEMPLATE="$PROJECT_DIR/infra/nginx/rateukma.conf.template"
DEST="/etc/nginx/sites-available/$SERVER_NAME"

[[ -f "$TEMPLATE" ]] || { log "tls" "ERROR: nginx template missing at $TEMPLATE"; exit 1; }

log "tls" "Obtaining TLS certificate for $SERVER_NAME"
sudo systemctl stop nginx 2>/dev/null || true
sudo certbot certonly --standalone \
    --non-interactive --agree-tos \
    -m "$CERTBOT_EMAIL" \
    -d "$SERVER_NAME"

log "tls" "Applying TLS nginx config"
envsubst '${SERVER_NAME}' < "$TEMPLATE" | sudo tee "$DEST" > /dev/null
sudo nginx -t
sudo systemctl restart nginx

log "tls" "Done — $SERVER_NAME is now serving HTTPS"
