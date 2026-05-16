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
    --keep-until-expiring \
    -m "$CERTBOT_EMAIL" \
    -d "$SERVER_NAME"

# options-ssl-nginx.conf and ssl-dhparams.pem are only created by certbot's nginx
# plugin, not by --standalone. Copy them from the installed certbot-nginx package.
if [[ ! -f /etc/letsencrypt/options-ssl-nginx.conf ]]; then
    log "tls" "Copying options-ssl-nginx.conf from certbot-nginx package"
    src=$(find /usr -name "options-ssl-nginx.conf" 2>/dev/null | head -1)
    [[ -n "$src" ]] || { log "tls" "ERROR: options-ssl-nginx.conf not found in certbot package"; exit 1; }
    sudo cp "$src" /etc/letsencrypt/options-ssl-nginx.conf
fi

if [[ ! -f /etc/letsencrypt/ssl-dhparams.pem ]]; then
    log "tls" "Copying ssl-dhparams.pem from certbot package"
    src=$(find /usr -name "ssl-dhparams.pem" -path "*/certbot/*" 2>/dev/null | head -1)
    [[ -n "$src" ]] || { log "tls" "ERROR: ssl-dhparams.pem not found in certbot package"; exit 1; }
    sudo cp "$src" /etc/letsencrypt/ssl-dhparams.pem
fi

log "tls" "Applying production nginx config"
envsubst '${SERVER_NAME}' < "$TEMPLATE" | sudo tee "$DEST" > /dev/null
sudo nginx -t
sudo systemctl restart nginx

log "tls" "Done — $SERVER_NAME is now serving HTTPS"
