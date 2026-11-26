"""UKMA Data ids in words: the discipline or semester each one is on the site, so a
review case shows names instead of ids.

An id the site does not have yet falls back to the newest sync change that would
create it; an id neither knows stays unnamed.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any, cast

from django.db.models import Count

from rating_app.models import Course, CourseOffering, SyncChange
from rating_app.sync.view import semester_text

MAX_IDS = 200


@dataclass(frozen=True)
class Record:
    id: str
    kind: str | None
    title: str | None
    place: str | None
    semester: str | None
    ratings: int
    course_id: str | None
    on_site: bool


def _dict(value: object) -> dict[str, Any]:
    return cast(dict[str, Any], value) if isinstance(value, dict) else {}


def _text(value: object) -> str | None:
    return value if isinstance(value, str) and value else None


def _courses(ids: set[str]) -> dict[str, Record]:
    rows = Course.objects.filter(ukma_data_id__in=ids).select_related("department")
    return {
        str(course.ukma_data_id): Record(
            id=str(course.ukma_data_id),
            kind="course",
            title=course.title,
            place=course.department.name,
            semester=None,
            ratings=course.ratings_count,
            course_id=str(course.pk),
            on_site=True,
        )
        for course in rows
    }


def _offerings(ids: set[str]) -> dict[str, Record]:
    rows = (
        CourseOffering.objects.filter(ukma_data_id__in=ids)
        .select_related("course__department", "semester")
        .annotate(rating_total=Count("ratings"))
    )
    return {
        str(offering.ukma_data_id): Record(
            id=str(offering.ukma_data_id),
            kind="offering",
            title=offering.course.title,
            place=offering.course.department.name,
            semester=semester_text(
                {"year": offering.semester.year, "term": offering.semester.term}
            ),
            ratings=int(getattr(offering, "rating_total", 0)),
            course_id=str(offering.course_id),
            on_site=True,
        )
        for offering in rows
    }


def _proposed(ids: set[str]) -> dict[str, Record]:
    rows = (
        SyncChange.objects.filter(ukma_data_id__in=ids, kind__in=("new_course", "new_offering"))
        .order_by("ukma_data_id", "-pk")
        .values_list("ukma_data_id", "kind", "after")
    )
    found: dict[str, Record] = {}
    for ukma_data_id, kind, after in rows:
        key = str(ukma_data_id)
        if key in found:
            continue
        payload = _dict(after)
        course = _dict(_dict(payload.get("display")).get("course"))
        found[key] = Record(
            id=key,
            kind="course" if kind == "new_course" else "offering",
            title=_text(payload.get("title")) or _text(course.get("title")),
            place=_text(course.get("department")),
            semester=semester_text(payload.get("semester")),
            ratings=0,
            course_id=None,
            on_site=False,
        )
    return found


def describe(ids: Iterable[str]) -> list[Record]:
    """Each id in the order given, named from the site first, then from a proposed
    new record."""
    wanted = list(dict.fromkeys(ids))[:MAX_IDS]
    found = _courses(set(wanted))
    found.update(_offerings(set(wanted) - found.keys()))
    found.update(_proposed(set(wanted) - found.keys()))
    return [
        found.get(key)
        or Record(
            id=key,
            kind=None,
            title=None,
            place=None,
            semester=None,
            ratings=0,
            course_id=None,
            on_site=False,
        )
        for key in wanted
    ]
