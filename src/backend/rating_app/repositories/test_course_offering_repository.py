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
    semester2 = SemesterFactory()
    existing = CourseOfferingFactory(
        code="CS101-001",
        course=course1,
        semester=semester1,
        credits=3.0,
        weekly_hours=2,
    )

    data = CourseOfferingDTO(
        id=uuid4(),
        code="CS101-001",
        course_id=course2.id,
        semester_id=semester2.id,
        exam_type="EXAM",
        practice_type="LAB",
        credits=Decimal("4.0"),
        weekly_hours=4,
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
    assert offering.course_id == course2.id
    assert offering.semester_id == semester2.id


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
        practice_type="LAB",
        credits=Decimal("3.0"),
        weekly_hours=2,
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
