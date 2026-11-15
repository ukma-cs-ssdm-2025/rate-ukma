#!/usr/bin/env bash

# Applies the parser-db Postgres cluster and waits until it is ready. Run by .github/workflows/parser-platform.yml.

set -euo pipefail

: "${PLATFORM_ROOT:?PLATFORM_ROOT is required}"

before=$(kubectl -n parser get cluster parser-db --ignore-not-found -o jsonpath='{.metadata.generation}')
kubectl apply --server-side --field-manager=parser-platform -k "$PLATFORM_ROOT/database"
after=$(kubectl -n parser get cluster parser-db -o jsonpath='{.metadata.generation}')

# CNPG reports no observedGeneration: after a spec change, Ready=True may still be the old state.
# Give the operator 30s to pick the change up; reload-only changes never drop Ready.
if [ -n "$before" ] && [ "$before" != "$after" ]; then
  kubectl -n parser wait --for=condition=Ready=false cluster/parser-db --timeout=30s 2> /dev/null \
    || echo "Ready stayed True: this change needed no restart."
fi

# The first start pulls the image and runs initdb.
kubectl -n parser wait --for=condition=Ready cluster/parser-db --timeout=10m

# WAL archiving through the barman-cloud plugin: False means the bucket or its keys are wrong.
# The plugin reports the first archived segment within a few minutes of the apply.
if ! kubectl -n parser wait --for=condition=ContinuousArchiving cluster/parser-db --timeout=5m; then
  kubectl -n parser get cluster parser-db \
    -o jsonpath='{range .status.conditions[?(@.type=="ContinuousArchiving")]}{.reason}: {.message}{"\n"}{end}'
  echo "::error::WAL archiving to the backup bucket is not working"
  exit 1
fi

# The service reads DATABASE_URL from this Secret.
uri=$(kubectl -n parser get secret parser-db-app -o jsonpath='{.data.uri}')
[ -n "$uri" ] || { echo "::error::parser-db-app has no uri key"; exit 1; }
