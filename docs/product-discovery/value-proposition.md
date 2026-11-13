# Rate UKMA: Value Proposition Canvas

## Analysis

**Pains that come from the registration mechanics.** Four rules in САЗ create the most severe pains, and all of them hit before a student ever opens a course page:

- **The race for seats.** Registration opens at the same moment for the whole university, with no priority for anyone. Courses with a seat limit fill up within seconds, and whoever is slower doesn't get in. There's no time to research once registration opens, so the decision has to be made in advance, and it has to include backups for every limited course.
- **Cancellation.** A course without enough registrations doesn't take place, and the student is removed from it. Any niche choice needs a plan B.
- **Lock-in.** After correction week, the plan is fixed. A bad choice means a semester with a heavy or useless course, and skipping it means academic debt.
- **The timetable comes later.** In March, students commit without knowing if their courses clash. No product can fully solve this, because the data doesn't exist yet at the moment of choice.

**How the three profiles differ.**

- **Profile 1** has one to two weeks and a long list. They need to compare quality and real workload and build a main plan plus backups.
- **Profile 2** has a few days and a short list of whatever is still open. They need availability first, quality second, and speed above everything.
- **Profile 3** doesn't need to choose anything. They need rating to be fast, safe and worth it.

**Where the product is likely strong or weak.**

- **Strong:** reading about courses that already have reviews. Verified ratings, the course map and filters give Profile 1 what САЗ lacks, as long as the course has been rated. For Profile 3, the low-effort path (numbers only, text optional) and notifications about votes are already live.
- **Weak:** everything that depends on data the product may not have. Free seats are an open question, so most of Profile 2's value is conditional. The backup planning job depends on the planner, which isn't live yet. And for the courses where Profile 1 needs help most (cross-faculty, niche), reviews are probably thin, and no live feature targets that.

---

## Result

### Profile 1. The pre-registration planner with no one to ask

**Value proposition:** For a second-year bachelor who must pick many third-year courses at once, with a main course and a backup for each slot, before registration opens and with no seniors to ask, Rate UKMA shows the real workload and usefulness of each course from verified students who took it, and (once the planner ships) lets them build several plan variants with credits checked automatically, so that they walk into registration with a ranked plan instead of a guess, unlike opening САЗ pages one by one and asking in chats where nobody took the course.

#### Customer Profile

| Type | Description | Importance / severity |
|---|---|---|
| Job (functional) | "I need a main pick and a backup for every elective slot before registration opens." | **key** |
| Job (functional) | "I need to know how much time each course will actually take, not just its credits." | **key** |
| Job (functional) | "I need my credits and weekly hours to add up to the limits." | medium |
| Job (functional) | "I need to compare 15–20 courses without keeping them all in my head." | medium |
| Job (emotional) | "I want to feel I chose, not guessed." | **key** |
| Job (emotional) | "I don't want to panic on registration day." | medium |
| Job (social) | "I don't want to look clueless messaging third- and fourth-year students I barely know from last year's list." | low |
| Pain | "I'm taking a course from another faculty and I don't know anyone who took it. The annotation sounds good, but I have no idea how much work it is." (Job: real workload) | high |
| Pain | "If I pick wrong, I'm stuck with it for a semester, and skipping it means academic debt." (Job: main pick and backup) | high |
| Pain | "The whole university registers at the same second. If I'm a moment too slow, the course is full." (Job: main pick and backup) | high |
| Pain | "The exact courses I care about have zero or two reviews." (Job: real workload) | high |
| Pain | "The reviews may be about a teacher who no longer teaches it." (Job: real workload) | medium |
| Pain | "I have 20 tabs open and keep losing track of what I liked about which course." (Job: compare) | medium |
| Pain | "I only find out I'm over the hour limit inside САЗ, during registration." (Job: credits add up) | medium |
| Pain | "My backup might clash with my main courses, but there's no timetable yet." (Job: main pick and backup) | medium |
| Gain | A ranked shortlist with a main pick and backups, ready before registration opens | required |
| Gain | An honest workload signal from people who took the course, ideally with the same teacher | required |
| Gain | Credits and hours checked automatically | expected |
| Gain | Several courses side by side on one screen | expected |
| Gain | A sense of which courses are likely to fill up fast or not take place | desired |
| Gain | Discovering a good course they didn't know existed | unexpected |

#### Value Map

