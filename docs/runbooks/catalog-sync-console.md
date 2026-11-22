# Catalog Sync from the Console

Runbook for deciding the changes the nightly read of UKMA Data proposes: apply them, reject them, answer mapping questions, and set which kinds apply by themselves. Decisions are made here, in the console; the /data page only shows them ([ADR-0022](../architecture/decisions/0022-sync-runs-changes-and-policies.md), update of 2026-11-22).

## Before You Start

You already have a shell where `python manage.py` runs for the backend (or `node main.js` for the parser). How to get that shell is out of scope here.

- You need the username of an active superuser. Every decision is recorded under it with `--by <username>`.
- Ask the owner before the first write on an environment, and again before live.
- Work on staging first, check the result on staging's /data, then repeat on live.

## Rules

- **Every write command is a dry run unless you add `--yes`.** The dry run executes the same code inside a transaction that is rolled back, so it shows exactly what `--yes` would do and writes nothing.
- `--by <username>` is required for `apply`, `reject`, `answer` and `policy <kind> <mode>`, dry run included.
- Use the same selection flags for the dry run and for `--yes`. If the nightly read ran in between, run the dry run again.
- Change ids (`#48121`) are printed by `status`, `show` and the dry run, and shown on /data.
- Mapping questions, and changes that move ratings between courses, are «лише вручну»: no policy can make them `auto`.
- Output is Ukrainian. `status`, `show` and `policy` take `--json` for machine reading.

## Steps

### 1. Take a database dump (once, before the first apply on an environment)

Take a database dump with your usual backup tool and keep it until the apply is verified. Applies are not undone by a command; the dump is the way back.

### 2. See what waits

```bash
python manage.py catalog_sync status
```

It prints the last read (when, how long, whether it failed), how many changes wait per group, what was skipped and why, what was applied in the last 7 days, whether the nightly read is on, and which kinds are `auto`.

### 3. Look at the changes

```bash
python manage.py catalog_sync show --group change
python manage.py catalog_sync show --group change --rated --limit 50
python manage.py catalog_sync show --q "Тестова дисципліна А"
```

Groups: `new`, `link`, `change`, `mapping`, `removed`, `other`. Each line gives the id, the record, its ratings, and every changed field as old → new. Narrow with `--kind`, `--rated`/`--unrated`, `--q` or `--ids 48121,48122`.

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

Read the counts per kind, every listed change, and the «Не увійде:» lines: they name the changes the selection leaves out and why (waiting on another change, superseded, in another group). Use `--limit 0` to list every change, `--exclude 48122,48123` to leave some out.

### 5. Write

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
python manage.py catalog_sync show --ids 48121 --state applied
```

The applied changes no longer wait, the 7-day line counts the decision, and /data shows it under «Що застосовано» with your name and time. Open one changed course on the site and check the new value.

## Mapping Questions

Group `mapping` holds questions: two courses that may be one, a semester course without a course, a course that may belong elsewhere.

```bash
python manage.py catalog_sync show --group mapping
python manage.py catalog_sync answer 50011 keep_apart --by <username>
python manage.py catalog_sync answer 50011 merge --into <course-id> --by <username> --yes
python manage.py catalog_sync answer keep_apart --unrated --by <username>
```

| Question kind | Answers |
| --- | --- |
| `merge_courses` | `keep_apart`, `merge` |
| `move_offering` | `keep`, `move` |
| `relink_course` | `keep`, `relink` |
| `place_offering` | `place` (with `--into`) |

`keep_apart` and `keep` close the question. `merge`, `move`, `relink` and `place` record the answer; the change itself happens only when you `apply` it (steps 4–6). `--unrated` answers `keep_apart` for every question with no ratings and no plans.

## Policies

```bash
python manage.py catalog_sync policy
python manage.py catalog_sync policy change_course auto --by <username>
python manage.py catalog_sync policy change_course auto --by <username> --yes
```

The list shows each kind, its mode and who changed it last. The dry run prints old → new. `needs_approval` puts a kind back under review. Every change is audited and shown on /data under «Правила».

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
| `Відмовлено: Синхронізація саме триває…` | The nightly read or another apply holds the lock. Wait a few minutes and run the dry run again. |
| `Відмовлено: Ці зміни з попереднього читання САЗ…` | A newer read exists. Run `status` and `show` again and pick from it. |
| `Відмовлено: Дані старші за 48 год…` | The run is old. Check its age in `status`. Apply anyway only on purpose, with `--confirm-stale`. |
| `Під цю вибірку не підходить жодна зміна…` | Nothing waiting matches the flags. Check them with `show`. |
| `Користувача «…» не знайдено` or `«…» не адміністратор` | `--by` must name an active superuser, by username or email. |
| `status` shows the last read failed | /data and `status` keep showing the previous good read. Decide from it or wait for the next night; tell the parser owner if it fails twice. |

### Збій

`Не вдалося застосувати, нічого не записано (…)` means the apply failed and its transaction rolled back. Run `status`: the changes still wait. Run the dry run again; if it fails the same way, stop and open an issue with the message, the decision number if any, and the change ids. No student or teacher names in the issue.

If a written apply turns out wrong, do not edit rows by hand. Stop, tell the owner, and restore from the dump of step 1 if the owner decides so.

## UKMA Data Cases (parser, coming with PR 2)

Records UKMA Data could not match itself are its review cases. /data shows how many are open. Deciding them moves to the parser's CLI in the next PR, run from the parser shell:

```bash
node main.js ukma-data cases list
node main.js ukma-data cases show <case-id>
node main.js ukma-data cases decide <case-id> <answer>
node main.js ukma-data courses merge <course-id> <course-id>
node main.js ukma-data courses unmerge <course-id>
```

Same rules: dry run by default, `--yes` to write, then `cases list` to verify. Until that PR lands, these commands do not exist.
