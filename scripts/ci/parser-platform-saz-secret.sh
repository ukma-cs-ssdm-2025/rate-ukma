#!/usr/bin/env bash

# Prints the parser-saz Secret, the САЗ account the worker signs in with.
# Applied by .github/workflows/parser-platform.yml; to change the account, see the README.

set -euo pipefail

: "${SAZ_EMAIL:?SAZ_EMAIL is required}"
: "${SAZ_PASSWORD:?SAZ_PASSWORD is required}"

# Built from files, so the password never appears in a command line.
dir=$(mktemp -d)
trap 'rm -rf "$dir"' EXIT
printf '%s' "$SAZ_EMAIL" > "$dir/email"
printf '%s' "$SAZ_PASSWORD" > "$dir/password"

kubectl create secret generic parser-saz \
  --namespace parser \
  --from-file email="$dir/email" \
  --from-file password="$dir/password" \
  --dry-run=client -o yaml
