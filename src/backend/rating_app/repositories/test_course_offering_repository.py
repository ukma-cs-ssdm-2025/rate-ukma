from decimal import Decimal
from uuid import uuid4

import pytest

from rating_app.application_schemas.course_offering import CourseOffering as CourseOfferingDTO
from rating_app.repositories.course_offering_repository import CourseOfferingRepository
from rating_app.repositories.to_domain_mappers import CourseOfferingMapper, InstructorMapper
from rating_app.tests.factories import CourseFactory, CourseOfferingFactory, SemesterFactory


@pytest.fixture
def mapper():
    return CourseOfferingMapper(InstructorMapper())


@pytest.fixture
def repo(mapper):
    return CourseOfferingRepository(mapper=mapper)


@pytest.mark.django_db
@pytest.mark.integration
def test_get_all_returns_domain_models(repo):
    CourseOfferingFactory.create_batch(3)

    result = repo.get_all()

    assert len(result) == 3
    for offering in result:
        assert hasattr(offering, "course_id")
        assert hasattr(offering, "semester_id")


@pytest.mark.django_db
@pytest.mark.integration
def test_get_or_upsert_updates_existing_offering_when_code_matches(repo):
    course1 = CourseFactory()
    course2 = CourseFactory()
    semester1 = SemesterFactory()
    existing = CourseOfferingFactory(
        code="CS101-001",
        course=course1,
        semester=semester1,
        credits=3.0,
        weekly_hours=2,
        study_year=2,
    )

    data = CourseOfferingDTO(
        id=uuid4(),
        code="CS101-001",
        course_id=course2.id,
        semester_id=semester1.id,
        exam_type="EXAM",
        practice_type="PRACTICE",
        credits=Decimal("4.0"),
        weekly_hours=4,
        study_year=3,
        lecture_count=14,
        practice_count=14,
        max_students=30,
        max_groups=2,
        group_size_min=10,
        group_size_max=20,
    )
    offering, created = repo.get_or_upsert(data)

    assert created is False
    assert offering.id == existing.id
    assert offering.credits == pytest.approx(4.0)
    assert offering.weekly_hours == 4
    assert offering.total_hours == 120
    assert offering.study_year == 3
    assert offering.course_id == course2.id
    assert offering.semester_id == semester1.id


@pytest.mark.django_db
@pytest.mark.integration
def test_get_or_upsert_creates_new_offering_for_same_code_in_other_semester(repo):
    course = CourseFactory()
    fall_semester = SemesterFactory(year=2025, term="FALL")
    spring_semester = SemesterFactory(year=2026, term="SPRING")
    existing = CourseOfferingFactory(
        code="CS101-001",
        course=course,
        semester=fall_semester,
    )

    data = CourseOfferingDTO(
        id=uuid4(),
        code="CS101-001",
        course_id=course.id,
        semester_id=spring_semester.id,
        exam_type="EXAM",
        practice_type="PRACTICE",
        credits=Decimal("4.0"),
        weekly_hours=4,
        study_year=3,
        lecture_count=14,
        practice_count=14,
        max_students=30,
        max_groups=2,
        group_size_min=10,
        group_size_max=20,
    )

    offering, created = repo.get_or_upsert(data)

    assert created is True
    assert offering.id != existing.id
    assert offering.code == existing.code
    assert offering.semester_id == spring_semester.id


@pytest.mark.django_db
@pytest.mark.integration
def test_get_or_upsert_with_return_model_returns_orm_model(repo):
    course = CourseFactory()
    semester = SemesterFactory()

    data = CourseOfferingDTO(
        id=uuid4(),
        code="CS102-001",
        course_id=course.id,
        semester_id=semester.id,
        exam_type="EXAM",
        practice_type="PRACTICE",
        credits=Decimal("3.0"),
        weekly_hours=2,
        study_year=2,
        lecture_count=14,
        practice_count=14,
        max_students=30,
        max_groups=2,
        group_size_min=10,
        group_size_max=20,
    )
    offering, created = repo.get_or_upsert(data, return_model=True)

    assert created is True
    assert hasattr(offering, "course")
    assert offering.course == course
    assert offering.total_hours == 90
    assert offering.study_year == 2


@pytest.mark.django_db
@pytest.mark.integration
def test_create_returns_hydrated_domain_model(repo):
    course = CourseFactory(title="Algorithms")
    semester = SemesterFactory(year=2024, term="FALL")

    data = CourseOfferingDTO(
        id=uuid4(),
        code="CS1031",
        course_id=course.id,
        semester_id=semester.id,
        exam_type="EXAM",
        practice_type="PRACTICE",
        credits=Decimal("3.0"),
        weekly_hours=2,
        study_year=1,
        lecture_count=14,
        practice_count=14,
        max_students=30,
        max_groups=2,
        group_size_min=10,
        group_size_max=20,
    )

    offering = repo.create(data)

    assert offering.course_title == "Algorithms"
    assert offering.semester_year == 2024
    assert offering.semester_term == semester.label
    assert offering.total_hours == 90
    assert offering.study_year == 1


@pytest.mark.django_db
@pytest.mark.integration
def test_filter_applies_kwargs(repo):
    course_one = CourseFactory()
    course_two = CourseFactory()
    target = CourseOfferingFactory(course=course_one)
    CourseOfferingFactory(course=course_two)

    result = repo.filter(course_id=course_one.id)

    assert [offering.id for offering in result] == [target.id]
