#!/bin/sh
# Thin wrapper so `docs/presentations/render.sh fall-2026` keeps working.
# The renderer itself is render.mjs, which also runs on Windows.
exec node "$(dirname "$0")/render.mjs" "$@"
