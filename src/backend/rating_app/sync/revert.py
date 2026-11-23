"""Undo one applied decision by writing its changes' ``before`` back.

A revert is a new ``SyncApproval`` (action ``revert``) pointing at the original
through ``reverts``. It is all-or-nothing: the dry run lists every blocker with a
Ukrainian reason and writes nothing, and a write with any blocker refuses. The
reverted changes keep their original ``approval`` foreign key and move to the
``reverted`` state, so history still counts them under the decision that applied
them. A relink or move also supersedes its live mapping answer, or the builder
would propose it again.
"""

from __future__ import annotations

import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from typing import Any, cast

from django.contrib.auth.models import User
from django.db import connection, transaction
from django.utils import timezone

import structlog

from rating_app.models import (
    CatalogMappingDecision,
    Course,
    CourseOffering,
    CourseOfferingSpeciality,
    CourseOfferingTerm,
    Department,
    Faculty,
    Semester,
    Speciality,
    SyncApproval,
    SyncApprovalAction,
    SyncApprovalOutcome,
    SyncApprovalScope,
    SyncChange,
    SyncChangeState,
    SyncPolicyMode,
)
from rating_app.scheduler.lock import advisory_lock
from rating_app.sync import drafts
from rating_app.sync.apply import LOCK_KEYS, clear_cache_on_commit
from rating_app.sync.current_values import TargetMissingError, current_values
from rating_app.sync.fields import FIELD_LABELS
from rating_app.sync.handlers.mapping import recompute_aggregates
from rating_app.sync.kinds import KIND_BY_NAME
from rating_app.sync.policies import mode_for
from rating_app.sync.snapshot import RateUkmaSnapshot, load_rate_ukma_snapshot

logger = structlog.get_logger(__name__)

REVERTIBLE_KINDS: frozenset[str] = frozenset(
    kind for kind in KIND_BY_NAME if kind.startswith(("link_", "change_"))
) | frozenset({"relink_course", "move_offering"})

_WHOLE_CATALOG_KINDS = frozenset(
    {"link_faculty", "change_faculty", "link_department", "change_department"}
)

MANUAL_NEW_TEXT = "Лише вручну: нові записи вже можуть мати оцінки."
MANUAL_BACKUP_TEXT = "Лише вручну, з резервної копії бази."
MANUAL_TEACHERS_TEXT = "Лише вручну: зміни викладачів не відкочуються."
PLANS_TEXT = "Лише вручну: при переносі об'єднано плани."
AUTO_TEXT = (
    "Цей тип застосовується автоматично. Спершу переведіть його в «Потребує рішення» "
    "(catalog_sync policy)."
)

REFUSAL_TEXT: dict[str, str] = {
    "unknown_approval": "Рішення не знайдено.",
    "not_an_apply": "Відкотити можна лише застосоване рішення.",
    "not_applied": "Це рішення нічого не застосувало.",
    "already_reverted": "Це рішення вже відкочено.",
    "nothing_to_revert": "Нічого відкочувати: ці зміни нічого не записали.",
    "lock_held": "Синхронізація саме триває (нічне читання або інше застосування). "
    "Спробуйте за кілька хвилин.",
}


@dataclass(frozen=True)
class RevertBlocker:
    change_id: int
    kind: str
    reason: str
    text: str


@dataclass
class RevertResult:
    original_id: int
    dry_run: bool
    approval_id: int | None = None
    outcome: str = SyncApprovalOutcome.REFUSED
    error: str = ""
    change_ids: list[int] = field(default_factory=list)
    blockers: list[RevertBlocker] = field(default_factory=list)
    counts: dict[str, Any] = field(default_factory=dict)

    def refusal_text(self) -> str:
        return refusal_text(self.error)


def refusal_text(reason: str) -> str:
    return REFUSAL_TEXT.get(reason, reason or "Не вдалося відкотити рішення")


def kind_policy(kind: str) -> tuple[str, str]:
    """``write``, ``skip`` for a change that wrote nothing, or ``manual``."""
    if kind.startswith("removed_"):
        return "skip", ""
    if kind in REVERTIBLE_KINDS:
        return "write", ""
    if kind.startswith("new_"):
        return "manual", MANUAL_NEW_TEXT
    if kind in {"merge_courses", "place_offering"}:
        return "manual", MANUAL_BACKUP_TEXT
    if kind.startswith("teacher_"):
        return "manual", MANUAL_TEACHERS_TEXT
    return "manual", MANUAL_BACKUP_TEXT


