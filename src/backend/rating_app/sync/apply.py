"""Applying sync changes, by a superuser's approval or by a kind's policy.

One service for every source. Only the current run's proposed changes apply: a
person's approval after a confirm past 48 h, a policy's auto apply never past
36 h. A stale pre-pass commits first; a change applies only when every row in
its ``requires`` exists now. A unit is several changes that must land together:
all proposed teacher changes of one offering plus the ``teacher_created`` they
require. A unit applies in one savepoint, so an approval never leaves half a
link set; if a member cannot apply, every member stays proposed.

Logs and ``SyncApproval.error`` carry ids, kinds and reasons only: payloads
hold teacher names and emails and Sentry sends PII.
"""

from __future__ import annotations

import uuid
from collections import defaultdict
from collections.abc import Iterable, Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import timedelta

from django.contrib.auth.models import User
from django.db import transaction
from django.utils import timezone

import structlog

from rating_app.models import (
    Course,
    PlannedCourse,
    Rating,
    SyncApproval,
    SyncApprovalAction,
    SyncApprovalOutcome,
    SyncApprovalScope,
    SyncChange,
    SyncChangeGroup,
    SyncChangeState,
    SyncChangeStateReason,
    SyncPolicyMode,
    SyncRun,
    SyncRunStatus,
)
from rating_app.scheduler.jobs import job_named
from rating_app.scheduler.lock import advisory_lock
from rating_app.sync import constants
from rating_app.sync.drafts import is_stale
from rating_app.sync.handlers import Handler, handler_for
from rating_app.sync.kinds import KIND_BY_NAME, NEVER_AUTO_KINDS
from rating_app.sync.policies import mode_for
from rating_app.sync.runs import sweep_interrupted_approvals
from rating_app.sync.snapshot import RateUkmaSnapshot, load_rate_ukma_snapshot

logger = structlog.get_logger(__name__)

APPROVAL_MAX_AGE = timedelta(hours=48)
AUTO_MAX_AGE = timedelta(hours=36)

LOCK_KEYS: dict[str, int] = {
    "catalog": constants.CATALOG_SYNC_LOCK_KEY,
    "teachers": job_named("sync_offering_instructors").lock_key,
}

_UNIT_LINK_KINDS = frozenset({"teacher_link_added", "teacher_link_removed"})


class SyncApplyInputError(ValueError):
    """The selection is empty or spans several runs."""


@dataclass
class _Unit:
    key: str
    changes: list[SyncChange]


@dataclass
class _StalePass:
    superseded: int
    blocked_units: set[str]
    dead_requirements: set[tuple[str, str]]


class _UnitWaitingError(Exception):
    def __init__(self, change_ids: list[int]) -> None:
        super().__init__(change_ids)
        self.change_ids = change_ids


class _ApplyFailedError(Exception):
    def __init__(self, change: SyncChange, original: Exception) -> None:
        super().__init__(change.pk, type(original).__name__)
        self.change = change
        self.original = original


def approve(
    change_ids: Iterable[int],
    user: User,
    *,
    confirm_old_run: bool = False,
) -> SyncApproval:
    """Apply the selected proposed changes, each expanded to its whole unit.

    The approval row is written ``started`` before anything else. A run over
    :data:`APPROVAL_MAX_AGE` old is refused as ``run_too_old`` unless
    ``confirm_old_run`` says a person saw its age.
    """
    sweep_interrupted_approvals()
    changes = _load_selection(change_ids)
    run = changes[0].run
    proposed = [change for change in changes if change.state == SyncChangeState.PROPOSED]
    units = _expand_units(proposed, run)
    approval = _start_approval(
        run, _unit_members(units) or changes, user=user, action=SyncApprovalAction.APPLY
    )
    if not proposed:
        return _refuse(approval, "no_proposed_changes")
    if not _is_current(run):
        return _refuse(approval, "run_not_current")
    if not confirm_old_run and _run_age(run) > APPROVAL_MAX_AGE:
        return _refuse(approval, "run_too_old")
    with _source_lock(run.source) as held:
        if not held:
            return _refuse(approval, "lock_held")
        result = _run_apply(approval, run, units)
        if result.outcome == SyncApprovalOutcome.APPLIED:
            # A change auto-policy depended on may have just applied.
            apply_by_policy(run, lock_held=True)
    return result


