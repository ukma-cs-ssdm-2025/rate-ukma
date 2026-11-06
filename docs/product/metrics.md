# Product analytics

What Rate UKMA measures as a product: the north star, the questions each metric answers, how to count them, and what is left out on purpose.

Each question names the decision its answer would change.

## North star

Share of courses available for choice that have at least one review.

A course counts as available for choice if it is offered in the newest academic year present in the catalogue. `SemesterService._get_academic_year_range` builds that academic year from the offering's semester; the newest one is the set a student picks from in March, and before March it is the year currently running.

A course counts as covered if any offering of it, from any year, has at least one review. Reviews attach to a `CourseOffering`, but a student picks a `Course`, and the point is that they can read what earlier students wrote about it.

Most courses repeat from year to year, so the denominator is stable and the number moves because of reviews rather than because the catalogue changed. A course offered for the first time cannot have a review yet, which is expected and affects a small part of the set.

Next step after this saturates: raise the bar from one review to five. Depth needs no event collection.

Coverage counts supply, not the value a reader gets. Someone can read reviews every day, find them useful, and never change coverage, so this number is lower than what the product is worth.

One caveat when comparing coverage over time: the product can raise it by itself. After a review is saved it can offer a few more courses to rate, picked so that the least covered ones come first, which sends authors straight at the numerator. Before reading a before-and-after comparison, find out whether that was running for ordinary users at the time, or the product nudging its own authors will read as growth of the product.

## Questions

In the data column, *ready* means it can be computed from stored rows now, *partly* means one part is available and one is not, *events* means it needs event collection.

| # | Question | Decision it changes | Metric | Data |
| --- | --- | --- | --- | --- |
| Q1 Return | Do people come back, or visit once and disappear? | whether to spend effort on returning users or on new ones | active in last 30 days; retention by registration cohort | partly |
| Q2 Coverage | Does a student find a review for the course they are choosing? | the north star | see above | ready |
| Q3 Authors | How many registered users write something, and not only read? | whether the gap is traffic or the path to writing | share of accounts with at least one review | ready |
| Q4 First review | How fast does a new user write their first review? | whether new users need a push in their first days | median days from `date_joined` to first review; share who rate within 7 days | ready |
| Q5 Habit | For those who wrote once: one-off or habit? | whether it is worth reminding past authors | share of authors with 2 or more reviews; median gap between first and second | ready |
| Q6 Visit to review | Do visits turn into reviews? | whether the path to rating is hard to walk | sessions where someone meant to rate; sessions with a review; conversion between them | events |
| Q7 Reach | Do people get to the reviews at all? | whether the narrow point is supply or discovery | share of visitors who opened at least one course page that has a review | events |
| Q8 Substance | Are reviews substantive, or only stars? | whether to change the review form | share of reviews with text; median length | ready |
| Q9 Uncovered demand | Which courses do people look at while those courses have no review? | a list of courses to ask people to fill in | most viewed courses among those with no review | events |
| Q10 Student reach | What share of students have an account? | where to promote the product, and whether reach is the narrow point at all | accounts over students currently studying, split by faculty and by degree | ready |
| Q11 Feature use | Is a feature we shipped used? | where to spend effort and what to remove | how many different people used a feature since it was released | partly |

## Notes on the questions

- Return and Habit count different groups. Return is about everyone registered, Habit only about those who already wrote a review. Mixing them makes a number about returning authors look like an answer about returning users. Thirty days is a stock — how many people are here now — not a trend.
- Authors and First review count only accounts that have something to rate. Otherwise first-year students in September add zeros and the result reads as failure. Whether a student may rate a course is not a stored column: it is computed from the course's semester and how far that semester has gone, so a query has to derive it the way the backend does, in `SemesterService`. A course the student dropped does not count. The condition opens part-way through a trimester, so the correction matters at the start of a trimester and shrinks to nothing once rating opens.
- Visit to review needs a visitor id that survives sign-in. The first step of any funnel is a visit by someone not signed in, so a hashed user id is empty there. Events carry a random visitor id kept in the browser, the same before and after sign-in, next to the hashed user id.
- Visit to review also needs a definition of intent, which we cannot see and have to infer. Proposal: a session whose first real action is opening the rating form or the user's own ratings page. Conversion is counted from those sessions only, because the product does not try to keep readers on the site, so a visit that was never meant to end in a review is not a failure.
- Reach is about getting to a review, not about reading one. Whether a person read what they opened is not measured, and measuring it would mean time on the page and scroll depth, which this document leaves out on purpose. Whether reading changes a choice belongs to the open questions below. Two signals look like reader behaviour and are not used for it. A vote needs enrolment in the course and the midpoint of the trimester, so a student choosing a future course cannot vote at all, and the default order of reviews is itself driven by votes, so the reviews that are seen most collect the most votes. Comments on a review have no such gate, but there are few of them.
- Substance protects the north star, because coverage is easy to raise with one-word reviews.
- Feature use is one simple metric per feature, the same for every feature. A deeper metric answers whether a feature works the way it was meant to, and belongs to that feature's own issue. Count cumulatively rather than as a 30-day share: shares are noisy at small numbers and a 30-day window does not fit a product with three trimesters. Do not judge a feature before it has lived through at least one rating window. It is *partly* rather than *events* because some features already leave a trace in the database — notifications record when someone opened them — while most leave none.
- Student reach is about having an account, not about awareness, which cannot be measured from the database at all. Two mistakes change the number badly. The denominator is students who are studying now, not every row in the student table: that table is a catalogue import and holds alumni and several year groups at once, so dividing by it makes the share look several times smaller than it is. The programme start year together with the degree gives the right cut, and so do enrolments in the newest academic year. The other mistake is to measure the share of our own users who come from other faculties instead of the share of students who have an account: the first looks healthy whenever the other faculties are simply larger, which they are, and it hides exactly where the product is unknown. A faculty is known only through the student row an account is linked to, so report the number of unlinked accounts next to the share.