def revert(approval_id: int, user: User, *, dry_run: bool) -> RevertResult:
    """Write the original approval's ``before`` values back, or list the blockers."""
    original = SyncApproval.objects.select_related("run").filter(pk=approval_id).first()
    if original is None:
        return RevertResult(original_id=approval_id, dry_run=dry_run, error="unknown_approval")
    if original.action != SyncApprovalAction.APPLY:
        return RevertResult(original_id=approval_id, dry_run=dry_run, error="not_an_apply")
    if original.outcome != SyncApprovalOutcome.APPLIED:
        return RevertResult(original_id=approval_id, dry_run=dry_run, error="not_applied")
    if _reverted_by(original) is not None:
        return RevertResult(original_id=approval_id, dry_run=dry_run, error="already_reverted")
    applied = _applied_changes(original)
    if not applied:
        return RevertResult(original_id=approval_id, dry_run=dry_run, error="nothing_to_revert")
    source = _source(original, applied)
    if source is None:
        return RevertResult(original_id=approval_id, dry_run=dry_run, error="nothing_to_revert")

    approval = _start(original, applied, user)
    changes = applied
    writable = [change for change in applied if kind_policy(change.kind)[0] == "write"]
    try:
        with _source_lock(source) as held:
            if not held:
                return _refuse(approval, "lock_held", applied, dry_run)
            changes = _applied_changes(original)
            writable = [change for change in changes if kind_policy(change.kind)[0] == "write"]
            blockers = _blockers(original, changes)
            if blockers:
                return _refuse(approval, "revert_blocked", writable, dry_run, blockers=blockers)
            if not writable:
                return _refuse(approval, "nothing_to_revert", [], dry_run)
            with transaction.atomic():
                _write_back(writable)
                connection.check_constraints()
                now = timezone.now()
                _mark_reverted(writable, now)
                _supersede_decisions(writable, now)
                approval.outcome = SyncApprovalOutcome.APPLIED
                approval.counts = {
                    "reverted": len(writable),
                    "skipped": len(changes) - len(writable),
                }
                approval.save(update_fields=["outcome", "counts"])
                clear_cache_on_commit(original.run_ref)
    except Exception as exc:
        approval.outcome = SyncApprovalOutcome.FAILED
        approval.error = f"revert_failed:{type(exc).__name__}"
        approval.save(update_fields=["outcome", "error"])
        logger.error(
            "sync_revert_failed",
            approval_id=approval.pk,
            original_id=original.pk,
            error=type(exc).__name__,
        )
    else:
        logger.info(
            "sync_approval_reverted",
            approval_id=approval.pk,
            original_id=original.pk,
            change_ids=[change.pk for change in writable],
        )
    return RevertResult(
        original_id=original.pk,
        dry_run=dry_run,
        approval_id=None if dry_run else approval.pk,
        outcome=str(approval.outcome),
        error=str(approval.error or ""),
        change_ids=[change.pk for change in writable],
        counts=dict(approval.counts or {}),
    )


def quick_verdict(approval: SyncApproval) -> tuple[bool, str]:
    """Whether history can offer «Відкотити»; the dry run still finds blockers."""
    if approval.action != SyncApprovalAction.APPLY:
        return False, REFUSAL_TEXT["not_an_apply"]
    if approval.outcome != SyncApprovalOutcome.APPLIED:
        return False, REFUSAL_TEXT["not_applied"]
    if _reverted_by(approval) is not None:
        return False, REFUSAL_TEXT["already_reverted"]
    kinds = set(
        SyncChange.objects.filter(approval=approval, state=SyncChangeState.APPLIED)
        .values_list("kind", flat=True)
        .distinct()
    )
    writes = False
    for kind in sorted(kinds):
        state, text = kind_policy(kind)
        if state == "manual":
            return False, text
        if state == "write":
            writes = True
            if mode_for(kind) == SyncPolicyMode.AUTO:
                return False, AUTO_TEXT
    if not writes:
        return False, REFUSAL_TEXT["nothing_to_revert"]
    return True, ""


def _applied_changes(original: SyncApproval) -> list[SyncChange]:
    return list(
        SyncChange.objects.filter(approval=original, state=SyncChangeState.APPLIED).order_by("pk")
    )


def _reverted_by(original: SyncApproval) -> int | None:
    return (
        SyncApproval.objects.filter(
            reverts=original,
            action=SyncApprovalAction.REVERT,
            outcome=SyncApprovalOutcome.APPLIED,
        )
        .order_by("pk")
        .values_list("pk", flat=True)
        .first()
    )


