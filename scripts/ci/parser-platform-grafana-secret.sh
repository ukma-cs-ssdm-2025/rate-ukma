#!/usr/bin/env bash

# Prints the grafana-cloud Secret, Alloy's credentials for Grafana Cloud and its cluster label.
# Applied by .github/workflows/parser-platform.yml.

set -euo pipefail

case "${ENVIRONMENT:-}" in
  staging | live) ;;
  *) echo "ENVIRONMENT must be staging or live, got '${ENVIRONMENT:-}'" >&2; exit 1 ;;
esac

for var in GRAFANA_CLOUD_TOKEN GRAFANA_PROM_URL GRAFANA_PROM_USER GRAFANA_LOKI_URL GRAFANA_LOKI_USER; do
  [ -n "${!var:-}" ] || { echo "$var is required" >&2; exit 1; }
done

# Alloy's config.alloy adds it to every log line and series as the cluster label.
CLUSTER_NAME="parser-$ENVIRONMENT"

# Built from files, so the token never appears in a command line.
dir=$(mktemp -d)
trap 'rm -rf "$dir"' EXIT
for var in GRAFANA_CLOUD_TOKEN GRAFANA_PROM_URL GRAFANA_PROM_USER GRAFANA_LOKI_URL GRAFANA_LOKI_USER CLUSTER_NAME; do
  printf '%s' "${!var}" > "$dir/$var"
done

kubectl create secret generic grafana-cloud \
  --namespace monitoring \
  $(for f in "$dir"/*; do printf -- '--from-file=%s=%s ' "$(basename "$f")" "$f"; done) \
  --dry-run=client -o yaml
