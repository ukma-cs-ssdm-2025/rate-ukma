# Vendored anti-slop

Source: [dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop), commit `c44ef22ca116d0ba62a3ff663a0bd13a3f3fa40b`, directory `skills/install-anti-slop/assets/anti-slop/`. All 38 files match that commit's blobs byte for byte.

Installed plugins, registered in `src/parser/.oxlintrc.json`:

- `anti-slop`: `index.ts`, every generic rule at `error`, plus native `oxc/no-accumulating-spread`.
- `anti-slop-effect`: `effect/index.ts`, every Effect rule at `error`, because the package depends on `effect` directly.

Dependencies: `oxlint` and `@oxlint/plugins` pinned to the same exact version, 1.87.0.

Intentional deviations: none.

## Updating

Copy `skills/install-anti-slop/assets/anti-slop/` from a newer upstream commit over this directory, update the commit above, keep the plugin and `oxlint` versions in step, and run `pnpm check:all` in `src/parser`. `vendor/eslint-stylistic/UPSTREAM.md` is upstream's own record and stays byte for byte: the tests and `pnpm sync:skill-assets` it names live in the upstream repository, not here.