def reject(change_ids: Iterable[int], user: User) -> SyncApproval:
    """Reject the selected units; their dependents become ``dependency_rejected``."""
    sweep_interrupted_approvals()
    changes = _load_selection(change_ids)
    run = changes[0].run
    proposed = [change for change in changes if change.state == SyncChangeState.PROPOSED]
    units = _expand_units(proposed, run)
    approval = _start_approval(
        run, _unit_members(units) or changes, user=user, action=SyncApprovalAction.REJECT
    )
    if not proposed:
        return _refuse(approval, "no_proposed_changes")
    if not _is_current(run):
        return _refuse(approval, "run_not_current")

    members = _unit_members(units)
    now = timezone.now()
    with transaction.atomic():
        rejected = SyncChange.objects.filter(
            pk__in=[change.pk for change in members],
            state=SyncChangeState.PROPOSED,
        ).update(
            state=SyncChangeState.REJECTED,
            state_reason="",
            decided_at=now,
            approval=approval,
            waiting_on=[],
        )
        superseded = _supersede_dependents(
            run.source, {(change.kind, change.key) for change in members}
        )
        approval.outcome = SyncApprovalOutcome.APPLIED
        approval.counts = {"rejected": rejected, "superseded": superseded}
        approval.save(update_fields=["outcome", "counts"])
    logger.info(
        "sync_approval_rejected",
        approval_id=approval.pk,
        change_ids=[change.pk for change in members],
        rejected=rejected,
        superseded=superseded,
    )
    return approval


def apply_by_policy(run: SyncRun, *, lock_held: bool = False) -> SyncApproval | None:
    """Apply the current run's ``auto`` changes, with an approval whose user is null.

    A unit applies only when every kind in it is ``auto``. A change whose row
    has ratings or plans now is left proposed for a person (D13). Never-auto
    kinds are refused in code as well as by the check constraint. Returns
    ``None`` when there is nothing to apply or the lock is held.
    """
    sweep_interrupted_approvals()
    if not _is_current(run):
        logger.info("sync_auto_skipped", run_id=run.pk, source=run.source, reason="run_not_current")
        return None
    if _run_age(run) > AUTO_MAX_AGE:
        logger.info("sync_auto_skipped", run_id=run.pk, source=run.source, reason="run_too_old")
        return None

    modes: dict[str, str] = {}
    auto_changes = [
        change
        for change in SyncChange.objects.filter(run=run, state=SyncChangeState.PROPOSED)
        if _auto_kind(change.kind, modes)
    ]
    if not auto_changes:
        return None

    units = _expand_units(auto_changes, run)
    eligible: list[_Unit] = []
    for unit in units:
        if not all(_auto_kind(member.kind, modes) for member in unit.changes):
            logger.info(
                "sync_auto_skipped",
                change_ids=[member.pk for member in unit.changes],
                reason="not_auto",
            )
            continue
        if any(_has_rated_rows(member) for member in unit.changes):
            logger.info(
                "sync_auto_skipped",
                change_ids=[member.pk for member in unit.changes],
                kind=unit.changes[0].kind,
                reason="rated",
            )
            continue
        eligible.append(unit)
    if not eligible:
        return None

    with _source_lock(run.source, held=lock_held) as held:
        if not held:
            logger.info("sync_auto_skipped", run_id=run.pk, source=run.source, reason="lock_held")
            return None
        approval = _start_approval(
            run,
            _unit_members(eligible),
            user=None,
            action=SyncApprovalAction.APPLY,
            scope=SyncApprovalScope.KIND,
        )
        return _run_apply(approval, run, eligible)


def _run_apply(approval: SyncApproval, run: SyncRun, units: list[_Unit]) -> SyncApproval:
    applied = waiting = 0
    try:
        stale = _supersede_stale(units)
        if stale.dead_requirements:
            _supersede_dependents(run.source, stale.dead_requirements)
        with transaction.atomic():
            for unit in _ordered(units):
                outcome, members = _apply_unit(
                    unit, approval, blocked=unit.key in stale.blocked_units
                )
                if outcome == "applied":
                    applied += len(members)
                elif outcome == "waiting":
                    waiting += len(members)
            approval.outcome = SyncApprovalOutcome.APPLIED
            approval.counts = {
                "applied": applied,
                "superseded": stale.superseded,
                "waiting": waiting,
            }
            approval.save(update_fields=["outcome", "counts"])
    except _ApplyFailedError as failure:
        _fail_approval(approval, run, failure.change, failure.original)
    except Exception as exc:  # the pre-pass or a handler failed; sanitize it
        _fail_approval(approval, run, None, exc)
    return approval


