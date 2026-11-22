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
from rating_app.sync.matching import academic_year_of, same_title
from rating_app.sync.review import MAPPING_KINDS, target_refs


@dataclass
class Question:
    change: SyncChange
    courses: list[dict[str, Any]] = field(default_factory=list)
    ratings: int = 0
    plans: int = 0
    suggested_into: str | None = None
    answer: dict[str, Any] | None = None


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
    questions = []
    for change in changes:
        question = Question(change=change, answer=answers.get((change.kind, change.key)))
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
        question.suggested_into = _suggested(question.courses)
        questions.append(question)
    return questions


def _suggested(courses: Sequence[dict[str, Any]]) -> str | None:
    if not courses:
        return None
    both = [
        course for course in courses if course["title_matches_ukma"] and course["holds_ukma_id"]
    ]
    pool = both or list(courses)
    return str(
        max(
            pool,
            key=lambda course: (
                int(course["ratings"]),
                int(course["latest_year"]),
                str(course["id"]),
            ),
        )["id"]
    )


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


def page(
    run: SyncRun, *, rated: bool | None, after: int | None, limit: int
) -> tuple[list[Question], int | None]:
    rows = question_rows(run)
    if rated is not None:
        rows = [row for row in rows if (row.ratings > 0 or row.plans > 0) is rated]
    rows.sort(key=lambda row: (row.answer is not None, -row.ratings, row.change.pk))
    start = 0
    if after is not None:
        for index, row in enumerate(rows):
            if row.change.pk == after:
                start = index + 1
                break
    items = rows[start : start + limit]
    next_after = items[-1].change.pk if rows[start + limit :] else None
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
