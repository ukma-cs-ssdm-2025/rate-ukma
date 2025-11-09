# Frontend helpful instructions

## shadcn instructions

Use the latest version of Shadcn to install new components, like this command to add a button component:

```bash
pnpx shadcn@latest add button
```

## Linting and formatting

Use the following commands to lint and format the code:

```bash
pnpm lint
pnpm format --write
pnpm check
```

## Agent workflow

- **Read the README.** Before making edits, skim `README.md` so you understand the repo’s structure, tooling, and style decisions.
- **Prop immutability.** When props are not supposed to change, wrap the prop definitions (or the relevant subset) in `Readonly<T>` and follow the surrounding codebase conventions instead of inventing new patterns for read-only props.
- **Keep components tiny.** Break buttons/menus/etc. into small, single-responsibility pieces, avoid “hook hell” (deep nesting, cascading effects), and prefer obvious control flow over clever abstractions.
- **Recheck the pattern.** Whenever you reach for a new pattern, quickly search the repo for how similar concerns were addressed earlier; copy the established style if one exists, otherwise keep the addition trivial and well-justified.
- **Reuse before you build.** Before creating a new component (or even just picking a raw HTML element), search `src/components` and `src/components/ui`—if an existing component covers the same concern or markup, reuse it rather than inventing another variant.
