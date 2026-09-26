#!/bin/sh
# Prints the gallery path; SHOT_OPEN names any command that should open it,
# e.g. `SHOT_OPEN=open pnpm shots` or `SHOT_OPEN=xdg-open pnpm shots`.
gallery="$(cd "$1" && pwd)/index.html"
echo "$gallery"
if [ -n "${SHOT_OPEN:-}" ]; then
	$SHOT_OPEN "$gallery"
fi
