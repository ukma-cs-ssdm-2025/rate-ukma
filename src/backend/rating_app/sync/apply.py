"""Applying sync changes, by a superuser's approval or by a kind's policy.

One service for every source. Only the current run's proposed changes apply: a
person's approval after a confirm past 48 h, a policy's auto apply never past
36 h. A stale pre-pass commits first, together with the changes it retires; a
change applies only when every row in its ``requires`` exists now. A unit is
several changes that must land together: all proposed teacher changes of one
offering plus the ``teacher_created`` they require. A unit applies in one
savepoint, so an approval never leaves half a link set: if a member waits, every
member stays proposed, and if a member is stale, the whole unit is retired.

Logs and ``SyncApproval.error`` carry ids, kinds and reasons only: payloads
hold teacher names and emails and Sentry sends PII.
"""

from __future__ import annotations

import uuid
from collections import defaultdict
from collections.abc import Iterable, Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timedelta

from django.contrib.auth.models import User
from django.db import transaction
from django.utils import timezone

import structlog

from rateukma.caching import instances as caching
from rateukma.caching.cache_manager import SESSION_KEY_MARKER
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
    SyncCursor,
    SyncPolicyMode,
    SyncRun,
    SyncRunStatus,
    SyncSource,
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
# The filtered snapshot holds faculties and departments only through courses, so a
# selection targeting one of them reads the whole catalog.
_FACULTY_OR_DEPARTMENT_KINDS = frozenset(
    {"link_faculty", "change_faculty", "link_department", "change_department"}
)


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


class _UnitChangedError(Exception):
    """A member stopped being proposed between the unit's read and its write."""


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
    ids = _selection_ids(change_ids)
    run = _selection_run(ids)
    approval = _start_approval(run, ids, user=user, action=SyncApprovalAction.APPLY)
    with _source_lock(run.source) as held:
        if not held:
            return _refuse(approval, "lock_held")
        # The selection can change under us before the lock, so read it again.
        changes = _load_selection(ids)
        if not _is_current(run):
            return _refuse(approval, "run_not_current")
        proposed = [change for change in changes if change.state == SyncChangeState.PROPOSED]
        units = _expand_units(proposed, run)
        if not proposed:
            return _refuse(approval, "no_proposed_changes")
        if not confirm_old_run and _run_age(run) > APPROVAL_MAX_AGE:
            return _refuse(approval, "run_too_old")
        _set_approval_changes(approval, _unit_members(units) or changes)
        result = _run_apply(approval, run, units)
        if result.outcome == SyncApprovalOutcome.APPLIED:
            # A change auto-policy depended on may have just applied.
            apply_by_policy(run, lock_held=True)
    return result


