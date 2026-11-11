Acceptance Criteria (Given-When-Then)

**Business rules**:

| Rule | Value
|---|---|
| Total credits, bachelor programme | 240
| Profession-oriented credits (whole bachelor programme) | at least 54 |
| Free-choice credits (whole bachelor programme) | at most 25  | 
| Credits per year | 58–62 (no single "norm" value) |
| Summer semester | its credits count toward the year |
| Weekly hour limit | 24 hours per semester week | 
| Weekly hours of a course | taken from САЗ |  
| Taken and mandatory courses | the plan starts with courses already taken (from САЗ) and the mandatory courses of the programme for every year
| Mandatory courses | cannot be removed from the plan 
| Backups | not counted in any total 
| Limits | warnings, not hard blocks 
| Credits | can be decimal (3.5, 2.5), set per term 
| Courses | can run over several terms

Every scenario starts from its own state and can run alone.

---

## Step 5. Adds to ІНП, marks backups

### US-5.1 — Add a course to the plan from its course page

```gherkin
Scenario: Add a course from its course page to the chosen year of study
  Given I am signed in as a planner
  And my plan for year 3 has only the mandatory courses of my programme
  And I am on the course page of "Теорія ігор" (3 credits, autumn, free choice)
  When I add the course to my ІНП plan and choose year 3
  Then "Теорія ігор" appears in my plan under year 3, autumn semester
  And the course page shows "Ваш курс вже додано в ІНП"
```

```gherkin
Scenario: The course page shows that the course is already in the plan
  Given I am signed in as a planner
  And "Теорія ігор" is already in my plan under year 3, autumn
  When I open the course page of "Теорія ігор"
  Then I see "Ваш курс вже додано в ІНП"
  And my plan still contains "Теорія ігор" exactly once
```

```gherkin
Scenario: The chosen year decides where the course lands
  Given I am signed in as a planner
  And I am on the course page of "Теорія ігор" (3 credits, autumn, free choice)
  When I add the course to my ІНП plan and choose year 4
  Then "Теорія ігор" appears under year 4, autumn semester
  And year 3 does not contain "Теорія ігор"
```

```gherkin
Scenario: A course that runs over several terms lands in every term of the chosen year
  Given I am signed in as a planner
  And "Лінійна алгебра" runs in autumn and spring with 4 credits in each term
  When I add "Лінійна алгебра" to my plan and choose year 3
  Then the course appears in both the autumn and the spring semester of year 3
  And each semester counts 4 credits for it
```

### US-5.9 — See the plan by year and semester

```gherkin
Scenario: Plan grouped by year and semester with credits per semester
  Given I am signed in as a planner
  And my plan for year 3 has "Паралельне програмування" (4 credits, autumn), "Генеративний ШІ" (3 credits, autumn) and "Комп'ютерна графіка" (4 credits, spring)
  When I open my plan
  Then I see year 3 split into autumn and spring
  And autumn shows 7 credits and spring shows 4 credits
```

```gherkin
Scenario: Decimal credits are summed exactly
  Given I am signed in as a planner
  And my plan has "Курс A" (3.5 credits, autumn of year 3) and "Курс B" (2.5 credits, autumn of year 3)
  When I open my plan
  Then autumn of year 3 shows 6 credits
```

```gherkin
Scenario: First visit shows taken courses and mandatory courses for every year
  Given I am signed in as a planner in year 2
  And I have never added a course to my plan
  And according to САЗ I took "Вступ до програмування" (5 credits) in autumn of year 1 and "Дискретна математика" (4 credits) in spring of year 1
  And my programme has 6 mandatory courses worth 24 credits in year 3 and 3 mandatory courses worth 12 credits in year 4
  When I open my plan
  Then I see "Вступ до програмування" under year 1, autumn and "Дискретна математика" under year 1, spring
  And I see the 6 mandatory courses under year 3 and the 3 mandatory courses under year 4
  And year 3 shows 24 credits and year 4 shows 12 credits
```

```gherkin
Scenario: An empty semester is visible
  Given I am signed in as a planner
  And my plan for year 3 has courses only in autumn
  When I open my plan
  Then the spring semester of year 3 is shown with 0 credits
```

### US-5.2 — Mark a course as backup

