---
name: delete-comments
description: "Review every code comment under a path of this repo and remove the ones that do not earn their place: delete tautologies and stale ones, file an issue per hack, move decisions into an ADR. Use for /delete-comments <path>, \"clean up comments in X\", \"прибери коментарі\". Not for generated files."
---

# Delete comments

The webapp bans comments in `src/webapp/src` (`rate-ukma/no-comments` in `src/webapp/oxlint.config.ts`, plugin `src/webapp/lint/plugins/no-comments.ts`). Only lint and type directives stay. Files that still have comments are listed in `LINT_ALLOWLIST["rate-ukma/no-comments"]` in `src/webapp/lint/allowlist.ts`; that list only shrinks. ADR-0018 records the decisions earlier comments carried.

## Steps

1. List the comments under the path. In the webapp: `cd src/webapp && LINT_ALLOWLIST=off pnpm exec oxlint -f unix <path> | grep no-comments`. Elsewhere, read the files.
2. Read each file in full. Put every comment in one category:
   - **Tautology**: repeats the code, a name, a type or a test title. Delete it. If a better local name or test title would carry the meaning, rename, then delete.
   - **Stale**: refers to code or behaviour that is gone, or is commented-out code. Grep before you decide. Delete it.
   - **Excuse**: justifies a hack (a cast, a fixed wait, a library workaround, a TODO). Delete it and file one GitHub issue per hack: a plain body naming `file:line`, what the hack is and the proper fix. Group the same hack in several places into one issue.
   - **Decision**: an important, non-obvious decision. Delete it and add it to an ADR in `docs/architecture/decisions/` (extend the closest existing ADR, or write a new one grouping related decisions; list it in `INDEX.md`). Never one ADR per comment.
   - **Directive**: `oxlint-disable-next-line … -- reason`, `@ts-expect-error reason`, `/// <reference …>`. Keep.
3. Never touch generated files (`src/webapp/src/lib/api/generated/**`, `src/webapp/src/routeTree.gen.ts`).
4. Remove each cleaned file from the allowlist. `pnpm check:all` (Node 22) must pass; `pnpm lint:ratchet` fails while a clean file is still listed.
5. Report comment lines removed per category, lines remaining, the issues filed and the ADR changed.

Pure refactor: no behaviour change. Issue bodies and PR text follow the repo's rules in the root `AGENTS.md`; no real student or teacher data.