def reject(change_ids: Iterable[int], user: User) -> SyncApproval:
    """Reject the selected units; their dependents become ``dependency_rejected``."""
    sweep_interrupted_approvals()
    ids = _selection_ids(change_ids)
    run = _selection_run(ids)
    approval = _start_approval(run, ids, user=user, action=SyncApprovalAction.REJECT)
    with _source_lock(run.source) as held:
        if not held:
            return _refuse(approval, "lock_held")
        changes = _load_selection(ids)
        if not _is_current(run):
            return _refuse(approval, "run_not_current")
        proposed = [change for change in changes if change.state == SyncChangeState.PROPOSED]
        units = _expand_units(proposed, run)
        if not proposed:
            return _refuse(approval, "no_proposed_changes")

        members = _unit_members(units)
        _set_approval_changes(approval, members or changes)
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
            dead = set(
                SyncChange.objects.filter(
                    approval=approval, state=SyncChangeState.REJECTED
                ).values_list("kind", "key")
            )
            superseded = _supersede_dependents(run.source, dead)
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

    A unit applies only when every kind in it is ``auto``. A catalog change whose
    row has ratings or plans now is left proposed for a person (D13). Never-auto
    kinds are refused in code as well as by the check constraint. Returns
    ``None`` when there is nothing to apply or the lock is held.
    """
    sweep_interrupted_approvals()
    with _source_lock(run.source, held=lock_held) as held:
        if not held:
            logger.info("sync_auto_skipped", run_id=run.pk, source=run.source, reason="lock_held")
            return None
        if not _is_current(run):
            logger.info(
                "sync_auto_skipped", run_id=run.pk, source=run.source, reason="run_not_current"
            )
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
            if any(_leave_for_a_person(member) for member in unit.changes):
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

        approval = _start_approval(
            run,
            [change.pk for change in _unit_members(eligible)],
            user=None,
            action=SyncApprovalAction.APPLY,
            scope=SyncApprovalScope.KIND,
        )
        return _run_apply(approval, run, eligible)


def _run_apply(approval: SyncApproval, run: SyncRun, units: list[_Unit]) -> SyncApproval:
    applied = waiting = 0
    try:
        with transaction.atomic():  # a stale link and the rest of its unit retire together
            stale = _supersede_stale(units)
            superseded = stale.superseded
            if stale.dead_requirements:
                superseded += _supersede_dependents(run.source, stale.dead_requirements)
                _refresh_states(units)
        with transaction.atomic():
            catalog_applied, catalog_waiting = _apply_catalog(units, approval)
            applied += catalog_applied
            waiting += catalog_waiting
            for unit in _ordered(_unit_teacher_units(units)):
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
                "superseded": superseded,
                "waiting": waiting,
            }
            approval.save(update_fields=["outcome", "counts"])
    except _ApplyFailedError as failure:
        _fail_approval(approval, run, failure.change, failure.original)
    except Exception as exc:  # the pre-pass or a handler failed; sanitize it
        _fail_approval(approval, run, None, exc)
    else:
        if applied and run.source == SyncSource.CATALOG:
            _after_catalog_apply(run)
    return approval


def _apply_catalog(units: list[_Unit], approval: SyncApproval) -> tuple[int, int]:
    """Write the selection's catalog changes in batches, one kind at a time.

    Kinds run in the registry's order, so a ``new_department`` finds its faculty
    and a ``new_offering`` its course. Each change's ``requires`` is checked
    inside the transaction, just before its kind is written; one that is unmet
    stays proposed and waits.
    """
    by_kind: dict[str, list[SyncChange]] = defaultdict(list)
    for change in _unit_members(units):
        if change.source == SyncSource.CATALOG and change.state == SyncChangeState.PROPOSED:
            by_kind[change.kind].append(change)

    applied = waiting = 0
    for kind in sorted(by_kind, key=_kind_order):
        batch = sorted(by_kind[kind], key=lambda change: change.pk)
        handler = handler_for(kind)
        if handler is None:
            for change in batch:
                logger.info(
                    "sync_change_left_proposed",
                    change_id=change.pk,
                    kind=change.kind,
                    reason="no_handler",
                )
            waiting += len(batch)
            continue
        ready: list[SyncChange] = []
        try:
            with transaction.atomic():
                for change in batch:
                    unmet = _unmet_requirements(change)
                    if unmet:
                        _record_waiting([change], _waiting_on(unmet))
                        logger.info(
                            "sync_change_waiting",
                            change_id=change.pk,
                            kind=change.kind,
                            waiting_on=_waiting_on(unmet),
                        )
                        waiting += 1
                        continue
                    ready.append(change)
                if not ready:
                    continue
                if handler.apply_many is not None:
                    handler.apply_many(ready)
                else:
                    for change in ready:
                        handler.apply(change)
                _mark_applied(ready, approval)
        except _UnitChangedError:
            logger.info(
                "sync_changes_left_proposed",
                change_ids=[change.pk for change in ready],
                kind=kind,
                reason="changed",
            )
            waiting += len(ready)
            continue
        except Exception as exc:
            raise _ApplyFailedError(batch[0], exc) from exc
        applied += len(ready)
    return applied, waiting


def _unit_teacher_units(units: list[_Unit]) -> list[_Unit]:
    return [
        unit
        for unit in units
        if any(change.source != SyncSource.CATALOG for change in unit.changes)
    ]


def _after_catalog_apply(run: SyncRun) -> None:
    """Clear the cache except sessions and save the run's cursors (D2)."""
    try:
        caching.redis_cache_manager().invalidate_pattern("*", skip_keys=[SESSION_KEY_MARKER])
        saved = {
            list_name: _cursor_no(run.cursor_to, list_name)
            for list_name in constants.UKMA_DATA_LISTS
        }
        with transaction.atomic():
            for list_name, change_no in saved.items():
                SyncCursor.objects.update_or_create(
                    source=run.source,
                    list_name=list_name,
                    defaults={"change_no": change_no},
                )
            run.cursor_saved = saved
            run.save(update_fields=["cursor_saved"])
        logger.info("sync_catalog_applied", run_id=run.pk, cursors=saved)
    except Exception as exc:
        # The catalog is committed; a cache or cursor failure must not undo it.
        logger.error("sync_catalog_after_apply_failed", run_id=run.pk, error=type(exc).__name__)


