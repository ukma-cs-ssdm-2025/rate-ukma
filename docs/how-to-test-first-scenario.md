# How to test the first working scenario

Scenario: a student builds their personal study plan (ІНП). The plan shows taken
and mandatory courses by year and semester, and the student adds courses from
the catalog, marks them as backup, promotes backups and removes picks. Picks are
saved in the database, so they survive a reload, a restart and a change of
device.

Stories: US-5.1, US-5.2, US-5.9, US-5.10a, US-5.10b. Code: PR #817.

Everything runs on staging, https://staging.rateukma.com, where the
`fe_personal_plan` flag is on. You need a NaUKMA account for the plan, and a
staff account for the admin at https://staging.rateukma.com/admin/.

## 1. Open the plan

Open https://staging.rateukma.com/plan and sign in with your NaUKMA email.

Taken courses (from САЗ) and mandatory courses sit in their years and semesters,
with credits totalled per semester and per year.

- **Check:** a taken or mandatory course has no ✕. These courses cannot be
  removed or made backup.
- **Check:** a past year has no «Додати дисципліну» and no controls on its
  courses. It is read-only.
- **Check:** the summer semester of the final year says «На останньому курсі
  літнього семестру немає», and nothing can be added there.

## 2. Add a course as a backup

In a semester of a later year, click «Додати дисципліну», pick a course from
the catalog and click «Як запасну».

It appears in that semester as a backup.

- **Check:** the semester and year credits do not change. Backups are not
  counted.
- **Check:** switch the view to «Основні». The backup is hidden. Switch back to
  «З запасними».
- **Check:** open «Додати дисципліну» again. The course is no longer in the
  catalog, so it cannot be added twice.

## 3. Make it a main pick

Click ↑ next to the backup.

It becomes a main pick, and the semester's credits go up.

- **Check:** its credits, hours and type stay the same. Switching between main
  and backup does not change them.

## 4. Check that it is saved

In the admin, open **Rating_app → Planned courses**.

The course is at the top, with slot `MAIN` and an `updated_at` time from a few
seconds ago.

- **Check:** reload the plan, or open it on another device. The course is still
  there, because the plan is read from the server.
- **Check:** open your student in the admin. The **Personal plan** field shows
  the same plan as the app, built from the database.

## 5. Remove a pick

Click ✕ on the course from steps 2–4.

It disappears from the plan.

- **Check:** reload the admin list. Its row is gone.
- **Check:** add any course again, then delete its row in the admin and reload
  the plan. It is gone right away: deleting in the admin clears the student's
  cached plan.
