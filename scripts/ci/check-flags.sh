#!/usr/bin/env bash
# Fails when a name in PUBLIC_FEATURE_FLAGS has no useFeatureFlag("<name>") or
# useFeatureFlagState("<name>") call in the webapp sources (tests do not count),
# so a flag whose code is gone cannot stay in the public allowlist.
set -euo pipefail

settings="src/backend/rateukma/settings/_base.py"
webapp_src="src/webapp/src"

flags=$(awk '/^PUBLIC_FEATURE_FLAGS = \[/{inside=1; next} inside && /^\]/{exit} inside' "$settings" | grep -oE '"[^"]+"' | tr -d '"')
if [ -z "$flags" ]; then
  echo "No flags found in PUBLIC_FEATURE_FLAGS ($settings)" >&2
  exit 1
fi

sources=$(find "$webapp_src" -type f \( -name '*.ts' -o -name '*.tsx' \) ! -name '*.test.*' ! -path '*/generated/*')
status=0
for flag in $flags; do
  # shellcheck disable=SC2086
  if ! perl -0777 -ne 'BEGIN { $f = shift } $found = 1 if /useFeatureFlag(?:State)?\(\s*"\Q$f\E"/; END { exit($found ? 0 : 1) }' "$flag" $sources; then
    echo "Flag '$flag' is in PUBLIC_FEATURE_FLAGS but no useFeatureFlag(\"$flag\") call exists in $webapp_src. Remove it from the allowlist." >&2
    status=1
  fi
done
exit $status
