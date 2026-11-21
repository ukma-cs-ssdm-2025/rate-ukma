#!/usr/bin/env bash

# Applies the parser-db Postgres cluster and waits until it is ready. Run by .github/workflows/parser-platform.yml.

set -euo pipefail

: "${PLATFORM_ROOT:?PLATFORM_ROOT is required}"

cluster_generation() {
  kubectl -n parser get cluster parser-db --ignore-not-found -o jsonpath='{.metadata.generation}'
}

apply_database() {
  local before after
  before=$(cluster_generation)
  kubectl apply --server-side --field-manager=parser-platform -k "$PLATFORM_ROOT/database"
  after=$(cluster_generation)

  # CNPG reports no observedGeneration: after a spec change, Ready=True may still be the old state.
  # Give the operator 30s to pick the change up; reload-only changes never drop Ready.
  if [ -n "$before" ] && [ "$before" != "$after" ]; then
    kubectl -n parser wait --for=condition=Ready=false cluster/parser-db --timeout=30s 2> /dev/null \
      || echo "Ready stayed True: this change needed no restart."
  fi
}

wait_until_ready() {
  # The first start pulls the image and runs initdb.
  kubectl -n parser wait --for=condition=Ready cluster/parser-db --timeout=10m
}

wait_for_wal_archiving() {
  # False means the bucket or its keys are wrong.
  # The plugin reports the first archived segment within a few minutes of the apply.
  if kubectl -n parser wait --for=condition=ContinuousArchiving cluster/parser-db --timeout=5m; then
    return
  fi
  kubectl -n parser get cluster parser-db \
    -o jsonpath='{range .status.conditions[?(@.type=="ContinuousArchiving")]}{.reason}: {.message}{"\n"}{end}'
  echo "::error::WAL archiving to the backup bucket is not working"
  exit 1
}

first_completed_backup() {
  kubectl -n parser get backup \
    -o jsonpath='{range .items[?(@.status.phase=="completed")]}{.metadata.name}{"\n"}{end}' | head -n1
}

print_backups() {
  kubectl -n parser get backup \
    -o jsonpath='{range .items[*]}{.metadata.name}: {.status.phase} {.status.error}{"\n"}{end}'
}

# WAL alone is not a restore point: a base backup has to complete too.
# The ScheduledBackup takes the first one right after the first apply (immediate: true);
# later runs find it done.
wait_for_base_backup() {
  local completed=""
  for _ in $(seq 1 60); do
    completed=$(first_completed_backup)
    if [ -n "$completed" ]; then
      echo "Base backup $completed is completed."
      return
    fi
    sleep 10
  done
  print_backups
  echo "::error::no base backup of parser-db has completed within 10 minutes"
  exit 1
}

check_app_secret() {
  # The service reads DATABASE_URL from this Secret.
  local uri
  uri=$(kubectl -n parser get secret parser-db-app -o jsonpath='{.data.uri}')
  [ -n "$uri" ] || { echo "::error::parser-db-app has no uri key"; exit 1; }
}

apply_database
wait_until_ready
wait_for_wal_archiving
wait_for_base_backup
check_app_secret