```gherkin
Scenario: Mark a course as backup
  Given I am signed in as a planner
  And my plan for year 3 autumn has "Теорія ігор" (3 credits) as a main pick
  And autumn of year 3 shows 3 credits
  When I mark "Теорія ігор" as backup
  Then "Теорія ігор" is labelled as backup in my plan
  And autumn of year 3 shows 0 credits
```

```gherkin
Scenario: Backups do not count toward any total
  Given I am signed in as a planner
  And my plan for year 3 has 60 credits of main picks
  And "Блокчейн" (4 credits, free choice) is in the plan as backup
  When I open my plan
  Then the year 3 total shows 60 credits
  And the free-choice total does not include "Блокчейн"
```

```gherkin
Scenario: The only course in a semester can be a backup
  Given I am signed in as a planner
  And spring of year 3 has no mandatory courses
  And "Блокчейн" is the only course in spring of year 3
  When I mark "Блокчейн" as backup
  Then "Блокчейн" stays in the plan, labelled as backup
  And spring of year 3 shows 0 credits
```

### US-5.10a — Remove a course from the plan

```gherkin
Scenario: Remove a main course
  Given I am signed in as a planner
  And my plan for year 3 autumn has "Паралельне програмування" (4 credits) and "Генеративний ШІ" (3 credits)
  When I remove "Генеративний ШІ" from my plan
  Then "Генеративний ШІ" no longer appears in my plan
  And autumn of year 3 shows 4 credits
```

```gherkin
Scenario: Remove the last course I added
  Given I am signed in as a planner
  And my plan shows the courses I have already taken in years 1–2
  And year 3 has 6 mandatory courses worth 24 credits
  And "Теорія ігор" (3 credits) is the only course I added, under year 3, autumn
  When I remove "Теорія ігор"
  Then my plan shows only the courses I have already taken and the mandatory courses
  And year 3 shows 24 credits
```

```gherkin
Scenario: A mandatory course cannot be removed
  Given I am signed in as a planner
  And "Бази даних" is a mandatory course of my programme in year 3, autumn
  When I look at "Бази даних" in my plan
  Then there is no option to remove it
  And "Бази даних" stays in year 3, autumn
```

```gherkin
Scenario: Removing a multi-term course removes it from every term
  Given I am signed in as a planner
  And "Лінійна алгебра" is in my plan in autumn and spring of year 3 with 4 credits each
  When I remove "Лінійна алгебра"
  Then it no longer appears in autumn or spring of year 3
  And both semesters show 4 credits less than before
```

### US-5.10b — Turn a backup into a main pick

```gherkin
Scenario: Promote a backup to a main pick
  Given I am signed in as a planner
  And autumn of year 3 shows 7 credits from main picks
  And "Теорія ігор" (3 credits) is in autumn of year 3 as backup
  When I turn "Теорія ігор" into a main pick
  Then "Теорія ігор" is no longer labelled as backup
  And autumn of year 3 shows 10 credits
```

```gherkin
Scenario: Promoting a backup that pushes the year above the range shows a warning but is allowed
  Given I am signed in as a planner
  And year 3 has 60 credits from main picks
  And "Блокчейн" (4 credits) is in year 3 as backup
  When I turn "Блокчейн" into a main pick
  Then "Блокчейн" becomes a main pick
  And the year 3 total shows 64 credits with a warning that it is 2 credits above the 58–62 range
```

---

## Step 6. Confirms credits & hours

### US-6.1 — See the yearly credit total next to the required range

```gherkin
Scenario: Year inside the range
  Given I am signed in as a planner
  And my main picks for year 3 add up to 60 credits
  When I open my plan
  Then year 3 shows 60 credits next to the required range of 58–62
  And there is no credit warning for year 3
```

```gherkin
Scenario: Lower boundary of the range
  Given I am signed in as a planner
  And my main picks for year 3 add up to 58 credits
  When I open my plan
  Then there is no credit warning for year 3
```

```gherkin
Scenario: Just below the range with decimal credits
  Given I am signed in as a planner
  And my main picks for year 3 add up to 57.5 credits
  When I open my plan
  Then year 3 shows a warning that 0.5 credits are missing to the minimum of 58
```

```gherkin
Scenario: Year well below the range shows the gap
  Given I am signed in as a planner
  And my main picks for year 3 add up to 50 credits
  When I open my plan
  Then year 3 shows a warning that 8 credits are missing to the minimum of 58
```

