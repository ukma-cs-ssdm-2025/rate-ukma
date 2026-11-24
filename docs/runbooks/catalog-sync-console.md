# Catalog Sync from the Console

Runbook for deciding the changes the nightly read of UKMA Data proposes: apply them, reject them, undo an applied decision, answer mapping questions, set which kinds apply by themselves, and read the journal. Decisions are made here, in the console, or on the /data page; UKMA Data's own cases and course merges are decided on /data or from the parser shell (see the last section) ([ADR-0022](../architecture/decisions/0022-sync-runs-changes-and-policies.md), updates of 2026-11-22 and 2026-11-23).

## Making Decisions on /data

A superuser can make the same decisions on the site without this console: open /data, then «Оновлення з САЗ» → «Чекають рішення». It lists steps in apply order (links, links to check, new records, changes without ratings, changes with ratings, questions, removed). «Переглянути» opens a step's changes in words; untick a row to leave it out, then «Застосувати» runs the dry run and applies after a confirm, or «Не зараз» rejects. The same selection and idempotency rules apply; one request applies at most 5 000 changes and the step keeps the rest.

Every decision appears in «Журнал», where an applied decision can be undone with «Відкотити»: a dry run lists every blocker first, and the confirmation writes a new decision. Mapping questions are still answered only here with `catalog_sync answer`; the page lists them and shows the command.

## Before You Start

You already have a shell where `python manage.py` runs for the backend (or `node main.js` for the parser). How to get that shell is out of scope here.

- Before anything else, ask the owner to confirm in one line which environment this shell is on. `status` prints no environment name, so never infer it from the data. If they cannot confirm it, stop.
- **The owner** is the superuser who gave you the task. Their request covers the environment they named, and nothing else: "tonight's staging changes" means staging only. Live needs its own ask.
- "Tonight's changes" means the groups `status` shows as waiting, except `mapping`. Show the owner the per-group counts from `status` first and ask which groups they want; mapping questions are answered only when the owner names them.
- You need the owner's username for `--by <username>`; every decision is recorded under it. If they did not give it, ask. Never guess one.
- Work on staging first and check the result there before anyone asks for live.

## Working with the Owner

- **Show before you write.** Before every `--yes`, show the owner the full dry-run output: the counts, every listed change, and the «Не увійде:» lines. Add `--limit 0` to that dry run; without it only 20 changes are listed. Run the same command with `--yes` only after they confirm that selection. This holds for every apply, reject, answer (`--unrated` too) and policy change, not only the first.
- A changed selection is a new selection: after a refusal, a newer read or any change of flags, run the dry run again and get a new confirmation.
- If the `--yes` output has no `Рішення #` or its counts differ from the confirmed dry run, do not run `--yes` again. Run `status`, stop, and tell the owner.
- Decisions that belong to the owner, never to you: `--confirm-stale`, deciding from an older read when the last one failed, any write on live, and anything this runbook does not cover. Show them what you see and ask.
- When this runbook says to stop, stop and tell the owner what happened, with the command and its output.

## Rules

- **Every write command is a dry run unless you add `--yes`.** The dry run executes the same code inside a transaction that is rolled back, so it shows exactly what `--yes` would do and writes nothing.
- `--by <username>` is required for `apply`, `reject`, `answer` and `policy <kind> <mode>`, dry run included.
- Use the same selection flags for the dry run and for `--yes`. If the nightly read ran in between, run the dry run again.
- Change ids (`#48121`) are printed by `show` and the dry run, and shown on /data. `status` prints only counts.
- Mapping questions, and changes that move ratings between courses, are «лише вручну»: no policy can make them `auto`.
- `revert` is a write command like the rest: dry run first, show the owner, then `--yes`.
- Output is Ukrainian. `status`, `show`, `log` and `policy` take `--json` for machine reading.

## Steps

Steps 2 and 3 only read; they may run before the dump.

### 1. Take a database dump (before the first `--yes` of the session)

