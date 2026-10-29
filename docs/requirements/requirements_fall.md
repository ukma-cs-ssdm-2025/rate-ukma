# Rate UKMA: Semester Requirements (Fall 2026)

A short specification of what we build this semester and how we check it. Each section links to a page with full details.

| Detailed page | What's inside |
|---|---|
| [User Journey](user-journey.md) | Persona, goal and the happy path with VPC links |
| [Story Drafts](story_drafts.md) | All story drafts with persona, VPC link and status |
| [Story Mapping & MVP Scope](story_mapping_scope.md) | Story map with the MVP cut line |
| [Story Refinement](story_enhance.md) | How MVP stories were checked and split |
| [Acceptance Criteria](acceptance_criteria_gherkin.md) | Full Given-When-Then scenarios and business rules |

Related: [Value Proposition Canvas](../product-discovery/value-proposition.md) · [Audience Analysis](../product-discovery/audience-analysis.md) · [Critical Analysis](../product-discovery/critical-analysis.md) · [Functional & Non-Functional Requirements](requirements.md) · [User Stories (2025)](user-stories.md)

## 1. User Journey (Happy Path)

**Persona:** the pre-registration planner with no one to ask. A second-year bachelor planning their third year (Profile 1 in the [audience analysis](../product-discovery/audience-analysis.md)).

**Goal:** before March registration, turn 15–20 unfamiliar courses into one plan: a main pick for each slot, backups for risky courses, credits and hours that add up.

| # | Step | Expected result |
|---|---|---|
| 1 | **Signs in** with the university account | Sees ratings left only by students who took each course |
| 2 | **Filters** the catalog by specialty, semester and rating | Gets a short list of candidates |
| 3 | **Scans** the usefulness × difficulty map | Drops the "hard and useless" candidates early |
| 4 | **Reads** ratings and reviews, focusing on the current teacher | Learns the real workload of each course |
| 5 | **Adds** the chosen courses to the ІНП plan and **marks** backups | Main picks and backups are in one plan |
| 6 | **Confirms** that credits and hours add up | Goes into registration with a ready plan instead of a guess |

Details: [User Journey](user-journey.md).

## 2. Story Map & Scope

Steps 1–4 already work with live features. Steps 5–6 need the ІНП planner. Column **E** holds the data and analytics work from the semester plan.

| | 1. Signs in | 2. Filters | 3. Course map | 4. Reviews | 5. ІНП, backups | 6. Credits & hours | E. Enablers |
|---|---|---|---|---|---|---|---|
| **Already live** | 1.1, 1.4 | 2.1, 2.2, 2.3 | 3.1, 3.2, 3.3 | 4.1, 4.2, 4.3 | — | — | — |
| **In Scope (MVP)** | — | — | — | — | **5.1, 5.9, 5.2, 5.10a, 5.10b** | **6.1, 6.2, 6.3** | **E.1, E.2, E.3, E.5, E.6** |
| ✂️ ***MVP cut line*** | ✂️ | ✂️ | ✂️ | ✂️ | ✂️ | ✂️ | ✂️ |
| **Out of Scope** | 1.2, 1.3, 1.5, 1.6 | 2.4–2.9 | 3.4–3.7 | 4.4–4.10 | 5.3–5.8, 5.11 | 6.4–6.7 | E.4 |

### Already live

| ID | Story |
|---|---|
| US-1.1 | Sign in with corporate email |
| US-1.4 | Open a course page from a shared link |
| US-2.1 | Filter by specialty, semester, faculty, credits and rating |
| US-2.2 | Search a course by name |
| US-2.3 | Filter by teacher |
| US-3.1 | Usefulness × difficulty map |
| US-3.2 | Open a course from the map |
| US-3.3 | Map follows the filters |
| US-4.1 | Average difficulty and usefulness with rating count |
| US-4.2 | Most helpful reviews first |
| US-4.3 | Teacher shown on each review |

### In Scope (MVP)