```gherkin
Scenario: Upper boundary of the range
  Given I am signed in as a planner
  And my main picks for year 3 add up to 62 credits
  When I open my plan
  Then there is no credit warning for year 3
```

```gherkin
Scenario: Just above the range with decimal credits
  Given I am signed in as a planner
  And my main picks for year 3 add up to 62.5 credits
  When I open my plan
  Then year 3 shows a warning that it is 0.5 credits above the maximum of 62
```

```gherkin
Scenario: Summer semester credits count toward the year
  Given I am signed in as a planner
  And my main picks for year 3 add up to 28 credits in autumn, 24 in spring and 6 in summer
  When I open my plan
  Then year 3 shows 58 credits
  And there is no credit warning for year 3
```

```gherkin
Scenario: A year with only mandatory courses
  Given I am signed in as a planner
  And year 4 has only its 3 mandatory courses worth 12 credits
  When I open my plan
  Then year 4 shows 12 credits with a warning that 46 credits are missing to the minimum of 58
```

### US-6.2 — Warning when weekly hours exceed the limit

```gherkin
Scenario: Weekly hours within the limit
  Given I am signed in as a planner
  And my main picks for autumn of year 3 add up to 22 hours per week according to САЗ
  When I open my plan
  Then autumn of year 3 shows 22 of 24 hours per week
  And there is no hours warning
```

```gherkin
Scenario: Exactly at the weekly hour limit
  Given I am signed in as a planner
  And my main picks for autumn of year 3 add up to 24 hours per week
  When I open my plan
  Then there is no hours warning for autumn of year 3
```

```gherkin
Scenario: One hour above the limit
  Given I am signed in as a planner
  And my main picks for autumn of year 3 add up to 25 hours per week
  When I open my plan
  Then autumn of year 3 shows a warning that weekly hours exceed the limit of 24 by 1
```

```gherkin
Scenario: Each semester is checked separately
  Given I am signed in as a planner
  And my main picks add up to 25 hours per week in autumn of year 3 and 20 in spring of year 3
  When I open my plan
  Then only autumn of year 3 shows an hours warning
```

```gherkin
Scenario: The warning does not block adding a course
  Given I am signed in as a planner
  And autumn of year 3 is already above the weekly hour limit
  When I add "Генеративний ШІ" to autumn of year 3
  Then "Генеративний ШІ" is added to my plan
  And the hours warning for autumn of year 3 stays visible
```

```gherkin
Scenario: Backups do not count toward weekly hours
  Given I am signed in as a planner
  And autumn of year 3 is exactly at the weekly hour limit
  When I add "Блокчейн" to autumn of year 3 and mark it as backup
  Then there is no hours warning for autumn of year 3
```

### US-6.3 — Profession-oriented and free-choice credits against their limits

```gherkin
Scenario: Both rules are met across the whole programme
  Given I am signed in as a bachelor planner
  And my main picks across all four years include 54 profession-oriented credits and 25 free-choice credits
  When I open my plan
  Then I see 54 of at least 54 profession-oriented credits and 25 of at most 25 free-choice credits
  And there is no warning about these rules
```

```gherkin
Scenario: Profession-oriented credits just below the minimum
  Given I am signed in as a bachelor planner
  And my main picks across the whole programme include 53.5 profession-oriented credits
  When I open my plan
  Then I see a warning that 0.5 profession-oriented credits are missing
```

```gherkin
Scenario: Free-choice credits above the maximum
  Given I am signed in as a bachelor planner
  And my main picks across the whole programme include 25 free-choice credits
  When I add "Теорія ігор" (3 credits, free choice) as a main pick
  Then "Теорія ігор" is added to my plan
  And I see a warning that free-choice credits exceed the limit by 3
```

```gherkin
Scenario: Credits from different years add up to one programme total
  Given I am signed in as a bachelor planner
  And my plan has 20 profession-oriented credits in year 3 and 34 in year 4
  When I open my plan
  Then I see 54 profession-oriented credits for the programme
  And there is no profession-oriented warning
```

```gherkin
Scenario: Programme total toward 240 credits
  Given I am signed in as a bachelor planner
  And my main picks across all four years add up to 236 credits
  When I open my plan
  Then I see 236 of 240 credits for the programme
  And I see that 4 credits are left to reach 240
```

