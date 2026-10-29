# Rate UKMA

Course reviews for NaUKMA students: difficulty and usefulness ratings, written reviews, a course map. Live at rateukma.com, staging at staging.rateukma.com. The repo is public.

This semester has three tracks: the ІНП planner, САЗ data (UKMA Data) and analytics. Scope: `Project-Description.md`, `docs/requirements/`.

## Apps

Each app has its own `AGENTS.md`. Read it before you edit in that app.

- `src/backend`: Django REST API
- `src/webapp`: React SPA
- `src/parser`: UKMA Data, collects САЗ and smart.ukma data behind its own API (Effect, TypeScript)

Run everything: `cd src && cp .env.sample .env && docker compose --profile dev up -d --build` (webapp :3000, API :8000).

## Rules across apps

- The API contract is `docs/api/openapi-generated.yaml`. Backend serializers generate it, and the webapp generates its types from it on `pnpm install`. A backend API change commits the regenerated spec in the same PR.
- Unfinished user-facing behaviour ships behind a feature flag: `docs/feature-flags.md`, rationale in `docs/architecture/decisions/0009-feature-flags.md`. The webapp reads flags from `GET /api/v1/flags/`, which serves only the names in the backend allowlist `PUBLIC_FEATURE_FLAGS`. That allowlist is the security boundary: never put a server-only or sensitive flag in it.
- No real student or teacher data (names, emails, ids) in code, fixtures, logs, issues or PRs.
- A decision that shapes the schema or the API gets an ADR in `docs/architecture/decisions/`, listed in its `INDEX.md`.
- User-facing text is Ukrainian; code, commits and PRs are English.

## Git and release

- Commit and PR title: `<type>(#<issue>): <subject>`, checked by `semantic-commit.sh`. PRs squash-merge, so the PR title becomes the commit on main.
- The type decides the release. A merge to main that touches `src/` with `feat`, `fix`, `refactor`, `style`, `test` or `security` cuts a version and deploys to staging, then to live automatically. `docs`, `chore` and `ci` do not.
- Open a PR with its assignee set to the person responsible for it (`gh pr create --assignee @me`). PR body: follow the template, a few plain sentences plus `Resolves #N`. One feature per PR, one code-owner approval.
