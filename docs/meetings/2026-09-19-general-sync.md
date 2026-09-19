# Rate-UKMA Team Meeting — General

- Date: 2026-09-19 (from transcript file date; no explicit date in transcript)
- Participants:
  - Andrii Valenia
  - Anastasiia Aleksieienko
  - Kateryna Bratiuk
  - Absent: Maksym Korniichuk (supervisor), Milana Horalevych, Anastasiia Dvoilenko

## TL;DR

- Clean up the GitHub Projects board: move what was presented to Korniichuk into real statuses, push stale backlog items out, close merged PRs.
- Parser as a public service (repo layout open): Andrii designs the public API, Anastasiia Aleksieienko drafts the infra (Kubernetes + Terraform) and key-issuing approach.
- Individual study-plan constructor is Kateryna with Anastasiia Dvoilenko's track: vision/spec doc with ASCII mockups first, warnings instead of hard blocks, multi-variant compare.
- Fix PR review hygiene: stop auto-adding all codeowners; author picks reviewer(s); AI auto-approve for low-risk changes still open.
- Teacher data is a separate topic — discuss a teachers API with Kyrylo and Mykola (smart-ukma communicators) instead of the current corp-email parsing.

## Discussion

### GitHub Projects board cleanup and planning

- Transfer what the team presented to Korniichuk into GitHub Projects and tidy labels/sorting (courses-related tags).
- Parser, calculator, and planner tasks already exist — reuse them rather than creating duplicates.
- Andrii: about half of the backlog is actually in progress / in review; he will move his own tasks and close finished PRs.
- Milestone deadline: 1 December; next week is the horizon for Andrii closing his PRs.
- Remove or park backlog items the team will not do soon; use filters (e.g. in-progress) while cleaning.

### Parser as a public service (repo layout open)

- Repo layout (monorepo vs separate service) still open — to decide (see #703).
- Work split: Anastasiia Aleksieienko writes the infra vision (Kubernetes + Terraform, public API rollout, key issuance/auth); Andrii designs the public API and owns the parser code (see #704, #705).
- Auth model open: per-user API keys vs. shared/scope keys, how student data flows through (see #703).

### Notifications / recommendations

- Lower priority than the parser/planner tracks.

### Individual study-plan constructor

- Owner track: Kateryna with Anastasiia Dvoilenko; Milana Horalevych owns analytics and is expected to come with a plan for that side.
- Andrii's hindsight from an earlier attempt: the plan table rendered poorly and he lacked some data — first clarify what data is actually needed.
- Product ideas: several plan variants with compare; per-semester load; early warnings when adding a course (remaining credits toward 240, workload overruns); warnings, not hard blocks, since overrides exist.
- Mobility-student edge case (underload/overload semesters, transferred disciplines) — later feature, not v1.
- Agreed artifact: vision/spec draft first (user flow + ASCII mockups), then backend work in parallel (see #706).

### Teacher data (smart-ukma, separate topic)

- Current approach parses corp emails; alternative is a teachers API.
- Discuss with Kyrylo and Mykola, our communicators on smart-ukma.

### PR / code-review process

- Every PR auto-adds all codeowners as reviewers; proposal: author picks reviewer(s) instead (see #710).
- AI auto-approve for low-risk changes: open; Greptile or CodeRabbit as candidates (see #709). Responsibility stays with the merging author.
- Caution: still spot-check small changes; don't gamify review-speed metrics.

### Analytics

- Metabase as the analytics track; Milana Horalevych owns analytics setup (see #707).

## Decisions

- Parser repo layout (monorepo vs separate service) still open — to decide (see #703); public API scopes and domain remain open.
- Split: Anastasiia Aleksieienko — infra vision (Kubernetes + Terraform, key issuance/auth); Andrii — public API design + parser code (see #704, #705).
- Study-plan constructor: Kateryna with Anastasiia Dvoilenko write a vision/spec with ASCII mockups before backend work (see #706); warnings over hard restrictions; multi-variant compare in scope.
- Board hygiene: park/remove soon-not-planned backlog items; move genuinely in-progress items to in-progress; close merged PRs.
- Reviews: author-selected reviewer(s) instead of auto-adding all codeowners (see #710); AI auto-approve open, Greptile or CodeRabbit as candidates (see #709).
- Milestone deadline: 1 December.

## Action items

- Andrii Valenia: move own tasks to correct statuses; close finished/merged PRs by next week.
- Andrii Valenia: design the parser public API (see #703, #704).
- Andrii Valenia: check review-assignment settings (see #710).
- Anastasiia Aleksieienko: draft infra vision (Kubernetes + Terraform, API-key issuance/auth; see #705).
- Kateryna Bratiuk with Anastasiia Dvoilenko: draft study-plan constructor vision/spec with ASCII mockups (see #706); circulate before backend work.
- Milana Horalevych: come with a plan for the analytics/Metabase side (see #707).
- Owner: TBD: discuss teachers API vs corp-email parsing with Kyrylo and Mykola.

## Open questions

- Parser repo layout: monorepo vs separate service — open, to decide. See #703.
- Parser auth: per-user API keys vs. shared/scope keys; how student data passes through; subdomain vs. separate domain? See #703 (Parser Service), #704 (Public API design), #705 (deployment arch).
- AI auto-approve for low-risk PRs: adopt, with what risk criteria? Greptile or CodeRabbit as candidates. See #709 (agentic reviews), #710 (reviewer roulette).
