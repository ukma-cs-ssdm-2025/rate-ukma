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

sudo certbot --nginx \
    --non-interactive --agree-tos \
    --keep-until-expiring \
    -m "$CERTBOT_EMAIL" \
    -d "$SERVER_NAME"

log "tls" "Applying production nginx config"
envsubst '${SERVER_NAME}' < "$TEMPLATE" | sudo tee "$DEST" > /dev/null
sudo nginx -t
sudo nginx -s reload

log "tls" "Done — $SERVER_NAME is now serving HTTPS"