def _cursor_no(cursor_to: dict[str, object], list_name: str) -> int:
    value = cursor_to.get(list_name, cursor_to.get("after", 0))
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        try:
            return int(value)
        except ValueError:
            return 0
    return 0


def _refresh_states(units: list[_Unit]) -> None:
    members = list(_unit_members(units))
    states = dict(
        SyncChange.objects.filter(pk__in=[change.pk for change in members]).values_list(
            "pk", "state"
        )
    )
    for change in members:
        change.state = states.get(change.pk, change.state)


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
        # Its links are retired; a teacher still proposed here is one another live
        # link needs, so it applies with that link's unit or waits for it.
        return "skipped", []

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
    except _UnitChangedError:
        logger.info(
            "sync_unit_left_proposed",
            change_ids=[member.pk for member in members],
            reason="changed",
        )
        return "waiting", members
    return "applied", members


def _supersede_stale(units: list[_Unit]) -> _StalePass:
    """One pass over the selected units; a stale member blocks its unit."""
    members = [change for unit in units for change in unit.changes]
    target_ids = {change.target_id for change in members if change.target_id}
    if not target_ids:
        snapshot = None
    elif any(change.kind in _FACULTY_OR_DEPARTMENT_KINDS for change in members):
        snapshot = load_rate_ukma_snapshot()
    else:
        snapshot = load_rate_ukma_snapshot(offering_ids=target_ids, course_ids=target_ids)
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
                if reason == SyncChangeStateReason.STALE:
                    blocked_units.add(unit.key)
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
    if _teacher_missing_without_creation(change):
        return SyncChangeStateReason.STALE
    if change.target_id is None or snapshot is None:
        return None
    if is_stale(change.kind, snapshot, change.target_id, change.before):
        return SyncChangeStateReason.STALE
    return None


def _teacher_missing_without_creation(change: SyncChange) -> bool:
    """A link no change creates the teacher for: its apply could only raise."""
    if change.kind != "teacher_link_added":
        return False
    if any(
        (pair := _requirement_pair(entry)) is not None and pair[0] == "teacher_created"
        for entry in change.requires
    ):
        return False
    email = change.after.get("teacher_email")
    if not isinstance(email, str) or not email.strip():
        return False
    created = handler_for("teacher_created")
    return created is not None and created.exists is not None and not created.exists(email)


def _supersede_dependents(source: str, dead: set[tuple[str, str]]) -> int:
    """Supersede every proposed change waiting on a dead requirement, transitively.

    A dead teacher link also retires the rest of its offering's unit, and a
    ``teacher_created`` no live link needs any more goes with it, so no later
    approval applies part of a link set no run proposed.
    """
    superseded = 0
    now = timezone.now()
    dead_links = _dead_links(source, dead)
    dead_offerings = _offerings_of(dead_links)
    orphan_teachers = _teachers_required_by(dead_links)
    while dead or dead_offerings:
        rows = list(SyncChange.objects.filter(source=source, state=SyncChangeState.PROPOSED))
        doomed = [row for row in rows if _is_doomed(row, dead, dead_offerings)]
        if not doomed:
            break
        superseded += _supersede_as_dependency_rejected(doomed, now)
        dead = {(row.kind, row.key) for row in doomed}
        doomed_links = [row for row in doomed if row.kind in _UNIT_LINK_KINDS]
        dead_offerings = _offerings_of(doomed_links)
        orphan_teachers |= _teachers_required_by(doomed_links)
    return superseded + _supersede_orphan_teachers(source, orphan_teachers, now)


