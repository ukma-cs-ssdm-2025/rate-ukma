"""Mapping questions of one run, with the live state of every course they touch."""

from __future__ import annotations

import uuid
from collections import defaultdict
from collections.abc import Iterable, Sequence
from dataclasses import dataclass, field
from typing import Any, cast

from django.db.models import Count

from rating_app.models import (
    CatalogMappingDecision,
    Course,
    CourseOffering,
    SyncChange,
    SyncChangeGroup,
    SyncChangeState,
    SyncRun,
)
from rating_app.sync.matching import academic_year_of, normalise_title, same_title
from rating_app.sync.review import MAPPING_KINDS, target_refs


@dataclass
class Question:
    change: SyncChange
    courses: list[dict[str, Any]] = field(default_factory=list)
    ratings: int = 0
    plans: int = 0
    suggested_into: str | None = None
    answer: dict[str, Any] | None = None
    ukma_department: str | None = None
    offering: dict[str, Any] | None = None


def _after(value: object) -> dict[str, Any]:
    return cast(dict[str, Any], value) if isinstance(value, dict) else {}


def _text(value: object) -> str | None:
    if value is None:
        return None
    text = str(value)
    return text or None


def _uuids(values: Iterable[object]) -> set[uuid.UUID]:
    ids: set[uuid.UUID] = set()
    for value in values:
        if value is None:
            continue
        try:
            ids.add(uuid.UUID(str(value)))
        except (ValueError, TypeError):
            continue
    return ids


def ukma_course_id(change: SyncChange) -> str | None:
    after = _after(change.after)
    if change.kind == "move_offering":
        return _text(after.get("ukma_course_id"))
    if change.kind == "relink_course":
        return _text(after.get("ukma_data_id"))
    return _text(change.ukma_data_id)


def _ukma_title(change: SyncChange) -> str | None:
    display = _after(_after(change.after).get("display"))
    return _text(_after(display.get("ukma_course")).get("title"))


def _ukma_department(change: SyncChange) -> str | None:
    display = _after(_after(change.after).get("display"))
    return _text(_after(display.get("ukma_course")).get("department"))


def _offering(change: SyncChange, moved: dict[str, dict[str, Any]]) -> dict[str, Any] | None:
    """The semester a placement or a move is about: from САЗ for a placement, from
    the site's row for a move."""
    after = _after(change.after)
    if change.kind == "place_offering":
        semester = _after(after.get("semester"))
        year = semester.get("year")
        if not isinstance(year, int):
            return None
        return {
            "saz_code": str(after.get("saz_code") or ""),
            "year": year,
            "term": str(semester.get("term") or ""),
        }
    if change.kind == "move_offering" and change.target_id is not None:
        return moved.get(change.target_id)
    return None


def _moved_offerings(changes: Sequence[SyncChange]) -> dict[str, dict[str, Any]]:
    ids = _uuids(change.target_id for change in changes if change.kind == "move_offering")
    return {
        str(offering_id): {"saz_code": code or "", "year": year, "term": term}
        for offering_id, code, year, term in CourseOffering.objects.filter(pk__in=ids).values_list(
            "id", "code", "semester__year", "semester__term"
        )
    }


def _display_flags(change: SyncChange) -> dict[str, dict[str, Any]]:
    display = _after(_after(change.after).get("display"))
    flags: dict[str, dict[str, Any]] = {}
    for row in cast(list[object], display.get("courses") or []):
        payload = _after(row)
        course_id = _text(payload.get("id"))
        if course_id is not None:
            flags[course_id] = payload
    return flags


