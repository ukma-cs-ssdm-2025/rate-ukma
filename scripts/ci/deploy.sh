#!/usr/bin/env bash

# Remote deployment script. Runs on the deployment server via SSH. Handles backup, deploy, health check, and rollback.


set -euo pipefail

: "${PROJECT_DIR:?PROJECT_DIR is required}"
: "${SOURCE_CODE:?SOURCE_CODE is required}"
: "${TMP_DIR:?TMP_DIR is required}"
: "${BACKUP_DIR:?BACKUP_DIR is required}"
: "${STATIC_ROOT:?STATIC_ROOT is required}"
: "${ARCHIVE:?ARCHIVE is required}"
: "${MAX_ATTEMPTS:?MAX_ATTEMPTS is required}"
: "${HEALTHCHECK_TIMEOUT:?HEALTHCHECK_TIMEOUT is required}"
: "${SSH_USER:?SSH_USER is required}"
: "${GITHUB_TOKEN:?GITHUB_TOKEN is required}"
: "${GITHUB_ACTOR:?GITHUB_ACTOR is required}"
: "${WEBAPP_IMAGE_TAG:?WEBAPP_IMAGE_TAG is required}"
: "${BACKEND_IMAGE_TAG:?BACKEND_IMAGE_TAG is required}"

PREV_WEBAPP_TAG=""
PREV_BACKEND_TAG=""

compose_cmd() {
  sudo WEBAPP_IMAGE_TAG="$1" BACKEND_IMAGE_TAG="$2" docker compose --profile prod $3
}

setup_permissions() {
  echo "Setting up directory permissions..."
  sudo chown -R "$SSH_USER:$SSH_USER" "$PROJECT_DIR"
  sudo chmod -R 755 "$PROJECT_DIR"
  sudo chown -R "$SSH_USER:$SSH_USER" "$TMP_DIR"
  sudo chmod -R 755 "$TMP_DIR"
}

backup_current_version() {
  echo "Creating backup of current version..."
  mkdir -p "$TMP_DIR" "$BACKUP_DIR"

  if [ ! -d "$SOURCE_CODE" ]; then
    return
  fi

  cp -r "$SOURCE_CODE" "$BACKUP_DIR/"
  echo "Backup created at $BACKUP_DIR"

  echo "Saving current image tags for potential rollback..."
  cd "$SOURCE_CODE"
  PREV_WEBAPP_TAG=$(sudo docker ps --format "{{.Image}}" | grep "webapp" | awk -F: '{print $2}' || echo "")
  PREV_BACKEND_TAG=$(sudo docker ps --format "{{.Image}}" | grep "backend" | awk -F: '{print $2}' || echo "")

  echo "Previous WEBAPP_IMAGE_TAG: $PREV_WEBAPP_TAG"
  echo "Previous BACKEND_IMAGE_TAG: $PREV_BACKEND_TAG"

  if [ -n "$PREV_WEBAPP_TAG" ] && [ -n "$PREV_BACKEND_TAG" ]; then
    echo "PREV_WEBAPP_TAG=$PREV_WEBAPP_TAG" > "$TMP_DIR/prev_tags.env"
    echo "PREV_BACKEND_TAG=$PREV_BACKEND_TAG" >> "$TMP_DIR/prev_tags.env"
  else
    echo "Warning: Could not capture both previous image tags, rollback to previous version will not be available"
  fi
}

stop_services() {
  echo "Stopping existing services..."
  cd "$SOURCE_CODE"
  if [ -n "$PREV_WEBAPP_TAG" ] && [ -n "$PREV_BACKEND_TAG" ]; then
    compose_cmd "$PREV_WEBAPP_TAG" "$PREV_BACKEND_TAG" "down" || true
  else
    sudo docker compose --profile prod down || true
  fi
}

