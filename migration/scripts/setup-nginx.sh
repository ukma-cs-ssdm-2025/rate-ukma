#!/usr/bin/env bash
# Configures nginx with HTTP only. Run enable-tls.sh after DNS cutover to add TLS.

set -euo pipefail

log() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [$1] $2"; }

: "${SERVER_NAME:?SERVER_NAME is required}"

DEST="/etc/nginx/sites-available/$SERVER_NAME"

log "nginx" "Configuring HTTP-only vhost for $SERVER_NAME"

sudo tee "$DEST" > /dev/null << NGINX_CONF
upstream backend {
    server 127.0.0.1:8000;
    keepalive 16;
}

server {
    listen 80;
    server_name $SERVER_NAME;

    access_log /var/log/nginx/rateukma_access.log;
    error_log /var/log/nginx/rateukma_error.log;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 5;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;

    location /api/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /admin/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /accounts/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /courses/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /static/ {
        alias /opt/rateukma/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /media/ {
        alias /opt/rateukma/media/;
    }

    location = /index.html {
        root /opt/rateukma/static;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    location / {
        root /opt/rateukma/static;
        try_files \$uri \$uri/ /index.html =404;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
NGINX_CONF

sudo ln -sf "$DEST" "/etc/nginx/sites-enabled/$SERVER_NAME"
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo nginx -s reload 2>/dev/null || sudo systemctl start nginx

log "nginx" "Done — run enable-tls workflow after DNS cutover"
