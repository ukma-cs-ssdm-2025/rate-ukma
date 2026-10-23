#!/usr/bin/env bash

# Applies the parser-db Postgres cluster and waits until it is ready. Run by .github/workflows/parser-platform.yml.

set -euo pipefail

: "${PLATFORM_ROOT:?PLATFORM_ROOT is required}"

kubectl apply --server-side --field-manager=parser-platform -k "$PLATFORM_ROOT/database"

# CNPG reports no observedGeneration, so after a spec change Ready=True may still describe the old spec,
# and the operator can start a restart some time after the apply.
# So also check that the running instances already match the spec: then no restart is pending.
# This covers the fields cluster.yaml sets; a new field that restarts the pods needs a check here.
spec_applied() {
  local cluster pods pod params missing
  cluster=$(kubectl -n parser get cluster parser-db -o json) || return 1
  pods=$(kubectl -n parser get pods -l cnpg.io/cluster=parser-db,cnpg.io/podRole=instance -o json) || return 1

  # Image and resources are what CNPG compares to decide on a rolling restart.
  # The pod's resources are normalized, so cluster.yaml must use canonical quantities (100m, 512Mi).
  jq -en --argjson c "$cluster" --argjson p "$pods" '
    ($c.status.conditions // [] | any(.type == "Ready" and .status == "True"))
    and ($p.items | length) == $c.spec.instances
    and ($p.items | all(
      .metadata.deletionTimestamp == null
      and (.spec.containers[] | select(.name == "postgres")
        | .image == $c.spec.imageName and (.resources // {}) == ($c.spec.resources // {}))))
  ' > /dev/null || return 1

  # pg_file_settings re-reads the config files: applied=false means the value waits for a restart,
  # and a missing row means the instance manager hasn't written the new value yet.
  params=$(jq -c '.spec.postgresql.parameters // {}' <<< "$cluster")
  for pod in $(jq -r '.items[].metadata.name' <<< "$pods"); do
    missing=$(kubectl -n parser exec -i "$pod" -c postgres -- \
      psql -XtA -v ON_ERROR_STOP=1 -v want="$params" 2> /dev/null <<'SQL'
select count(*) from json_each_text(:'want'::json) w
where not exists (
  select 1 from pg_file_settings f
  where f.name = lower(w.key) and f.setting = w.value and f.applied
);
SQL
    ) || return 1
    [ "$missing" = 0 ] || return 1
  done
}

# The first start pulls the image and runs initdb, so allow several minutes.
deadline=$((SECONDS + 600))
until spec_applied; do
  if [ "$SECONDS" -ge "$deadline" ]; then
    echo "::error::parser-db did not reach the applied spec within 10m"
    kubectl -n parser get cluster parser-db
    exit 1
  fi
  sleep 10
done

# The service reads DATABASE_URL from this Secret.
kubectl -n parser get secret parser-db-app -o jsonpath='{.data.uri}' | grep -q . \
  || { echo "::error::parser-db-app has no uri key"; exit 1; }
