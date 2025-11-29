import pytest

from rating_app.repositories.course_offering_repository import CourseOfferingRepository
from rating_app.tests.factories import CourseFactory, CourseOfferingFactory, SemesterFactory


@pytest.fixture
def repo():
    return CourseOfferingRepository()


@pytest.mark.django_db
@pytest.mark.integration
def test_get_all_prefetches_related_course_and_semester(repo, django_assert_num_queries):
    CourseOfferingFactory.create_batch(3)

    result = repo.get_all()

    with django_assert_num_queries(0):
        for offering in result:
            _ = offering.course.title
            _ = offering.semester.year


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

    offering, created = repo.get_or_upsert(
        course=course2,
        semester=semester2,
        code="CS101-001",
        exam_type="EXAM",
        practice_type="LAB",
        credits=4.0,
        weekly_hours=4,
        lecture_count=14,
        practice_count=14,
        max_students=30,
        max_groups=2,
        group_size_min=10,
        group_size_max=20,
    )

    assert created is False
    assert offering.id == existing.id
    assert offering.credits == 4.0
    assert offering.weekly_hours == 4
    assert offering.course == course2
    assert offering.semester == semester2