def _source(original: SyncApproval, changes: list[SyncChange]) -> str | None:
    if original.run is not None:
        return str(original.run.source)
    sources = {str(change.source) for change in changes}
    return sources.pop() if len(sources) == 1 else None


def _start(original: SyncApproval, changes: list[SyncChange], user: User) -> SyncApproval:
    return SyncApproval.objects.create(
        run=original.run,
        run_ref=original.run_ref,
        action=SyncApprovalAction.REVERT,
        scope=SyncApprovalScope.CHANGE,
        change_ids=[change.pk for change in changes],
        user=user,
        reverts=original,
        outcome=SyncApprovalOutcome.STARTED,
    )


def _refuse(
    approval: SyncApproval,
    reason: str,
    changes: list[SyncChange],
    dry_run: bool,
    *,
    blockers: list[RevertBlocker] | None = None,
) -> RevertResult:
    blocking = blockers or []
    approval.outcome = SyncApprovalOutcome.REFUSED
    approval.error = reason
    approval.counts = {"blockers": len(blocking)}
    approval.save(update_fields=["outcome", "error", "counts"])
    logger.info(
        "sync_revert_refused",
        approval_id=approval.pk,
        original_id=approval.reverts_id,
        reason=reason,
        blockers=len(blocking),
    )
    return RevertResult(
        original_id=approval.reverts_id or 0,
        dry_run=dry_run,
        approval_id=None if dry_run else approval.pk,
        outcome=str(approval.outcome),
        error=reason,
        change_ids=[change.pk for change in changes],
        blockers=blocking,
        counts=dict(approval.counts or {}),
    )


def _blockers(original: SyncApproval, changes: list[SyncChange]) -> list[RevertBlocker]:
    blockers: list[RevertBlocker] = []
    revertible = [change for change in changes if kind_policy(change.kind)[0] == "write"]
    later = _later_touches(original, revertible)
    snapshot = _snapshot(revertible)
    plans = _moved_plans(original)
    modes: dict[str, str] = {}
    for change in changes:
        state, text = kind_policy(change.kind)
        if state == "skip":
            continue
        if state == "manual":
            blockers.append(_blocker(change, "manual", text))
            continue
        if change.kind not in modes:
            modes[change.kind] = mode_for(change.kind)
        if modes[change.kind] == SyncPolicyMode.AUTO:
            blockers.append(_blocker(change, "auto", AUTO_TEXT))
        if change.kind == "move_offering" and plans != 0:
            blockers.append(_blocker(change, "plans", PLANS_TEXT))
        other = later.get(change.pk)
        if other is not None:
            blockers.append(
                _blocker(
                    change,
                    "later",
                    f"спершу відкотіть рішення #{other} (пізніше застосоване)",
                )
            )
        field = _changed_field(change, snapshot)
        if field is not None:
            blockers.append(
                _blocker(
                    change,
                    "changed",
                    f"запис змінився після застосування ({FIELD_LABELS.get(field, field)})",
                )
            )
    return blockers


def _blocker(change: SyncChange, reason: str, text: str) -> RevertBlocker:
    return RevertBlocker(change_id=change.pk, kind=change.kind, reason=reason, text=text)


def _moved_plans(original: SyncApproval) -> int | None:
    counts = original.counts if isinstance(original.counts, dict) else {}
    value = counts.get("plans_deduplicated_by_move")
    return value if isinstance(value, int) else None


def _snapshot(changes: list[SyncChange]) -> RateUkmaSnapshot | None:
    target_ids = {change.target_id for change in changes if change.target_id}
    if not target_ids:
        return None
    if any(change.kind in _WHOLE_CATALOG_KINDS for change in changes):
        return load_rate_ukma_snapshot()
    return load_rate_ukma_snapshot(offering_ids=target_ids, course_ids=target_ids)


def _changed_field(change: SyncChange, snapshot: RateUkmaSnapshot | None) -> str | None:
    if change.target_id is None or snapshot is None:
        return "record"
    try:
        values = current_values(change.kind, snapshot, change.target_id)
    except TargetMissingError:
        return "record"
    for key, recorded in _written(change).items():
        if key == "specialities_added":
            if not _specialities_present(values.get(key), recorded):
                return key
            continue
        if key not in values or drafts.differs(change.kind, key, values[key], recorded):
            return key
    return None


