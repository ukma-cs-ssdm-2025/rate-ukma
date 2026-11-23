"""Approve and reject a selection of sync changes, for real or as a dry run.

The console (`manage.py catalog_sync`) decides through here, and the sync API
reads the current runs and their age through here, so both see one code path.
A dry run runs the very same `apply.approve` or `apply.reject` inside a
transaction that is rolled back, and reports what each selected change became.
"""

from __future__ import annotations

import secrets
import uuid
from collections.abc import Callable, Iterable, Sequence
from dataclasses import dataclass, field
from typing import Any

from django.contrib.auth.models import User
from django.db import transaction
from django.utils import timezone

from structlog.contextvars import bound_contextvars

from rating_app.models.sync import (
    SyncApproval,
    SyncApprovalOutcome,
    SyncChange,
    SyncChangeState,
    SyncPreview,
    SyncRun,
    SyncRunStatus,
    SyncSource,
)
from rating_app.sync import apply, review
from rating_app.sync import revert as revert_service

SyncApplyInputError = apply.SyncApplyInputError

REFUSAL_TEXT = {
    "lock_held": "Синхронізація саме триває (нічне читання або інше застосування). "
    "Спробуйте за кілька хвилин.",
    "run_not_current": "Ці зміни з попереднього читання САЗ, вже є новіше. "
    "Подивіться status і show ще раз.",
    "no_proposed_changes": "Серед вибраних немає змін, що чекають рішення.",
    "selection_changed": "Список змінився. Перегляньте ще раз.",
    "deadline_exceeded": "Не встигли вчасно, нічого не записано. Виберіть менше змін.",
}

INPUT_ERROR_TEXT = {
    "no change ids": "Не вибрано жодної зміни",
    "unknown change ids": "Деяких вибраних змін не існує",
    "changes from several runs": "Вибрані зміни належать різним читанням САЗ",
    "unknown preview token": "Перегляд не знайдено. Перегляньте ще раз.",
}


@dataclass(frozen=True)
class ChangeOutcome:
    """What one change of the selection became."""

    change: SyncChange
    state: str
    state_reason: str
    waiting_on: list[Any]
    decided_now: bool


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
    run_id: int | None = None

    def in_state(self, state: str) -> list[ChangeOutcome]:
        return [item for item in self.outcomes if item.state == state]

    def decided(self, state: str) -> list[ChangeOutcome]:
        """Changes this decision put into `state`; one decided earlier is not counted."""
        return [item for item in self.in_state(state) if item.decided_now]

    @property
    def remaining(self) -> int:
        return int(self.counts.get("remaining") or 0)


@dataclass(frozen=True)
class PreviewResult:
    """A dry run and, when it would apply something, a token for the apply."""

    result: DecisionResult
    token: str = ""


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
    client_key: uuid.UUID | None = None,
    max_changes: int | None = None,
    deadline_seconds: float | None = None,
    preview_token: str | None = None,
) -> DecisionResult:
    """Apply the selection through `apply.approve`; a dry run rolls it all back.

    A `preview_token` from `preview` makes the apply refuse as `selection_changed`
    when the selection no longer matches it. Raises `apply.SyncApplyInputError`
    for an empty, unknown or mixed selection.
    """
    ids = list(change_ids)
    scope_group = "" if group == review.OTHER_GROUP else group
    preview = _preview(preview_token, user)

    def run() -> SyncApproval:
        return apply.approve(
            ids,
            user,
            confirm_old_run=confirm_stale,
            client_key=client_key,
            group=scope_group,
            kind=kind,
            excluded=excluded,
            max_changes=max_changes,
            deadline_seconds=deadline_seconds,
            preview=preview,
        )

    return _decide(run, ids, dry_run=dry_run)


def preview(
    change_ids: Iterable[int],
    user: User,
    *,
    group: str = "",
    kind: str = "",
    excluded: Iterable[int] = (),
    max_changes: int | None = None,
    deadline_seconds: float | None = None,
) -> PreviewResult:
    """Dry-run the selection and, when it would apply, issue a `SyncPreview` token."""
    ids = list(change_ids)
    result = approve(
        ids,
        user,
        dry_run=True,
        group=group,
        kind=kind,
        excluded=excluded,
        max_changes=max_changes,
        deadline_seconds=deadline_seconds,
    )
    if result.outcome != SyncApprovalOutcome.APPLIED or result.run_id is None:
        return PreviewResult(result=result)
    token = secrets.token_urlsafe(24)
    SyncPreview.objects.create(token=token, run_id=result.run_id, user=user, count=len(set(ids)))
    return PreviewResult(result=result, token=token)


def _preview(token: str | None, user: User) -> SyncPreview | None:
    if not token:
        return None
    preview = SyncPreview.objects.filter(token=token, user=user).first()
    if preview is None:
        raise apply.SyncApplyInputError("unknown preview token")
    return preview


def revert(approval_id: int, user: User, *, dry_run: bool) -> revert_service.RevertResult:
    """Revert one applied decision through `sync.revert`; a dry run rolls back."""
    if not dry_run:
        return revert_service.revert(approval_id, user, dry_run=False)
    return rolled_back(lambda: revert_service.revert(approval_id, user, dry_run=True))


def reject(change_ids: Iterable[int], user: User, *, dry_run: bool) -> DecisionResult:
    """Reject the selection through `apply.reject`; a dry run rolls it all back."""
    ids = list(change_ids)
    return _decide(lambda: apply.reject(ids, user), ids, dry_run=dry_run)


def rolled_back[T](call: Callable[[], T]) -> T:
    """Run `call` in one transaction and roll it all back. Log events it emits
    carry `dry_run=True`, so they cannot be read as real writes."""
    with bound_contextvars(dry_run=True), transaction.atomic():
        result = call()
        transaction.set_rollback(True)
    return result


def _decide(
    run: Callable[[], SyncApproval], ids: Sequence[int], *, dry_run: bool
) -> DecisionResult:
    """A real decision commits as `apply` commits it, approval row first; a dry
    run wraps the same call in `rolled_back`."""
    if not dry_run:
        return _result(run(), ids, dry_run=False)
    return rolled_back(lambda: _result(run(), ids, dry_run=True))


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
        run_id=approval.run_ref,
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
            decided_now=change.approval_id == approval.pk,
        )
        for change in changes
    ]
    moved = [
        item.change
        for item in result.decided(SyncChangeState.APPLIED)
        if item.change.kind in {"merge_courses", "move_offering"}
    ]
    result.ratings_moved, result.plans_moved = review.moved_counts(moved)
    counts.setdefault("skipped", 0)
    if str(approval.action) == "apply":
        counts["skipped"] = skipped_count(approval, counts)
    return result