## Why there are few reviews

Three explanations compete, and they need opposite actions, so reading these together matters more than any single number.

| Explanation | Can we measure it | Action if this is the cause |
| --- | --- | --- |
| Few people know about the product | only indirectly: Student reach counts accounts, not awareness | spread the word: channels, other faculties |
| People are afraid to leave reviews | partly, share of reviews left anonymously | work on trust and make the anonymous option easier to notice |
| The rating flow itself is hard to walk | needs events | simplify the form and the path |

Some of the team have heard from users directly that they are afraid to leave reviews. That is anecdotal, with no sample and no method, and it is also the only direct user feedback anyone has. The argument on the other side is that the product is open source, reviews never go to lecturers, and an anonymous option exists — but that describes how the system is built, not how people see it.

The share of reviews left anonymously tests this in one direction only. A high share supports the fear explanation; a low share does not disprove it, because people may not notice the checkbox or may not trust it.

Fear and the rating flow stay hypotheses until there is data, and should be called hypotheses in both directions.

## Reading the numbers

- Compare academic years, not trimesters. A trimester is compared with the same trimester of another year.
- Prefer totals over per-period counts while the product has less than two full academic years behind it. Totals are not affected by the season, per-period counts are. Show per-period counts cumulatively, and mark enrollment in March and the three rating windows on any chart over time.
- Rating opens part-way through a trimester, so the flow of new reviews rises and falls with those dates rather than with anything the product did. A past course stays open for rating with no time limit, so there is no moment when nothing at all can be rated — except for a student whose courses are all in the trimester now running.
- Never show a share without the counts behind it. The rough error of a share is about 1 over the square root of n: 30 points at n = 10, 10 points at n = 100, 6 points at n = 250. While the numerator is in single digits, "6 of 10" is honest and "60%" is not. Do not act on a share with fewer than about 20 in the numerator.

While the numbers are this small, they are good for telling zero from not-zero and for finding large gaps. For "why", a few conversations with students tell more than any metric.

## Traps in the data

- `rating_app_student` is not the user base. The catalogue scraper fills it, and `Student.user` is set only for people who have an account. Our own users are counted from `auth_user`. `Student` is the catalogue: it answers what a student takes and how many students there are, and it is never a count of users.
- `last_login` works here but has no history. The session lasts three hours of inactivity and there is no "remember me", so someone coming back on another day signs in again and the field does move. Only the latest login is kept, though: twenty visits and two visits look the same, and past months are gone. A weekly snapshot starts the clock and cannot bring back what is already lost.
- A deleted review leaves nothing behind. Reviews are removed from the table, there is no column marking them deleted, and an author can delete their own. Coverage can therefore fall with nothing stored to say why, and every count of reviews written is really a count of reviews still there. Only a snapshot taken while they exist can show it happening.
- `Enrollment.enrolled_at` is the time the row was imported, not the day a student enrolled: every row from one import carries the same timestamp, so nothing about when students choose their courses can be read from it.
- `Course.ratings_count` and the averages next to it are a cache: they are recomputed when a review is created, changed or deleted, and not when the catalogue import moves an offering from one course row to another. Count coverage from the review rows, joined through the offering to the course.
- Semesters do not sort with a plain `ORDER BY`. `Semester.term` is text and `Meta.ordering` is `["-year", "-term"]`, which sorts alphabetically. `SemesterService.TERM_PRIORITY` has the right order and analytics SQL has to follow it.
- Anonymisation costs nothing. No metric here needs an email, a `student_id` or the text of a review; a hashed author id, dates and aggregates are enough. Every query reads anonymised views.
- Error monitoring samples traffic on both sides, records part of the front-end sessions, and carries the signed-in person's identity with it. It is not a product-analytics store and should not become one: sampling makes small numbers meaningless, and how long anything is kept there is not ours to decide. The anonymisation above is about our own queries.

## Out of scope

- Session length, time on site, engagement. The product should be useful, not hold attention.
- Searches with no results. Every course a student has heard of is in the scraped catalogue, so an empty result is a typo, and no decision follows from it.
- Where traffic comes from. There are no referral links and people arrive from Outlook and from offline, so a referrer tells us nothing. The weaker version we accept instead is jumps in `date_joined` next to known promotion dates.
- Total number of courses, and total rows in `rating_app_student`. That is the size of a scraper import, not an audience.
- Average rating across the platform. It mixes courses that have nothing to do with each other, and nothing follows from it moving: the product does not decide which courses exist or how hard they are.

## Open questions

Ideas that are not buildable yet, each with the thing that unblocks it.

| Idea | Unblocked when |
| --- | --- |
| Whether a review is actually read, and whether reading one changes a choice. The strongest signal available is conversion from the course page to adding that course to a personal plan, because choosing a course is what reviews are for | there is a `course_viewed` event and the backend stores plans, as [ADR-0012](../architecture/decisions/0012-inp-plan-storage.md) proposes. While a plan lives only in the browser, the backend never sees a course being added to it |
| A separate "this review helped me choose" signal, kept apart from an upvote, which today means "I agree with this assessment" and needs enrollment | we decide to split the two signals |
| Removing or relaxing the vote gate | a separate product issue: the gate keeps out votes from people with no stake in the course |
| Asking users directly | the indirect signals have not answered within a trimester. A control on the review itself is not a popup and interrupts nobody |
