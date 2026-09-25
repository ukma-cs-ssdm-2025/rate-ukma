#!/usr/bin/env bash
# Screenshot every state on a base ref and on the working tree, then open one
# before | after gallery with changed states flagged.
#
#   pnpm shots:compare                        # origin/main vs working tree
#   pnpm shots:compare <ref>                  # any branch, tag or sha as the base
#   SHOT_ONLY='^course' pnpm shots:compare    # states whose name matches the regex
#   SHOT_DIR=/tmp/x SHOT_NO_OPEN=1 pnpm shots:compare
#
# The base is built once per commit and cached under $SHOT_CACHE. The current
# branch's shot states drive both builds, so a state the base cannot reach
# shows as "no before shot" instead of failing the run.
set -euo pipefail

webapp=$(cd "$(dirname "$0")/.." && pwd)
repo=$(git -C "$webapp" rev-parse --show-toplevel)
base_ref=${1:-origin/main}
if [[ $base_ref == origin/* ]]; then
	git -C "$repo" fetch -q origin "${base_ref#origin/}"
fi
sha=$(git -C "$repo" rev-parse --short "$base_ref")
cache=${SHOT_CACHE:-${TMPDIR:-/tmp}/rate-ukma-shots}
base=$cache/base-$sha/src/webapp
branch=$(git -C "$repo" rev-parse --abbrev-ref HEAD | tr / -)
out=$(mkdir -p "${SHOT_DIR:-$cache/$branch-vs-$sha}" && cd "${SHOT_DIR:-$cache/$branch-vs-$sha}" && pwd)
port=${SHOT_BASE_PORT:-4175}

if [[ ! -f $base/dist/index.html ]]; then
	echo "Building $base_ref ($sha) in $cache/base-$sha"
	rm -rf "$cache/base-$sha"
	mkdir -p "$cache/base-$sha"
	# orval generates the API client from docs/api during install.
	git -C "$repo" archive "$sha" src/webapp docs/api | tar -x -C "$cache/base-$sha"
	(
		cd "$base"
		pnpm install --frozen-lockfile --prefer-offline --reporter=silent
		VITE_API_BASE_URL=http://localhost:9 pnpm exec vite build --logLevel error
	)
fi

rm -rf "$out/before" "$out"/*.png
(cd "$base" && exec pnpm exec vite preview --port "$port" --strictPort --host 127.0.0.1) \
	>"$out/base-server.log" 2>&1 &
server=$!
trap 'kill "$server" 2>/dev/null || true' EXIT
for _ in $(seq 1 60); do
	curl -sf "http://127.0.0.1:$port" >/dev/null && break
	sleep 0.5
done

cd "$webapp"
echo "Shooting $base_ref"
SHOT_DIR=$out/before SHOT_BASE_URL=http://127.0.0.1:$port \
	pnpm exec playwright test --config playwright.shots.config.ts --retries 0 --timeout 40000 \
	>"$out/before.log" 2>&1 || echo "Some states do not exist on $base_ref; see $out/before.log"
kill "$server" 2>/dev/null || true
trap - EXIT

echo "Shooting the working tree"
SHOT_DIR=$out SHOT_BEFORE_DIR=$out/before \
	pnpm exec playwright test --config playwright.shots.config.ts

echo "$out/index.html"
if [[ -z ${SHOT_NO_OPEN:-} ]]; then
	orca tab create --url "file://$out/index.html" --json >/dev/null 2>&1 || true
fi