def question_rows(run: SyncRun) -> list[Question]:
    changes = list(
        SyncChange.objects.filter(
            run=run, group=SyncChangeGroup.MAPPING, state=SyncChangeState.PROPOSED
        ).order_by("id")
    )
    if not changes:
        return []
    answers = _answers([(change.kind, change.key) for change in changes])
    refs = {
        change.pk: target_refs(change.kind, change.target_id, _after(change.after))
        for change in changes
    }
    courses = _load_courses(
        (course_id for course_ids, _ in refs.values() for course_id in course_ids),
        (offering_id for _, offering_ids in refs.values() for offering_id in offering_ids),
    )
    moved = _moved_offerings(changes)
    questions = []
    for change in changes:
        question = Question(
            change=change,
            answer=answers.get((change.kind, change.key)),
            ukma_department=_ukma_department(change),
            offering=_offering(change, moved),
        )
        ukma_title = _ukma_title(change)
        ukma_id = ukma_course_id(change)
        flags = _display_flags(change)
        course_ids = [
            course_id
            for course_id in sorted(set(refs[change.pk][0]) | set(refs[change.pk][1]))
            if course_id in courses
        ]
        for course_id in course_ids:
            stats = courses[course_id]
            display = flags.get(course_id, {})
            title_matches = display.get("title_matches_ukma")
            if not isinstance(title_matches, bool):
                title_matches = bool(ukma_title and same_title(str(stats["title"]), ukma_title))
            holds_id = display.get("holds_ukma_id")
            if not isinstance(holds_id, bool):
                holds_id = ukma_id is not None and stats["ukma_data_id"] == ukma_id
            question.courses.append(
                {
                    "id": course_id,
                    "title": stats["title"],
                    "department": stats["department"],
                    "years": stats["years"],
                    "offerings": stats["offerings"],
                    "ratings": stats["ratings"],
                    "plans": stats["plans"],
                    "title_matches_ukma": title_matches,
                    "holds_ukma_id": holds_id,
                    "url": f"/courses/{course_id}",
                    "latest_year": stats["latest_year"],
                }
            )
            question.ratings += int(stats["ratings"])
            question.plans += int(stats["plans"])
        question.suggested_into = _suggested(question.courses, question.ukma_department)
        questions.append(question)
    return questions


def _suggested(courses: Sequence[dict[str, Any]], ukma_department: str | None) -> str | None:
    """The page that stays: the one with ratings, then the one whose department is
    as in САЗ, then the one that already matches САЗ, then the newest."""
    if not courses:
        return None
    department = normalise_title(ukma_department or "")

    def rank(course: dict[str, Any]) -> tuple[int, bool, bool, int, str]:
        return (
            int(course["ratings"]),
            bool(department) and normalise_title(str(course["department"])) == department,
            bool(course["title_matches_ukma"] and course["holds_ukma_id"]),
            int(course["latest_year"]),
            str(course["id"]),
        )

    return str(max(courses, key=rank)["id"])


def _answers(keys: Sequence[tuple[str, str]]) -> dict[tuple[str, str], dict[str, Any]]:
    wanted = set(keys)
    answers: dict[tuple[str, str], dict[str, Any]] = {}
    decisions = CatalogMappingDecision.objects.filter(
        superseded_at__isnull=True, kind__in=MAPPING_KINDS
    ).order_by("id")
    for decision in decisions:
        key = (decision.kind, decision.question_key)
        if key not in wanted:
            continue
        answers[key] = {
            "answer": decision.answer,
            "into": decision.into_ref or None,
            "decided_at": decision.decided_at,
        }
    return answers


