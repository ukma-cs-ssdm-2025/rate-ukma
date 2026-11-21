# ADR-0018: Webapp Decisions Recorded Here Instead of in Code Comments

## Status

Accepted

## Date

2026-11-21

## Context

The webapp (`src/webapp/src`) had about 970 code comments. Most repeated the code or described code that was gone. A few carried decisions a reader needs and cannot get from the code: why an approach was chosen over the obvious one, a product rule, a constraint from the backend, a browser or a library. Comments like these go stale without anyone noticing, and nobody looks for decisions in the middle of a component.

## Decision

We will not keep comments in `src/webapp/src`. Lint bans them (`rate-ukma/no-comments`, `src/webapp/lint/plugins/no-comments.ts`); only lint and type directives with their reason stay. A hack gets a GitHub issue, and a decision goes into an ADR. The decisions the removed comments carried are recorded below, grouped by topic, with the file they apply to. The `delete-comments` skill (`.claude/skills/delete-comments/SKILL.md`) repeats this review for any path.

### API and network

- **Array query params are repeated keys** (`a=1&a=2`, not `a[]=1`), because the backend parses them that way (`lib/api/apiClient.ts`).
- **A 403 from UKMA Data does not end the session.** Other 401 and 403 answers signal an expired session, but a signed-in non-superuser gets 403 from the staff-only UKMA Data endpoints, and that section shows its own "superusers only" page (`lib/api/apiClient.ts`).
- **Sentry receives a plain `Error`, not the `AxiosError`**, so request bodies and response data never leave the browser (`lib/api/apiClient.ts`).
- **Retries.** A query that fails without an HTTP response (timeout, abort, offline) is never retried: the client already sends the user to `/connection-error` on the first failure, and retries would only multiply slow requests. 401 and 403 are never retried; other errors back off exponentially (`integrations/tanstack-query/RootProvider.tsx`). A 502 or 503 from UKMA Data shows its error state with a Retry button at once (`features/ukma-data/reviewCases.ts`).
- **Returning from `/connection-error`** happens automatically only after a real offline-to-online change (the browser's `online` event and a successful session probe). A server probe can succeed while the page that bounced still times out, which would bounce the user back and forth (`features/connection-error/components/ConnectionErrorPage.tsx`).
- **Outage bounce counter.** The start of an outage lives in `sessionStorage` (per tab), not the URL, and bounces count as one outage only while failures arrive back to back, so an old `?bounces=N` ages out instead of disabling auto-return next time (`lib/api/networkError.ts`).
- **Term values.** The course offerings endpoints send the term as a label (`Spring`), every other endpoint as the enum (`SPRING`); the client reads both as the enum (`lib/semester-term.ts`).
- **The feed cursor is opaque.** The client sends back what the server issued and stops when none comes; the first page has no cursor (`features/feed/hooks/useFeed.ts`).

### Auth and feature flags

- **The session query is lazy** and never retries a 401, which is an answer, not a failure (`lib/auth/AuthContext.tsx`).
- **Flags are keyed by auth identity**, because Waffle evaluates them per user: a login, logout or user switch reads its own cache entry, with no manual invalidation. The query waits for the identity to settle instead of fetching for the loading one (`lib/feature-flags/FeatureFlagsContext.tsx`).
- **Flags are ready once the first request settles**, success or error, so a failed fetch falls back to all flags off instead of hanging (`lib/feature-flags/FeatureFlagsContext.tsx`).
- **Client overrides are on in every environment, live included.** Waffle cannot be flipped from the browser, and the E2E suite runs against live and flips flags. An override only changes client-side display; every write is checked on the server, so it is not a security boundary (`lib/feature-flags/overrides.ts`).
- **UKMA Data is guarded on the server.** Hiding the section in the browser is presentation; the `/api/v1/ukma-data/` proxy checks superuser on every call and holds the data key. With the flag off the route renders an "unavailable" view rather than `notFound()`, because the root error boundary would catch the throw first (`features/ukma-data/components/UkmaDataSection.tsx`).
- **A 403 from UKMA Data** can mean "not a superuser" or "session ended". The error view asks the session which one it is instead of refetching, because a refetch remounts the section and hits the 403 again. A late session answer never restores a session that logout already cleared (`features/ukma-data/components/UkmaDataError.tsx`).

### Privacy

- Sentry sends default PII (IP address, user agent); session replay masks all text and input (`integrations/sentry/init.ts`).

### Product rules

- **Ratings start empty.** Score inputs have no default: a preset 3 anchors people and lets them submit a verdict they never made (`features/ratings/components/RatingForm.tsx`).
- **An academic year starts in the fall**: spring 2026 belongs to 2025–2026 (`features/ratings/groupRatings.ts`).
- **Semesters mirror the backend's `SemesterService`**: which term a month falls in and from which month that term's courses can be rated. The two must change together (`features/ratings/components/MyRatingsSemesterSection.tsx`).
- **My ratings.** Remembered section choices hold for the current term only, so a new term opens on what is newly rateable. Each semester shows one status: the call to rate shows only while the semester is closed for rating, then each row's "Оцінити" button is the call. An academic-year heading is hidden over a single semester or a filtered list (`MyRatingsSemesterSection.tsx`, `MyRatingsYearSection.tsx`).
- **Instructors.** Rating-form suggestions need one mention on the student's own offering, or two across the whole course, since one old tag may be a typo (`features/instructors/courseInstructorPicks.ts`). The course page lists a teacher only when at least two distinct students named them; students, not ratings, are counted because one student may rate several offerings (`features/instructors/courseTeachers.ts`). Names follow the backend's "last first" order, and a non-empty selection replaces the legacy free-text instructor while an empty one leaves it alone (`features/ratings/components/RatingModal.tsx`).
- **Course filters.** Speciality and course type lead the panel, because students filter by their own programme far more than by faculty. With no speciality picked, a course type means "of my speciality", and ELECTIVE covers everything neither compulsory nor profession-oriented for it. Credits are stored per academic year, so the credits filter uses the newest year (`features/courses/components/CourseFiltersPanel.tsx`, `features/courses/hooks/useCourseFiltersData.ts`).
- **Promo.** The backend decides whether a banner shows (the admin-configured active one, or none). A dismissal is remembered by banner `id`, so a new id resurfaces it; it is read in a lazy initialiser so a dismissed banner never flashes. An accent the client does not know falls back to the default (`features/promo/`, `features/feed/components/FeedPromoItem.tsx`).
- **Notifications.** A comment notification may end with the comment text as a quoted segment; the client splits it off so the headline stays short (`features/notifications/components/NotificationList.tsx`).
- **САЗ records.** САЗ lists a course once per stream, so one year can hold several records, mostly split by speciality; the UI groups them per year and caps the stream list, since a general course can have twenty (`features/course-offerings/components/CourseCazRecords.tsx`).
- **UKMA Data review cases.** `candidates` and `safe_answer` are free JSON; the UI shows ids as UKMA Data sent them. The list asks for UKMA Data's largest page size. The proxy has no single-case route, so the case page reads the cached list page (`features/ukma-data/`).

### UI and accessibility

- **Disabled buttons that explain themselves** use `aria-disabled`, not `disabled`, so keyboard users can reach the reason tooltip; a tap opens it for touch users (`components/DisabledButtonWithTooltip.tsx`).
- **No button inside a button.** A popover trigger that holds a clear or chip-remove control is a `div` with button or combobox semantics; scatter-plot points are SVG elements with button semantics (`features/instructors/components/`, `features/courses/components/CoursesScatterPlot.tsx`).
- **The drawer is portalled to `body`**, because an ancestor stacking context (the view-transition name on `/explore`) would trap it under the sticky header (`components/ui/Drawer.tsx`).
- **Collapsible content** animates from Radix's measured height, so padding goes on an inner wrapper, not the animated element (`components/ui/Collapsible.tsx`). `ButtonGroup` styles corners by `data-slot="button"`, which custom buttons must forward (`components/ui/ButtonGroup.tsx`).
- **Tailwind classes are written out in full** (faculty colours), so they are not purged; a custom line clamp uses inline CSS because Tailwind only ships static `line-clamp-*` (`lib/faculty-colors.ts`, `components/ui/ExpandableText.tsx`).
- **The "system" theme is resolved in CSS** by `prefers-color-scheme`; only an explicit pick is written to `<html>`, so OS changes need no JS (`components/ThemeProvider.tsx`).
- **Callback refs** for elements that can mount late (behind a flag), so setup still runs (`lib/hooks/useHorizontalScroll.ts`).
- **Feed strip.** The scroller is positioned because tiles' screen-reader labels are absolutely positioned and would otherwise widen the page. The loading tile renders only when there are items, or it becomes the scroll-snap target. Channel images centre-crop banners and posters and sit on a white backdrop so dark transparent logos show in dark mode (`features/feed/components/`).
- **The course page renders its mobile column once**, not per breakpoint, so the rate button's test id stays unique (`routes/courses.$courseId.tsx`).
- **Test ids** are kebab-case `feature-component-element-type` with an element suffix (`-button`, `-input`, `-modal`), stable, with no dynamic values, made with `createTestIds`/`getTestId` (`lib/test-ids.ts`).
- **The sign-in backdrop** scatters invented demo courses placed like the course map, in percentages so it fits any screen; the tooltip carousel keeps its dots clear of the form and runs only on wide, tall screens without reduced motion (`components/AuthShell.tsx`, `components/authShellDots.ts`).

## Consequences

* ✅ Code says what it does through names, types and tests; decisions live where people look for them.
* ✅ The lint rule stops new comments; a ratchet allowlist (`src/webapp/lint/allowlist.ts`) lists files that still have them and only shrinks.
* ⚠️ A decision now needs an ADR edit, which is more work than a comment. That cost is the point: only decisions worth recording get recorded.
* ⚠️ This ADR points at files by path; a move needs this list updated.

## Considered Alternatives

1. **Keep "why" comments and ban only "what" comments**
    * Rejection Reason: no lint can tell them apart, so the rule could not be enforced, and the review found most "why" comments were tautologies or stale.
2. **One ADR per decision**
    * Rejection Reason: about sixty small ADRs would bury the index; grouped topics read better.
