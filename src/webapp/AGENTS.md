# Frontend instructions

## Convention reminders

- **Readme first:** Skim `README.md` before touching code so you know the repo layout, tooling, and style constraints.
- **Immutable props:** Wrap immutable props (or slices of them) in `Readonly<T>` and mirror existing patterns for read-only approvals.
- **Focused components:** Keep UI parts tiny—break buttons/menus into single-purpose pieces, avoid deeply nested hooks, and favor obvious control flow.
- **Pattern recheck:** Search `src/components` and `src/components/ui` before introducing new patterns; reuse an existing solution when it fits.
- **Reuse:** Prefer existing components when the markup/behavior already exists instead of recreating similar UI.

## Tooling reminders

### shadcn install

Use the latest shadcn CLI to add UI components, for example:

```bash
pnpx shadcn@latest add button
```

### lint & formatting

Run these commands regularly:

```bash
pnpm lint
pnpm format --write
pnpm check
```

## Small tips

- Prefer `globalThis` over `window` when touching the global scope.
