# Rate UKMA

Course reviews for NaUKMA students: difficulty and usefulness ratings, written reviews, a course map. Live at rateukma.com, staging at staging.rateukma.com. The repo is public.

This semester has three tracks: the ІНП planner, САЗ data (UKMA Data) and analytics. Scope: `Project-Description.md`, `docs/requirements/`.

## Apps

Each app has its own `AGENTS.md`. Read it before you edit in that app.

- `src/backend`: Django REST API
- `src/webapp`: React SPA
- `src/parser`: UKMA Data, collects САЗ and smart.ukma data behind its own API (Effect, TypeScript)

Run it: `docs/onboarding.md`, section 3 (sets `REDIS_HOST=redis`, which the README skips).

## Rules across apps

- The API contract is `docs/api/openapi-generated.yaml`. Backend serializers generate it, and the webapp generates its types from it on `pnpm install`. A backend API change commits the regenerated spec in the same PR.
- Unfinished user-facing behaviour ships behind a feature flag: `docs/feature-flags.md`.
- No real student or teacher data (names, emails, ids) in code, fixtures, logs, issues or PRs.
- A decision that shapes the schema or the API gets an ADR in `docs/architecture/decisions/`, listed in its `INDEX.md`.
- User-facing text is Ukrainian; code, commits and PRs are English.

## Git and release

- Commit and PR title: `<type>(#<issue>): <subject>`. `semantic-commit.sh` checks the type and format; the issue scope is our convention. PRs squash-merge, so the PR title becomes the commit on main.
- Every push to main that changes `src/`, `infra/` or `.github/` deploys to staging once tests and the build pass, whatever the commit type. If it also changes `src/backend`, `src/webapp`, `src/parser` or `infra/`, it cuts a version (`feat!` major, `feat` minor, any other type patch, `docs`, `chore` and `ci` included) and deploys that version to live.
- Open a PR with its assignee set to the person responsible for it (`gh pr create --assignee @me`). Body: `.github/pull_request_template.md`. One feature per PR, one code-owner approval.