| Pain or gain | How Rate UKMA addresses it | Feature | Status |
|---|---|---|---|
| Pain: no one I know took this course | The student sees the real workload from people who took the course, without hunting for acquaintances in another faculty. Only enrolled students can rate, so the source is trustworthy. Works when the course has at least a few reviews. | Difficulty and usefulness ratings, written reviews, verified enrolment | live |
| Pain: stuck for a semester with a bad choice | The course map shows at a glance which candidates are "hard and useless," so the riskiest choices drop out early. Reduces risk only for courses that have ratings. | Course map (usefulness × difficulty), per-course analytics | live |
| Pain: course fills up in seconds and I don't get in | The planner lets the student prepare backup variants in advance, so a full course isn't a dead end. The enrolled count is a rough popularity signal. САЗ keeps data on past registrations (past-year course pages), so whether a course ran and how full it was can in theory be pulled from there, but Rate UKMA doesn't show it yet. Today the student has to dig through old САЗ pages course by course. | ІНП planner with several variants; enrolled count on course page | in development (planner); live (count); **gap** (past registration history: data exists in САЗ, not shown in Rate UKMA) |
| Pain: zero or two reviews on the courses I care about | Nothing today. Reminders to rate would raise supply overall, but not specifically for cross-faculty or niche courses. | — (reminders to rate) | **gap** (backlog only) |
| Pain: reviews may describe a different teacher | The teacher filter finds courses by the current teacher, and a reviewer can say in the review which teacher they had. So the student can pick out reviews about the teacher who teaches the course now. Works when reviewers actually specify the teacher; a review without it still leaves the question open. | Teacher filter; teacher field in reviews | live |
| Pain: 20 tabs, losing track | The course map puts many courses on one chart. The planner will hold the shortlist in one place. There's no side-by-side table of specific courses. | Course map; ІНП planner | live; in development; **partial gap** (side-by-side comparison) |
| Pain: over the hour limit discovered in САЗ | Automatic credit and limit checks show the problem before registration. | ІНП planner | in development |
| Pain: backup may clash, no timetable | In March, nothing: the timetable data doesn't exist yet. At most, a past-year time slot could hint at a clash. After the timetable is published, the team's separate service resolves clashes when the student picks groups. | Separate timetable-clash service (outside Rate UKMA) | **gap** in March; separate service later |
| Gain: ranked shortlist with backups before registration | Several plan variants let the student keep "plan A" and "plan B." Whether a variant can be ranked or marked as a backup is unclear. | ІНП planner | in development |
| Gain: honest workload signal | Ratings plus reviews, with helpful / unhelpful votes pushing the most useful reviews to the top. The teacher noted in a review shows whether the experience applies to the current teacher. Works when the course has reviews. | Ratings, reviews, helpful votes | live |
| Gain: credits and hours checked automatically | The planner counts credits and checks limits. | ІНП planner | in development |
| Gain: courses side by side | The map gives a visual comparison on two axes only. Workload details stay in separate pages. | Course map | live (partial) |
| Gain: know which courses fill fast or get cancelled | Not covered in Rate UKMA. The past registration data exists in САЗ and could be shown next to ratings, turning a manual search through old pages into one glance. | — | **gap** (data available in САЗ) |
| Gain: discover a good course they didn't know | Filtering by specialty and rating, and scanning the map for "useful and manageable" courses, surfaces options the student wouldn't have searched for. Recommendations would do this directly. | Filters, course map; recommendations | live; backlog |

#### Fit

For courses that already have reviews, the product covers this profile's core need well: real workload and usefulness from verified students, in one place, with a map that speeds up comparison. The three most severe gaps are thin reviews on exactly the cross-faculty and niche courses this profile looks at, no view of past registration history, even though the data exists in САЗ (this matters most for limited-seat courses that fill up in seconds), and the fact that the backup job depends on a planner that isn't live yet. Teacher changes are handled well: the teacher filter and the teacher field in reviews let the student read about the current teacher, as long as reviewers fill that field in.

---

### Profile 2. The correction-week scrambler

**Value proposition:** For a student whose course was cancelled and who has a few days to close the credit gap, Rate UKMA lets them filter possible replacements by credits and see how people who took them rated them, so that they pick a replacement that isn't a disaster before the deadline, unlike taking whatever still has seats in САЗ and asking in chats. *(Conditional: the value depends heavily on whether free seats are shown in Rate UKMA.)*

#### Customer Profile

| Type | Description | Importance / severity |
|---|---|---|
| Job (functional) | "I need a replacement that closes my three-credit gap before correction week ends." | **key** |
| Job (functional) | "I need to decide whether to wait for the reserve course or give up my spot and switch." | **key** |
| Job (functional) | "I need the replacement to fit my weekly hours." | medium |
| Job (emotional) | "I want to get back in control fast instead of feeling trapped with leftovers." | **key** |
| Job (social) | "I don't want to post 'does anyone know anything about X?' in five chats." | low |
| Pain | "I have a few days, and I'm opening every open course one by one." (Job: replacement) | high |
| Pain | "Courses with free seats might be empty for a good reason." (Job: replacement) | high |
| Pain | "I check seats in САЗ and ratings in Rate UKMA and keep switching between them." (Job: replacement) | high (depends on open question) |
| Pain | "I have no idea if the reserve course will reach its minimum." (Job: wait or switch) | high |
| Pain | "If I miss the deadline, I'm short on credits and end up with academic debt." (Job: replacement) | high |
| Pain | "The replacement might clash with my other courses once the timetable comes out." (Job: fits my hours) | medium |
| Gain | One list: still open, right credits, with ratings | required |
| Gain | A reason to trust a leftover course: "it's niche, not bad" | required |
| Gain | The credit gap shown instantly | expected |
| Gain | A sense of whether the reserve course will run | desired |
| Gain | Alternatives similar to the cancelled course | unexpected |

