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
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from django.contrib.auth.models import User
from django.db import transaction
from django.utils import timezone

import structlog

from rateukma.caching import instances as caching
from rateukma.caching.cache_manager import SESSION_KEY_MARKER
from rating_app.models import (
    Course,
    CourseOffering,
    Department,
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
from rating_app.sync.drafts import (
    Identity,
    changed_identity,
    course_identity,
    is_stale,
)
from rating_app.sync.handlers import (
    ChangeNotReadyError,
    ChangeStaleError,
    Handler,
    HandlerReport,
    handler_for,
)
from rating_app.sync.kinds import KIND_BY_NAME, KIND_LISTS, NEVER_AUTO_KINDS
from rating_app.sync.payloads import NewCoursePayload
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
# Kinds whose payload changes a course identity and so can hit
# ``course_identity_unique``.
_IDENTITY_KINDS = frozenset({"new_course", "change_course"})


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


@dataclass
class _CatalogPass:
    applied: list[SyncChange] = field(default_factory=list)
    waiting: int = 0
    superseded: int = 0
    counts: dict[str, object] = field(default_factory=dict)

    def add(self, outcome: _ReadyResult) -> None:
        self.applied.extend(outcome.applied)
        self.waiting += outcome.waiting
        self.superseded += outcome.superseded
        for report in outcome.reports:
            _merge_report(self.counts, report)


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
    catalog_applied: list[SyncChange] = []
    try:
        with transaction.atomic():  # a stale link and the rest of its unit retire together
            stale = _supersede_stale(units)
            superseded = stale.superseded
            if stale.dead_requirements:
                superseded += _supersede_dependents(run.source, stale.dead_requirements)
                _refresh_states(units)
        with transaction.atomic():
            catalog = _apply_catalog(units, approval)
            catalog_applied = catalog.applied
            applied += len(catalog.applied)
            waiting += catalog.waiting
            superseded += catalog.superseded
            for unit in _ordered(_unit_teacher_units(units)):
                outcome, members = _apply_unit(
                    unit, approval, blocked=unit.key in stale.blocked_units
                )
                if outcome == "applied":
                    applied += len(members)
                elif outcome == "waiting":
                    waiting += len(members)
            approval.outcome = SyncApprovalOutcome.APPLIED
            counts: dict[str, object] = {
                "applied": applied,
                "superseded": superseded,
                "waiting": waiting,
            }
            counts.update(catalog.counts)
            approval.counts = counts
            approval.save(update_fields=["outcome", "counts"])
    except _ApplyFailedError as failure:
        _fail_approval(approval, run, failure.change, failure.original)
    except Exception as exc:  # the pre-pass or a handler failed; sanitize it
        _fail_approval(approval, run, None, exc)
    else:
        if catalog_applied:
            _after_catalog_apply(run, {change.kind for change in catalog_applied})
    return approval


def _apply_catalog(units: list[_Unit], approval: SyncApproval) -> _CatalogPass:
    """Write the selection's catalog changes in batches, one kind at a time.

    Kinds run in the registry's order, so a ``new_department`` finds its faculty
    and a ``new_offering`` its course. Each change's ``requires`` is checked
    inside the transaction, just before its kind is written; one that is unmet
    stays proposed and waits. A mapping change without a live holding answer
    also waits; one whose answer premise changed is superseded.
    """
    by_kind: dict[str, list[SyncChange]] = defaultdict(list)
    for change in _unit_members(units):
        if change.source == SyncSource.CATALOG and change.state == SyncChangeState.PROPOSED:
            by_kind[change.kind].append(change)

    result = _CatalogPass()
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
            result.waiting += len(batch)
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
                        result.waiting += 1
                        continue
                    ready.append(change)
                if not ready:
                    continue
                outcome = _apply_ready(handler, ready)
                if outcome.applied:
                    _mark_applied(outcome.applied, approval)
                result.add(outcome)
        except _UnitChangedError:
            logger.info(
                "sync_changes_left_proposed",
                change_ids=[change.pk for change in ready],
                kind=kind,
                reason="changed",
            )
            result.waiting += len(ready)
            continue
        except _ApplyFailedError:
            raise
        except Exception as exc:
            # A handler names the change whose row it could not find; a plain
            # database error leaves the first change of the failing batch.
            culprit = getattr(exc, "change", None) or (ready[0] if ready else batch[0])
            raise _ApplyFailedError(culprit, exc) from exc
    return result


@dataclass
class _ReadyResult:
    applied: list[SyncChange] = field(default_factory=list)
    waiting: int = 0
    superseded: int = 0
    reports: list[HandlerReport] = field(default_factory=list)


def _apply_ready(handler: Handler, ready: list[SyncChange]) -> _ReadyResult:
    """Run one kind's ready changes; report what applied, waited or went stale."""
    outcome = _ReadyResult()
    if handler.apply_many is not None:
        report = handler.apply_many(ready)
        if report:
            outcome.reports.append(report)
        outcome.applied = ready
        return outcome
    for change in ready:
        try:
            with transaction.atomic():
                report = handler.apply(change)
        except ChangeNotReadyError:
            logger.info(
                "sync_change_waiting",
                change_id=change.pk,
                kind=change.kind,
                reason="not_ready",
            )
            outcome.waiting += 1
            continue
        except ChangeStaleError:
            if _supersede_change(change):
                outcome.superseded += 1
            continue
        except Exception as exc:
            raise _ApplyFailedError(change, exc) from exc
        if report:
            outcome.reports.append(report)
        outcome.applied.append(change)
    return outcome


def _supersede_change(change: SyncChange) -> bool:
    updated = SyncChange.objects.filter(pk=change.pk, state=SyncChangeState.PROPOSED).update(
        state=SyncChangeState.SUPERSEDED,
        state_reason=SyncChangeStateReason.STALE,
        decided_at=timezone.now(),
    )
    if updated:
        change.state = SyncChangeState.SUPERSEDED
        change.state_reason = SyncChangeStateReason.STALE
        logger.info(
            "sync_change_superseded",
            change_id=change.pk,
            kind=change.kind,
            reason=SyncChangeStateReason.STALE,
        )
    return bool(updated)


def _merge_report(counts: dict[str, object], report: HandlerReport | None) -> None:
    """Fold a handler's report (lists and counts) into the approval's counts."""
    if not report:
        return
    for key, value in report.items():
        if isinstance(value, list):
            existing = counts.get(key)
            counts[key] = [*(existing if isinstance(existing, list) else []), *value]
        elif isinstance(value, int):
            existing = counts.get(key)
            counts[key] = (existing if isinstance(existing, int) else 0) + value
        else:
            counts[key] = value


def _unit_teacher_units(units: list[_Unit]) -> list[_Unit]:
    return [
        unit
        for unit in units
        if any(change.source != SyncSource.CATALOG for change in unit.changes)
    ]


def _after_catalog_apply(run: SyncRun, applied_kinds: set[str]) -> None:
    """Clear the cache except sessions and save the cursors of the lists the
    applied kinds came from (D2).

    Separate try blocks: a cache failure must not skip the cursor save. A
    ``removed_*`` acknowledgement writes nothing and saves nothing, and neither
    does an approval that applied no change.
    """
    try:
        caching.redis_cache_manager().invalidate_pattern("*", skip_keys=[SESSION_KEY_MARKER])
    except Exception as exc:
        # The catalog is committed; a cache failure must not undo it.
        logger.error("sync_catalog_cache_clear_failed", run_id=run.pk, error=type(exc).__name__)
    lists = sorted({name for kind in applied_kinds for name in KIND_LISTS.get(kind, ())})
    if not lists:
        return
    try:
        saved = {list_name: _cursor_no(run.cursor_to, list_name) for list_name in lists}
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
        # The catalog is committed; a cursor failure must not undo it either.
        logger.error("sync_catalog_cursor_save_failed", run_id=run.pk, error=type(exc).__name__)


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
    # A move's premise names its destination course, which is not its target row.
    move_targets = {
        text
        for change in members
        if change.kind == "move_offering" and isinstance(change.after, dict)
        if isinstance(text := change.after.get("to_course_id"), str)
    }
    if not target_ids and not move_targets:
        snapshot = None
    elif any(change.kind in _FACULTY_OR_DEPARTMENT_KINDS for change in members):
        snapshot = load_rate_ukma_snapshot()
    else:
        snapshot = load_rate_ukma_snapshot(
            offering_ids=target_ids, course_ids=target_ids | move_targets
        )
    now = timezone.now()
    superseded = 0
    blocked_units: set[str] = set()
    dead: set[tuple[str, str]] = set()
    with transaction.atomic():
        collisions = _identity_collisions(members)
        for unit in units:
            for change in unit.changes:
                reason = _stale_reason(change, snapshot)
                if reason is None and change.pk in collisions:
                    reason = SyncChangeStateReason.IDENTITY_COLLISION
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
                if reason in (
                    SyncChangeStateReason.STALE,
                    SyncChangeStateReason.IDENTITY_COLLISION,
                ):
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


def _identity_collisions(changes: list[SyncChange]) -> set[int]:
    """``new_course``/``change_course`` changes that would now break the unique
    course identity, against the rows in the database or each other.

    A change that keeps its course's identity cannot create a new collision, as
    the builder does not propose one either.
    """
    linking = _departments_linked_by(changes)
    identities: dict[Identity, list[SyncChange]] = defaultdict(list)
    for change in changes:
        if change.kind not in _IDENTITY_KINDS:
            continue
        identity = _collision_identity(change, linking)
        if identity is not None:
            identities[identity].append(change)
    colliding: set[int] = set()
    for identity, rows in identities.items():
        existing = _existing_course_ids(identity)
        for change in rows:
            target = change.target_id if change.kind == "change_course" else None
            if len(rows) > 1 or existing - {target}:
                colliding.add(change.pk)
    return colliding


def _departments_linked_by(changes: list[SyncChange]) -> dict[str, str]:
    """UKMA Data department id -> Rate UKMA department id for the
    ``link_department`` changes applying in the same approval."""
    linking: dict[str, str] = {}
    for change in changes:
        ukma_data_id = change.after.get("ukma_data_id")
        if change.kind == "link_department" and change.target_id and isinstance(ukma_data_id, str):
            linking[ukma_data_id] = change.target_id
    return linking


def _collision_identity(change: SyncChange, linking: dict[str, str]) -> Identity | None:
    if change.kind == "new_course":
        payload = NewCoursePayload.model_validate(change.after)
        return course_identity(
            payload.title,
            _department_identity_id(payload.department_ukma_id, linking),
            payload.level,
        )
    current = _course_identity(change.target_id)
    if current is None:
        return None
    identity = changed_identity(current, _resolved_course_after(change.after, linking))
    return identity if identity != current else None


def _resolved_course_after(after: dict[str, object], linking: dict[str, str]) -> dict[str, object]:
    """A ``change_course`` payload with its department id resolved like the
    handler resolves it: by id, else by the UKMA Data id."""
    department = after.get("department")
    if not isinstance(department, dict) or department.get("id"):
        return after
    resolved = _department_identity_id(department.get("ukma_data_id"), linking)
    return {**after, "department": {**department, "id": resolved}}


def _department_identity_id(ukma_data_id: object, linking: dict[str, str]) -> str:
    if not isinstance(ukma_data_id, str) or not ukma_data_id:
        return ""
    if ukma_data_id in linking:
        return linking[ukma_data_id]
    existing = (
        Department.objects.filter(ukma_data_id=ukma_data_id).values_list("id", flat=True).first()
    )
    return str(existing) if existing is not None else f"new:{ukma_data_id}"


def _course_identity(target_id: str | None) -> Identity | None:
    if target_id is None:
        return None
    try:
        pk = uuid.UUID(target_id)
    except ValueError:
        return None
    row = Course.objects.filter(pk=pk).values("title", "department_id", "education_level").first()
    if row is None:
        return None
    return course_identity(row["title"], str(row["department_id"]), row["education_level"])


def _existing_course_ids(identity: Identity) -> set[str]:
    title, department_id, level = identity
    if not department_id or department_id.startswith("new:"):
        return set()
    try:
        department = uuid.UUID(department_id)
    except ValueError:
        return set()
    return {
        str(course_id)
        for course_id in Course.objects.filter(
            title=title, department_id=department, education_level=level
        ).values_list("id", flat=True)
    }


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
    if change.kind in {"new_offering", "place_offering"} and _saz_code_taken(
        change.after.get("saz_code")
    ):
        return SyncChangeStateReason.EXISTS
    if _teacher_missing_without_creation(change):
        return SyncChangeStateReason.STALE
    if change.kind == "move_offering" and _move_target_lost(change, snapshot):
        return SyncChangeStateReason.STALE
    if change.target_id is None or snapshot is None:
        return None
    if is_stale(change.kind, snapshot, change.target_id, change.before):
        return SyncChangeStateReason.STALE
    return None


def _saz_code_taken(code: object) -> bool:
    """A new offering whose САЗ code a Rate UKMA offering already holds would
    hit the unique code and roll back the whole approval."""
    return isinstance(code, str) and CourseOffering.objects.filter(code=code).exists()


def _move_target_lost(change: SyncChange, snapshot: RateUkmaSnapshot | None) -> bool:
    """A move applies only while its destination still carries the expected id."""
    after = change.after if isinstance(change.after, dict) else {}
    target_id = after.get("to_course_id")
    expected = after.get("ukma_course_id")
    if not isinstance(target_id, str) or not isinstance(expected, str):
        return False
    if snapshot is None:
        return True
    course = snapshot.courses.get(target_id)
    return course is None or course.ukma_data_id != expected


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