deploy_new_version() {
  echo "Cleaning project directory..."
  sudo rm -rf "${SOURCE_CODE:?}"/*

  echo "Extracting new version..."
  cd "$PROJECT_DIR"
  if ! tar xzf "$TMP_DIR/$ARCHIVE"; then
    echo "Failed to extract archive"
    return 1
  fi
  rm "$TMP_DIR/$ARCHIVE"

  echo "Copying environment file..."
  cp "$PROJECT_DIR/.env" "$SOURCE_CODE/.env"

  echo "Logging in to GitHub Container Registry..."
  if ! echo "$GITHUB_TOKEN" | sudo docker login ghcr.io -u "$GITHUB_ACTOR" --password-stdin; then
    echo "Docker login failed"
    return 1
  fi

  echo "Pulling docker images..."
  echo "Using WEBAPP_IMAGE_TAG: $WEBAPP_IMAGE_TAG"
  echo "Using BACKEND_IMAGE_TAG: $BACKEND_IMAGE_TAG"
  cd "$SOURCE_CODE"
  compose_cmd "$WEBAPP_IMAGE_TAG" "$BACKEND_IMAGE_TAG" "pull"

  echo "Starting services..."
  compose_cmd "$WEBAPP_IMAGE_TAG" "$BACKEND_IMAGE_TAG" "up -d"
}

health_check() {
  echo "Waiting for services to be up and running..."
  local attempt=1

  EXPECTED_SERVICES=$(sudo docker compose --profile prod config --services | wc -l)
  echo "Expecting $EXPECTED_SERVICES services"

  while [ "$attempt" -le "$MAX_ATTEMPTS" ]; do
    echo "Health check attempt $attempt/$MAX_ATTEMPTS..."

    # services that are running or exited successfully (e.g. one-shot build containers)
    HEALTHY_SERVICES=$(sudo docker compose ps --format json | jq -s '[.[] | select(.State == "running" or (.State == "exited" and .ExitCode == 0))] | length')

    if [ "$HEALTHY_SERVICES" -eq "$EXPECTED_SERVICES" ] && [ -f "$STATIC_ROOT/index.html" ]; then
      return 0
    fi

    echo "Services not ready yet ($HEALTHY_SERVICES/$EXPECTED_SERVICES healthy), waiting..."
    sleep "$HEALTHCHECK_TIMEOUT"
    attempt=$((attempt + 1))
  done

  return 1
}

cleanup_on_success() {
  echo "Services are up and healthy"
  rm -rf "$BACKUP_DIR"
  rm -f "$TMP_DIR/prev_tags.env"

  echo "Cleaning up old Docker resources (older than 7 days)..."
  sudo docker image prune -a -f --filter "until=168h"
  sudo docker container prune -f --filter "until=168h"
  COMPOSE_PROJECT="$(basename "$SOURCE_CODE")"
  sudo docker network ls --filter "label=com.docker.compose.project=$COMPOSE_PROJECT" --format '{{.ID}}' \
    | xargs -r sudo docker network rm 2>/dev/null || true

  echo "Reclaimed space:"
  sudo docker system df
  echo "Deployment successful"
}

rollback() {
  echo "Services failed to start properly. Rolling back..."
  sudo docker compose --profile prod down || true

  echo "Restoring previous version from $BACKUP_DIR"
  sudo rm -rf "${SOURCE_CODE:?}"/*
  cp -r "$BACKUP_DIR/src/"* "$SOURCE_CODE/"

  cd "$SOURCE_CODE"

  if [ -f "$TMP_DIR/prev_tags.env" ]; then
    echo "Loading previous image tags..."
    source "$TMP_DIR/prev_tags.env"
  fi

  if [ -n "$PREV_WEBAPP_TAG" ] && [ -n "$PREV_BACKEND_TAG" ]; then
    echo "Rolling back to WEBAPP: $PREV_WEBAPP_TAG, BACKEND: $PREV_BACKEND_TAG"
    compose_cmd "$PREV_WEBAPP_TAG" "$PREV_BACKEND_TAG" "pull"
    compose_cmd "$PREV_WEBAPP_TAG" "$PREV_BACKEND_TAG" "up -d"
  else
    echo "Warning: Previous image tags not available. Cannot rollback to a previous version."
  fi

  echo "Rollback completed. Deployment failed."
  exit 1
}

echo "Deploying..."
setup_permissions
backup_current_version
stop_services
deploy_new_version

if health_check; then
  cleanup_on_success
else
  rollback
fi
