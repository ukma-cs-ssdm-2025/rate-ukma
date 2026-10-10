# UKMA Data conventions

The package lints with oxlint, formats with oxfmt, and runs the vendored anti-slop rules in `tools/oxlint/anti-slop`; `pnpm check:all` runs them with typecheck and tests.

# Learning more about Effect

This repository uses the Effect Typescript library.

Before writing any Effect code, first read `src/parser/node_modules/effect/AGENTS.md`
**completely**, and follow the links in the file when required.

If you need to learn more about particular Effect apis and concepts that the
guide doesn't cover, search through the source code in `src/parser/node_modules/effect/src`.