| ID | Story |
|---|---|
| US-5.1 | Add a course to the ІНП plan from its course page |
| US-5.9 | See the plan by year and semester |
| US-5.2 | Mark a course as backup |
| US-5.10a | Remove a course from the plan |
| US-5.10b | Turn a backup into a main pick |
| US-6.1 | Yearly credit total next to the 58–62 range |
| US-6.2 | Warning when weekly hours exceed 24 |
| US-6.3 | Profession-oriented and free-choice credits against their limits |
| US-E.1 | Course and enrolment data update daily on their own |
| US-E.2 | Notification about a failed or unusually small data update |
| US-E.3 | Summary of what each data update changed |
| US-E.5 | Funnel from visit to submitted rating |
| US-E.6 | Track usage of a new feature |

### Out of Scope

| ID | Story |
|---|---|
| US-1.2 | Reminder before registration |
| US-1.3 | First-visit note on who can rate |
| US-1.5 | Unrated past courses after sign-in |
| US-1.6 | Sign-ups by faculty and year |
| US-2.4 | Sort or filter by number of reviews |
| US-2.5 | Hide courses that didn't run in past years |
| US-2.6 | Recommendations of similar courses |
| US-2.7 | "Still has seats" filter |
| US-2.8 | Track filter use and page views |
| US-2.9 | Next year's courses soon after САЗ publishes them |
| US-3.4 | Rating count on each map point |
| US-3.5 | Add to plan from the map |
| US-3.6 | Compare courses side by side |
| US-3.7 | Highlight courses from other faculties |
| US-4.4 | "Few reviews" warning |
| US-4.5 | Ask for more reviews on a thin course |
| US-4.6 | Notify contributors about review requests |
| US-4.7 | Past registration history on the course page |
| US-4.8 | End-of-semester reminder to rate |
| US-4.9 | Official teacher from smart.ukma |
| US-4.10 | Current-semester enrolments loaded for rating |
| US-5.3 | Link a backup to the course it replaces |
| US-5.4 | Ratings shown inside the plan |
| US-5.5 | Warning when a risky course has no backup |
| US-5.6 | Estimated workload of the plan |
| US-5.7 | Rate past courses from the planner |
| US-5.8 | Swap a cancelled course for its backup |
| US-5.11 | Several ІНП variants |
| US-6.4 | Check the plan with a backup swapped in |
| US-6.5 | Export the plan as a checklist |
| US-6.6 | Reminder on registration day |
| US-6.7 | Survey after registration |
| US-E.4 | Staff review of unclear course matches |

Details: [Story Drafts](story_drafts.md) · [Story Mapping & MVP Scope](story_mapping_scope.md).

## 3. MVP User Stories

| ID | Story |
|---|---|
| US-5.1 | As a planner, I want to add a course to my ІНП plan from its course page, so that my picks are collected in one place. |
| US-5.9 | As a planner, I want to see my plan grouped by year and semester with credits per semester, so that I can spot an overloaded or empty semester before registration. |
| US-5.2 | As a planner, I want to mark a course in my plan as "backup", so that I have a plan B for every risky slot. |
| US-5.10a | As a planner, I want to remove a course from my plan, so that courses I ruled out after reading reviews no longer count toward my credits. |
| US-5.10b | As a planner, I want to turn a backup course into a main pick, so that my credit totals count it when I change my mind. |
| US-6.1 | As a planner, I want to see my yearly credit total next to the required range, so that I see a gap before registration. |
| US-6.2 | As a planner, I want a warning when my weekly hours exceed the limit, so that I don't find out inside САЗ during registration. |
| US-6.3 | As a planner, I want to see my profession-oriented and free-choice credits against their limits, so that my plan follows the rules. |
| US-E.1 | As a data maintainer, I want course and enrolment data to update on its own every day, so that students see current courses and can rate the ones they just finished. |
| US-E.2 | As a data maintainer, I want to be notified when a data update fails or brings far fewer courses than usual, so that I fix it before students see stale or missing data. |
| US-E.3 | As a data maintainer, I want to see what each data update changed (new, changed and removed courses), so that I catch wrong data before students rely on it. |
| US-E.5 | As a developer, I want to see how many students go from visiting the site to opening a course page, starting a review and submitting a rating, so that we know which step to fix first. |
| US-E.6 | As a developer, I want to track usage of a new feature with a few lines of code, so that we know in March whether students used the ІНП planner. |

