from decimal import Decimal

import pytest

from rating_app.models.choices import (
    CourseTypeKind,
    ExamType,
    InstructorRole,
    SemesterTerm,
)
from rating_app.sync.snapshot import load_rate_ukma_snapshot


@pytest.mark.django_db
@pytest.mark.integration
def test_load_rate_ukma_snapshot_counts_and_sorts_terms(
    faculty_factory,
    department_factory,
    course_factory,
    semester_factory,
    course_offering_factory,
    course_offering_term_factory,
    course_offering_speciality_factory,
    speciality_factory,
    instructor_factory,
    course_instructor_factory,
    rating_factory,
    planned_course_factory,
):
    faculty = faculty_factory(ukma_data_id="ud_faculty")
    department = department_factory(faculty=faculty, ukma_data_id="ud_department")
    course = course_factory(department=department, ukma_data_id="ud_course")
    fall = semester_factory(year=2025, term=SemesterTerm.FALL)
    spring = semester_factory(year=2024, term=SemesterTerm.SPRING)
    offering = course_offering_factory(
        course=course,
        semester=fall,
        exam_type=ExamType.CREDIT,
        ukma_data_id="ud_offering",
    )
    course_offering_term_factory(
        offering=offering,
        semester=fall,
        credits=Decimal("3.0"),
        exam_type=ExamType.CREDIT,
    )
    course_offering_term_factory(
        offering=offering,
        semester=spring,
        credits=Decimal("4.5"),
        exam_type=ExamType.EXAM,
    )
    media = speciality_factory(faculty=faculty, name="Медіа")
    analysis = speciality_factory(faculty=faculty, name="Аналіз")
    course_offering_speciality_factory(
        offering=offering, speciality=media, type_kind=CourseTypeKind.PROF_ORIENTED
    )
    course_offering_speciality_factory(
        offering=offering, speciality=analysis, type_kind=CourseTypeKind.COMPULSORY
    )
    lecturer = instructor_factory(
        email="teacher@example.test", last_name="Тестова", first_name="Олена", patronymic=""
    )
    course_instructor_factory(
        course_offering=offering, instructor=lecturer, role=InstructorRole.LECTURE_INSTRUCTOR
    )
    rating_factory.create_batch(2, course_offering=offering)
    planned_course_factory.create_batch(2, offering=offering)

    other_course = course_factory(department=department, ukma_data_id="ud_other_course")
    other_offering = course_offering_factory(
        course=other_course, semester=fall, ukma_data_id="ud_other_offering"
    )

    snapshot = load_rate_ukma_snapshot(offering_ids=[offering.id])

    loaded = snapshot.offerings[str(offering.id)]
    assert set(snapshot.offerings) == {str(offering.id)}
    assert loaded.ratings == 2
    assert loaded.planned == 2
    assert [(term.year, term.term) for term in loaded.terms] == [
        (2024, SemesterTerm.SPRING),
        (2025, SemesterTerm.FALL),
    ]
    assert [term.credits for term in loaded.terms] == ["4.5", "3.0"]
    assert loaded.specialities == (
        ("Аналіз", CourseTypeKind.COMPULSORY),
        ("Медіа", CourseTypeKind.PROF_ORIENTED),
    )
    assert [(link.instructor_id, link.role) for link in loaded.instructor_links] == [
        (str(lecturer.id), InstructorRole.LECTURE_INSTRUCTOR)
    ]
    assert str(course.id) in snapshot.courses
    assert str(department.id) in snapshot.departments
    assert str(faculty.id) in snapshot.faculties
    assert snapshot.faculties[str(faculty.id)].ukma_data_id == "ud_faculty"
    assert str(other_course.id) not in snapshot.courses
    assert str(other_offering.id) not in snapshot.offerings
    assert {"Медіа", "Аналіз"} <= snapshot.speciality_names


@pytest.mark.django_db
@pytest.mark.integration
def test_load_rate_ukma_snapshot_loads_teacher_links_and_names(
    course_offering_factory,
    instructor_factory,
    course_instructor_factory,
):
    offering = course_offering_factory()
    lecturer = instructor_factory(
        email="teacher@example.test", last_name="Тестова", first_name="Олена", patronymic="П."
    )
    practice = instructor_factory(
        email="practice@example.test", last_name="Практична", first_name="Ірина", patronymic=""
    )
    course_instructor_factory(
        course_offering=offering, instructor=lecturer, role=InstructorRole.LECTURE_INSTRUCTOR
    )
    course_instructor_factory(
        course_offering=offering, instructor=practice, role=InstructorRole.PRACTICUM_INSTRUCTOR
    )

    snapshot = load_rate_ukma_snapshot(offering_ids=[offering.id])

    links = snapshot.offerings[str(offering.id)].instructor_links
    assert {(link.instructor_id, link.role) for link in links} == {
        (str(lecturer.id), InstructorRole.LECTURE_INSTRUCTOR),
        (str(practice.id), InstructorRole.PRACTICUM_INSTRUCTOR),
    }
    assert snapshot.instructors[str(lecturer.id)].email == "teacher@example.test"
    assert snapshot.instructors[str(lecturer.id)].name == "Тестова Олена П."
    assert snapshot.instructors[str(practice.id)].name == "Практична Ірина"


@pytest.mark.django_db
@pytest.mark.integration
def test_load_rate_ukma_snapshot_uses_eight_queries(
    django_assert_num_queries,
    course_offering_factory,
    course_instructor_factory,
):
    offering = course_offering_factory()
    course_instructor_factory(course_offering=offering)

    with django_assert_num_queries(8):
        load_rate_ukma_snapshot(offering_ids=[offering.id])
