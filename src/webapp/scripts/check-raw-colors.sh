#!/bin/sh
# Fails on a hex colour or a raw Tailwind palette class in a .tsx file: colours come from tokens in src/styles.css.
# lib/faculty-colors.ts keeps the faculty palette and is not a .tsx file, so it is not scanned.
hex='#[0-9a-fA-F]{3,8}\b'
palette='\b[a-z]+-(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-[0-9]{2,3}\b'
hits=$(grep -rnE "$hex|$palette" src --include='*.tsx' --exclude='*.test.tsx' --exclude-dir=generated)
if [ -n "$hits" ]; then
	echo "Raw colours in .tsx (use a token from src/styles.css):" >&2
	echo "$hits" >&2
	exit 1
fi