#### Value Map

| Pain or gain | How Rate UKMA addresses it | Feature | Status |
|---|---|---|---|
| Pain: few days, opening courses one by one | Filters by credits, semester and rating narrow the list fast. Without free-seat data, the student still has to check each result in САЗ. | Search and filters | live; **free seats: unknown — hypothesis** |
| Pain: leftover courses may be bad | Ratings and reviews tell "niche but good" from "empty for a reason." Works only when the course has reviews, and leftover niche courses are likely the least-reviewed. | Ratings, reviews | live (weak for this profile) |
| Pain: switching between САЗ and Rate UKMA | Solved only if free seats appear in Rate UKMA. The enrolled count is live but doesn't say if seats remain. | Enrolled count; free seats | live; **unknown — gap if not shown** |
| Pain: reserve course may not run | The enrolled count on the course page gives a rough sense of how close it is to the minimum, if the student knows the minimum from САЗ. No status ("may take place") is shown. | Enrolled count | live (partial); **gap** (status and minimum) |
| Pain: missing the deadline, short on credits | The planner's credit check shows the gap once the student removes the cancelled course from their plan by hand. The planner won't pick up cancellations on its own, because data from САЗ isn't pulled often enough to follow status changes during correction week. | ІНП planner | in development; **gap** (no automatic update after cancellation) |
| Pain: timetable clash later | Covered by a separate web service from the team that resolves timetable clashes. It helps once the timetable is published, when the student picks specific groups before the semester. It can't help at the moment of choosing a replacement, because the timetable doesn't exist yet. | Separate timetable-clash service (outside Rate UKMA) | separate service |
| Gain: one list of open courses with ratings | Filters plus ratings get close, but without free seats it's not "one list." | Filters, ratings; free seats | live; **unknown** |
| Gain: trust a leftover course | Written reviews explain *why* a course is unpopular. Works when reviews exist. | Reviews | live |
| Gain: credit gap shown instantly | Automatic credit check, after the student removes the cancelled course by hand. | ІНП planner | in development (partial) |
| Gain: sense of whether reserve course runs | Not covered beyond the raw enrolled count. | — | **gap** |
| Gain: similar alternatives | Recommendations based on similar course sets would point to a replacement close to the cancelled one. | Course recommendations | backlog |

#### Fit

This is the profile the product serves worst today. All five high-severity pains depend on availability data (free seats, reserve status, sync with cancellations), and the product either doesn't show it or it's unknown whether it does. For this profile, Rate UKMA is a review reader next to САЗ, not a replacement for it. The most harmful gap is free seats: if they're shown together with ratings and credit filters, most of this profile's job is covered by features that already exist.

---

### Profile 3. The contributor (senior student with fresh experience)

**Value proposition:** For a senior student who wants to help younger students choose well without answering the same questions in chats, Rate UKMA lets them rate a course anonymously in under a minute and shows them when their review helped someone, so that their experience outlasts their graduation, unlike chat answers that get lost in history.

#### Customer Profile

| Type | Description | Importance / severity |
|---|---|---|
| Job (functional) | "I want to pass on what I know about courses I took, once, instead of in every chat." | **key** |
| Job (functional) | "While I'm planning my own year, I can rate a few past courses on the side." | medium |
| Job (emotional) | "I need to be sure the teacher can't figure out it was me." | **key** |
| Job (emotional) | "After a really good or really bad course, I want to get it off my chest." | medium |
| Job (emotional) | "I want to know my effort mattered." | **key** |
| Job (social) | "I want to be helpful to younger students, the senior I wish I'd had." | medium |
| Job (social) | "I don't want to be seen as someone who trashes teachers." | medium |
| Pain | "There were eight of us in that course. The teacher will know who wrote it, and I need them for my thesis." (Job: be safe) | high |
| Pain | "Writing a proper review takes time, and I've already made my choices." (Job: pass on what I know) | medium |
| Pain | "I have no idea if anyone reads what I write." (Job: effort mattered) | medium |
| Pain | "By March, I've forgotten the details of last autumn's courses." (Job: pass on what I know) | medium |
| Pain | "Angry one-star rants next to my review make the whole page look unserious." (Job: be seen as fair) | low |
| Gain | Rating takes under a minute | required |
| Gain | Confidence that anonymity holds, even in small groups | required |
| Gain | Seeing that a review helped (votes, comments, views) | expected |
| Gain | A link to send in chats instead of retyping the same answer | desired |
| Gain | A personal record of all courses they took and what they thought | unexpected |

