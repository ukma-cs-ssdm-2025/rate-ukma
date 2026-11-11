#!/usr/bin/env bash

# Prints the parser-ghcr-pull Secret, which lets the cluster pull the private parser image from ghcr.io.
# Applied by .github/workflows/parser-platform.yml; to rotate the token, see the README.

set -euo pipefail

: "${GHCR_PULL_USER:?GHCR_PULL_USER is required}"
: "${GHCR_PULL_TOKEN:?GHCR_PULL_TOKEN is required}"

# Built from files, so the token never appears in a command line.
config=$(mktemp)
trap 'rm -f "$config"' EXIT
jq -n --arg user "$GHCR_PULL_USER" --arg token "$GHCR_PULL_TOKEN" \
  '{auths: {"ghcr.io": {auth: ("\($user):\($token)" | @base64)}}}' > "$config"

kubectl create secret generic parser-ghcr-pull \
  --namespace parser \
  --type kubernetes.io/dockerconfigjson \
  --from-file .dockerconfigjson="$config" \
  --dry-run=client -o yaml
