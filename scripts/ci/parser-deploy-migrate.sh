#!/usr/bin/env bash

# Runs the parser-migrate Job from the rendered manifests and waits for it. Run by .github/workflows/parser-deploy.yml.
# Exits non-zero when the migration fails, so the rollout never starts and the old pods keep serving.

set -euo pipefail

: "${MANIFESTS:?MANIFESTS is required}"

namespace=parser
job=parser-migrate

# A Job's pod template can't change, so every deploy starts a new Job.
kubectl -n "$namespace" delete job "$job" --ignore-not-found --wait
kubectl apply -f "$MANIFESTS" -l app.kubernetes.io/component=migrate

# kubectl wait takes a single condition, and a failed Job would only end it at the timeout.
# activeDeadlineSeconds (300s) fails the Job, so one of the two conditions comes within 6 minutes.
result=""
for _ in $(seq 1 72); do
  conditions=$(kubectl -n "$namespace" get job "$job" -o jsonpath='{.status.conditions[?(@.status=="True")].type}')
  case " $conditions " in
    *" Complete "*) result=Complete; break ;;
    *" Failed "*) result=Failed; break ;;
  esac
  sleep 5
done

# No logs yet when the pod never started, for example on ImagePullBackOff.
kubectl -n "$namespace" logs "job/$job" --tail=200 || true

if [ "$result" != Complete ]; then
  kubectl -n "$namespace" describe pods -l "job-name=$job" || true
  echo "::error::migration ${result:-timed out}: nothing was rolled out"
  exit 1
fi
echo "Migration complete"
