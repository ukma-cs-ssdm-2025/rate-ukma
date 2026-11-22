"""Decide UKMA Data sync changes from the console (ADR-0022, update 2026-11-22).

`status` and `show` read; `apply`, `reject`, `answer` and `policy` run as a dry
run unless `--yes` is given, and `--by <username>` names the superuser the
decision is recorded for. Runbook: docs/runbooks/catalog-sync-console.md.
"""

from __future__ import annotations

import json
import textwrap
from argparse import ArgumentParser
from collections.abc import Callable
from datetime import timedelta
from typing import Any

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone

import waffle

from rating_app.models import (
    SyncApproval,
    SyncApprovalOutcome,
    SyncChange,
    SyncChangeState,
    SyncPolicy,
    SyncRun,
    SyncRunStatus,
    SyncSource,
)
from rating_app.sync import answers, decisions, policies, questions, review, selection
from rating_app.sync import console as text
from rating_app.sync.apply import SyncApplyInputError
from rating_app.sync.constants import SWITCH_NAME
from rating_app.sync.kinds import KIND_BY_NAME, KINDS, NEVER_AUTO_KINDS

GROUPS = ("new", "link", "change", "mapping", "removed", review.OTHER_GROUP)
DRY_RUN = "Пробний запуск, нічого не записано."
TO_WRITE = "Щоб записати: додайте --yes."


