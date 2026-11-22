"""Mapping handlers: the answer to a mapping question and a course merge.

A mapping change applies only with a live ``CatalogMappingDecision`` whose
premise still holds: the Rate UKMA course ids as a set, the UKMA Data course id,
its ``mergeSource``, the САЗ code of a move or placement, and the ratings
re-counted now. A settling answer (``keep_apart``, ``keep``) writes nothing. A
merge locks both courses and the source's offerings, moves every offering into
the target, keeps one planned course per student, supersedes the decisions
naming the source before deleting it, and recomputes the target's aggregates.
"""

from __future__ import annotations

import uuid
from collections.abc import Iterable
from decimal import Decimal
from functools import partial

from django.db import transaction
from django.db.models import Avg, Count
from django.utils import timezone

import structlog

from rating_app.models import (
    CatalogMappingDecision,
    Course,
    CourseOffering,
    MappingAnswer,
    PlannedCourse,
    Rating,
    SyncChange,
)
from rating_app.sync.catalog.mapping import premise_holds
from rating_app.sync.handlers import ChangeNotReadyError, ChangeStaleError, register
from rating_app.sync.handlers.catalog import create_offering
from rating_app.sync.payloads import (
    MergeCoursesPayload,
    MoveOfferingPayload,
    PlaceOfferingPayload,
    UkmaDataIdPayload,
)

logger = structlog.get_logger(__name__)

_APPLYING_ANSWERS: dict[str, str] = {
    "relink_course": MappingAnswer.RELINK,
    "place_offering": MappingAnswer.PLACE,
    "move_offering": MappingAnswer.MOVE,
    "merge_courses": MappingAnswer.MERGE,
}
_SETTLING_ANSWERS = frozenset({MappingAnswer.KEEP, MappingAnswer.KEEP_APART})


# Relink


@register("relink_course")
def apply_relink_course(change: SyncChange) -> None:
    decision = _holding_decision(change)
    if decision is None:
        return
    payload = UkmaDataIdPayload.model_validate(change.after)
    course_id = _uuid(change.target_id)
    if course_id is None:
        raise ChangeNotReadyError
    if not Course.objects.filter(pk=course_id).update(ukma_data_id=payload.ukma_data_id):
        raise ChangeStaleError


# Place


@register("place_offering")
def apply_place_offering(change: SyncChange) -> None:
    decision = _holding_decision(change)
    if decision is None:
        return
    payload = PlaceOfferingPayload.model_validate(change.after)
    target_id = decision.into_id
    if target_id is None or str(target_id) not in payload.candidates:
        raise ChangeNotReadyError
    if not Course.objects.filter(pk=target_id).exists():
        raise ChangeStaleError
    if CourseOffering.objects.filter(ukma_data_id=change.key).exists():
        raise ChangeStaleError
    create_offering(change, payload, target_id)


# Move


@register("move_offering")
def apply_move_offering(change: SyncChange) -> None:
    decision = _holding_decision(change)
    if decision is None:
        return
    payload = MoveOfferingPayload.model_validate(change.after)
    offering_id = _uuid(change.target_id)
    source_id = _uuid(payload.from_course)
    target_id = _uuid(payload.to_course_id)
    if offering_id is None or source_id is None or target_id is None:
        raise ChangeNotReadyError
    target = Course.objects.filter(pk=target_id).first()
    if target is None or target.ukma_data_id != payload.ukma_course_id:
        raise ChangeStaleError
    moved = CourseOffering.objects.filter(pk=offering_id, course_id=source_id).update(
        course_id=target_id
    )
    if not moved:
        raise ChangeStaleError
    _deduplicate_plans(target_id)
    for course_id in (source_id, target_id):
        _recompute_aggregates(course_id)
        transaction.on_commit(partial(_recompute_after_commit, course_id))


# Merge


@register("merge_courses")
def apply_merge_courses(change: SyncChange) -> dict[str, object]:
    decision = _holding_decision(change)
    if decision is None:
        return {}
    payload = MergeCoursesPayload.model_validate(change.after)
    target_id = decision.into_id
    if target_id is None:
        raise ChangeNotReadyError
    source_ids = _source_ids(payload.courses, target_id)
    if source_ids is None:
        raise ChangeNotReadyError
    wanted = {target_id, *source_ids}
    locked = set(
        Course.objects.select_for_update()
        .filter(id__in=wanted)
        .order_by("id")
        .values_list("id", flat=True)
    )
    if locked != wanted:
        raise ChangeStaleError

    plans = 0
    snapshots: dict[uuid.UUID, dict[str, object]] = {}
    for source_id in sorted(source_ids, key=str):
        moved_plans, snapshots[source_id] = _merge_course(source_id, target_id)
        plans += moved_plans
    if change.ukma_data_id:
        Course.objects.filter(pk=target_id).update(ukma_data_id=change.ukma_data_id)
    _recompute_aggregates(target_id)
    transaction.on_commit(lambda: _recompute_after_commit(target_id))
    return {
        "merges": [
            {"from": str(source_id), "to": str(target_id), "snapshot": snapshots[source_id]}
            for source_id in source_ids
        ],
        "plans_deduplicated": plans,
    }


