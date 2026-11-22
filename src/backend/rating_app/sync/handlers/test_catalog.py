"""Catalog handlers write exactly what a change describes, in a few statements."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

import pytest

from rating_app.models import (
    Course,
    CourseOffering,
    CourseOfferingSpeciality,
    CourseOfferingTerm,
    Department,
    Faculty,
    Semester,
    SyncChange,
)
from rating_app.models.choices import CourseTypeKind, ExamType, PracticeType, SemesterTerm
from rating_app.sync import handlers
from rating_app.sync.kinds import KIND_BY_NAME


def change(
    kind: str,
    key: str,
    after: dict[str, Any],
    *,
    target_id: str | None = None,
    before: dict[str, Any] | None = None,
) -> SyncChange:
    registry_kind = KIND_BY_NAME[kind]
    return SyncChange(
        source=registry_kind.source,
        group=registry_kind.group,
        kind=kind,
        key=key,
        target_id=target_id,
        before=before or {},
        after=after,
    )


def handler(kind: str):
    resolved = handlers.handler_for(kind)
    assert resolved is not None
    return resolved


def term(year: int = 2025, season: str = "FALL") -> dict[str, Any]:
    return {
        "year": year,
        "term": season,
        "credits": "3.0",
        "weekly_hours": 4,
        "lecture_count": 16,
        "practice_count": 16,
        "practice_type": "SEMINAR",
        "exam_type": "EXAM",
    }


def offering_after(
    *,
    course_id: str | None = None,
    course_ukma_id: str | None = None,
    saz_code: str = "315421",
    specialities: list[dict[str, str]] | None = None,
) -> dict[str, Any]:
    after: dict[str, Any] = {
        "saz_code": saz_code,
        "semester": {"year": 2025, "term": "FALL"},
        "exam_type": "EXAM",
        "study_year": 1,
        "max_students": 60,
        "max_groups": 3,
        "group_size_min": 10,
        "group_size_max": 30,
        "terms": [term()],
        "specialities": specialities or [],
    }
    if course_id is not None:
        after["course_id"] = course_id
    if course_ukma_id is not None:
        after["course_ukma_id"] = course_ukma_id
    return after


@pytest.mark.django_db
@pytest.mark.integration
def test_link_handlers_set_each_rows_ukma_data_id(
    faculty_factory,
    department_factory,
    course_factory,
    course_offering_factory,
):
    faculty = faculty_factory()
    department = department_factory(faculty=faculty)
    course = course_factory(department=department)
    offering = course_offering_factory(course=course)

    handler("link_faculty").apply(
        change(
            "link_faculty", str(faculty.pk), {"ukma_data_id": "ud-fac"}, target_id=str(faculty.pk)
        )
    )
    handler("link_department").apply(
        change(
            "link_department",
            str(department.pk),
            {"ukma_data_id": "ud-dept"},
            target_id=str(department.pk),
        )
    )
    handler("link_course").apply(
        change(
            "link_course", str(course.pk), {"ukma_data_id": "ud-course"}, target_id=str(course.pk)
        )
    )
    handler("link_offering").apply(
        change(
            "link_offering",
            str(offering.pk),
            {"ukma_data_id": "ud-offering"},
            target_id=str(offering.pk),
        )
    )

    faculty.refresh_from_db()
    department.refresh_from_db()
    course.refresh_from_db()
    offering.refresh_from_db()
    assert faculty.ukma_data_id == "ud-fac"
    assert department.ukma_data_id == "ud-dept"
    assert course.ukma_data_id == "ud-course"
    assert offering.ukma_data_id == "ud-offering"


@pytest.mark.django_db
@pytest.mark.integration
def test_a_link_batch_is_one_statement_whatever_the_row_count(
    django_assert_num_queries,
    faculty_factory,
):
    few = faculty_factory.create_batch(3)
    many = faculty_factory.create_batch(30)

    def changes(rows):
        return [
            change(
                "link_faculty", str(row.pk), {"ukma_data_id": f"ud-{row.pk}"}, target_id=str(row.pk)
            )
            for row in rows
        ]

    with django_assert_num_queries(1):
        handler("link_faculty").apply_many(changes(few))
    with django_assert_num_queries(1):
        handler("link_faculty").apply_many(changes(many))

    assert Faculty.objects.filter(ukma_data_id__isnull=False).count() == 33


@pytest.mark.django_db
@pytest.mark.integration
def test_new_faculty_creates_the_row_with_its_ukma_data_id():
    handler("new_faculty").apply(change("new_faculty", "ud-fac", {"name": "Факультет даних"}))

    faculty = Faculty.objects.get()
    assert (faculty.ukma_data_id, faculty.name) == ("ud-fac", "Факультет даних")


@pytest.mark.django_db
@pytest.mark.integration
def test_new_department_finds_its_faculty_by_ukma_data_id(faculty_factory):
    faculty = faculty_factory(ukma_data_id="ud-fac")

    handler("new_department").apply(
        change("new_department", "ud-dept", {"name": "Кафедра даних", "faculty_ukma_id": "ud-fac"})
    )

    department = Department.objects.get()
    assert department.faculty_id == faculty.pk
    assert (department.ukma_data_id, department.name) == ("ud-dept", "Кафедра даних")


@pytest.mark.django_db
@pytest.mark.integration
def test_new_department_without_its_faculty_writes_nothing(department_factory):
    with pytest.raises(LookupError):
        handler("new_department").apply(
            change(
                "new_department",
                "ud-dept",
                {"name": "Кафедра даних", "faculty_ukma_id": "ud-missing"},
            )
        )

    assert Department.objects.count() == 0


@pytest.mark.django_db
@pytest.mark.integration
def test_new_course_writes_every_after_value(department_factory):
    department = department_factory(ukma_data_id="ud-dept")

    handler("new_course").apply(
        change(
            "new_course",
            "ud-course",
            {
                "title": "Основи числових методів",
                "level": "MASTER",
                "department_ukma_id": "ud-dept",
                "status": "ACTIVE",
                "description": "Опис курсу",
            },
        )
    )

    course = Course.objects.get()
    assert course.department_id == department.pk
    assert (course.ukma_data_id, course.title, course.education_level) == (
        "ud-course",
        "Основи числових методів",
        "MASTER",
    )
    assert (course.status, course.description) == ("ACTIVE", "Опис курсу")


@pytest.mark.django_db
@pytest.mark.integration
def test_new_offering_on_an_existing_course_writes_terms_and_specialities(
    course_factory, speciality_factory
):
    course = course_factory()
    speciality = speciality_factory(name="Спеціальність даних")

    handler("new_offering").apply(
        change(
            "new_offering",
            "ud-offering",
            offering_after(
                course_id=str(course.pk),
                specialities=[{"name": speciality.name, "kind": "COMPULSORY"}],
            ),
        )
    )

    offering = CourseOffering.objects.get()
    assert offering.course_id == course.pk
    assert offering.ukma_data_id == "ud-offering"
    assert offering.code == "315421"
    assert offering.max_students == 60
    term_row = CourseOfferingTerm.objects.get()
    assert term_row.semester == Semester.objects.get(year=2025, term=SemesterTerm.FALL)
    assert term_row.credits == Decimal("3.0")
    assert term_row.practice_type == PracticeType.SEMINAR.value
    assert term_row.exam_type == ExamType.EXAM.value
    link = CourseOfferingSpeciality.objects.get()
    assert (link.speciality_id, link.type_kind) == (
        speciality.pk,
        CourseTypeKind.COMPULSORY.value,
    )


@pytest.mark.django_db
@pytest.mark.integration
def test_new_offering_finds_the_course_created_in_the_same_run(course_factory, department_factory):
    department = department_factory(ukma_data_id="ud-dept")
    handler("new_course").apply(
        change(
            "new_course",
            "ud-course",
            {
                "title": "Новий курс",
                "level": "BACHELOR",
                "department_ukma_id": "ud-dept",
                "status": "ACTIVE",
                "description": "",
            },
        )
    )
    course = Course.objects.get(department=department)

    handler("new_offering").apply(
        change("new_offering", "ud-offering", offering_after(course_ukma_id="ud-course"))
    )

    assert CourseOffering.objects.get().course_id == course.pk


@pytest.mark.django_db
@pytest.mark.integration
def test_change_handlers_write_the_after_values(
    faculty_factory,
    department_factory,
    course_factory,
    course_offering_factory,
):
    faculty = faculty_factory(name="Старий факультет")
    department = department_factory(faculty=faculty, name="Стара кафедра")
    course = course_factory(department=department, title="Старий курс")
    offering = course_offering_factory(course=course, max_students=10)
    new_department = department_factory(faculty=faculty, name="Нова кафедра")

    handler("change_faculty").apply(
        change(
            "change_faculty",
            str(faculty.pk),
            {"name": "Новий факультет"},
            target_id=str(faculty.pk),
        )
    )
    handler("change_department").apply(
        change(
            "change_department",
            str(department.pk),
            {"name": "Новіша кафедра"},
            target_id=str(department.pk),
        )
    )
    handler("change_course").apply(
        change(
            "change_course",
            str(course.pk),
            {
                "title": "Новий курс",
                "department": {
                    "id": str(new_department.pk),
                    "ukma_data_id": None,
                    "name": new_department.name,
                },
                "education_level": "MASTER",
                "status": "FINISHED",
                "description": "Новий опис",
            },
            target_id=str(course.pk),
        )
    )
    handler("change_offering").apply(
        change(
            "change_offering",
            str(offering.pk),
            {"max_students": 99, "exam_type": "CREDIT"},
            target_id=str(offering.pk),
        )
    )

    faculty.refresh_from_db()
    department.refresh_from_db()
    course.refresh_from_db()
    offering.refresh_from_db()
    assert faculty.name == "Новий факультет"
    assert department.name == "Новіша кафедра"
    assert (course.title, course.department_id, course.education_level) == (
        "Новий курс",
        new_department.pk,
        "MASTER",
    )
    assert (course.status, course.description) == ("FINISHED", "Новий опис")
    assert (offering.max_students, offering.exam_type) == (99, "CREDIT")
    assert offering.study_year is not None


@pytest.mark.django_db
@pytest.mark.integration
def test_change_course_keeps_fields_the_change_does_not_write(course_factory):
    course = course_factory(title="Старий курс", description="Старий опис")

    handler("change_course").apply(
        change("change_course", str(course.pk), {"title": "Новий курс"}, target_id=str(course.pk))
    )

    course.refresh_from_db()
    assert course.title == "Новий курс"
    assert course.description == "Старий опис"


@pytest.mark.django_db
@pytest.mark.integration
def test_change_offering_clears_a_field_it_sets_to_null(course_offering_factory):
    offering = course_offering_factory(study_year=3)

    handler("change_offering").apply(
        change(
            "change_offering", str(offering.pk), {"study_year": None}, target_id=str(offering.pk)
        )
    )

    offering.refresh_from_db()
    assert offering.study_year is None


@pytest.mark.django_db
@pytest.mark.integration
def test_change_offering_replaces_terms_and_adds_a_speciality(
    course_offering_factory, course_offering_term_factory, speciality_factory
):
    offering = course_offering_factory()
    course_offering_term_factory(offering=offering, credits=Decimal("5.0"))
    speciality = speciality_factory(name="Нова спеціальність")

    handler("change_offering").apply(
        change(
            "change_offering",
            str(offering.pk),
            {
                "terms": [term(season="SPRING")],
                "specialities_added": [{"name": speciality.name, "kind": "ELECTIVE"}],
            },
            target_id=str(offering.pk),
        )
    )

    terms = CourseOfferingTerm.objects.filter(offering=offering)
    assert terms.count() == 1
    assert terms.get().semester.term == SemesterTerm.SPRING
    link = CourseOfferingSpeciality.objects.get(offering=offering)
    assert (link.speciality_id, link.type_kind) == (speciality.pk, CourseTypeKind.ELECTIVE.value)


@pytest.mark.django_db
@pytest.mark.integration
def test_removed_kinds_never_delete_a_catalog_row(course_factory, course_offering_factory):
    course = course_factory()
    offering = course_offering_factory(course=course)

    handler("removed_course").apply(
        change(
            "removed_course",
            str(course.pk),
            {"ukma_data_id": "ud-course", "title": "Курс", "removed_at": None},
            target_id=str(course.pk),
        )
    )
    handler("removed_offering").apply(
        change(
            "removed_offering",
            str(offering.pk),
            {"saz_code": offering.code, "title": "Курс", "removed_at": None},
            target_id=str(offering.pk),
        )
    )

    assert Course.objects.filter(pk=course.pk).exists()
    assert CourseOffering.objects.filter(pk=offering.pk).exists()


@pytest.mark.django_db
@pytest.mark.integration
def test_exists_answers_whether_a_link_applied(faculty_factory):
    faculty = faculty_factory()

    assert handler("link_faculty").exists is not None
    assert not handler("link_faculty").exists(str(faculty.pk))

    handler("link_faculty").apply(
        change(
            "link_faculty", str(faculty.pk), {"ukma_data_id": "ud-fac"}, target_id=str(faculty.pk)
        )
    )

    assert handler("link_faculty").exists(str(faculty.pk))


@pytest.mark.django_db
@pytest.mark.integration
def test_exists_answers_whether_a_new_row_is_there(faculty_factory, course_factory):
    faculty_factory(ukma_data_id="ud-fac")
    course_factory(ukma_data_id="ud-course")

    assert handler("new_faculty").exists is not None
    assert handler("new_faculty").exists("ud-fac")
    assert not handler("new_faculty").exists("ud-other")
    assert handler("new_course").exists is not None
    assert handler("new_course").exists("ud-course")
    assert not handler("new_course").exists("ud-other")