class Command(BaseCommand):
    help = (
        "Read and decide sync changes from UKMA Data. Dry run unless --yes. "
        "Runbook: docs/runbooks/catalog-sync-console.md"
    )

    def add_arguments(self, parser: ArgumentParser) -> None:
        sub = parser.add_subparsers(dest="action", required=True)

        status = sub.add_parser("status", help="What the last read found and what waits")
        status.add_argument("--json", action="store_true")

        show = sub.add_parser("show", help="One line per waiting change")
        self._selection_args(show)
        show.add_argument("--state", choices=[s.value for s in SyncChangeState], default="proposed")
        show.add_argument("--limit", type=int, default=20)
        show.add_argument("--json", action="store_true")

        for name, label in (("apply", "Apply"), ("reject", "Reject")):
            decide = sub.add_parser(name, help=f"{label} a selection (dry run unless --yes)")
            self._selection_args(decide)
            self._write_args(decide)
            decide.add_argument("--exclude", default="", help="Ids to leave out: 1,2,3")
            decide.add_argument("--limit", type=int, default=20, help="Changes to list; 0 = all")
            if name == "apply":
                decide.add_argument("--confirm-stale", action="store_true")

        answer = sub.add_parser("answer", help="Answer a mapping question (dry run unless --yes)")
        answer.add_argument("words", nargs="+", help="<id> <choice>, or <choice> with --unrated")
        answer.add_argument("--into", default=None, help="Course id for merge or place")
        answer.add_argument("--unrated", action="store_true", help="Every unrated question")
        self._write_args(answer)

        policy = sub.add_parser("policy", help="List policies, or set one kind")
        policy.add_argument("kind", nargs="?")
        policy.add_argument("mode", nargs="?", choices=["auto", "needs_approval"])
        policy.add_argument("--json", action="store_true")
        self._write_args(policy)

    def _selection_args(self, parser: ArgumentParser) -> None:
        parser.add_argument("--source", choices=[s.value for s in SyncSource], default="catalog")
        parser.add_argument("--group", choices=GROUPS)
        parser.add_argument("--kind", choices=sorted(KIND_BY_NAME))
        parser.add_argument("--q", default=None, help="Title or САЗ code")
        rated = parser.add_mutually_exclusive_group()
        rated.add_argument("--rated", dest="rated", action="store_const", const=True)
        rated.add_argument("--unrated", dest="rated", action="store_const", const=False)
        parser.add_argument("--ids", default="", help="Change ids: 48121,48122")

    def _write_args(self, parser: ArgumentParser) -> None:
        parser.add_argument("--yes", action="store_true", help="Write; without it a dry run")
        parser.add_argument("--by", default=None, help="Username of the deciding superuser")

    def handle(self, *args: Any, **options: Any) -> None:
        action = options["action"]
        handlers: dict[str, Callable[[dict[str, Any]], None]] = {
            "status": self._status,
            "show": self._show,
            "apply": self._apply,
            "reject": self._reject,
            "answer": self._answer,
            "policy": self._policy,
        }
        handlers[action](options)

    def _say(self, *lines: str) -> None:
        for line in lines:
            self.stdout.write(line)

    def _json(self, payload: Any) -> None:
        self.stdout.write(json.dumps(payload, ensure_ascii=False, indent=2, default=str))

    # status ------------------------------------------------------------------

    def _status(self, options: dict[str, Any]) -> None:
        payload = {
            "sources": {source: _source_status(source) for source in SyncSource},
            "applied_7_days": _applied_week(),
            "catalog_switch_on": waffle.switch_is_active(SWITCH_NAME),
            "auto_kinds": sorted(
                SyncPolicy.objects.filter(mode="auto").values_list("kind", flat=True)
            ),
        }
        if options["json"]:
            self._json(payload)
            return
        catalog = payload["sources"][SyncSource.CATALOG]
        self._say(*_source_lines("Каталог", catalog))
        teachers = payload["sources"][SyncSource.TEACHERS]
        self._say(
            f"Викладачі: останнє читання {text.ago(teachers['finished_at'])}, "
            f"чекають {text.number(teachers['waiting'])}."
        )
        week = payload["applied_7_days"]
        line = (
            f"Застосовано за 7 днів: {week['decisions']} рішень, "
            f"{text.changes_word(week['changes'])}"
        )
        if week["last_at"] is not None:
            line += f" (останнє {text.ago(week['last_at'])}, {week['last_by'] or 'авто'})"
        self._say(line + ".")
        switch = "увімкнено" if payload["catalog_switch_on"] else "вимкнено"
        self._say(f"Нічне читання каталогу (перемикач {SWITCH_NAME}): {switch}.")
        auto = payload["auto_kinds"]
        self._say(
            "Авто-правила: " + (", ".join(auto) if auto else "немає, усе чекає рішення") + "."
        )

    # show --------------------------------------------------------------------

    def _show(self, options: dict[str, Any]) -> None:
        run = _current_run(options["source"])
        changes = SyncChange.objects.filter(run=run, state=options["state"])
        ids = _ids(options["ids"])
        if ids:
            changes = changes.filter(pk__in=ids)
        changes = _narrow(changes, options)
        total = changes.count()
        limit = options["limit"]
        page = list(changes.order_by("-ratings", "id")[: limit if limit > 0 else None])
        mapping = {
            question.change.pk: question
            for question in questions.question_rows(run)
            if question.change.pk in {change.pk for change in page}
        }
        if options["json"]:
            self._json(
                {
                    "run_id": run.pk,
                    "total": total,
                    "items": [
                        text.question_json(mapping[change.pk])
                        if change.pk in mapping
                        else text.change_json(change)
                        for change in page
                    ],
                }
            )
            return
        label = text.GROUP_LABELS.get(options["group"] or "", "Зміни")
        state = text.state_text(options["state"])
        self._say(f"{label}, {text.number(total)} ({state}), показано {len(page)}:")
        if options["group"]:
            self._say(f"  Що це: {text.GROUP_HINTS[options['group']]}.")
        for change in page:
            question = mapping.get(change.pk)
            lines = text.question_lines(question) if question else text.change_lines(change)
            self._say(*(f"  {line}" for line in lines))
        if total > len(page):
            self._say(f"Ще {text.number(total - len(page))}. Далі: --limit 50 або --q «назва».")

    # apply / reject ------------------------------------------------------------

    def _apply(self, options: dict[str, Any]) -> None:
        self._decide(options, reject=False)

    def _reject(self, options: dict[str, Any]) -> None:
        self._decide(options, reject=True)

    def _decide(self, options: dict[str, Any], *, reject: bool) -> None:
        user = _decider(options)
        dry_run = not options["yes"]
        run = _current_run(options["source"])
        ids, excluded = _selected(run, options)
        if not ids:
            raise CommandError("Під цю вибірку не підходить жодна зміна, що чекає рішення.")
        try:
            if reject:
                result = decisions.reject(ids, user, dry_run=dry_run)
            else:
                result = decisions.approve(
                    ids,
                    user,
                    dry_run=dry_run,
                    confirm_stale=options["confirm_stale"],
                    group=options["group"] or "",
                    kind=options["kind"] or "",
                    excluded=excluded,
                )
        except SyncApplyInputError as exc:
            raise CommandError(decisions.input_error_text(exc)) from exc
        if result.outcome == SyncApprovalOutcome.REFUSED:
            raise CommandError("Відмовлено: " + decisions.refusal_text(result.error, run))
        if result.outcome == SyncApprovalOutcome.FAILED:
            raise CommandError(
                f"Не вдалося застосувати, нічого не записано ({result.error}). "
                "Див. розділ «Збій» у runbook."
            )
        if dry_run:
            self._say(DRY_RUN)
        self._say(*text.decision_lines(result, limit=options["limit"]))
        superseded = int(result.counts.get("superseded") or 0)
        if reject and superseded:
            self._say(f"Разом із ними неактуальними стануть залежні: {superseded}.")
        if dry_run:
            self._say(TO_WRITE)
            return
        if reject:
            self._say(
                f"Рішення #{result.approval_id}. Відхилені повернуться з наступним "
                "читанням, якщо САЗ не зміниться."
            )
        else:
            self._say(f"Рішення #{result.approval_id}. Кеш сайту оновиться після запису.")

    # answer --------------------------------------------------------------------

    def _answer(self, options: dict[str, Any]) -> None:
        user = _decider(options)
        dry_run = not options["yes"]
        words = options["words"]
        if options["unrated"]:
            if words != ["keep_apart"]:
                raise CommandError("З --unrated єдина відповідь: keep_apart.")
            count = _maybe_rolled_back(lambda: answers.keep_apart_unrated(user), dry_run)
            if dry_run:
                self._say(DRY_RUN)
            verb = "Позначило б" if dry_run else "Позначено"
            self._say(f"{verb} «лишити окремо» {text.number(count)} питань без оцінок і планів.")
            if dry_run:
                self._say(TO_WRITE)
            return
        if len(words) != 2 or not words[0].lstrip("#").isdigit():
            raise CommandError("Формат: answer <id> <відповідь>, напр. answer 50011 keep_apart.")
        change = SyncChange.objects.filter(pk=int(words[0].lstrip("#"))).first()
        if change is None:
            raise CommandError(f"Зміни #{words[0]} немає.")
        choice = words[1]
        allowed = sorted(answers.ANSWERS_BY_KIND.get(change.kind, ()))
        if change.kind in answers.MAPPING_KINDS and choice not in allowed:
            raise CommandError(f"Для цього питання відповіді: {' | '.join(allowed)}.")
        try:
            decision = _maybe_rolled_back(
                lambda: answers.answer_change(change, choice, user, into=options["into"]),
                dry_run,
            )
        except answers.MappingAnswerError as exc:
            raise CommandError(str(exc)) from exc
        if dry_run:
            self._say(DRY_RUN)
        verb = "Записало б" if dry_run else "Відповідь записано"
        self._say(f"{verb}: #{change.pk} {text.change_title(change)} → {decision.answer}.")
        self._say(
            f"Оцінок зараз: {decision.premise.get('ratings', 0)}. "
            "Зміна застосується, коли ви запустите apply для неї."
            if choice not in answers.SETTLING_ANSWERS.values()
            else "Питання закрите: нічого не переноситься."
        )
        if dry_run:
            self._say(TO_WRITE)

    # policy --------------------------------------------------------------------

    def _policy(self, options: dict[str, Any]) -> None:
        if options["kind"] is None:
            self._policy_list(options["json"])
            return
        kind, mode = options["kind"], options["mode"]
        if kind not in KIND_BY_NAME:
            raise CommandError(f"Невідомий тип змін: {kind}. Список: catalog_sync policy.")
        if mode is None:
            raise CommandError("Вкажіть режим: auto або needs_approval.")
        label = text.POLICY_LABELS.get(kind, kind)
        if mode == "auto" and kind in NEVER_AUTO_KINDS:
            raise CommandError(
                f"«{label}» не може бути авто: питання й зміни, що переносять оцінки, "
                "завжди вирішує людина."
            )
        user = _decider(options)
        dry_run = not options["yes"]
        old = policies.mode_for(kind)
        try:
            _maybe_rolled_back(lambda: policies.set_mode(kind, mode, user), dry_run)
        except ValueError as exc:
            raise CommandError(str(exc)) from exc
        if dry_run:
            self._say(DRY_RUN)
        verb = "Змінило б" if dry_run else "Змінено"
        if old == mode:
            self._say(f"«{label}» вже {text.MODE_TEXT[mode]}, нічого не змінюється.")
        else:
            self._say(f"{verb}: «{label}» {text.MODE_TEXT[old]} → {text.MODE_TEXT[mode]}.")
        if dry_run:
            self._say(TO_WRITE)

    def _policy_list(self, as_json: bool) -> None:
        rows = {policy.kind: policy for policy in SyncPolicy.objects.select_related("updated_by")}
        items = []
        for kind in KINDS:
            policy = rows.get(kind.name)
            items.append(
                {
                    "kind": kind.name,
                    "group": kind.group,
                    "mode": policy.mode if policy else "needs_approval",
                    "never_auto": kind.name in NEVER_AUTO_KINDS,
                    "updated_by": policy.updated_by.username if policy else None,
                    "updated_at": policy.updated_at if policy else None,
                }
            )
        if as_json:
            self._json(items)
            return
        self._say(f"{'Тип змін':<32}{'Режим':<20}{'Код':<22}Хто змінив")
        for item in items:
            mode = "лише вручну" if item["never_auto"] else text.MODE_TEXT[item["mode"]]
            who = (
                f"{item['updated_by']}, {text.ago(item['updated_at'])}"
                if item["updated_by"]
                else ""
            )
            label = text.POLICY_LABELS.get(item["kind"], item["kind"])
            self._say(f"{label:<32}{mode:<20}{item['kind']:<22}{who}"[: text.WIDTH].rstrip())