def _load_courses(
    course_ids: Iterable[str], offering_ids: Iterable[str]
) -> dict[str, dict[str, Any]]:
    course_uuids = _uuids(course_ids)
    if offering_ids:
        course_uuids |= set(
            CourseOffering.objects.filter(pk__in=_uuids(offering_ids)).values_list(
                "course_id", flat=True
            )
        )
    if not course_uuids:
        return {}
    offerings: dict[str, list[dict[str, Any]]] = defaultdict(list)
    ratings: dict[str, int] = defaultdict(int)
    plans: dict[str, int] = defaultdict(int)
    for course_id, code, year, term, rating_count, plan_count in (
        CourseOffering.objects.filter(course_id__in=course_uuids)
        .annotate(
            rating_count=Count("ratings", distinct=True),
            plan_count=Count("planned_by", distinct=True),
        )
        .values_list(
            "course_id",
            "code",
            "semester__year",
            "semester__term",
            "rating_count",
            "plan_count",
        )
    ):
        course_key = str(course_id)
        offerings[course_key].append(
            {
                "saz_code": code,
                "year": year,
                "term": term,
                "ratings": int(rating_count),
                "_academic_year": academic_year_of(year, term),
            }
        )
        ratings[course_key] += int(rating_count)
        plans[course_key] += int(plan_count)
    for rows in offerings.values():
        rows.sort(key=lambda row: (row["year"], row["term"], row["saz_code"]))
    courses = {
        str(row["id"]): {
            "title": row["title"],
            "department": row["department__name"],
            "ukma_data_id": row["ukma_data_id"],
        }
        for row in Course.objects.filter(pk__in=course_uuids).values(
            "id", "title", "ukma_data_id", "department__name"
        )
    }
    for course_id, course in courses.items():
        rows = offerings.get(course_id, [])
        years = sorted({int(row["_academic_year"]) for row in rows})
        for row in rows:
            del row["_academic_year"]
        course["offerings"] = rows
        course["years"] = years
        course["latest_year"] = years[-1] if years else 0
        course["ratings"] = ratings.get(course_id, 0)
        course["plans"] = plans.get(course_id, 0)
    return courses


def _sort_key(row: Question) -> tuple[bool, int, int]:
    return (row.answer is not None, -row.ratings, row.change.pk)


def _cursor(row: Question) -> str:
    answered, ratings, pk = _sort_key(row)
    return f"{int(answered)}.{-ratings}.{pk}"


def _parse_cursor(cursor: str) -> tuple[bool, int, int]:
    answered, ratings, pk = cursor.split(".")
    return (answered == "1", -int(ratings), int(pk))


def page(
    run: SyncRun,
    *,
    rated: bool | None,
    after: str | None,
    limit: int,
    kinds: frozenset[str] = frozenset(),
    q: str | None = None,
) -> tuple[list[Question], str | None]:
    """The cursor is the last row's sort key, not its id: answering a question moves
    it to the end, and an id cursor would then skip every question still to answer."""
    rows = question_rows(run)
    if kinds:
        rows = [row for row in rows if row.change.kind in kinds]
    needle = normalise_title(q or "")
    if needle:
        rows = [
            row
            for row in rows
            if any(needle in normalise_title(str(course["title"])) for course in row.courses)
        ]
    if rated is not None:
        rows = [row for row in rows if (row.ratings > 0 or row.plans > 0) is rated]
    rows.sort(key=_sort_key)
    if after is not None:
        last = _parse_cursor(after)
        rows = [row for row in rows if _sort_key(row) > last]
    items = rows[:limit]
    next_after = _cursor(items[-1]) if len(rows) > limit else None
    return items, next_after


def payload(question: Question) -> dict[str, Any]:
    change = question.change
    courses = [
        {key: value for key, value in course.items() if key != "latest_year"}
        for course in question.courses
    ]
    return {
        "id": change.pk,
        "kind": change.kind,
        "key": change.key,
        "ukma_data_id": ukma_course_id(change),
        "ukma_title": _ukma_title(change),
        "ukma_department": question.ukma_department,
        "offering": question.offering,
        "move_into": _text(_after(change.after).get("to_course_id"))
        if change.kind == "move_offering"
        else None,
        "ratings": question.ratings,
        "plans": question.plans,
        "courses": courses,
        "suggested_into": question.suggested_into,
        "answer": question.answer,
    }


def suggestions(run_ids: Iterable[int]) -> dict[int, str | None]:
    return {
        question.change.pk: question.suggested_into
        for run in SyncRun.objects.filter(pk__in=set(run_ids))
        if (rows := question_rows(run))
        for question in rows
    }


__all__ = [
    "MAPPING_KINDS",
    "Question",
    "page",
    "payload",
    "question_rows",
    "suggestions",
    "ukma_course_id",
]
