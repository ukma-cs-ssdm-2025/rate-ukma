 Mapping & MVP Scope
 
## Story map with the cut line

| | 1. Signs in | 2. Filters the catalog | 3. Scans the course map | 4. Reads ratings & reviews | 5. Adds to ІНП, marks backups | 6. Confirms credits & hours | E. Enablers (parser, analytics) |
|---|---|---|---|---|---|---|---|
| **Already live** | US-1.1, US-1.4 | US-2.1, US-2.2, US-2.3 | US-3.1, US-3.2, US-3.3 | US-4.1, US-4.2, US-4.3 | — | — | — |
| **MVP (In Scope)** | — | — | — | — | **US-5.1, US-5.9, US-5.2, US-5.10** | **US-6.1, US-6.2, US-6.3** | **US-E.1, US-E.2, US-E.3, US-E.5, US-E.6** |
| **Post-MVP (Out of Scope)** | US-1.2, US-1.3, US-1.5, US-1.6 | US-2.4, US-2.5, US-2.6, US-2.7, US-2.8, US-2.9 | US-3.4, US-3.5, US-3.6, US-3.7 | US-4.4, US-4.5, US-4.6, US-4.7, US-4.8, US-4.9, US-4.10 | US-5.3, US-5.4, US-5.5, US-5.6, US-5.7, US-5.8, US-5.11 | US-6.4, US-6.5, US-6.6, US-6.7 | US-E.4 |

**Totals:** 11 already live · 12 in MVP · 33 post-MVP.

## Already live (baseline, not semester work)

| ID | Step | Story |
|---|---|---|
| US-1.1 | 1 | Sign in with corporate email, so every rating comes from a verified student. |
| US-1.4 | 1 | Open a course page from a link a senior sent in a chat. |
| US-2.1 | 2 | Filter courses by specialty, semester, faculty, credits and rating. |
| US-2.2 | 2 | Search a course by name. |
| US-2.3 | 2 | Filter by teacher. |
| US-3.1 | 3 | See candidates on the usefulness × difficulty map. |
| US-3.2 | 3 | Click a point to open the course. |
| US-3.3 | 3 | The map follows the filters. |
| US-4.1 | 4 | See average difficulty and usefulness with the number of ratings. |
| US-4.2 | 4 | See the most helpful reviews first. |
| US-4.3 | 4 | See which teacher each review describes. |

## In Scope (MVP)

| ID | Step | Story |
|---|---|---|
| US-5.1 | 5 | As a planner, I want to add a course to my ІНП plan from its course page, so that my picks are collected in one place. |
| US-5.9 | 5 | As a planner, I want to see my plan grouped by year and semester with credits per semester, so that I see where each pick lands. |
| US-5.2 | 5 | As a planner, I want to mark a course in my plan as "backup", so that I have a plan B for every risky slot. |
| US-5.10 | 5 | As a planner, I want to remove a course from my plan or turn a backup into a main pick, so that my plan follows what I learn from reviews. |
| US-6.1 | 6 | As a planner, I want my yearly credit total compared with the required norm, so that I see a gap before registration. |
| US-6.2 | 6 | As a planner, I want a warning when my weekly hours exceed the limit, so that I don't find out inside САЗ during registration. |
| US-6.3 | 6 | As a planner, I want to see my profession-oriented and free-choice credits against their limits, so that my plan follows the rules. |
| US-E.1 | E | As the team, I want course, term and enrolment data refreshed by a scheduled worker instead of a 2–3 h manual run, so that data stays fresh without depending on one person. |
| US-E.2 | E | As the team, I want a Sentry alert when a parser run fails or returns abnormal counts, so that a broken crawl isn't silent. |
| US-E.3 | E | As staff, I want to see what changed after each run (new, changed, removed) before it reaches students, so that bad data doesn't break ratings. |
| US-E.5 | E | As the team, I want a funnel from visit → course page → review started → rating submitted, so that we see where students drop off. |
| US-E.6 | E | As the team, I want to add an event for a new feature in a few lines, so that every feature, starting with ІНП, is measured from day one. |

## Out of Scope (Post-MVP)

| ID | Step | Story |
|---|---|---|
| US-1.2 | 1 | Reminder in late February that registration is coming. |
| US-1.3 | 1 | Short note on first visit about who can rate. |
| US-1.5 | 1 | Unrated past courses with one-tap rating after sign-in (P3). |
| US-1.6 | 1 | Sign-ups by faculty and year (Team). |
| US-2.4 | 2 | Sort or filter by number of reviews. |
| US-2.5 | 2 | Hide courses that didn't run in past years. |
| US-2.6 | 2 | Recommendations of similar courses. |
| US-2.7 | 2 | "Still has seats" filter (P2). |
| US-2.8 | 2 | Track filter use and course page views (Team). |
| US-2.9 | 2 | Next year's courses in the catalog soon after САЗ publishes them. |
| US-3.4 | 3 | Each map point shows how many ratings it's based on. |
| US-3.5 | 3 | Add a course to the plan straight from the map. |
| US-3.6 | 3 | Compare 2–4 courses side by side. |
| US-3.7 | 3 | Highlight courses from other faculties on the map. |
| US-4.4 | 4 | "Few reviews" warning on thin course pages. |
| US-4.5 | 4 | Ask for more reviews on a thin course. |
| US-4.6 | 4 | Contributor notified about a review request (P3). |
| US-4.7 | 4 | Past registration history on the course page. |
| US-4.8 | 4 | End-of-semester reminder to rate (P3). |
| US-4.9 | 4 | Official teacher of each offering from smart.ukma. |
| US-4.10 | 4 | Current-semester enrolments loaded automatically, so P3 can rate right away. |
| US-5.3 | 5 | Link each backup to the main course it replaces. |
| US-5.4 | 5 | Ratings and review counts shown inside the plan. |
| US-5.5 | 5 | Warning when a limited or often-cancelled course has no backup. |
| US-5.6 | 5 | Estimated total workload of the plan from difficulty ratings. |
| US-5.7 | 5 | Past courses one click from rating inside the planner (P3). |
| US-5.8 | 5 | Swap a cancelled course for its backup (P2). |
| US-5.11 | 5 | Several ІНП variants with switching. |
| US-6.4 | 6 | Check the plan still adds up if a backup replaces its main course. |
| US-6.5 | 6 | Export the plan as a registration-day checklist. |
| US-6.6 | 6 | Reminder on registration day with the plan. |
| US-6.7 | 6 | One-question survey after registration. |
| US-E.4 | E | Staff section to review unclear course matches and merge or split courses. |