Details: [Story Refinement](story_enhance.md).

## 4. Acceptance Criteria

**Business rules**

| Rule | Value |
|---|---|
| Total credits, bachelor programme | 240 |
| Profession-oriented credits (whole programme) | at least 54 |
| Free-choice credits (whole programme) | at most 25 |
| Credits per year (summer included) | 58–62 |
| Weekly hours per semester | at most 24, hours taken from САЗ |
| Starting plan | courses already taken + mandatory courses for every year |
| Mandatory courses | cannot be removed |
| Backups | not counted in any total |
| Limits | warnings, not hard blocks |
| Credits | can be decimal (3.5), courses can run over several terms |

Full Given-When-Then scenarios: [Acceptance Criteria](acceptance_criteria_gherkin.md).

**US-5.1: Add a course from its course page**
- [ ] The student picks the year of study, and the course lands in that year and its semester.
- [ ] After adding, the course page shows "Ваш курс вже додано в ІНП", and the course is in the plan only once.
- [ ] A course that runs over several terms appears in every term of the chosen year.

**US-5.9: Plan by year and semester**
- [ ] Each year is split into semesters, and each semester shows its credits.
- [ ] Decimal credits are summed exactly (3.5 + 2.5 = 6).
- [ ] On first visit, the plan already shows taken courses and mandatory courses for every year.
- [ ] A semester with no courses shows 0 credits.

**US-5.2: Mark as backup**
- [ ] A backup is labelled and stays in the plan.
- [ ] A backup is not counted in semester, year, programme, profession-oriented or free-choice totals.

**US-5.10a: Remove a course**
- [ ] A removed course disappears, and the semester total drops by its credits.
- [ ] A multi-term course is removed from every term.
- [ ] A mandatory course has no remove option.

**US-5.10b: Backup → main pick**
- [ ] The backup label disappears, and the course counts toward totals.
- [ ] If this pushes the year above 62, the change is allowed and a warning appears.

**US-6.1: Yearly credits**
- [ ] 58 and 62 show no warning; 57.5 and 62.5 show a warning with the exact difference.
- [ ] Summer semester credits count toward the year.
- [ ] A year with only mandatory courses shows how many credits are missing to 58.

**US-6.2: Weekly hours**
- [ ] 24 hours show no warning; 25 hours show "exceeds the limit of 24 by 1".
- [ ] Each semester is checked separately.
- [ ] The warning doesn't block adding a course, and backups don't count.

**US-6.3: Profession-oriented and free-choice credits**
- [ ] 54 profession-oriented and 25 free-choice credits show no warning.
- [ ] 53.5 profession-oriented credits show "0.5 missing"; 28 free-choice credits show "exceeds by 3".
- [ ] Credits from all years add up to one programme total toward 240.
- [ ] A course counts by its type for the student's own programme.

**US-E.1: Daily data update**
- [ ] A new САЗ course appears in the catalog after the next daily update, with no manual import.
- [ ] A student can rate a finished course after their enrolment is loaded.
- [ ] If САЗ is down, students still see yesterday's courses and reviews.

**US-E.2: Update notifications**
- [ ] A failed update notifies the data maintainer with what failed and when.
- [ ] An update with far fewer courses than the alert threshold notifies with both counts.
- [ ] A normal update sends no notification.

**US-E.3: Update summary**
- [ ] The summary lists new, changed and removed courses by name, with old and new values.
- [ ] A removed course is held, not deleted, and students still see it with its ratings.
- [ ] An update with no changes says so.

**US-E.5: Rating funnel**
- [ ] The funnel shows visits → course page → review started → rating submitted, with conversion between steps.
- [ ] An abandoned review counts as started, not submitted.
- [ ] A period with no data shows zeros and no percentages.

**US-E.6: Feature usage tracking**
- [ ] A newly tracked action shows its daily count after release.
- [ ] An action nobody used shows 0.