def _source_ids(courses: Iterable[object], target_id: uuid.UUID) -> list[uuid.UUID] | None:
    """The courses a merge empties, or None when one id does not parse."""
    ids: list[uuid.UUID] = []
    found_target = False
    for row in courses:
        course_id = _uuid(getattr(row, "id", None))
        if course_id is None:
            return None
        if course_id == target_id:
            found_target = True
        else:
            ids.append(course_id)
    return ids if found_target else None


def _merge_course(source_id: uuid.UUID, target_id: uuid.UUID) -> tuple[int, dict[str, object]]:
    """Move one source course's offerings into the target, then delete it.

    Returns the plans deduplicated and a snapshot of the deleted course row,
    kept on the approval so the course can be restored by hand."""
    locked = {
        course.id: course
        for course in Course.objects.select_for_update()
        .filter(id__in=[source_id, target_id])
        .order_by("id")
    }
    if source_id not in locked or target_id not in locked:
        raise ChangeStaleError
    # Lock the offerings before moving them, so a rating saved meanwhile waits.
    list(
        CourseOffering.objects.select_for_update()
        .filter(course_id=source_id)
        .values_list("id", flat=True)
    )
    CourseOffering.objects.filter(course_id=source_id).update(course_id=target_id)
    plans = _deduplicate_plans(target_id)
    if CourseOffering.objects.filter(course_id=source_id).exists():
        raise RuntimeError("merge_source_not_empty")
    _supersede_decisions_naming(source_id)
    snapshot = _course_snapshot(source_id)
    Course.objects.filter(pk=source_id).delete()
    logger.info("sync_course_merged", source_id=str(source_id), target_id=str(target_id))
    return plans, snapshot


def _course_snapshot(course_id: uuid.UUID) -> dict[str, object]:
    row = Course.objects.filter(pk=course_id).values().first() or {}
    return {
        key: value if value is None or isinstance(value, (bool, int, str)) else str(value)
        for key, value in row.items()
    }


def _deduplicate_plans(course_id: uuid.UUID) -> int:
    """Keep one planned course per student and course, the newest."""
    students = (
        PlannedCourse.objects.filter(offering__course_id=course_id)
        .values("student_id")
        .annotate(rows=Count("id"))
        .filter(rows__gt=1)
        .values_list("student_id", flat=True)
    )
    removed = 0
    for student_id in list(students):
        plans = list(
            PlannedCourse.objects.filter(
                student_id=student_id, offering__course_id=course_id
            ).order_by("-updated_at", "-id")
        )
        removed += len(plans) - 1
        PlannedCourse.objects.filter(pk__in=[plan.pk for plan in plans[1:]]).delete()
    return removed


def _supersede_decisions_naming(course_id: uuid.UUID) -> int:
    needle = str(course_id)
    named = [
        decision.pk
        for decision in CatalogMappingDecision.objects.filter(superseded_at__isnull=True)
        if _names_course(decision, needle)
    ]
    if not named:
        return 0
    superseded = CatalogMappingDecision.objects.filter(
        pk__in=named, superseded_at__isnull=True
    ).update(superseded_at=timezone.now())
    logger.info("sync_decisions_superseded", course_id=needle, decision_ids=named)
    return superseded


def _names_course(decision: CatalogMappingDecision, course_id: str) -> bool:
    refs = {str(decision.course_id), str(decision.into_id), decision.course_ref, decision.into_ref}
    if course_id in refs:
        return True
    premise = decision.premise if isinstance(decision.premise, dict) else {}
    course_ids = premise.get("course_ids")
    return isinstance(course_ids, list) and course_id in {str(value) for value in course_ids}


def _recompute_aggregates(course_id: uuid.UUID) -> None:
    stats = Rating.objects.filter(course_offering__course_id=course_id).aggregate(
        avg_difficulty=Avg("difficulty"),
        avg_usefulness=Avg("usefulness"),
        ratings_count=Count("id"),
    )
    Course.objects.filter(pk=course_id).update(
        avg_difficulty=_decimal(stats["avg_difficulty"]),
        avg_usefulness=_decimal(stats["avg_usefulness"]),
        ratings_count=stats["ratings_count"] or 0,
    )


def _decimal(value: object) -> Decimal:
    return Decimal(0) if value is None else Decimal(str(value))


def _recompute_after_commit(course_id: uuid.UUID) -> None:
    """Ratings saved while the merge ran may have recomputed against the old course."""
    try:
        _recompute_aggregates(course_id)
    except Exception as exc:
        logger.error(
            "sync_merge_aggregates_failed", course_id=str(course_id), err=type(exc).__name__
        )


# Decisions