def _written(change: SyncChange) -> dict[str, Any]:
    """The values the apply wrote, keyed like the snapshot's ``current_values``."""
    before = change.before if isinstance(change.before, dict) else {}
    after = cast(dict[str, Any], change.after) if isinstance(change.after, dict) else {}
    written = {key: after[key] for key in before if key in after}
    if change.kind == "move_offering":
        written["from_course"] = after.get("to_course_id")
    return written


def _specialities_present(current: object, recorded: object) -> bool:
    return _speciality_pairs(recorded) <= _speciality_pairs(current)


def _speciality_pairs(value: object) -> set[tuple[str, str]]:
    if not isinstance(value, list):
        return set()
    rows = cast(list[object], value)
    return {
        (str(row.get("name")), str(row.get("kind")))
        for row in rows
        if isinstance(row, dict) and row.get("name") is not None
    }


def _later_touches(original: SyncApproval, changes: list[SyncChange]) -> dict[int, int]:
    """Our change id -> the later applied approval that touched it or needs it."""
    targets = {change.target_id for change in changes if change.target_id}
    pairs = {(change.kind, change.key) for change in changes}
    if not targets and not pairs:
        return {}
    reverted_ids = [
        pk
        for pk in SyncApproval.objects.filter(
            action=SyncApprovalAction.REVERT,
            outcome=SyncApprovalOutcome.APPLIED,
            reverts__isnull=False,
        ).values_list("reverts_id", flat=True)
        if pk is not None
    ]
    later = (
        SyncApproval.objects.filter(
            pk__gt=original.pk,
            action=SyncApprovalAction.APPLY,
            outcome=SyncApprovalOutcome.APPLIED,
        )
        .exclude(pk__in=reverted_ids)
        .order_by("pk")
    )
    by_target: dict[str, int] = {}
    by_pair: dict[tuple[str, str], int] = {}
    rows = (
        SyncChange.objects.filter(approval__in=later, state=SyncChangeState.APPLIED)
        .order_by("approval_id", "pk")
        .values_list("approval_id", "target_id", "requires")
    )
    for approval_id, target_id, requires in rows:
        if target_id is not None and target_id in targets:
            by_target.setdefault(target_id, approval_id)
        for entry in requires or []:
            pair = _pair(entry)
            if pair is not None and pair in pairs:
                by_pair.setdefault(pair, approval_id)
    touches: dict[int, int] = {}
    for change in changes:
        other = by_target.get(change.target_id or "")
        if other is None:
            other = by_pair.get((change.kind, change.key))
        if other is not None:
            touches[change.pk] = other
    return touches


def _pair(entry: object) -> tuple[str, str] | None:
    if not isinstance(entry, dict):
        return None
    kind = entry.get("kind")
    key = entry.get("key")
    if isinstance(kind, str) and isinstance(key, str):
        return kind, key
    return None


_COURSE_FIELDS = ("title", "education_level", "status", "description")
_OFFERING_FIELDS = (
    "exam_type",
    "study_year",
    "max_students",
    "max_groups",
    "group_size_min",
    "group_size_max",
)


def _write_back(changes: list[SyncChange]) -> None:
    for change in changes:
        if kind_policy(change.kind)[0] != "write":
            continue
        pk = _uuid(change.target_id)
        if pk is None:
            raise ValueError(f"revert_target_missing:{change.pk}")
        before = change.before if isinstance(change.before, dict) else {}
        if change.kind == "link_faculty":
            Faculty.objects.filter(pk=pk).update(ukma_data_id=before.get("ukma_data_id"))
        elif change.kind == "link_department":
            Department.objects.filter(pk=pk).update(ukma_data_id=before.get("ukma_data_id"))
        elif change.kind in {"link_course", "relink_course"}:
            Course.objects.filter(pk=pk).update(ukma_data_id=before.get("ukma_data_id"))
        elif change.kind == "link_offering":
            CourseOffering.objects.filter(pk=pk).update(ukma_data_id=before.get("ukma_data_id"))
        elif change.kind == "change_faculty":
            Faculty.objects.filter(pk=pk).update(name=before.get("name"))
        elif change.kind == "change_department":
            Department.objects.filter(pk=pk).update(name=before.get("name"))
        elif change.kind == "change_course":
            _restore_course(pk, before)
        elif change.kind == "change_offering":
            _restore_offering(pk, before)
            _restore_specialities(change, pk)
        elif change.kind == "move_offering":
            _restore_move(pk, change)
        else:
            raise ValueError(f"revert_kind_unhandled:{change.kind}")


