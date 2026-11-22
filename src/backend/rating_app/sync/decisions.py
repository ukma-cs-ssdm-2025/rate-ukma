"""Approve and reject a selection of sync changes, for real or as a dry run.

The console (`manage.py catalog_sync`) decides through here, and the sync API
reads the current runs and their age through here, so both see one code path.
A dry run runs the very same `apply.approve` or `apply.reject` inside a
transaction that is rolled back, and reports what each selected change became.
"""

from __future__ import annotations

from collections.abc import Callable, Iterable, Sequence
from dataclasses import dataclass, field
from typing import Any

from django.contrib.auth.models import User
from django.db import transaction
from django.utils import timezone

from rating_app.models.sync import (
    SyncApproval,
    SyncApprovalOutcome,
    SyncChange,
    SyncChangeState,
    SyncRun,
    SyncRunStatus,
    SyncSource,
)
from rating_app.sync import apply, review

REFUSAL_TEXT = {
    "lock_held": "Синхронізація саме триває (нічне читання або інше застосування). "
    "Спробуйте за кілька хвилин.",
    "run_not_current": "Ці зміни з попереднього читання САЗ, вже є новіше. "
    "Подивіться status і show ще раз.",
    "no_proposed_changes": "Серед вибраних немає змін, що чекають рішення.",
}

INPUT_ERROR_TEXT = {
    "no change ids": "Не вибрано жодної зміни",
    "unknown change ids": "Деяких вибраних змін не існує",
    "changes from several runs": "Вибрані зміни належать різним читанням САЗ",
}


@dataclass(frozen=True)
class ChangeOutcome:
    """What one change of the selection became."""

    change: SyncChange
    state: str
    state_reason: str
    waiting_on: list[Any]


@dataclass
class DecisionResult:
    """An approval or a rejection, written or rolled back."""

    action: str
    outcome: str
    dry_run: bool
    approval_id: int | None
    error: str
    counts: dict[str, Any]
    outcomes: list[ChangeOutcome] = field(default_factory=list)
    ratings_moved: int = 0
    plans_moved: int = 0
    run_age_hours: int | None = None

    def in_state(self, state: str) -> list[ChangeOutcome]:
        return [item for item in self.outcomes if item.state == state]


def current_run(source: str) -> SyncRun | None:
    """The source's latest succeeded run: the one whose changes can be decided."""
    return (
        SyncRun.objects.filter(source=source, status=SyncRunStatus.SUCCEEDED)
        .order_by("-finished_at", "-id")
        .first()
    )


def current_runs(source: str | None = None) -> list[SyncRun]:
    sources = [source] if source is not None else list(SyncSource)
    return [run for value in sources if (run := current_run(value)) is not None]


def latest_run(source: str) -> SyncRun | None:
    """The source's newest run, whatever its status."""
    return SyncRun.objects.filter(source=source).order_by("-started_at", "-id").first()


def age_hours(run: SyncRun) -> int | None:
    """Hours since the older of the run's finish and its САЗ data time."""
    stamps = [stamp for stamp in (run.finished_at, run.data_updated_at) if stamp is not None]
    if not stamps:
        return None
    return int((timezone.now() - min(stamps)).total_seconds() // 3600)


def input_error_text(exc: apply.SyncApplyInputError) -> str:
    return INPUT_ERROR_TEXT.get(str(exc), "Некоректна вибірка змін")


def refusal_text(reason: str, run: SyncRun | None) -> str:
    if reason == "run_too_old":
        hours = None if run is None else age_hours(run)
        age = "" if hours is None else f" ({hours} год)"
        return (
            f"Дані старші за 48 год{age}. Якщо ви бачили їхній вік і все одно "
            "застосовуєте, додайте --confirm-stale."
        )
    return REFUSAL_TEXT.get(reason, reason or "Не вдалося виконати дію")


def approve(
    change_ids: Iterable[int],
    user: User,
    *,
    dry_run: bool,
    confirm_stale: bool = False,
    group: str = "",
    kind: str = "",
    excluded: Iterable[int] = (),
) -> DecisionResult:
    """Apply the selection through `apply.approve`; a dry run rolls it all back.

    Raises `apply.SyncApplyInputError` for an empty, unknown or mixed selection.
    """
    ids = list(change_ids)
    scope_group = "" if group == review.OTHER_GROUP else group

    def run() -> SyncApproval:
        return apply.approve(
            ids,
            user,
            confirm_old_run=confirm_stale,
            group=scope_group,
            kind=kind,
            excluded=excluded,
        )

    return _decide(run, ids, dry_run=dry_run)


def reject(change_ids: Iterable[int], user: User, *, dry_run: bool) -> DecisionResult:
    """Reject the selection through `apply.reject`; a dry run rolls it all back."""
    ids = list(change_ids)
    return _decide(lambda: apply.reject(ids, user), ids, dry_run=dry_run)


def _decide(
    run: Callable[[], SyncApproval], ids: Sequence[int], *, dry_run: bool
) -> DecisionResult:
    """A real decision commits as `apply` commits it, approval row first; a dry
    run wraps the same call in one transaction and rolls everything back."""
    if not dry_run:
        return _result(run(), ids, dry_run=False)
    with transaction.atomic():
        result = _result(run(), ids, dry_run=True)
        transaction.set_rollback(True)
    return result


def skipped_count(approval: SyncApproval, counts: dict[str, Any]) -> int:
    """Selected changes that are still proposed but wait on nothing: a unit
    pulled in by the selection that did not apply this time."""
    remaining = SyncChange.objects.filter(
        pk__in=approval.change_ids, state=SyncChangeState.PROPOSED
    ).count()
    return max(0, remaining - int(counts.get("waiting") or 0))


def _result(approval: SyncApproval, selected: Sequence[int], *, dry_run: bool) -> DecisionResult:
    run = approval.run
    counts = {str(key): value for key, value in (approval.counts or {}).items()}
    result = DecisionResult(
        action=str(approval.action),
        outcome=str(approval.outcome),
        dry_run=dry_run,
        approval_id=None if dry_run else approval.pk,
        error=str(approval.error or ""),
        counts=counts,
        run_age_hours=None if run is None else age_hours(run),
    )
    if approval.outcome != SyncApprovalOutcome.APPLIED:
        return result
    ids = sorted(set(approval.change_ids or []) | set(selected))
    changes = list(SyncChange.objects.filter(pk__in=ids).order_by("pk"))
    result.outcomes = [
        ChangeOutcome(
            change=change,
            state=str(change.state),
            state_reason=str(change.state_reason or ""),
            waiting_on=list(change.waiting_on or []),
        )
        for change in changes
    ]
    moved = [
        change
        for change in changes
        if change.state == SyncChangeState.APPLIED
        and change.kind in {"merge_courses", "move_offering"}
    ]
    result.ratings_moved, result.plans_moved = review.moved_counts(moved)
    counts.setdefault("skipped", 0)
    if str(approval.action) == "apply":
        counts["skipped"] = skipped_count(approval, counts)
    return result
