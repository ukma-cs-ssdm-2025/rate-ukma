MVP Story Refinement & Decomposition

## Changes

| Original ID | Problem found | What changed |
|---|---|---|
| US-5.1 | none | No change. |
| US-5.9 | format | The "why" ("I see where each pick lands") only rephrased the "what". It now names the outcome: spotting an overloaded or empty semester. |
| US-5.2 | none | No change. |
| US-5.10 | atomicity | It mixed two separate actions: removing a course and turning a backup into a main pick. Split into **US-5.10a** (remove) and **US-5.10b** (backup → main). Each has its own value and can be tested on its own. |
| US-6.1 | format | The "what" had no action ("my yearly credit total compared…"). Rewritten as "see my yearly credit total next to the required norm". |
| US-6.2 | none | No change. |
| US-6.3 | none | No change. It's one action (see a rule check) on two counters from the same rule, so it doesn't need splitting. |
| US-E.1 | format | "the team" → **data maintainer**. Removed implementation details ("scheduled worker", "2–3 h manual run"). The "what" is now "course and enrolment data updates on its own every day". The "why" now names the student-facing outcome. |
| US-E.2 | format | "the team" → **data maintainer**. Removed the tool name ("Sentry") and the jargon ("parser run", "crawl"). The "what" is now "be notified when a data update fails or brings far fewer courses than usual". |
| US-E.3 | format | "staff" → **data maintainer**. Removed the jargon ("run"). The "why" now names the outcome: catching wrong data before students rely on it. |
| US-E.5 | format | "the team" → **developer**. The "why" ("see where students drop off") rephrased the "what". It now says why we need it: knowing which step to fix first. |
| US-E.6 | format | "the team" → **developer**. The "why" now names a concrete outcome: knowing in March whether students used the ІНП planner. |

**Result:** 12 stories in, 13 out (one split). Eight stories changed format, and none of them changed scope.

## Final MVP stories

### Step 5. Adds to ІНП, marks backups

| ID | Step | Story |
|---|---|---|
| US-5.1 | 5 | As a planner, I want to add a course to my ІНП plan from its course page, so that my picks are collected in one place. |
| US-5.9 | 5 | As a planner, I want to see my plan grouped by year and semester with credits per semester, so that I can spot an overloaded or empty semester before registration. |
| US-5.2 | 5 | As a planner, I want to mark a course in my plan as "backup", so that I have a plan B for every risky slot. |
| US-5.10a | 5 | As a planner, I want to remove a course from my plan, so that courses I ruled out after reading reviews no longer count toward my credits. |
| US-5.10b | 5 | As a planner, I want to turn a backup course into a main pick, so that my credit totals count it when I change my mind. |

### Step 6. Confirms credits & hours

| ID | Step | Story |
|---|---|---|
| US-6.1 | 6 | As a planner, I want to see my yearly credit total next to the required norm, so that I see a gap before registration. |
| US-6.2 | 6 | As a planner, I want a warning when my weekly hours exceed the limit, so that I don't find out inside САЗ during registration. |
| US-6.3 | 6 | As a planner, I want to see my profession-oriented and free-choice credits against their limits, so that my plan follows the rules. |

### E. Enablers (data, analytics)

| ID | Step | Story |
|---|---|---|
| US-E.1 | E | As a data maintainer, I want course and enrolment data to update on its own every day, so that students see current courses and can rate the ones they just finished without anyone spending hours on a manual import. |
| US-E.2 | E | As a data maintainer, I want to be notified when a data update fails or brings far fewer courses than usual, so that I fix it before students see stale or missing data. |
| US-E.3 | E | As a data maintainer, I want to see what each data update changed (new, changed and removed courses), so that I catch wrong data before students rely on it. |
| US-E.5 | E | As a developer, I want to see how many students go from visiting the site to opening a course page, starting a review and submitting a rating, so that we know which step to fix first. |
| US-E.6 | E | As a developer, I want to track usage of a new feature with a few lines of code, so that we know in March whether students used the ІНП planner. |