def _dead_links(source: str, dead: set[tuple[str, str]]) -> list[SyncChange]:
    keys = [key for kind, key in dead if kind in _UNIT_LINK_KINDS]
    if not keys:
        return []
    rows = SyncChange.objects.filter(
        source=source,
        kind__in=_UNIT_LINK_KINDS,
        key__in=keys,
        state__in=[SyncChangeState.SUPERSEDED, SyncChangeState.REJECTED],
    )
    return [row for row in rows if (row.kind, row.key) in dead]


def _offerings_of(links: list[SyncChange]) -> set[tuple[int, str]]:
    return {(row.run_id, row.target_id) for row in links if row.target_id is not None}


def _teachers_required_by(links: list[SyncChange]) -> set[tuple[int, str]]:
    return {
        (row.run_id, pair[1])
        for row in links
        for entry in row.requires
        if (pair := _requirement_pair(entry)) is not None and pair[0] == "teacher_created"
    }


def _is_doomed(
    row: SyncChange, dead: set[tuple[str, str]], dead_offerings: set[tuple[int, str]]
) -> bool:
    if row.kind in _UNIT_LINK_KINDS and (row.run_id, row.target_id) in dead_offerings:
        return True
    return any(
        pair is not None and pair in dead
        for pair in (_requirement_pair(entry) for entry in row.requires)
    )


def _supersede_orphan_teachers(source: str, candidates: set[tuple[int, str]], now: datetime) -> int:
    if not candidates:
        return 0
    still_needed = _teachers_required_by(
        list(
            SyncChange.objects.filter(
                source=source, kind__in=_UNIT_LINK_KINDS, state=SyncChangeState.PROPOSED
            )
        )
    )
    orphans = [
        row
        for row in SyncChange.objects.filter(
            source=source, kind="teacher_created", state=SyncChangeState.PROPOSED
        )
        if (row.run_id, row.key) in candidates and (row.run_id, row.key) not in still_needed
    ]
    return _supersede_as_dependency_rejected(orphans, now) if orphans else 0


def _supersede_as_dependency_rejected(rows: list[SyncChange], now: datetime) -> int:
    ids = [row.pk for row in rows]
    count = SyncChange.objects.filter(pk__in=ids, state=SyncChangeState.PROPOSED).update(
        state=SyncChangeState.SUPERSEDED,
        state_reason=SyncChangeStateReason.DEPENDENCY_REJECTED,
        decided_at=now,
    )
    logger.info(
        "sync_changes_superseded",
        change_ids=ids,
        kinds=sorted({row.kind for row in rows}),
        reason=SyncChangeStateReason.DEPENDENCY_REJECTED,
    )
    return count