def _holding_decision(change: SyncChange) -> CatalogMappingDecision | None:
    """The live decision whose premise holds, or None when its answer settles.

    Raises ``ChangeNotReadyError`` when no live answer exists and ``ChangeStaleError``
    when the premise changed since the answer, so the question is asked again.
    """
    decision = _live_decision(change.kind, change.key)
    if decision is None:
        raise ChangeNotReadyError
    ratings_by_course = _ratings_by_course(change)
    if not premise_holds(decision.premise, _premise(change), ratings_by_course=ratings_by_course):
        raise ChangeStaleError
    if decision.answer in _SETTLING_ANSWERS:
        _mark_decision_applied(decision)
        return None
    if decision.answer != _APPLYING_ANSWERS[change.kind]:
        raise ChangeNotReadyError
    _mark_decision_applied(decision)
    return decision


def _live_decision(kind: str, question_key: str) -> CatalogMappingDecision | None:
    decision = (
        CatalogMappingDecision.objects.filter(
            kind=kind, question_key=question_key, superseded_at__isnull=True
        )
        .order_by("-id")
        .first()
    )
    if decision is None or _row_gone(decision):
        return None
    return decision


def _row_gone(decision: CatalogMappingDecision) -> bool:
    """The builder drops a decision whose row is gone, so the apply must too."""
    return (
        (bool(decision.course_ref) and decision.course_id is None)
        or (bool(decision.offering_ref) and decision.offering_id is None)
        or (bool(decision.into_ref) and decision.into_id is None)
    )


def _mark_decision_applied(decision: CatalogMappingDecision) -> None:
    if decision.applied_at is None:
        decision.applied_at = timezone.now()
        CatalogMappingDecision.objects.filter(pk=decision.pk, applied_at__isnull=True).update(
            applied_at=decision.applied_at
        )


def _premise(change: SyncChange) -> dict[str, object]:
    """The premise the answer service records, rebuilt from the change now."""
    course_ids = _course_ids(change)
    premise: dict[str, object] = {
        "course_ids": course_ids,
        "ukma_course_id": _ukma_course_id(change),
        "merge_source": _merge_source(change),
        "ratings": _ratings(change, course_ids),
    }
    saz_code = _saz_code(change)
    if saz_code:
        premise["saz_code"] = saz_code
    return premise


def _course_ids(change: SyncChange) -> list[str]:
    after = change.after if isinstance(change.after, dict) else {}
    raw: list[object]
    if change.kind == "merge_courses":
        rows = after.get("courses")
        raw = (
            [row.get("id") for row in rows if isinstance(row, dict)]
            if isinstance(rows, list)
            else []
        )
    elif change.kind == "move_offering":
        raw = [after.get("from_course"), after.get("to_course_id")]
    elif change.kind == "relink_course":
        raw = [change.target_id]
    elif change.kind == "place_offering":
        candidates = after.get("candidates")
        raw = list(candidates) if isinstance(candidates, list) else []
    else:
        raw = []
    return sorted({text for value in raw if (text := _text(value)) is not None})


def _ukma_course_id(change: SyncChange) -> str | None:
    after = change.after if isinstance(change.after, dict) else {}
    if change.kind == "move_offering":
        return _text(after.get("ukma_course_id"))
    if change.kind == "relink_course":
        return _text(after.get("ukma_data_id"))
    return _text(change.ukma_data_id)


def _merge_source(change: SyncChange) -> object:
    after = change.after if isinstance(change.after, dict) else {}
    if "merge_source" in after:
        return after["merge_source"]
    display = after.get("display")
    if isinstance(display, dict):
        ukma_course = display.get("ukma_course")
        if isinstance(ukma_course, dict):
            return ukma_course.get("merge_source")
    return None


def _saz_code(change: SyncChange) -> str | None:
    after = change.after if isinstance(change.after, dict) else {}
    if change.kind == "place_offering":
        return _text(after.get("saz_code"))
    if change.kind != "move_offering":
        return None
    offering = CourseOffering.objects.filter(pk=_uuid(change.target_id)).first()
    return None if offering is None else offering.code


def _ratings(change: SyncChange, course_ids: list[str]) -> int:
    if change.kind == "move_offering":
        offering_id = _uuid(change.target_id)
        if offering_id is None:
            return 0
        return Rating.objects.filter(course_offering_id=offering_id).count()
    return Rating.objects.filter(course_offering__course_id__in=_valid_ids(course_ids)).count()


def _ratings_by_course(change: SyncChange) -> dict[str, int] | None:
    """Per-course counts, so a premise recorded as a map also compares."""
    if change.kind not in {"merge_courses", "place_offering"}:
        return None
    course_ids = _valid_ids(_course_ids(change))
    by_course = {str(course_id): 0 for course_id in course_ids}
    counts = (
        Rating.objects.filter(course_offering__course_id__in=course_ids)
        .values("course_offering__course_id")
        .annotate(count=Count("id"))
        .values_list("course_offering__course_id", "count")
    )
    by_course.update({str(course_id): count for course_id, count in counts})
    return by_course


def _valid_ids(values: Iterable[str]) -> list[uuid.UUID]:
    return [parsed for value in values if (parsed := _uuid(value)) is not None]


def _uuid(value: object) -> uuid.UUID | None:
    if not isinstance(value, str):
        return None
    try:
        return uuid.UUID(value)
    except ValueError:
        return None


def _text(value: object) -> str | None:
    if value is None:
        return None
    text = str(value)
    return text or None