#### Value Map

| Pain or gain | How Rate UKMA addresses it | Feature | Status |
|---|---|---|---|
| Pain: teacher will recognize me in a small group | Reviews are published without a name. This hides the name but not the content: in a group of eight, a specific story still identifies the author. There's no protection like delayed publication or hiding texts until a course has several reviews. | Anonymous publishing | live; **gap** (small-group protection) |
| Pain: writing takes time | Text is optional. The student can leave two numbers in seconds, which likely explains why half of ratings have no text. | Numeric ratings with optional review | live |
| Pain: no idea if anyone reads it | Notifications about votes and comments show that someone engaged. View counts aren't mentioned, so a review nobody voted on feels ignored. | Notifications, helpful votes, comments | live (partial) |
| Pain: forgot details by March | Reminders at the end of each semester would catch the student while memory is fresh. Nothing prompts them today. | Reminders to rate completed courses | backlog; **gap now** |
| Pain: rants make the page look unserious | Helpful / unhelpful votes push balanced reviews up. Verified enrolment means ratings come from people who actually took the course. | Helpful votes, verified enrolment | live |
| Gain: rating in under a minute | Two sliders and an optional text field. | Rating form | live |
| Gain: confidence in anonymity | Covered only at the level of names. | Anonymous publishing | live (partial); **gap** |
| Gain: seeing the review helped | Notifications about votes and comments. | Notifications | live |
| Gain: a link to send in chats | A course page is a public URL within the platform, so a senior can answer "see here." The person who gets the link can open and read the page without friction. | Course page | live |
| Gain: personal record of past courses | The personal page groups the student's own ratings by year. | Personal page | live |
| Link to planning visit | The March spike in ratings comes from exactly this: students rate past courses while planning their own year. When the student opens the planner in March, their past courses could be one click away from a rating, which makes this existing habit even easier. | ІНП planner + personal page | in development |

#### Fit

The effort side is covered well: numeric-only ratings make contributing nearly free, and notifications give some sense of impact. The most harmful gap is anonymity in small groups, which is exactly where niche and cross-faculty courses live, so the reviews Profile 1 needs most are also the riskiest to write. The second gap is timing: without reminders (backlog), contributions depend on the student coming back in March for their own reasons, when memory has already faded.

---

### Links between profiles

**Profiles 1 and 2 run on Profile 3.** Almost every pain reliever for Profiles 1 and 2 comes with the same condition: "works when the course has reviews." The required gain for both ("an honest signal from people who took it") is created entirely by Profile 3. The product is a two-sided marketplace, and the supply side is the bottleneck.

**Testing the uncomfortable hypothesis against the value map.** The value map doesn't contradict it, and in two places makes it worse:

- No live feature targets review supply for cross-faculty or niche courses. Reminders (backlog) would raise supply overall, but if most students take in-faculty courses, even reminders will grow reviews where there are already many.
- Small-group anonymity is the main barrier for Profile 3, and small groups are typical of niche courses. So the courses Profile 1 cares about most are also the riskiest to review.
- Profile 2 lands on leftover courses, which are most likely niche and least reviewed.

The hypothesis still needs checking with data (reviews per course by faculty and course type, versus page views). But if it holds, the product's weakest spot is exactly the students it most wants to help. A targeted fix would be to connect demand and supply directly: when Profile 1 views a course with few reviews, flag it, and prompt the students who took that course to rate it.

**Which profile is served best today.** Among the three, Profile 1 gets the most today, but specifically the version of Profile 1 choosing popular courses in their own faculty. That's the student who already has the easiest access to informal advice. Profile 3 is served reasonably well on effort. Profile 2 is served worst, and the gap there is mostly a data question (free seats), not a big new feature. Once the planner ships, Profile 1's backup job gets covered, and since students already rate past courses while planning in March, the planner can make that moment of contribution even easier, which helps supply.

**Protection from the anti-persona (the score-settler).**

- Verified enrolment and corporate login mean only people who took the course can rate it. Each student can rate a course only once, so one person can't flood a course with ratings.
- Rating on difficulty and usefulness, not on the teacher as a person, directs feedback at the course.
- Helpful / unhelpful votes and comments let other students push rants down.
- There's no mention of moderation or reporting, and that's a **gap**. Anonymity, which protects Profile 3, also protects the score-settler. The planned AI-generated tags could amplify emotional words from rants into filters unless they are built with that in mind.
