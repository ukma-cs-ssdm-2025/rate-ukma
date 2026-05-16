#!/usr/bin/env bash
# Deploys the app on a fresh server. No backup or rollback — new servers only.

set -euo pipefail

log() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] [$1] $2"; }

: "${PROJECT_DIR:?PROJECT_DIR is required}"
: "${STATIC_ROOT:?STATIC_ROOT is required}"
: "${WEBAPP_IMAGE_TAG:?WEBAPP_IMAGE_TAG is required}"
: "${BACKEND_IMAGE_TAG:?BACKEND_IMAGE_TAG is required}"
: "${GITHUB_TOKEN:?GITHUB_TOKEN is required}"
: "${GITHUB_ACTOR:?GITHUB_ACTOR is required}"
MAX_ATTEMPTS="${MAX_ATTEMPTS:-6}"
HEALTHCHECK_TIMEOUT="${HEALTHCHECK_TIMEOUT:-10}"

SOURCE_CODE="$PROJECT_DIR/src"

compose_cmd() {
    sudo WEBAPP_IMAGE_TAG="$WEBAPP_IMAGE_TAG" BACKEND_IMAGE_TAG="$BACKEND_IMAGE_TAG" \
        docker compose --profile prod "$@"
}

log "deploy" "Logging in to GHCR"
echo "$GITHUB_TOKEN" | sudo docker login ghcr.io -u "$GITHUB_ACTOR" --password-stdin

log "deploy" "Pulling images (backend: $BACKEND_IMAGE_TAG, webapp: $WEBAPP_IMAGE_TAG)"
cd "$SOURCE_CODE"
compose_cmd pull

log "deploy" "Starting services"
compose_cmd up -d

log "deploy" "Waiting for services to be healthy"
attempt=1
EXPECTED_SERVICES=$(sudo docker compose --profile prod config --services | wc -l)
log "deploy" "Expecting $EXPECTED_SERVICES services"

while [[ "$attempt" -le "$MAX_ATTEMPTS" ]]; do
    log "deploy" "Health check attempt $attempt/$MAX_ATTEMPTS"
    ALL_JSON=$(sudo docker compose ps -a --format json | jq -s '.')
    HEALTHY=$(echo "$ALL_JSON" | jq '[.[] | select(.State == "running" or (.State == "exited" and .ExitCode == 0))] | length')

    if [[ "$HEALTHY" -eq "$EXPECTED_SERVICES" && -f "$STATIC_ROOT/index.html" ]]; then
        log "deploy" "All $HEALTHY/$EXPECTED_SERVICES services healthy"
        exit 0
    fi

    log "deploy" "$HEALTHY/$EXPECTED_SERVICES healthy, retrying in ${HEALTHCHECK_TIMEOUT}s"
    echo "$ALL_JSON" | jq -r '.[] | select(.State != "running" and (.State != "exited" or .ExitCode != 0)) | "  UNHEALTHY: \(.Service) state=\(.State) exit_code=\(.ExitCode)"'
    sleep "$HEALTHCHECK_TIMEOUT"
    attempt=$((attempt + 1))
done

log "deploy" "ERROR: services failed to become healthy"
sudo docker compose ps -a
exit 1