def _maybe_rolled_back[T](call: Callable[[], T], dry_run: bool) -> T:
    """Run the same service call; a dry run rolls its writes back."""
    if not dry_run:
        return call()
    with transaction.atomic():
        result = call()
        transaction.set_rollback(True)
    return result


def _decider(options: dict[str, Any]) -> User:
    name = options["by"]
    if not name:
        raise CommandError(
            "Вкажіть --by <username>: хто ухвалює рішення (потрібно і для пробного запуску)."
        )
    user = User.objects.filter(Q(username=name) | Q(email=name)).first()
    if user is None:
        raise CommandError(f"Користувача «{name}» не знайдено.")
    if not user.is_superuser or not user.is_active:
        raise CommandError(f"«{name}» не адміністратор: рішення ухвалюють лише адміністратори.")
    return user


def _current_run(source: str) -> SyncRun:
    run = decisions.current_run(source)
    if run is None:
        raise CommandError("Успішних читань САЗ ще не було: вирішувати нічого.")
    return run


def _ids(value: str) -> list[int]:
    parts = [part.strip().lstrip("#") for part in value.split(",") if part.strip()]
    if not all(part.isdigit() for part in parts):
        raise CommandError(f"Некоректні id: {value}. Формат: 48121,48122.")
    return [int(part) for part in parts]


