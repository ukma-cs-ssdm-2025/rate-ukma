#!/usr/bin/env bash

# Prints the parser-db-backup-s3 Secret, the barman-cloud plugin's credentials for the backup bucket.
# Applied by .github/workflows/parser-platform.yml.

set -euo pipefail

for var in BACKUP_S3_ACCESS_KEY BACKUP_S3_SECRET_KEY; do
  [ -n "${!var:-}" ] || { echo "$var is required" >&2; exit 1; }
done

# Built from files, so the keys never appear in a command line.
dir=$(mktemp -d)
trap 'rm -rf "$dir"' EXIT
printf '%s' "$BACKUP_S3_ACCESS_KEY" > "$dir/ACCESS_KEY_ID"
printf '%s' "$BACKUP_S3_SECRET_KEY" > "$dir/ACCESS_SECRET_KEY"
printf '%s' hel1 > "$dir/REGION"

kubectl create secret generic parser-db-backup-s3 \
  --namespace parser \
  --from-file=ACCESS_KEY_ID="$dir/ACCESS_KEY_ID" \
  --from-file=ACCESS_SECRET_KEY="$dir/ACCESS_SECRET_KEY" \
  --from-file=REGION="$dir/REGION" \
  --dry-run=client -o yaml
