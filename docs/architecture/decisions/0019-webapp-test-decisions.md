# ADR-0019: Webapp Test Decisions Recorded Here Instead of in Test Comments

## Status

Accepted

## Date

2026-11-21

## Context

[ADR-0018](0018-webapp-decisions-from-comments.md) moved the decisions in the webapp's app-code comments into an ADR and banned new comments in `src/webapp/src`. The unit tests in `src/webapp/src` and the Playwright suites in `src/webapp/tests` (e2e, shots, perf) had about 630 more comment lines. Most repeated the test title or the code. Some recorded why a test is built the way it is, and some excused a workaround; each workaround now has an issue (#891 to #905).

## Decision

We will keep tests free of comments like the app code: a test title, a `test.step` name or a helper's name says what a step does. The decisions the removed test comments carried are recorded below.

### Unit tests (`src/webapp/src`)

- **Mock at the HTTP mutator, not the generated hook, when the wiring matters.** Feed tests mock the mutator so the orval-generated cursor and pagination code and the flag-to-request path stay under test; component tests stub `useFeed` instead (`features/feed/feedFlagGating.test.tsx`, `features/feed/hooks/useFeed.test.tsx`). The promo test stubs only the promo query and keeps the rest of the generated client real, so co-rendered providers (auth, flags) work (`features/promo/components/PromoBanner.test.tsx`).
- **One router stand-in.** `MockLink` in `test-utils/router.tsx` replaces TanStack Router's `Link` through `vi.mock("@tanstack/react-router")` with `importActual`, so test files do not each write their own.
- **Pinned product rules.** The feed header stays mounted in every state (loading, error, empty, list); only the content below it changes (`FeedPage.test.tsx`). The rating form offers a teacher as a quick pick only after more than one mention on the course (`RatingForm.test.tsx`).
- **Theme contrast.** `theme-contrast.test.ts` parses `styles.css` assuming the light tokens sit in `:root` before its nested `@variant dark` block, and maps colours into sRGB the CSS Color 4 way (reduce chroma by binary search) instead of clipping, so it measures what browsers render. Destructive buttons and badges use the full-strength token in light mode and `bg-destructive/60` in dark mode, so each mode is held to 4.5:1 on its own surface and the raw dark pair only to the large-text target. Dimmed secondary text (`opacity-70` icons, the dialog close) meets the strict target in dark mode; in light mode it holds a no-worse floor, because a stronger muted tone would stop looking muted.

### Playwright (`src/webapp/tests`)

- **Shots** screenshot every state at desktop and phone widths, in light and dark, against a route-mocked backend with invented data (`pnpm shots`; `pnpm shots:compare` for before and after; `SHOT_BASE_URL` to shoot a running server). The mock answers every `/api/v1/` request from fixtures; a request with no handler is aborted and reported, so a new endpoint shows up as a gap instead of a half-rendered shot (`tests/shots/fixtures/mockBackend.ts`). Fixture timestamps are relative to a fixed `NOW`, so relative dates like "3 год тому" stay stable, and every fixture value is invented: no real students, teachers or reviews (`tests/shots/fixtures/data.ts`).
- **E2E feature flags** are set through the `ff:overrides` localStorage entry with `addInitScript`, so they must be set before `page.goto` (`tests/e2e/shared/feature-flags.ts`).
- **E2E instructor data** comes from the live directory instead of hard-coded staff, who may be renamed or filtered out. The two rating tests in `instructor-multiselect.spec.ts` rate the same first unrated course, so they run serially. The teacher offered as a one-tap pick is among the top two, and the test's rating only raises that teacher's count; with no picks, the teacher the test names becomes the only one.
- **Perf** (`tests/perf/perf.spec.ts`) loads each page several times in fresh contexts under CPU throttling and reports medians. The API is mocked, so network cost is excluded and the numbers compare builds, not production. INP counts interactions, not events: keydown, keypress and keyup share one interaction id and the slowest is the latency. Below 50 interactions INP is the slowest one; none recorded means every interaction beat the observer's 16 ms threshold, not 0 ms.

## Consequences

- ✅ Test intent sits in titles and step names, which show up in failure output; comments did not.
- ✅ Workarounds are tracked as issues instead of explained in place.
- ⚠️ Only `src/webapp/src` is linted for comments (`rate-ukma/no-comments`); `src/webapp/tests` relies on review and the `delete-comments` skill.

## Considered Alternatives

1. **Extend ADR-0018**
   - Rejection Reason: ADR-0018 is accepted and merged; test conventions are a separate audience (people writing tests), so they get their own record.
2. **Lint `src/webapp/tests` for comments too**
   - Rejection Reason: the rule starts with `src/webapp/src`, where the app code lives; the Playwright suites can follow once they stay clean.
