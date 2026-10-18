#!/usr/bin/env bash

# Diffs the platform kustomizations against the cluster. Run by .github/workflows/parser-platform.yml.
# Prints the diff, writes has_changes to $GITHUB_OUTPUT and the diff to $GITHUB_STEP_SUMMARY.

set -euo pipefail

: "${PLATFORM_ROOT:?PLATFORM_ROOT is required}"
: "${PLATFORM_DIRS:?PLATFORM_DIRS is required}"
: "${ENVIRONMENT:?ENVIRONMENT is required}"
: "${GITHUB_OUTPUT:?GITHUB_OUTPUT is required}"
: "${GITHUB_STEP_SUMMARY:?GITHUB_STEP_SUMMARY is required}"

diff_file=$(mktemp)

# Before the first apply, the namespaces and CRDs don't exist, so a server-side diff can't run.
# Only NotFound counts as "not installed"; any other error fails the script.
installed=$(kubectl get namespace cert-manager cnpg-system parser --ignore-not-found -o name)
if [ "$(grep -c . <<< "$installed")" -lt 3 ]; then
  {
    echo "Not installed yet. The first apply creates:"
    for dir in $PLATFORM_DIRS; do
      kubectl kustomize "$PLATFORM_ROOT/$dir" | grep '^kind:' | sort | uniq -c
    done
  } > "$diff_file"
  has_changes=true
else
  # kubectl diff exits 1 when there are changes, and >1 on errors.
  has_changes=false
  for dir in $PLATFORM_DIRS; do
    code=0
    kubectl diff --server-side --field-manager=parser-platform -k "$PLATFORM_ROOT/$dir" >> "$diff_file" || code=$?
    if [ "$code" -gt 1 ]; then exit "$code"; fi
    if [ "$code" -eq 1 ]; then has_changes=true; fi
  done
fi

cat "$diff_file"
echo "has_changes=$has_changes" >> "$GITHUB_OUTPUT"
{
  echo "### Platform diff ($ENVIRONMENT)"
  if [ "$has_changes" = false ]; then
    echo "No changes."
  else
    echo '<details><summary>Full diff</summary>'
    echo
    echo '```diff'
    # Step summaries are limited to 1 MiB; a CRD upgrade can be larger.
    head -c 500000 "$diff_file"
    echo '```'
    echo '</details>'
    [ "$(wc -c < "$diff_file")" -le 500000 ] || echo "Truncated: the job log has the full diff."
  fi
} >> "$GITHUB_STEP_SUMMARY"
