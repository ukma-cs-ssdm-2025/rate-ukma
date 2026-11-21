from decimal import Decimal

import pytest

from rating_app.models.choices import (
    CourseStatus,
    CourseTypeKind,
    EducationLevel,
    ExamType,
    InstructorRole,
    SemesterTerm,
)
from rating_app.sync.current_values import TargetMissingError, current_values
from rating_app.sync.snapshot import RateUkmaSnapshot, load_rate_ukma_snapshot


@pytest.mark.django_db
@pytest.mark.integration
def test_current_values_change_offering_returns_canonical_values(
    faculty_factory,
    department_factory,
    course_factory,
    semester_factory,
    course_offering_factory,
    course_offering_term_factory,
    course_offering_speciality_factory,
    speciality_factory,
):
    faculty = faculty_factory()
    department = department_factory(faculty=faculty)
    course = course_factory(department=department)
    fall = semester_factory(year=2025, term=SemesterTerm.FALL)
    spring = semester_factory(year=2024, term=SemesterTerm.SPRING)
    offering = course_offering_factory(course=course, semester=fall)
    course_offering_term_factory(
        offering=offering,
        semester=fall,
        credits=Decimal("3.0"),
        weekly_hours=4,
        lecture_count=16,
        practice_count=16,
        practice_type="",
        exam_type=ExamType.EXAM,
    )
    course_offering_term_factory(
        offering=offering,
        semester=spring,
        credits=Decimal("4.5"),
        weekly_hours=6,
        lecture_count=20,
        practice_count=10,
        practice_type="PRACTICE",
        exam_type=ExamType.CREDIT,
    )
    media = speciality_factory(faculty=faculty, name="Медіа")
    analysis = speciality_factory(faculty=faculty, name="Аналіз")
    course_offering_speciality_factory(
        offering=offering, speciality=media, type_kind=CourseTypeKind.PROF_ORIENTED
    )
    course_offering_speciality_factory(
        offering=offering, speciality=analysis, type_kind=CourseTypeKind.COMPULSORY
    )
    snapshot = load_rate_ukma_snapshot(offering_ids=[offering.id])

    values = current_values("change_offering", snapshot, str(offering.id))

    assert values == {
        "semester": {"year": 2025, "term": SemesterTerm.FALL},
        "exam_type": ExamType.EXAM,
        "study_year": 1,
        "max_students": 60,
        "max_groups": 3,
        "group_size_min": 10,
        "group_size_max": 30,
        "terms": [
            {
                "year": 2024,
                "term": SemesterTerm.SPRING,
                "credits": "4.5",
                "weekly_hours": 6,
                "lecture_count": 20,
                "practice_count": 10,
                "practice_type": "PRACTICE",
                "exam_type": ExamType.CREDIT,
            },
            {
                "year": 2025,
                "term": SemesterTerm.FALL,
                "credits": "3.0",
                "weekly_hours": 4,
                "lecture_count": 16,
                "practice_count": 16,
                "practice_type": "",
                "exam_type": ExamType.EXAM,
            },
        ],
        "specialities_added": [
            {"name": "Аналіз", "kind": CourseTypeKind.COMPULSORY},
            {"name": "Медіа", "kind": CourseTypeKind.PROF_ORIENTED},
        ],
    }


@pytest.mark.django_db
@pytest.mark.integration
def test_current_values_change_course_returns_department_ref(
    faculty_factory, department_factory, course_factory
):
    faculty = faculty_factory(ukma_data_id="ud_faculty")
    department = department_factory(
        faculty=faculty, ukma_data_id="ud_department", name="Кафедра даних"
    )
    course = course_factory(
        department=department,
        title="Аналіз даних",
        description="Опис курсу",
        status=CourseStatus.FINISHED,
        education_level=EducationLevel.MASTER,
    )
    snapshot = load_rate_ukma_snapshot(course_ids=[course.id])

    values = current_values("change_course", snapshot, str(course.id))

    assert values == {
        "title": "Аналіз даних",
        "department": {
            "id": str(department.id),
            "ukma_data_id": "ud_department",
            "name": "Кафедра даних",
        },
        "education_level": EducationLevel.MASTER,
        "status": CourseStatus.FINISHED,
        "description": "Опис курсу",
    }


@pytest.mark.django_db
@pytest.mark.integration
def test_current_values_link_offering_returns_ukma_data_id(course_offering_factory):
    offering = course_offering_factory(ukma_data_id="ud_offering")
    snapshot = load_rate_ukma_snapshot(offering_ids=[offering.id])

    assert current_values("link_offering", snapshot, str(offering.id)) == {
        "ukma_data_id": "ud_offering"
    }


@pytest.mark.django_db
@pytest.mark.integration
def test_current_values_teacher_links_are_the_offerings_sorted_links(
    course_offering_factory, instructor_factory, course_instructor_factory
):
    offering = course_offering_factory()
    lecturer = instructor_factory(email="lecturer@example.test")
    practice = instructor_factory(email="practice@example.test")
    course_instructor_factory(
        course_offering=offering, instructor=lecturer, role=InstructorRole.LECTURE_INSTRUCTOR
    )
    course_instructor_factory(
        course_offering=offering, instructor=practice, role=InstructorRole.PRACTICUM_INSTRUCTOR
    )
    snapshot = load_rate_ukma_snapshot(offering_ids=[offering.id])

    expected = {
        "links": sorted(
            [
                {"instructor_id": str(lecturer.id), "role": InstructorRole.LECTURE_INSTRUCTOR},
                {"instructor_id": str(practice.id), "role": InstructorRole.PRACTICUM_INSTRUCTOR},
            ],
            key=lambda link: (link["instructor_id"], link["role"]),
        )
    }

    assert current_values("teacher_link_added", snapshot, str(offering.id)) == expected
    assert current_values("teacher_link_removed", snapshot, str(offering.id)) == expected


@pytest.mark.django_db
@pytest.mark.integration
def test_current_values_raises_target_missing_when_target_absent(course_offering_factory):
    offering = course_offering_factory()
    snapshot = load_rate_ukma_snapshot(offering_ids=[])

    with pytest.raises(TargetMissingError, match="not found"):
        current_values("change_offering", snapshot, str(offering.id))


def test_current_values_returns_empty_dict_when_kind_has_no_target():
    snapshot = RateUkmaSnapshot({}, {}, {}, {}, {}, frozenset())

    assert current_values("new_offering", snapshot, None) == {}
    assert current_values("teacher_created", snapshot, None) == {}