def _restore_course(pk: uuid.UUID, before: dict[str, Any]) -> None:
    values = {
        name: before[name] for name in _COURSE_FIELDS if name in before and before[name] is not None
    }
    department = before.get("department")
    if isinstance(department, dict) and department.get("id") is not None:
        department_id = _uuid(str(department["id"]))
        if department_id is not None:
            values["department_id"] = department_id
    if values:
        Course.objects.filter(pk=pk).update(**values)


def _restore_offering(pk: uuid.UUID, before: dict[str, Any]) -> None:
    values = {name: before[name] for name in _OFFERING_FIELDS if name in before}
    semester = before.get("semester")
    if isinstance(semester, dict):
        values["semester_id"] = _semester(semester.get("year"), str(semester.get("term") or "")).id
    if values:
        CourseOffering.objects.filter(pk=pk).update(**values)
    terms = before.get("terms")
    if isinstance(terms, list):
        _restore_terms(pk, cast(list[object], terms))


def _restore_terms(offering_id: uuid.UUID, terms: list[object]) -> None:
    CourseOfferingTerm.objects.filter(offering_id=offering_id).delete()
    rows = []
    for term in terms:
        if not isinstance(term, dict):
            continue
        semester = _semester(term.get("year"), str(term.get("term") or ""))
        rows.append(
            CourseOfferingTerm(
                offering_id=offering_id,
                semester_id=semester.id,
                credits=Decimal(str(term.get("credits") or 0)),
                weekly_hours=term.get("weekly_hours") or 0,
                lecture_count=term.get("lecture_count"),
                practice_count=term.get("practice_count"),
                practice_type=str(term.get("practice_type") or ""),
                exam_type=str(term.get("exam_type") or ""),
            )
        )
    if rows:
        CourseOfferingTerm.objects.bulk_create(rows, ignore_conflicts=True)


def _restore_specialities(change: SyncChange, offering_id: uuid.UUID) -> None:
    after = change.after if isinstance(change.after, dict) else {}
    before = change.before if isinstance(change.before, dict) else {}
    added = _speciality_pairs(after.get("specialities_added")) - _speciality_pairs(
        before.get("specialities_added")
    )
    if not added:
        return
    speciality_ids = dict(
        Speciality.objects.filter(name__in={name for name, _ in added}).values_list("name", "id")
    )
    doomed = [
        row.pk
        for row in CourseOfferingSpeciality.objects.filter(
            offering_id=offering_id, speciality_id__in=speciality_ids.values()
        ).select_related("speciality")
        if (row.speciality.name, row.type_kind) in added
    ]
    if doomed:
        CourseOfferingSpeciality.objects.filter(pk__in=doomed).delete()


def _restore_move(pk: uuid.UUID, change: SyncChange) -> None:
    before = change.before if isinstance(change.before, dict) else {}
    after = change.after if isinstance(change.after, dict) else {}
    source_id = _uuid(str(before.get("from_course") or ""))
    left_id = _uuid(str(after.get("to_course_id") or ""))
    if source_id is None:
        raise ValueError(f"revert_move_source_missing:{change.pk}")
    CourseOffering.objects.filter(pk=pk).update(course_id=source_id)
    for course_id in (source_id, left_id):
        if course_id is not None and Course.objects.filter(pk=course_id).exists():
            recompute_aggregates(course_id)


def _mark_reverted(changes: list[SyncChange], now: datetime) -> None:
    SyncChange.objects.filter(
        pk__in=[change.pk for change in changes], state=SyncChangeState.APPLIED
    ).update(state=SyncChangeState.REVERTED, decided_at=now)


def _supersede_decisions(changes: list[SyncChange], now: datetime) -> None:
    for change in changes:
        if change.kind not in {"relink_course", "move_offering"}:
            continue
        CatalogMappingDecision.objects.filter(
            kind=change.kind, question_key=change.key, superseded_at__isnull=True
        ).update(superseded_at=now)


def _semester(year: object, term: str) -> Semester:
    try:
        year_value = int(str(year))
    except ValueError:
        raise ValueError(f"revert_term_year:{year}") from None
    semester, _ = Semester.objects.get_or_create(year=year_value, term=term)
    return semester


def _uuid(value: str | None) -> uuid.UUID | None:
    if value is None:
        return None
    try:
        return uuid.UUID(value)
    except ValueError:
        return None


@contextmanager
def _source_lock(source: str) -> Iterator[bool]:
    with advisory_lock(LOCK_KEYS[source]) as acquired:
        yield acquired