def _apply_unit(
    unit: _Unit, approval: SyncApproval, *, blocked: bool
) -> tuple[str, list[SyncChange]]:
    members = [change for change in unit.changes if change.state == SyncChangeState.PROPOSED]
    if not members:
        return "skipped", []
    members.sort(key=lambda change: (_kind_order(change.kind), change.pk))

    handlers: dict[int, Handler] = {}
    for member in members:
        handler = handler_for(member.kind)
        if handler is None:
            logger.info(
                "sync_change_left_proposed",
                change_id=member.pk,
                kind=member.kind,
                reason="no_handler",
            )
            return "waiting", members
        handlers[member.pk] = handler

    if blocked:
        _record_waiting(members, [])
        logger.info(
            "sync_unit_left_proposed",
            change_ids=[member.pk for member in members],
            reason="stale_member",
        )
        return "waiting", members

    try:
        with transaction.atomic():
            for member in members:
                unmet = _unmet_requirements(member)
                if unmet:
                    raise _UnitWaitingError(_waiting_on(unmet))
                try:
                    handlers[member.pk].apply(member)
                except Exception as exc:
                    raise _ApplyFailedError(member, exc) from exc
            _mark_applied(members, approval)
    except _UnitWaitingError as waiting:
        _record_waiting(members, waiting.change_ids)
        logger.info(
            "sync_unit_waiting",
            change_ids=[member.pk for member in members],
            kind=members[0].kind,
            waiting_on=waiting.change_ids,
        )
        return "waiting", members
    return "applied", members


def _supersede_stale(units: list[_Unit]) -> _StalePass:
    """One committed pass over the selected units; stale members block their unit."""
    members = [change for unit in units for change in unit.changes]
    target_ids = {change.target_id for change in members if change.target_id}
    snapshot = (
        load_rate_ukma_snapshot(offering_ids=target_ids, course_ids=target_ids)
        if target_ids
        else None
    )
    now = timezone.now()
    superseded = 0
    blocked_units: set[str] = set()
    dead: set[tuple[str, str]] = set()
    with transaction.atomic():
        for unit in units:
            for change in unit.changes:
                reason = _stale_reason(change, snapshot)
                if reason is None:
                    continue
                updated = SyncChange.objects.filter(
                    pk=change.pk, state=SyncChangeState.PROPOSED
                ).update(
                    state=SyncChangeState.SUPERSEDED,
                    state_reason=reason,
                    decided_at=now,
                )
                if not updated:
                    continue
                change.state = SyncChangeState.SUPERSEDED
                change.state_reason = reason
                superseded += 1
                blocked_units.add(unit.key)
                if reason == SyncChangeStateReason.STALE:
                    dead.add((change.kind, change.key))
                logger.info(
                    "sync_change_superseded",
                    change_id=change.pk,
                    kind=change.kind,
                    reason=reason,
                )
    return _StalePass(superseded, blocked_units, dead)


def _stale_reason(change: SyncChange, snapshot: RateUkmaSnapshot | None) -> str | None:
    if change.kind not in KIND_BY_NAME:
        return None
    handler = handler_for(change.kind)
    if (
        handler is not None
        and handler.exists is not None
        and change.group == SyncChangeGroup.NEW
        and handler.exists(change.key)
    ):
        return SyncChangeStateReason.EXISTS
    if change.target_id is None or snapshot is None:
        return None
    if is_stale(change.kind, snapshot, change.target_id, change.before):
        return SyncChangeStateReason.STALE
    return None


def _supersede_dependents(source: str, dead: set[tuple[str, str]]) -> int:
    """Supersede every proposed change waiting on a dead requirement, transitively."""
    superseded = 0
    now = timezone.now()
    while dead:
        rows = list(SyncChange.objects.filter(source=source, state=SyncChangeState.PROPOSED))
        doomed = [
            row
            for row in rows
            if any(
                pair is not None and pair in dead
                for pair in (_requirement_pair(entry) for entry in row.requires)
            )
        ]
        if not doomed:
            break
        ids = [row.pk for row in doomed]
        superseded += SyncChange.objects.filter(pk__in=ids, state=SyncChangeState.PROPOSED).update(
            state=SyncChangeState.SUPERSEDED,
            state_reason=SyncChangeStateReason.DEPENDENCY_REJECTED,
            decided_at=now,
        )
        dead = {(row.kind, row.key) for row in doomed}
        logger.info(
            "sync_changes_superseded",
            change_ids=ids,
            kinds=sorted({row.kind for row in doomed}),
            reason=SyncChangeStateReason.DEPENDENCY_REJECTED,
        )
    return superseded


