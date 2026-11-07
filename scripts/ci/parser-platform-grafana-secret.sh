#!/usr/bin/env bash

# Prints the grafana-cloud Secret, Alloy's credentials for Grafana Cloud.
# Applied by .github/workflows/parser-platform.yml.

set -euo pipefail

for var in GRAFANA_CLOUD_TOKEN GRAFANA_PROM_URL GRAFANA_PROM_USER GRAFANA_LOKI_URL GRAFANA_LOKI_USER; do
  [ -n "${!var:-}" ] || { echo "$var is required" >&2; exit 1; }
done

# Built from files, so the token never appears in a command line.
dir=$(mktemp -d)
trap 'rm -rf "$dir"' EXIT
for var in GRAFANA_CLOUD_TOKEN GRAFANA_PROM_URL GRAFANA_PROM_USER GRAFANA_LOKI_URL GRAFANA_LOKI_USER; do
  printf '%s' "${!var}" > "$dir/$var"
done

kubectl create secret generic grafana-cloud \
  --namespace monitoring \
  $(for f in "$dir"/*; do printf -- '--from-file=%s=%s ' "$(basename "$f")" "$f"; done) \
  --dry-run=client -o yaml