```gherkin
Scenario: A course is counted by its type for my programme
  Given I am signed in as a planner in programme "Комп'ютерні науки"
  And "Теорія ігор" is free choice for "Комп'ютерні науки" and profession-oriented for another programme
  When I add "Теорія ігор" (3 credits) as a main pick
  Then my free-choice credits grow by 3
  And my profession-oriented credits do not change
```

---

## E. Enablers (data, analytics)

### US-E.1 — Course and enrolment data update on its own

```gherkin
Scenario: A new course from САЗ appears without a manual import
  Given "Квантові обчислення" was published in САЗ for 2026–27 today
  And no one on the team runs an import
  When the next daily update finishes
  Then a planner can find "Квантові обчислення" in the Rate UKMA catalog
```

```gherkin
Scenario: A finished course can be rated after the update
  Given a student was enrolled in "Функціональне програмування" in autumn 2026 according to САЗ
  And Rate UKMA did not know about this enrolment yesterday
  When the next daily update finishes
  Then that student can rate "Функціональне програмування"
```

```gherkin
Scenario: The source is unavailable during an update
  Given yesterday's data shows 520 rated courses in the catalog
  And САЗ does not respond during today's update
  When today's update ends
  Then students still see the same 520 courses with their ratings and reviews
  And no course or review disappears
```

### US-E.2 — Notification about a failed or unusual update

```gherkin
Scenario: A failed update notifies the data maintainer
  Given I am the data maintainer
  When today's data update fails
  Then I get a notification that says which update failed and when
```

```gherkin
Scenario: An update with far fewer courses than usual
  Given I am the data maintainer
  And the previous update returned 1 000 courses
  When today's update returns fewer courses than the alert threshold
  Then I get a notification that shows both course counts
```

```gherkin
Scenario: A normal update does not notify
  Given I am the data maintainer
  And the previous update returned 1 000 courses
  When today's update succeeds and returns 998 courses
  Then I get no notification
```

### US-E.3 — See what each data update changed

```gherkin
Scenario: Summary of changes after an update
  Given I am signed in as a data maintainer
  And today's update added "Квантові обчислення", changed the credits of "Теорія ігор" from 3 to 4 and found "Історія джазу" missing in САЗ
  When I open the summary of today's update
  Then I see 1 new, 1 changed and 1 removed course, each listed by name
  And for "Теорія ігор" I see the old and the new credits
```

```gherkin
Scenario: A removed course is held, not deleted
  Given I am signed in as a data maintainer
  And today's update found "Історія джазу" missing in САЗ
  And "Історія джазу" has 6 ratings in Rate UKMA
  When I open the summary of today's update
  Then "Історія джазу" is listed as a held removal
  And students can still see "Історія джазу" with its 6 ratings
```

```gherkin
Scenario: An update with no changes
  Given I am signed in as a data maintainer
  And today's update found no differences from yesterday
  When I open the summary of today's update
  Then I see that the update found no changes
```

### US-E.5 — Funnel from visit to submitted rating

```gherkin
Scenario: The funnel shows each step with counts and conversion
  Given in October 2026, 1 000 students visited Rate UKMA
  And 400 of them opened a course page
  And 100 started a review
  And 60 submitted a rating
  When I open the funnel for October 2026 as a developer
  Then I see 1 000 → 400 → 100 → 60
  And I see conversion between steps: 40%, 25% and 60%
```

```gherkin
Scenario: A review that was started and abandoned
  Given a student started a review of "Теорія ігор" on 5 October 2026 and left without submitting
  When I open the funnel for October 2026 as a developer
  Then this student is counted in "review started"
  And this student is not counted in "rating submitted"
```

```gherkin
Scenario: A period with no data
  Given no student visited Rate UKMA on 1 August 2026
  When I open the funnel for 1 August 2026 as a developer
  Then every step shows 0
  And no conversion percentage is shown
```

### US-E.6 — Track usage of a new feature

```gherkin
Scenario: A new ІНП action becomes visible in usage numbers
  Given I am a developer
  And I add tracking for the action "add to ІНП" on the course page
  When 3 planners add courses to their plans after the release
  Then the usage numbers show 3 "add to ІНП" actions for that day
```

```gherkin
Scenario: A tracked action no one used yet
  Given I am a developer
  And tracking for "mark as backup" was released today
  When no planner marks a course as backup today
  Then the usage numbers show 0 "mark as backup" actions for today
```