def _expand_units(selected: list[SyncChange], run: SyncRun) -> list[_Unit]:
    """Group the selection into units: an offering's teacher changes and their teachers."""
    proposed = list(SyncChange.objects.filter(run=run, state=SyncChangeState.PROPOSED))
    links_by_offering: dict[str, list[SyncChange]] = defaultdict(list)
    creations: dict[str, SyncChange] = {}
    for change in proposed:
        if change.kind in _UNIT_LINK_KINDS and change.target_id is not None:
            links_by_offering[change.target_id].append(change)
        elif change.kind == "teacher_created":
            creations[change.key] = change

    units: dict[str, _Unit] = {}
    claimed: set[int] = set()
    # Links first, so a creation a selected link needs joins that link's unit
    # instead of forming a second unit of its own.
    ordered = sorted(
        selected,
        key=lambda row: (0 if row.kind in _UNIT_LINK_KINDS else 1, row.pk),
    )
    for change in ordered:
        if change.state != SyncChangeState.PROPOSED or change.pk in claimed:
            continue
        if change.kind in _UNIT_LINK_KINDS and change.target_id is not None:
            key = f"offering:{change.target_id}"
            members = _offering_unit(change, links_by_offering, creations, claimed)
        else:
            key = f"change:{change.pk}"
            members = [change]
        units[key] = _Unit(key=key, changes=members)
        claimed.update(member.pk for member in members)
    return list(units.values())


def _offering_unit(
    anchor: SyncChange,
    links_by_offering: dict[str, list[SyncChange]],
    creations: dict[str, SyncChange],
    claimed: set[int],
) -> list[SyncChange]:
    members = list(links_by_offering.get(anchor.target_id or "", [anchor]))
    for member in list(members):
        for entry in member.requires:
            pair = _requirement_pair(entry)
            if pair is None or pair[0] != "teacher_created":
                continue
            creation = creations.get(pair[1])
            if creation is not None and creation.pk not in claimed:
                members.append(creation)
    return _unique_changes(members)


def _unique_changes(changes: list[SyncChange]) -> list[SyncChange]:
    seen: set[int] = set()
    unique: list[SyncChange] = []
    for change in changes:
        if change.pk in seen:
            continue
        seen.add(change.pk)
        unique.append(change)
    return unique


def _unit_members(units: list[_Unit]) -> list[SyncChange]:
    return _unique_changes([change for unit in units for change in unit.changes])


def _ordered(units: list[_Unit]) -> list[_Unit]:
    return sorted(
        units,
        key=lambda unit: (
            min(_kind_order(change.kind) for change in unit.changes),
            unit.key,
        ),
    )


def _kind_order(kind: str) -> int:
    registry_kind = KIND_BY_NAME.get(kind)
    return registry_kind.order if registry_kind is not None else 1000


def _auto_kind(kind: str, modes: dict[str, str]) -> bool:
    if kind in NEVER_AUTO_KINDS:
        return False
    if kind not in modes:
        modes[kind] = mode_for(kind)
    return modes[kind] == SyncPolicyMode.AUTO


def _has_rated_rows(change: SyncChange) -> bool:
    """Whether the change's Rate UKMA row has ratings or plans now (D13)."""
    if not change.target_id:
        return False
    try:
        target = uuid.UUID(change.target_id)
    except ValueError:
        return False
    if Rating.objects.filter(course_offering_id=target).exists():
        return True
    if PlannedCourse.objects.filter(offering_id=target).exists():
        return True
    if not Course.objects.filter(pk=target).exists():
        return False
    return (
        Rating.objects.filter(course_offering__course_id=target).exists()
        or PlannedCourse.objects.filter(offering__course_id=target).exists()
    )


def _unmet_requirements(change: SyncChange) -> list[tuple[str, str]]:
    return [
        pair
        for entry in change.requires
        if (pair := _requirement_pair(entry)) is not None and not _requirement_met(*pair)
    ]