Take a database dump with the environment's usual backup tool and keep it until the apply is verified. `revert` undoes only the kinds in [Undo a Decision](#undo-a-decision); new records, merges and placements still need the dump. If you do not know how to take a dump on this environment, ask the owner to take one or to confirm one was taken tonight, and wait for their yes. Run no `--yes` before that.

### 2. See what waits

```bash
python manage.py catalog_sync status
```

It prints the last read (when, how long, whether it failed), how many changes wait per group with the `--group` code to use for each, what was skipped and why, what was applied in the last 7 days, whether the nightly read is on, and which kinds are `auto`.

### 3. Look at the changes

```bash
python manage.py catalog_sync show --group change
python manage.py catalog_sync show --group change --rated --limit 50
python manage.py catalog_sync show --q "Тестова дисципліна А"
```

Groups: `new`, `link`, `change`, `mapping`, `removed`, `other`; `status` lists only those that have waiting changes. Each line gives the id, the record, its ratings, and every changed field as old → new. Narrow with `--kind`, `--rated`/`--unrated`, `--q` or `--ids 48121,48122`.

### 4. Dry run

```bash
python manage.py catalog_sync apply --group change --by <username>
```

Example output (invented data):

```text
Пробний запуск, нічого не записано.
Застосувало б 1 зміну: зміни курсів 1.
  #48121  Курс «Тестова дисципліна А» · 3 оцінки
      назва: «Тестова дисципліна А» → «Тестова дисципліна Б»
Пропущено 0, чекають 0.
Щоб записати: додайте --yes.
```