def _expand_units(selected: list[SyncChange], run: SyncRun) -> list[_Unit]:
    """Group the selection into units: an offering's teacher changes and their teachers.

    Selecting a link takes its offering's whole unit; selecting a teacher takes
    every offering unit whose links require it.
    """
    proposed = list(SyncChange.objects.filter(run=run, state=SyncChangeState.PROPOSED))
    links_by_offering: dict[str, list[SyncChange]] = defaultdict(list)
    creations: dict[str, SyncChange] = {}
    links_requiring: dict[str, list[SyncChange]] = defaultdict(list)
    for change in proposed:
        if change.kind in _UNIT_LINK_KINDS and change.target_id is not None:
            links_by_offering[change.target_id].append(change)
            for entry in change.requires:
                pair = _requirement_pair(entry)
                if pair is not None and pair[0] == "teacher_created":
                    links_requiring[pair[1]].append(change)
        elif change.kind == "teacher_created":
            creations[change.key] = change

    units: dict[str, _Unit] = {}
    claimed: set[int] = set()

    def add_offering(anchor: SyncChange) -> None:
        key = f"offering:{anchor.target_id}"
        members = _offering_unit(anchor, links_by_offering, creations)
        units[key] = _Unit(key=key, changes=members)
        claimed.update(member.pk for member in members)

    # Links first, so a creation a selected link needs joins that link's unit
    # instead of forming a second unit of its own.
    ordered = sorted(
        selected,
        key=lambda row: (0 if row.kind in _UNIT_LINK_KINDS else 1, row.pk),
    )
    for change in ordered:
        if change.state != SyncChangeState.PROPOSED:
            continue
        if change.kind in _UNIT_LINK_KINDS and change.target_id is not None:
            if change.pk not in claimed:
                add_offering(change)
        elif change.kind == "teacher_created":
            required = links_requiring.get(change.key, [])
            if required:
                for link in required:
                    key = f"offering:{link.target_id}"
                    if key not in units:
                        add_offering(link)
            elif change.pk not in claimed:
                key = f"change:{change.pk}"
                units[key] = _Unit(key=key, changes=[change])
                claimed.add(change.pk)
        elif change.pk not in claimed:
            key = f"change:{change.pk}"
            units[key] = _Unit(key=key, changes=[change])
            claimed.add(change.pk)
    return list(units.values())


def _offering_unit(
    anchor: SyncChange,
    links_by_offering: dict[str, list[SyncChange]],
    creations: dict[str, SyncChange],
) -> list[SyncChange]:
    members = list(links_by_offering.get(anchor.target_id or "", [anchor]))
    for member in list(members):
        for entry in member.requires:
            pair = _requirement_pair(entry)
            if pair is None or pair[0] != "teacher_created":
                continue
            creation = creations.get(pair[1])
            if creation is not None:
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


def _leave_for_a_person(change: SyncChange) -> bool:
    """Whether a catalog change's Rate UKMA row has ratings or plans now (D13).

    Teacher changes only add or remove teacher links, as the teacher sync always
    has on rated offerings, so D13 does not hold them back.
    """
    if change.source != SyncSource.CATALOG or not change.target_id:
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
    updated = SyncChange.objects.filter(
        pk__in=[change.pk for change in members], state=SyncChangeState.PROPOSED
    ).update(
        state=SyncChangeState.APPLIED,
        state_reason="",
        decided_at=now,
        approval=approval,
        waiting_on=[],
    )
    if updated != len(members):
        raise _UnitChangedError
    for member in members:
        member.state = SyncChangeState.APPLIED


def _record_waiting(members: list[SyncChange], change_ids: list[int]) -> None:
    if not change_ids:
        return
    SyncChange.objects.filter(
        pk__in=[change.pk for change in members], state=SyncChangeState.PROPOSED
    ).update(waiting_on=change_ids)


def _selection_ids(change_ids: Iterable[int]) -> list[int]:
    ids = list(dict.fromkeys(change_ids))
    if not ids:
        raise SyncApplyInputError("no change ids")
    return ids


def _selection_run(ids: list[int]) -> SyncRun:
    """Read only the selection's run, before the source lock is taken."""
    run_ids = set(SyncChange.objects.filter(pk__in=ids).values_list("run_id", flat=True))
    if not run_ids:
        raise SyncApplyInputError("unknown change ids")
    if len(run_ids) != 1:
        raise SyncApplyInputError("changes from several runs")
    return SyncRun.objects.get(pk=run_ids.pop())


def _load_selection(ids: list[int]) -> list[SyncChange]:
    changes = list(SyncChange.objects.filter(pk__in=ids).select_related("run").order_by("pk"))
    if not changes:
        raise SyncApplyInputError("unknown change ids")
    if len({change.run_id for change in changes}) != 1:
        raise SyncApplyInputError("changes from several runs")
    return changes


def _start_approval(
    run: SyncRun,
    change_ids: list[int],
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
        change_ids=change_ids,
        user=user,
        outcome=SyncApprovalOutcome.STARTED,
    )


def _set_approval_changes(approval: SyncApproval, changes: list[SyncChange]) -> None:
    approval.change_ids = [change.pk for change in changes]
    approval.save(update_fields=["change_ids"])


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
