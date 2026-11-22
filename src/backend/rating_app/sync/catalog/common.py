"""Helpers the catalog builders share: one offering index per run, drafts,
display snapshots and deterministic sorting."""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable, Mapping
from dataclasses import dataclass

from rating_app.application_schemas import ukma_data_api as ukma_data
from rating_app.sync.drafts import ChangeDraft, Identity, course_identity, make_before
from rating_app.sync.kinds import KIND_BY_NAME
from rating_app.sync.matching import academic_year_of
from rating_app.sync.snapshot import (
    RateUkmaSnapshot,
    RuCourse,
    RuOffering,
    UkmaDataSnapshot,
)

_TERM_RANK = {"FALL": 1, "SPRING": 2, "SUMMER": 3}


@dataclass(frozen=True)
class CatalogIndex:
    """Rate UKMA's offerings grouped by course once per run.

    Every helper that needs a course's offerings, its years or its latest
    offering reads this index instead of scanning the snapshot, so a build stays
    linear in the catalog size.
    """

    ru: RateUkmaSnapshot
    offerings_by_course: Mapping[str, tuple[RuOffering, ...]]
    identity_courses: Mapping[Identity, tuple[str, ...]]

    @classmethod
    def build(cls, ru: RateUkmaSnapshot) -> CatalogIndex:
        grouped: dict[str, list[RuOffering]] = defaultdict(list)
        for offering in ru.offerings.values():
            grouped[offering.course_id].append(offering)

        identities: dict[Identity, list[str]] = defaultdict(list)
        for course in ru.courses.values():
            identities[
                course_identity(course.title, course.department_id, course.education_level)
            ].append(course.id)

        return cls(
            ru=ru,
            offerings_by_course={
                course_id: tuple(sorted(rows, key=_offering_order))
                for course_id, rows in grouped.items()
            },
            identity_courses={
                identity: tuple(course_ids) for identity, course_ids in identities.items()
            },
        )

    def offerings(self, course_id: str) -> tuple[RuOffering, ...]:
        return self.offerings_by_course.get(course_id, ())

    def latest_offering(self, course_id: str) -> RuOffering | None:
        rows = self.offerings(course_id)
        return rows[-1] if rows else None

    def years(self, course_id: str) -> list[int]:
        return sorted(
            {
                academic_year_of(offering.semester_year, offering.semester_term)
                for offering in self.offerings(course_id)
            }
        )

    def courses_with_identity(
        self, title: str, department_id: str, education_level: str
    ) -> tuple[str, ...]:
        return self.identity_courses.get((title, department_id, education_level), ())


def _offering_order(offering: RuOffering) -> tuple[int, int, str]:
    return (
        academic_year_of(offering.semester_year, offering.semester_term),
        _TERM_RANK.get(offering.semester_term, 0),
        offering.code,
    )


def make_draft(
    index: CatalogIndex,
    kind: str,
    key: str,
    target_id: str | None,
    ukma_data_id: str | None,
    after: dict[str, object],
    display: dict[str, object],
    *,
    ratings: int = 0,
    requires: Iterable[dict[str, str]] = (),
) -> ChangeDraft:
    return ChangeDraft(
        kind=kind,
        key=key,
        ukma_data_id=ukma_data_id,
        target_id=target_id,
        before=make_before(kind, index.ru, target_id, after),
        after=after,
        requires=list(requires),
        ratings=ratings,
        display=display,
    )


def course_display(index: CatalogIndex, course: RuCourse) -> dict[str, object]:
    offerings = index.offerings(course.id)
    department = index.ru.departments.get(course.department_id)
    years = index.years(course.id)
    teachers = []
    for year in years:
        names = {
            instructor.name
            for offering in offerings
            if academic_year_of(offering.semester_year, offering.semester_term) == year
            for link in offering.instructor_links
            if (instructor := index.ru.instructors.get(link.instructor_id)) is not None
        }
        teachers.append({"year": year, "teachers": sorted(names)})
    return {
        "title": course.title,
        "department": department.name if department is not None else "",
        "years": years,
        "saz_codes": sorted({offering.code for offering in offerings}),
        "teachers": teachers,
    }


def department_ref(index: CatalogIndex, course: RuCourse) -> dict[str, object]:
    department = index.ru.departments.get(course.department_id)
    if department is None:
        return {"id": course.department_id, "ukma_data_id": None, "name": ""}
    return {
        "id": department.id,
        "ukma_data_id": department.ukma_data_id,
        "name": department.name,
    }


def ukma_course_display(ud: UkmaDataSnapshot, course: ukma_data.Course) -> dict[str, object]:
    department = None
    if course.department_id is not None:
        row = ud.departments.get(course.department_id)
        if row is not None:
            department = row.name
    return {
        "title": course.title,
        "department": department,
        "merge_source": merge_source(course),
    }


def merge_source(course: ukma_data.Course) -> str | None:
    return None if course.merge_source is None else course.merge_source.value


def sorted_drafts(drafts: list[ChangeDraft]) -> list[ChangeDraft]:
    return sorted(drafts, key=lambda draft: (KIND_BY_NAME[draft.kind].order, draft.key))


def sorted_skips(skipped: dict[str, list[str]]) -> dict[str, list[str]]:
    return {reason: sorted(ids) for reason, ids in sorted(skipped.items()) if ids}
