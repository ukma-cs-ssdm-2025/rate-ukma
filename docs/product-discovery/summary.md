# Rate UKMA: users, value proposition and critical analysis

A short summary of practical assignment 2. Rate UKMA is already live, so we used AI to check the working product against its users, not to design a new one.

| Step | Prompt | Full AI result |
|---|---|---|
| 2.1 Audience | [2.1_audience_analysis.md](prompts/2.1_audience_analysis.md) | [audience-analysis.md](results/audience-analysis.md) |
| 2.2 Value proposition | [2.2_vpc.md](prompts/2.2_vpc.md) | [value-proposition.md](results/value-proposition.md) |
| 2.3 Critical analysis | [2.3_critical_analysis.md](prompts/2.3_critical_analysis.md) | [critical-analysis.md](results/critical-analysis.md) |

Each prompt passes the result of the previous step forward, so the three steps build on each other.

## 1. Target audience

We split users by the task they come with and the moment in the registration cycle, not by demographics. At NaUKMA, students register for next year's electives in March, all at once; popular courses fill up almost immediately, courses with too few students get cancelled, and after correction week the plan is locked.

| Profile | Who and when | What they need |
|---|---|---|
| **1. Pre-registration planner with no one to ask** (primary) | A second-year bachelor planning their third year: many electives to pick at once, some of them in other faculties, and friends in the same year who haven't taken these courses. One to two weeks before March registration. | A main pick and a backup for each slot, and the real workload of each course, before registration opens. |
| **2. Correction-week scrambler** | A student whose course was cancelled. A few days during correction week. | A replacement that still has seats, fits the credits and is not a disaster. |
| **3. Contributor** | A senior student who finished a course. The supply side: without them, profiles 1 and 2 see empty pages. | Rating in under a minute, staying anonymous, seeing that it helped. |

Often it is the same student in different roles, but the three need different data and features, so we keep them apart.

**Anti-persona:** the score-settler who writes reviews to punish a teacher. **Most critical stakeholder:** the university administration and the САЗ team, who control the login and the course data.

## 2. Value proposition

| Profile | Value proposition | How well we serve it today |
|---|---|---|
| 1. Planner | Real workload and usefulness from verified students who took the course, and soon several plan variants with credits checked automatically, so the student comes to registration with a plan instead of a guess. | **Well, for courses with reviews.** Gaps: thin reviews on cross-faculty and niche courses; no history of whether a course ran or filled up; backups depend on the planner, which is in development. |
| 2. Scrambler | Filters by credits plus ratings from people who took the course, to pick a replacement before the deadline. | **Worst of the three.** Free seats and course status are not shown, so the student has to switch between САЗ and Rate UKMA. |
| 3. Contributor | An anonymous rating in under a minute, with notifications when it helps someone, so the experience outlives graduation. | **Well on effort** (text is optional). Gaps: anonymity in small groups, no reminders at the end of the semester. |

**The main finding.** Rate UKMA is a two-sided product, and almost every benefit for profiles 1 and 2 works "only if the course has reviews." Reviews probably pile up on popular courses in large faculties, where advice is already easy to get, and stay thin on the cross-faculty and niche courses profile 1 needs most. We are checking this with data (see below).

## 3. Critical analysis and team decisions

The AI acted as a sceptical tech lead and found 13 risks. We left its wording unchanged in the [full result](results/critical-analysis.md) and filled in only the "Team decision" column.

| # | Risk found by AI | Decision | Why |
|---|---|---|---|
| 1 | We measure who writes ratings, not who reads them or whether it changes their choice | **Act on** | Without this, every roadmap decision is a guess. We will add event tracking. |
| 2 | A once-a-year product that must be rediscovered every March | **Act on** | ~2/3 of ratings come in March and April. We plan the year around two windows. |
| 3 | Most course pages have too few ratings to help | **Act on** | ~1 700 ratings over ~520 courses is ~3 per course. We will measure the distribution. |
| 4 | Users and reviews skew toward the Faculty of Informatics *(speculative)* | **Act on** | Cheap to check with one database query. |
| 5 | A small group of students writes most ratings | **Act on** | ~1.4 ratings per user. We will check the distribution. |
| 6 | The САЗ data pipeline is fragile | **Reject in part** | The pipeline works and needs only periodic updates. We agree the data is not refreshed often enough. |
| 7 | The administration can switch the product off | **Reject** | We are already in contact with the САЗ team, they know about the product, and there are no problems. |
| 8 | Personal data of students who never signed up | **Under discussion** | We will consider a privacy policy. |
| 9 | Anonymity breaks in small groups | **Under discussion** | The team does not yet see a real risk here. |
| 10 | No reporting or moderation for reviews about named teachers | **Under discussion** | We agree with the idea of moderation and will decide on its form. |
| 11 | The planner misses March 2027 | **Reject** | The planner is part of the semester milestone on 1 December, well before registration. |
| 12 | The product cannot realistically serve profile 2 | **Monitor** | It concerns only some students in some years, so it is not a priority now. |
| 13 | The product dies when the team graduates | **Act on** | Our current priority: a successor plan and a runbook. |

## What changes after the analysis

1. **Analytics before new features.** Before February, track course page views, filter use and rating starts, and ask after registration whether Rate UKMA changed the student's choice.
2. **Plan around two windows.** A pre-registration push in late February, and a review drive at the end of each semester.
3. **Check our assumptions with data.** Ratings per course, users and ratings by faculty, and ratings per user.
4. **Free seats during registration.** A new idea from the analysis: show free seats in real time or with an hourly update, which also helps profile 2.
5. **Sustainability.** A successor plan for after graduation, a runbook for deploy and data loading, and written approval from the САЗ team.
