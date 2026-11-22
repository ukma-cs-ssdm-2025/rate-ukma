"""Staff answers to catalog mapping questions, written with their premise (M15).

An answer is a live `CatalogMappingDecision` whose premise the builders re-check:
the course ids as a set, the UKMA Data course id, its `mergeSource`, the ratings
counted, and the САЗ code for a move or a placement. A decision whose `course`,
`offering` or `into` row is gone is dropped by `load_decisions`, so every
foreign key written here also copies its id into the matching `_ref` column.

The premise is rebuilt from the ``SyncChange.after`` the builder recorded, so an
answer matches the question it settles without reading the whole catalog.
"""

from __future__ import annotations

import uuid
from typing import Any, cast

from django.contrib.auth.models import User
from django.db import transaction
from django.utils import timezone

from rating_app.models import (
    CatalogMappingDecision,
    Course,
    CourseOffering,
    MappingAnswer,
    Rating,
    SyncChange,
    SyncChangeGroup,
    SyncChangeState,
    SyncRun,
    SyncRunStatus,
    SyncSource,
)
from rating_app.sync.catalog.mapping import premise_holds

MAPPING_KINDS = frozenset({"merge_courses", "move_offering", "place_offering", "relink_course"})

ANSWERS_BY_KIND: dict[str, frozenset[str]] = {
    "merge_courses": frozenset({MappingAnswer.KEEP_APART, MappingAnswer.MERGE}),
    "move_offering": frozenset({MappingAnswer.KEEP, MappingAnswer.MOVE}),
    "relink_course": frozenset({MappingAnswer.KEEP, MappingAnswer.RELINK}),
    "place_offering": frozenset({MappingAnswer.PLACE}),
}

# The answer that settles a question for good. A merge, move or relink still
# needs its change applied, so that question stays proposed until the apply.
SETTLING_ANSWERS: dict[str, str] = {
    "merge_courses": MappingAnswer.KEEP_APART,
    "move_offering": MappingAnswer.KEEP,
    "relink_course": MappingAnswer.KEEP,
}


class MappingAnswerError(ValueError):
    """The change is not a mapping question, or the answer does not fit it."""


def answer_change(
    change: SyncChange,
    answer: str,
    user: User,
    *,
    into: str | None = None,
) -> CatalogMappingDecision:
    """Write the staff answer with its premise and refs; supersede an earlier one."""
    if change.kind not in MAPPING_KINDS:
        raise MappingAnswerError("Відповісти можна лише на питання зіставлення")
    if answer not in ANSWERS_BY_KIND[change.kind]:
        raise MappingAnswerError("Ця відповідь не підходить до цього питання")

    into_course = _into_course(change, answer, into)
    with transaction.atomic():
        _lock_question(change)
        _supersede_live(change.kind, change.key)
        return _create_decision(
            change, answer, user, into_course=into_course, ratings=live_rating_count(change)
        )


def live_rating_count(change: SyncChange) -> int:
    """The ratings the question touches now, counted from Rate UKMA."""
    if change.kind == "move_offering":
        return _ratings_for_offering(change.target_id)
    return _ratings_for_courses(_course_ids(change))


def keep_apart_unrated(user: User) -> int:
    """Settle every unanswered unrated mapping question for the current run."""
    run = (
        SyncRun.objects.filter(source=SyncSource.CATALOG, status=SyncRunStatus.SUCCEEDED)
        .order_by("-pk")
        .first()
    )
    if run is None:
        return 0

    changes = SyncChange.objects.filter(
        run=run,
        group=SyncChangeGroup.MAPPING,
        state=SyncChangeState.PROPOSED,
    ).order_by("pk")
    count = 0
    with transaction.atomic():
        for change in changes:
            answer = SETTLING_ANSWERS.get(change.kind)
            if answer is None:
                continue
            _lock_question(change)
            ratings = live_rating_count(change)
            if ratings != 0 or _live_answer_holds(change, ratings):
                continue
            _supersede_live(change.kind, change.key)
            _create_decision(change, answer, user, into_course=None, ratings=ratings)
            count += 1
    return count


def _lock_question(change: SyncChange) -> None:
    """Serialize writers on one question: a manual answer and the bulk settle both
    lock its change row before they read or replace its live decision."""
    list(SyncChange.objects.select_for_update().filter(pk=change.pk).values_list("pk"))


def _live_answer_holds(change: SyncChange, ratings: int) -> bool:
    """A live answer whose premise still describes this question; the builder
    reopens a question whose premise changed, and so does the bulk settle."""
    current = premise_for(change, ratings)
    return any(
        premise_holds(decision.premise or {}, current)
        for decision in CatalogMappingDecision.objects.filter(
            kind=change.kind, question_key=change.key, superseded_at__isnull=True
        )
    )


def premise_for(change: SyncChange, ratings: int) -> dict[str, object]:
    """The premise the builder put in ``after``, in the shape ``_answered`` reads."""
    course_ids = _course_ids(change)
    premise: dict[str, object] = {
        "course_ids": course_ids,
        "ukma_course_id": _ukma_course_id(change),
        "merge_source": _merge_source(change),
        "ratings": ratings,
    }
    saz_code = _saz_code(change)
    if saz_code:
        premise["saz_code"] = saz_code
    return premise


