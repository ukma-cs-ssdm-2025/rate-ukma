#!/usr/bin/env bash

# Renders the deploy-time .env file from infra/deploy/.env.<environment>
# by substituting GitHub Environment secrets (passed via the environment) into ${VAR} placeholders

# Fails fast if any referenced variable is missing or empty, 
# so an absent secret cannot silently produce an empty value in the rendered file

# Reads secret values from environment variables matching each ${VAR} 
# placeholder in the template (e.g. POSTGRES_PASSWORD, DJANGO_SECRET_KEY)
# Writes the rendered file to ./.deploy_env in the current working dir

set -euo pipefail

ENVIRONMENT="${1:?usage: $0 <environment>}"

case "$ENVIRONMENT" in
  staging | live) ;;
  *)
    echo "::error::Unsupported environment: $ENVIRONMENT" >&2
    exit 1
    ;;
esac

TEMPLATE="infra/deploy/.env.${ENVIRONMENT}"
OUTPUT=".deploy_env"

if [[ ! -f "$TEMPLATE" ]]; then
  echo "::error::Template $TEMPLATE not found" >&2
  exit 1
fi

# Each ${VAR} in the template must resolve to a non-empty value
# envsubst alone would silently substitute empty strings for missing/empty secrets
# Comment lines are excluded so prose references to ${VAR} in headers aren't misread as required variables

REQUIRED=$(grep -v '^[[:space:]]*#' "$TEMPLATE" | grep -oE '\$\{[A-Z0-9_]+\}' | tr -d '${}' | sort -u)
MISSING=()
for var in $REQUIRED; do
  if [[ -z "${!var:-}" ]]; then
    MISSING+=("$var")
  fi
done
if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo "::error::Missing or empty secret(s) for $ENVIRONMENT environment: ${MISSING[*]}" >&2
  exit 1
fi

envsubst < "$TEMPLATE" > "$OUTPUT"

if grep -nE '\$\{[A-Z0-9_]+\}' "$OUTPUT"; then
  echo "::error::Unresolved placeholders in rendered .env (see above) - template references a variable not provided via env:" >&2
  exit 1
fi
