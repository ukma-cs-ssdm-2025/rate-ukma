from __future__ import annotations

import datetime
import uuid
from collections.abc import Iterable
from dataclasses import dataclass

from django.db.models import Count, Prefetch, Q

from rating_app.application_schemas.ukma_data import (
    UkmaDataCourse,
    UkmaDataDepartment,
    UkmaDataFaculty,
    UkmaDataOffering,
    UkmaDataProgramme,
    UkmaDataTerm,
)
from rating_app.models import (
    Course,
    CourseOffering,
    CourseOfferingSpeciality,
    CourseOfferingTerm,
    Department,
    Faculty,
    Speciality,
)


@dataclass(frozen=True)
class RuFaculty:
    id: str
    name: str
    ukma_data_id: str | None


@dataclass(frozen=True)
class RuDepartment:
    id: str
    name: str
    faculty_id: str
    ukma_data_id: str | None


@dataclass(frozen=True)
class RuCourse:
    id: str
    title: str
    department_id: str
    education_level: str
    status: str
    description: str
    ukma_data_id: str | None
    ratings: int


@dataclass(frozen=True)
class RuTerm:
    year: int
    term: str
    credits: str
    weekly_hours: int
    lecture_count: int | None
    practice_count: int | None
    practice_type: str
    exam_type: str


@dataclass(frozen=True)
class RuOffering:
    id: str
    code: str
    course_id: str
    semester_year: int
    semester_term: str
    exam_type: str
    study_year: int | None
    max_students: int | None
    max_groups: int | None
    group_size_min: int | None
    group_size_max: int | None
    ukma_data_id: str | None
    terms: tuple[RuTerm, ...]
    specialities: tuple[tuple[str, str], ...]
    ratings: int
    planned: int


@dataclass(frozen=True)
class RateUkmaSnapshot:
    faculties: dict[str, RuFaculty]
    departments: dict[str, RuDepartment]
    courses: dict[str, RuCourse]
    offerings: dict[str, RuOffering]
    speciality_names: frozenset[str]


@dataclass(frozen=True)
class UkmaDataSnapshot:
    faculties: dict[str, UkmaDataFaculty]
    departments: dict[str, UkmaDataDepartment]
    programmes: dict[str, UkmaDataProgramme]
    terms: dict[str, UkmaDataTerm]
    courses: dict[str, UkmaDataCourse]
    offerings: dict[str, UkmaDataOffering]
    data_updated_at: datetime.datetime | None


def load_rate_ukma_snapshot(
    *,
    offering_ids: Iterable[uuid.UUID | str] | None = None,
    course_ids: Iterable[uuid.UUID | str] | None = None,
) -> RateUkmaSnapshot:
    """Read Rate UKMA's catalog side in a bounded number of queries.

    With no ids every row is loaded. ``offering_ids`` limits the offerings;
    ``course_ids`` limits the courses and their offerings. Either way the
    snapshot also holds the offerings' courses and the courses' departments and
    faculties, so a proposal's target can be read from it.
    """
    offering_filter = None if offering_ids is None else {str(value) for value in offering_ids}
    course_filter = None if course_ids is None else {str(value) for value in course_ids}

    offerings = (
        CourseOffering.objects.select_related("course", "semester")
        .annotate(
            rating_count=Count("ratings", distinct=True),
            planned_count=Count("planned_by", distinct=True),
        )
        .prefetch_related(
            Prefetch(
                "terms",
                queryset=CourseOfferingTerm.objects.select_related("semester"),
            ),
            Prefetch(
                "course_offering_specialities",
                queryset=CourseOfferingSpeciality.objects.select_related("speciality"),
            ),
        )
        .order_by("code")
    )
    filtered = offering_filter is not None or course_filter is not None
    if filtered:
        offerings = offerings.filter(
            Q(id__in=offering_filter or set()) | Q(course_id__in=course_filter or set())
        )
    offering_rows = list(offerings)

    courses = Course.objects.select_related("department").annotate(
        rating_count=Count("offerings__ratings")
    )
    if filtered:
        loaded_course_ids = set(course_filter or ()) | {str(row.course_id) for row in offering_rows}
        courses = courses.filter(id__in=loaded_course_ids)
    course_rows = list(courses)

    departments = Department.objects.select_related("faculty")
    if filtered:
        departments = departments.filter(id__in={str(row.department_id) for row in course_rows})
    department_rows = list(departments)

    faculties = Faculty.objects.all()
    if filtered:
        faculties = faculties.filter(id__in={str(row.faculty_id) for row in department_rows})
    faculty_rows = list(faculties)

    speciality_names = frozenset(Speciality.objects.values_list("name", flat=True))

    return RateUkmaSnapshot(
        faculties={
            str(row.id): RuFaculty(id=str(row.id), name=row.name, ukma_data_id=row.ukma_data_id)
            for row in faculty_rows
        },
        departments={
            str(row.id): RuDepartment(
                id=str(row.id),
                name=row.name,
                faculty_id=str(row.faculty_id),
                ukma_data_id=row.ukma_data_id,
            )
            for row in department_rows
        },
        courses={
            str(row.id): RuCourse(
                id=str(row.id),
                title=row.title,
                department_id=str(row.department_id),
                education_level=row.education_level,
                status=row.status,
                description=row.description,
                ukma_data_id=row.ukma_data_id,
                ratings=row.rating_count,  # pyright: ignore[reportAttributeAccessIssue]  # queryset annotation
            )
            for row in course_rows
        },
        offerings={str(row.id): _offering(row) for row in offering_rows},
        speciality_names=speciality_names,
    )


def _offering(row: CourseOffering) -> RuOffering:
    terms = tuple(
        sorted(
            (
                RuTerm(
                    year=term.semester.year,
                    term=term.semester.term,
                    credits=f"{term.credits:.1f}",
                    weekly_hours=term.weekly_hours,
                    lecture_count=term.lecture_count,
                    practice_count=term.practice_count,
                    practice_type=term.practice_type,
                    exam_type=term.exam_type,
                )
                for term in row.terms.all()
            ),
            key=lambda term: (term.year, term.term),
        )
    )
    specialities = tuple(
        sorted(
            (
                (link.speciality.name, link.type_kind)
                for link in row.course_offering_specialities.all()
            ),
            key=lambda link: (link[0], link[1]),
        )
    )
    return RuOffering(
        id=str(row.id),
        code=row.code,
        course_id=str(row.course_id),
        semester_year=row.semester.year,
        semester_term=row.semester.term,
        exam_type=row.exam_type,
        study_year=row.study_year,
        max_students=row.max_students,
        max_groups=row.max_groups,
        group_size_min=row.group_size_min,
        group_size_max=row.group_size_max,
        ukma_data_id=row.ukma_data_id,
        terms=terms,
        specialities=specialities,
        ratings=row.rating_count,  # pyright: ignore[reportAttributeAccessIssue]  # queryset annotation
        planned=row.planned_count,  # pyright: ignore[reportAttributeAccessIssue]  # queryset annotation
    )