def _create_decision(
    change: SyncChange,
    answer: str,
    user: User,
    *,
    into_course: Course | None,
    ratings: int,
) -> CatalogMappingDecision:
    course, offering, into = _refs(change, answer, into_course)
    premise = premise_for(change, ratings)
    return CatalogMappingDecision.objects.create(
        kind=change.kind,
        question_key=change.key,
        ukma_course_id=_ukma_course_id(change) or "",
        saz_code=_saz_code(change) or "",
        course=course,
        course_ref="" if course is None else str(course.pk),
        offering=offering,
        offering_ref="" if offering is None else str(offering.pk),
        into=into,
        into_ref="" if into is None else str(into.pk),
        answer=answer,
        premise=premise,
        decided_by=user,
    )


def _refs(
    change: SyncChange, answer: str, into_course: Course | None
) -> tuple[Course | None, CourseOffering | None, Course | None]:
    match change.kind:
        case "merge_courses":
            return None, None, into_course if answer == MappingAnswer.MERGE else None
        case "move_offering":
            source = _resolve_course(_text(_after(change).get("from_course")))
            offering = _resolve_offering(change.target_id)
            into = _resolve_course(_text(_after(change).get("to_course_id")))
            return source, offering, into if answer == MappingAnswer.MOVE else None
        case "relink_course":
            return _resolve_course(change.target_id), None, None
        case "place_offering":
            return None, None, into_course
    return None, None, None


def _into_course(change: SyncChange, answer: str, into: str | None) -> Course | None:
    if change.kind not in {"merge_courses", "place_offering"}:
        return None
    if answer not in {MappingAnswer.MERGE, MappingAnswer.PLACE}:
        return None
    if into is None or into not in _course_ids(change):
        raise MappingAnswerError("Оберіть курс із запропонованих")
    course = _resolve_course(into)
    if course is None:
        raise MappingAnswerError("Курс не знайдено")
    return course


def _after(change: SyncChange) -> dict[str, Any]:
    return cast(dict[str, Any], change.after or {})


def _text(value: object) -> str | None:
    if value is None:
        return None
    text = str(value)
    return text or None


def _course_ids(change: SyncChange) -> list[str]:
    after = _after(change)
    match change.kind:
        case "merge_courses":
            courses = after.get("courses")
            rows = cast(list[Any], courses) if isinstance(courses, list) else []
            raw = [row.get("id") for row in rows if isinstance(row, dict)]
        case "move_offering":
            raw = [after.get("from_course"), after.get("to_course_id")]
        case "relink_course":
            raw = [change.target_id]
        case "place_offering":
            candidates = after.get("candidates")
            raw = cast(list[Any], candidates) if isinstance(candidates, list) else []
        case _:
            raw = []
    return sorted({text for value in raw if (text := _text(value)) is not None})


def _ukma_course_id(change: SyncChange) -> str | None:
    after = _after(change)
    match change.kind:
        case "move_offering":
            return _text(after.get("ukma_course_id"))
        case "relink_course":
            return _text(after.get("ukma_data_id"))
        case _:
            return _text(change.ukma_data_id)


def _merge_source(change: SyncChange) -> object:
    after = _after(change)
    if "merge_source" in after:
        return after["merge_source"]
    display = after.get("display")
    if not isinstance(display, dict):
        return None
    ukma_course = cast(dict[str, Any], display).get("ukma_course")
    if not isinstance(ukma_course, dict):
        return None
    return ukma_course.get("merge_source")


def _saz_code(change: SyncChange) -> str | None:
    after = _after(change)
    if change.kind == "place_offering":
        return _text(after.get("saz_code"))
    if change.kind != "move_offering":
        return None
    offering = _resolve_offering(change.target_id)
    return None if offering is None else offering.code


def _ratings_for_courses(course_ids: list[str]) -> int:
    ids = [value for value in (_uuid(course_id) for course_id in course_ids) if value is not None]
    if not ids:
        return 0
    return Rating.objects.filter(course_offering__course_id__in=ids).count()


def _ratings_for_offering(offering_id: str | None) -> int:
    offering = _uuid(offering_id)
    if offering is None:
        return 0
    return Rating.objects.filter(course_offering_id=offering).count()


def _uuid(value: str | None) -> uuid.UUID | None:
    if value is None:
        return None
    try:
        return uuid.UUID(value)
    except (ValueError, TypeError):
        return None


def _resolve_course(value: str | None) -> Course | None:
    course_id = _uuid(value)
    if course_id is None:
        return None
    return Course.objects.filter(pk=course_id).first()


def _resolve_offering(value: str | None) -> CourseOffering | None:
    offering_id = _uuid(value)
    if offering_id is None:
        return None
    return CourseOffering.objects.filter(pk=offering_id).first()


def _supersede_live(kind: str, question_key: str) -> None:
    CatalogMappingDecision.objects.filter(
        kind=kind, question_key=question_key, superseded_at__isnull=True
    ).update(superseded_at=timezone.now())
