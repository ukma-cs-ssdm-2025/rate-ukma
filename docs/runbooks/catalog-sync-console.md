# Catalog Sync from the Console

Runbook for deciding the changes the nightly read of UKMA Data proposes: apply them, reject them, answer mapping questions, and set which kinds apply by themselves. Decisions are made here, in the console; the /data page only shows them ([ADR-0022](../architecture/decisions/0022-sync-runs-changes-and-policies.md), update of 2026-11-22).

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
- Output is Ukrainian. `status`, `show` and `policy` take `--json` for machine reading.

## Steps

Steps 2 and 3 only read; they may run before the dump.

### 1. Take a database dump (before the first `--yes` of the session)

Take a database dump with the environment's usual backup tool and keep it until the apply is verified. Applies are not undone by a command; the dump is the way back. If you do not know how to take a dump on this environment, ask the owner to take one or to confirm one was taken tonight, and wait for their yes. Run no `--yes` before that.

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

Read the counts per kind, every listed change, and the «Не увійде:» lines (after `--yes`: «Не увійшло:»). They name the changes the selection leaves out and why: waiting on another change, out of date («неактуальна»), already applied or rejected, a question with no answer yet, or skipped this time because the row on the site changed. Use `--limit 0` to list every change, `--exclude 48122,48123` to leave some out.

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

## Mapping Questions

Group `mapping` holds questions: two courses that may be one, a semester course without a course, a course that may belong elsewhere.

```bash
python manage.py catalog_sync show --group mapping
python manage.py catalog_sync answer 50011 keep_apart --by <username>
python manage.py catalog_sync answer 50011 merge --into <course-id> --by <username> --yes
python manage.py catalog_sync answer keep_apart --unrated --by <username>
```

`--unrated` takes the answer alone, with no question id: it closes every question that has no ratings and no plans, with `keep_apart` for merges and `keep` for moves and relinks. `--into` takes a course id from the question as `show --group mapping` prints it. Answers follow the same rule: dry run, the owner's confirmation, then `--yes`.

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
| `status` shows the last read failed | `status` and /data keep showing the previous good read. Stop and tell the owner; decide from the previous read only if they say so. |

### Збій

Two messages:

- `Пробний запуск не вдався, нічого не записано (…)`: the dry run failed and wrote nothing.
- `Рішення #N не вдалося: вибрані зміни не застосовано (…)`: the `--yes` run failed. None of the selected changes applied. Two things were written: the failed decision #N, which /data shows, and any change the run found already out of date, now marked «неактуальна».

Run `status`: the selected changes still wait, except those now marked «неактуальна». Run the dry run again; if it fails the same way, stop. Draft an issue for the owner with the message, the decision number if any, and the change ids, and let them file it. No student or teacher names in it.

If a written apply turns out wrong, do not edit rows by hand. Stop and tell the owner. The restore from the dump of step 1 is the owner's decision and the owner's to run; you do not run one.

## UKMA Data cases (parser)

Review cases are the records UKMA Data could not match on its own. /data shows only how many are open; you decide them from the parser shell. `cases show` and `cases decide` print student names and study details, so run them in an interactive shell, never as a scheduled job whose output a log collector keeps, and never paste their output into an issue or PR.

```bash
node main.js cases list --status open                      # every open case, one line each
node main.js cases list --kind student_match --status open
node main.js cases show <case-id>                          # the case and its candidates
node main.js cases decide <case-id> same_person            # dry run: what would change
node main.js cases decide <case-id> same_person --yes      # write, after the owner says ok
node main.js courses merge <course-id> --into <course-id>  # dry run
node main.js courses merge <course-id> --into <course-id> --yes
node main.js courses unmerge <course-id>                   # dry run; add --yes to write
```

Same rules as above: show the owner the dry run, write only after their ok, then run `cases list --status open` (or `cases show <case-id>`) to check the case is decided. Only `student_match` cases can be decided here; other kinds are listed and refused with `not_student_match`. A refusal prints one line and exits non-zero: stop and tell the owner. The audit log records a command-line decision with no key.