def _narrow(changes: Any, options: dict[str, Any]) -> Any:
    if options["group"]:
        changes = review.in_group(changes, options["group"])
    if options["kind"]:
        changes = changes.filter(kind=options["kind"])
    if options["rated"] is not None:
        changes = changes.filter(ratings__gt=0) if options["rated"] else changes.filter(ratings=0)
    if options["q"]:
        changes = changes.filter(pk__in=review.search_ids(changes, options["q"]))
    return changes


def _selected(run: SyncRun, options: dict[str, Any]) -> tuple[list[int], list[int]]:
    """The ids an apply or reject takes: `--ids`, or the waiting changes of a group."""
    excluded = _ids(options["exclude"])
    ids = _ids(options["ids"])
    if ids:
        return [change_id for change_id in ids if change_id not in excluded], excluded
    if not options["group"]:
        raise CommandError("Виберіть зміни: --group <група> або --ids 1,2,3.")
    filters = {
        "group": options["group"],
        "kind": options["kind"],
        "rated": options["rated"],
        "q": options["q"],
        "exclude_ids": excluded,
    }
    return selection.filter_ids(run, options["source"], filters), excluded


def _source_status(source: str) -> dict[str, Any]:
    latest = decisions.latest_run(source)
    current = decisions.current_run(source)
    waiting: dict[str, dict[str, int]] = {}
    total = 0
    if current is not None:
        rows = (
            SyncChange.objects.filter(run=current, state=SyncChangeState.PROPOSED)
            .values("group", "kind")
            .annotate(count=Count("id"))
        )
        for row in rows:
            waiting.setdefault(row["group"], {})[row["kind"]] = row["count"]
            total += row["count"]
    return {
        "run_id": None if current is None else current.pk,
        "finished_at": None if current is None else current.finished_at,
        "started_at": None if current is None else current.started_at,
        "data_updated_at": None if current is None else current.data_updated_at,
        "age_hours": None if current is None else decisions.age_hours(current),
        "waiting": total,
        "waiting_by_group": waiting,
        "skipped": {} if current is None else review.not_proposed(current),
        "latest_failed": None
        if latest is None or latest.status != SyncRunStatus.FAILED
        else {"run_id": latest.pk, "error": latest.error, "at": latest.started_at},
    }