Every `apply` and `reject` needs a selection: `--group`, `--ids`, or `--kind` with `--group`. `--ids` takes no `--kind`, `--q` or `--rated`; with `--group`, every id must be in that group, or the command refuses. To apply everything that waits, go group by group in this order: `link`, `new`, `change`, `removed`, `other`, with steps 4–6 for each. A change whose required row does not exist yet is counted under «чекають» and stays proposed; it applies with a later group or the next night. Group `mapping` is answered, not applied wholesale: see [Mapping Questions](#mapping-questions).

Read the counts per kind, every listed change, and the «Не увійде:» lines (after `--yes`: «Не увійшло:»). They name the changes the selection leaves out and why: waiting on another change, out of date («неактуальна»), already applied or rejected, a question with no answer yet, or skipped this time because the row on the site changed or the selection was narrowed. Use `--limit 0` to list every change, `--exclude 48122,48123` to leave some out.

### 5. Write

Only after the owner confirmed the dry run of step 4:

```bash
python manage.py catalog_sync apply --group change --by <username> --yes
```

It prints the decision number (`Рішення #73`). To reject instead:

```bash
python manage.py catalog_sync reject --ids 48122 --by <username>
python manage.py catalog_sync reject --ids 48122 --by <username> --yes
```

A rejected change comes back with the next read if САЗ still differs.

### 6. Verify

```bash
python manage.py catalog_sync status
python manage.py catalog_sync show --group change --state applied --limit 0
```

Use the group you just applied in place of `change`.

Every change your dry run listed should be there, except those it said would wait (`--ids 48121,48122` narrows the list). The 7-day line in `status` counts the decision, and the environment's /data page shows it under «Що застосовано» with the owner's name and time. Then ask the owner to open one changed course on that environment's site, or give you its address, and check the new value; the course is the record named in the `show` line. If neither is possible, report that this check was not done.

### Done

Done when, for every group the owner chose, `status` shows no waiting changes in that group except those the dry run said wait, and step 6 passed. If `status` shows nothing waiting outside `mapping`, do nothing and tell the owner. The «Викладачі» line in `status` is the teacher sync: show its count to the owner; this runbook does not decide it.

Finish with a report to the owner: per group, the decision numbers, the counts applied, the changes left waiting and why, and any check that was not done.

## Undo a Decision

An applied decision can be undone with `revert`. It writes back what the decision wrote; it never deletes rows and cannot be undone itself.

```bash
python manage.py catalog_sync log
python manage.py catalog_sync revert 74 --by <username>
python manage.py catalog_sync revert 74 --by <username> --yes
```

The dry run lists every change that blocks the whole revert, one line each (invented data):

```text
Пробний запуск, нічого не записано.
Не можна відкотити рішення #74: 2 зміни заважають.
  зміна #48121  запис змінився після застосування (назва)
  зміна #48130  спершу відкотіть рішення #77 (пізніше застосоване)
Спершу приберіть перешкоди.
```

A revert is all-or-nothing: while one blocker stays, nothing is written. What blocks it:

- the record changed after the apply (someone edited it, or a later decision did);
- a later decision that was not reverted touched the same record, or one of its changes needs a change in this decision;
- the kind is currently `auto`, so the next nightly read would apply it again; set the kind to `needs_approval` first;
- a move merged study plans away; restore those plans by hand instead.

Which kinds can be reverted: `link_*`, `relink_course`, `change_*` and `move_offering`. `new_*` cannot («Лише вручну: нові записи вже можуть мати оцінки»), and neither can `merge_courses` or `place_offering` («Лише вручну, з резервної копії бази»). `removed_*` wrote nothing, so there is nothing to undo. Only applied decisions can be reverted; a rejected change simply comes back after the next read.

When the dry run has no blockers, it says how many changes it would return and their fields get their previous values. After `--yes` it prints a new decision number; the changes become «відкочено», keep their original decision number for counting, and come back to «Чекають рішення» after the next read if САЗ still differs. Check:

```bash
python manage.py catalog_sync log --limit 5
python manage.py catalog_sync show --group change --state reverted --limit 0
```

## Journal

`log` lists every decision, newest first: applies, rejections and reverts (by a person or «автоматично»), policy changes and mapping answers. One line per entry: the decision number, what it did with counts, who, when, and «відкочено» on a decision that a later revert undid.

```bash
python manage.py catalog_sync log
python manage.py catalog_sync log --limit 50
python manage.py catalog_sync log --json
```

Use it to find the decision number for `revert`, to check what a dry run would touch, and to answer the owner's «що вже сталося».

## Mapping Questions

Group `mapping` holds questions: two courses that may be one, a semester course without a course, a course that may belong elsewhere.

```bash
python manage.py catalog_sync show --group mapping
python manage.py catalog_sync answer 50011 keep_apart --by <username>
python manage.py catalog_sync answer 50011 merge --into <course-id> --by <username> --yes
python manage.py catalog_sync answer keep_apart --unrated --by <username>
```

`--unrated` takes the answer alone, with no question id: it closes every merge, move and relink question with no ratings on any side (`keep_apart` for merges, `keep` for moves and relinks). It does not check study plans, and it skips placement questions (`place_offering`), which always need an `--into` answer. `--into` takes a course id from the question as `show --group mapping` prints it. Answers follow the same rule: dry run, the owner's confirmation, then `--yes`.

| Question kind | Answers |
| --- | --- |
| `merge_courses` | `keep_apart`, `merge` |
| `move_offering` | `keep`, `move` |
| `relink_course` | `keep`, `relink` |
| `place_offering` | `place` (with `--into`) |

`keep_apart` and `keep` close the question. `merge`, `move`, `relink` and `place` record the answer; the change itself happens only when you apply it with `apply --ids <question id>` (steps 4–6).

A closed question still counts as waiting in `status` and on /data until the next nightly read. That read does not ask it again while its courses and ratings stay the same.

Check after `--yes`:

```bash
python manage.py catalog_sync show --ids 50011
```

The question now prints `відповідь уже є: <answer>` with the time. After `--unrated`, `show --group mapping --unrated --limit 0` lists every unrated question with its answer.

## Policies

```bash
python manage.py catalog_sync policy
python manage.py catalog_sync policy change_course auto --by <username>
python manage.py catalog_sync policy change_course auto --by <username> --yes
```

The list shows each kind, its mode and who changed it last. The dry run prints old → new. `needs_approval` puts a kind back under review. Every change is audited and shown on /data under «Правила».

Check after `--yes`: run `python manage.py catalog_sync policy` again. The kind's row shows the new mode and the owner's username under «Хто змінив».

## The Nightly Read

The nightly read runs only while the switch `catalog_sync_proposals` is on. `status` shows it.

```bash
python manage.py waffle_switch catalog_sync_proposals on --create
python manage.py waffle_switch catalog_sync_proposals off
```

Turning it on for live is the owner's call.

## Refusals and Failures

| Message | What to do |
| --- | --- |
| `Відмовлено: Синхронізація саме триває…` | The nightly read or another apply holds the lock. Run the dry run again in 5 minutes, at most 3 times; then stop. |
| `Відмовлено: Ці зміни з попереднього читання САЗ…` | A newer read exists. Run `status` and `show` again; the dry run and the owner's confirmation start over. |
| `Відмовлено: Дані старші за 48 год…` | The run is old. Show the owner its age from `status`. Add `--confirm-stale` only if they say so. |
| `Під цю вибірку не підходить жодна зміна…` | Nothing waiting matches the flags. Check them with `show`. |
| `Користувача «…» не знайдено` or `«…» не адміністратор` | `--by` must name an active superuser, by username or email. |
| `Рішення не знайдено.` | Check the decision number with `log`. |
| `Відкотити можна лише застосоване рішення.` or `Це рішення нічого не застосувало.` | Only an applied decision can be reverted; a rejection needs no undo. |
| `Це рішення вже відкочено.` | A second revert would undo the undo. Check `log`. |
| `Нічого відкочувати: ці зміни нічого не записали.` | The decision only acknowledged `removed_*` changes or was itself a revert. |
| `Не можна відкотити рішення #N: …` | The dry run lists every blocker; fix them or restore the dump instead. |
| `status` shows the last read failed | `status` and /data keep showing the previous good read. Stop and tell the owner; decide from the previous read only if they say so. |

### Збій

Two messages:

- `Пробний запуск не вдався, нічого не записано (…)`: the dry run failed and wrote nothing.
- `Рішення #N не вдалося: вибрані зміни не застосовано (…)`: the `--yes` run failed. None of the selected changes applied. Two things were written: the failed decision #N, which /data shows, and any change the run found already out of date, now marked «неактуальна».

Run `status`: the selected changes still wait, except those now marked «неактуальна». Run the dry run again; if it fails the same way, stop. Draft an issue for the owner with the message, the decision number if any, and the change ids, and let them file it. No student or teacher names in it.

If a written apply turns out wrong, do not edit rows by hand. Stop and tell the owner. The restore from the dump of step 1 is the owner's decision and the owner's to run; you do not run one.

## UKMA Data Cases and Course Merges

Review cases are the records UKMA Data could not match on its own; course merges join two UKMA Data courses into one. Both change UKMA Data itself, not Rate UKMA's database.

**UKMA Data has one environment, and it is live.** Every `--yes` below and every decision button on /data writes shared live data that every reader of UKMA Data sees. There is no staging run first, and the dump of step 1 does not cover it. So for each write: show the owner the dry run (or the confirm text on /data), and act only on their explicit ok for that one write.

**What can be undone.** A merge is undone by an unmerge. A `same_person` decision has no documented undo: say so to the owner before the write. The only decision a case takes is `same_person` («Це та сама людина»): the new record is the student it joined. If the owner says the two are different people, there is no command for it; leave the case open and note it for the owner.

**Which path.** If /data shows the buttons enabled (on live; see «On /data»), decide there: the page records who decided. Otherwise use the parser shell. `cases list` and `cases show` exist only in the shell.

### From the parser shell

`cases show` and `cases decide` print student names and study details, so run them in an interactive shell, never as a scheduled job whose output a log collector keeps, and never paste their output into an issue or PR.

```bash
node main.js cases list --status open                      # every open case, one line each
node main.js cases list --kind student_match --status open
node main.js cases show <case-id>                          # the case and its candidates
node main.js cases decide <case-id> same_person            # dry run: what would change
node main.js cases decide <case-id> same_person --yes      # write, after the owner's ok
node main.js courses merge <course-id> --into <course-id>  # dry run; --into is the course that stays
node main.js courses merge <course-id> --into <course-id> --yes
node main.js courses unmerge <course-id>                   # dry run; add --yes to write
```

Check each write:

- after `cases decide … --yes`, run `cases show <case-id>` (or `cases list --status open`): the case is decided;
- after `courses merge … --yes`, run the dry run `courses unmerge <course-id>` (no `--yes`): it lists what it would undo when the merge is in place, and refuses with `not_merged` when it is not;
- after `courses unmerge … --yes`, the same dry run now refuses with `not_merged`.

For a `course_match` case the shell has no candidate view: take both course ids (`crs_…`) and which one stays (`--into`) from /data or from the owner, and run the `courses merge` dry run before the `--yes`. Only `student_match` cases can be decided; other kinds are refused with `not_student_match`. A refusal prints one line with its code (`not_student_match`, `not_open`, `not_merged`, `level_mismatch`, …) and exits non-zero: stop and tell the owner the code and the id. UKMA Data's audit log records a shell decision with no key and no person, so write the owner's name, the id and the time in your report to them.

### On /data

The buttons work only when the server's UKMA Data key (`UKMA_DATA_API_KEY`, the same key the lists use) has the `review:decide` scope. Live's key has it; staging's has only `review:read`, so on staging the buttons stay disabled with «Тут лише перегляд: рішення змінюють спільні дані САЗ», and the backend refuses every decision before calling UKMA Data. Never give the staging key `review:decide`, and do not read, print, copy or paste a key's value. If the buttons are disabled on live, tell the owner the live key seems to have lost `review:decide`.

1. Open /data → «Справи». Each open case is a row with its buttons: «Це та сама людина» for a `student_match` case, «Об'єднати з …» per candidate for a `course_match` case (the candidate is the course that stays). A row opens the case with its details.
2. Press the button. The confirm names the case or both courses and says that the change affects the shared САЗ data. It is the only check before the write: read it to the owner and press the confirm only on their ok.
3. The row shows the result: «✓ …» when done, or UKMA Data's reason. The case moves to «Стан: Вирішені» with the badge «Вирішено».
4. Every attempt that reaches UKMA Data appears in «Оновлення з САЗ» → «Журнал» as «Рішення в UKMA Data» with who, what, and any refusal or error. A done merge has «Роз'єднати» there.

When a decision does not go through:

- **«UKMA Data не відповіла, тож рішення могло й не записатися…»**: UKMA Data was down or slow (the API answered 502). The decision may or may not have been written; the «Журнал» row says «помилка» either way. Before pressing again, check:
  - a case: open «Справи» with «Стан: Усі»; the badge «Вирішено» means it was written;
  - a merge: run the dry run `node main.js courses unmerge <course-id>` in the parser shell (no `--yes`). If it lists what it would undo, the merge happened: do not press again. If it refuses with `not_merged`, it did not: tell the owner and ask before retrying.
- **A refusal** (for example «Курси різного рівня: об'єднати можна лише однакові.»): UKMA Data changed nothing. These are the shell's refusal codes in Ukrainian. Do not retry; tell the owner the case or course id.
- **A merge made by mistake**: with the owner's ok, press «Роз'єднати» on its «Журнал» row. That writes a new decision; the merge row keeps its history and loses the button.

Done when each write the owner approved has passed its check. Report to the owner, per write: the ids, the button or the exact command, the time and the check result; for a shell write also the owner's name, since UKMA Data records no person.