def _requirement_pair(entry: object) -> tuple[str, str] | None:
    if not isinstance(entry, dict):
        return None
    kind = entry.get("kind")
    key = entry.get("key")
    if isinstance(kind, str) and isinstance(key, str):
        return kind, key
    return None


def _requirement_met(kind: str, key: str) -> bool:
    handler = handler_for(kind)
    if handler is not None and handler.exists is not None:
        return handler.exists(key)
    return SyncChange.objects.filter(kind=kind, key=key, state=SyncChangeState.APPLIED).exists()


def _waiting_on(requirements: list[tuple[str, str]]) -> list[int]:
    ids: set[int] = set()
    for kind, key in requirements:
        ids.update(
            SyncChange.objects.filter(
                kind=kind, key=key, state=SyncChangeState.PROPOSED
            ).values_list("pk", flat=True)
        )
    return sorted(ids)


def _mark_applied(members: list[SyncChange], approval: SyncApproval) -> None:
    now = timezone.now()
    SyncChange.objects.filter(
        pk__in=[change.pk for change in members], state=SyncChangeState.PROPOSED
    ).update(
        state=SyncChangeState.APPLIED,
        state_reason="",
        decided_at=now,
        approval=approval,
        waiting_on=[],
    )
    for member in members:
        member.state = SyncChangeState.APPLIED


def _record_waiting(members: list[SyncChange], change_ids: list[int]) -> None:
    if not change_ids:
        return
    SyncChange.objects.filter(
        pk__in=[change.pk for change in members], state=SyncChangeState.PROPOSED
    ).update(waiting_on=change_ids)


def _load_selection(change_ids: Iterable[int]) -> list[SyncChange]:
    ids = list(dict.fromkeys(change_ids))
    if not ids:
        raise SyncApplyInputError("no change ids")
    changes = list(SyncChange.objects.filter(pk__in=ids).select_related("run").order_by("pk"))
    if not changes:
        raise SyncApplyInputError("unknown change ids")
    if len({change.run_id for change in changes}) != 1:
        raise SyncApplyInputError("changes from several runs")
    return changes


def _start_approval(
    run: SyncRun,
    changes: list[SyncChange],
    *,
    user: User | None,
    action: str,
    scope: str = SyncApprovalScope.CHANGE,
) -> SyncApproval:
    return SyncApproval.objects.create(
        run=run,
        run_ref=run.pk,
        action=action,
        scope=scope,
        change_ids=[change.pk for change in changes],
        user=user,
        outcome=SyncApprovalOutcome.STARTED,
    )


def _refuse(approval: SyncApproval, reason: str) -> SyncApproval:
    approval.outcome = SyncApprovalOutcome.REFUSED
    approval.error = reason
    approval.save(update_fields=["outcome", "error"])
    logger.info(
        "sync_approval_refused",
        approval_id=approval.pk,
        run_id=approval.run_ref,
        reason=reason,
    )
    return approval


def _fail_approval(
    approval: SyncApproval,
    run: SyncRun,
    change: SyncChange | None,
    exc: Exception,
) -> None:
    reason = f"apply_failed:{type(exc).__name__}"
    if change is not None:
        reason = f"{reason}:change={change.pk}:kind={change.kind}"
    approval.outcome = SyncApprovalOutcome.FAILED
    approval.error = reason
    approval.save(update_fields=["outcome", "error"])
    logger.error(
        "sync_apply_failed",
        approval_id=approval.pk,
        run_id=run.pk,
        source=run.source,
        change_id=change.pk if change is not None else None,
        kind=change.kind if change is not None else None,
        err=type(exc).__name__,
    )


def _is_current(run: SyncRun) -> bool:
    current = (
        SyncRun.objects.filter(source=run.source, status=SyncRunStatus.SUCCEEDED)
        .order_by("-pk")
        .values_list("pk", flat=True)
        .first()
    )
    return current == run.pk


def _run_age(run: SyncRun) -> timedelta:
    stamps = [stamp for stamp in (run.finished_at, run.data_updated_at) if stamp is not None]
    if not stamps:
        return timedelta(0)
    return timezone.now() - min(stamps)


@contextmanager
def _source_lock(source: str, *, held: bool = False) -> Iterator[bool]:
    if held:
        yield True
        return
    with advisory_lock(LOCK_KEYS[source]) as acquired:
        yield acquired