def _source_lines(name: str, status: dict[str, Any]) -> list[str]:
    lines: list[str] = []
    failed = status["latest_failed"]
    if failed is not None:
        lines.append(
            f"{name}: останнє читання #{failed['run_id']} НЕ вдалося "
            f"({failed['error']}), {text.ago(failed['at'])}. Діють зміни попереднього."
        )
    if status["run_id"] is None:
        return [*lines, f"{name}: успішних читань САЗ ще не було."]
    took = ""
    if status["finished_at"] and status["started_at"]:
        seconds = (status["finished_at"] - status["started_at"]).total_seconds()
        minutes = max(0, round(seconds / 60))
        took = f", тривало {minutes} хв"
    lines.append(
        f"{name}: читання САЗ #{status['run_id']} завершилось "
        f"{text.ago(status['finished_at'])}{took}."
    )
    if status["data_updated_at"]:
        lines.append(f"Дані САЗ станом на {text.stamp(status['data_updated_at'])}.")
    if (status["age_hours"] or 0) > 48:
        lines.append("Увага: дані старші за 48 год, apply попросить --confirm-stale.")
    lines.append(f"Чекають рішення: {text.changes_word(status['waiting'])}")
    for group in GROUPS:
        kinds = status["waiting_by_group"].get(group)
        if not kinds:
            continue
        count = sum(kinds.values())
        label = text.GROUP_LABELS[group]
        line = f"  {label:<16}{text.number(count):>7}  ({text.kind_breakdown(kinds)})"
        lines.append(line[: text.WIDTH])
    skipped = status["skipped"]
    if skipped:
        parts = [
            f"{text.SKIP_REASON_TEXT.get(reason, reason)} {value['count']}"
            for reason, value in skipped.items()
            if value["count"]
        ]
        if parts:
            lines.extend(
                textwrap.wrap(
                    "Не запропоновано (сайт не може зберегти такі рядки САЗ): " + ", ".join(parts),
                    width=text.WIDTH,
                    subsequent_indent="  ",
                )
            )
    return lines


def _applied_week() -> dict[str, Any]:
    since = timezone.now() - timedelta(days=7)
    approvals = SyncApproval.objects.filter(
        created_at__gte=since, outcome=SyncApprovalOutcome.APPLIED, action="apply"
    ).select_related("user")
    last = approvals.order_by("-created_at", "-id").first()
    changes = SyncChange.objects.filter(
        approval__in=approvals, state=SyncChangeState.APPLIED
    ).count()
    return {
        "decisions": approvals.count(),
        "changes": changes,
        "last_at": None if last is None else last.created_at,
        "last_by": None if last is None or last.user is None else last.user.username,
    }
