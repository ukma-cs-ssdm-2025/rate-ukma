#!/usr/bin/env bash
# Find the latest available Docker image tag for a package in GitHub Container Registry.
#
# Usage: find-image-tags.sh <package_name> <target_version> <tag_prefix>
#
# Required env vars: GH_TOKEN, ORG
# Outputs the best matching tag to stdout. Diagnostic messages go to stderr.

set -euo pipefail

PACKAGE_NAME="${1:?Usage: find-image-tags.sh <package_name> <target_version> <tag_prefix>}"
TARGET_VERSION="${2:?Usage: find-image-tags.sh <package_name> <target_version> <tag_prefix>}"
TAG_PREFIX="${3:-}"

: "${GH_TOKEN:?GH_TOKEN is required}"
: "${ORG:?ORG is required}"

echo "Searching for $PACKAGE_NAME (target: $TARGET_VERSION, prefix: $TAG_PREFIX)" >&2

encoded_package="${PACKAGE_NAME//\//%2F}"
tags=$(gh api \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  --paginate \
  "/orgs/$ORG/packages/container/$encoded_package/versions" \
  --jq '[.[] | .metadata.container.tags[]? // empty] | unique | .[]')

if [ -z "$tags" ]; then
  echo "No tags found, using default: ${TAG_PREFIX}${TARGET_VERSION}" >&2
  echo "${TAG_PREFIX}${TARGET_VERSION}"
  exit 0
fi

# Filter tags matching the semver pattern
pattern="^${TAG_PREFIX}v[0-9]+\.[0-9]+\.[0-9]+"
filtered=$(echo "$tags" | grep -E "$pattern" || true)

if [ -z "$filtered" ]; then
  echo "No matching tags found, using default: ${TAG_PREFIX}${TARGET_VERSION}" >&2
  echo "${TAG_PREFIX}${TARGET_VERSION}"
  exit 0
fi

# Remove prefix and 'v' for version comparison
target_num="${TARGET_VERSION#v}"

# Find highest version <= target
latest=$(echo "$filtered" | while IFS= read -r tag; do
  ver="${tag#"$TAG_PREFIX"}"
  ver="${ver#v}"

  # Compare versions: if ver <= target_num, output it
  if [ "$(printf '%s\n' "$ver" "$target_num" | sort -V | tail -n1)" = "$target_num" ]; then
    echo "$tag"
  fi
done | sort -V | tail -n1)

if [ -n "$latest" ]; then
  echo "Found: $latest" >&2
  echo "$latest"
else
  echo "No suitable version found, using default: ${TAG_PREFIX}${TARGET_VERSION}" >&2
  echo "${TAG_PREFIX}${TARGET_VERSION}"
fi
