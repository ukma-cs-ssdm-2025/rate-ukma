import pytest

from rating_app.models import CourseOffering
from rating_app.repositories.course_offering_repository import CourseOfferingRepository
from rating_app.tests.factories import CourseFactory, CourseOfferingFactory, SemesterFactory


@pytest.fixture
def repo():
    return CourseOfferingRepository()


@pytest.mark.django_db
def test_get_all_returns_all_course_offerings(repo):
    # Arrange
    CourseOfferingFactory.create_batch(3)

    # Act
    result = repo.get_all()

    # Assert
    assert len(result) == 3
    assert all(isinstance(offering, CourseOffering) for offering in result)


@pytest.mark.django_db
def test_get_all_returns_empty_list_when_no_offerings(repo):
    # Act
    result = repo.get_all()

    # Assert
    assert result == []


@pytest.mark.django_db
def test_get_all_prefetches_related_course_and_semester(repo, django_assert_num_queries):
    # Arrange
    CourseOfferingFactory.create_batch(3)

    # Act
    result = repo.get_all()

    # Assert
    with django_assert_num_queries(0):
        for offering in result:
            _ = offering.course.title
            _ = offering.semester.year


@pytest.mark.django_db
def test_get_by_id_returns_offering_by_id(repo):
    # Arrange
    offering = CourseOfferingFactory()

    # Act
    result = repo.get_by_id(offering.id)

    # Assert
    assert result.id == offering.id


@pytest.mark.django_db
def test_get_by_id_raises_error_when_id_not_found(repo):
    # Arrange
    invalid_id = "00000000-0000-0000-0000-000000000000"

    # Act & Assert
    with pytest.raises(CourseOffering.DoesNotExist):
        repo.get_by_id(invalid_id)


@pytest.mark.django_db
def test_get_by_id_prefetches_related_course_and_semester(repo, django_assert_num_queries):
    # Arrange
    offering = CourseOfferingFactory()

    # Act
    result = repo.get_by_id(offering.id)

    # Assert
    with django_assert_num_queries(0):
        _ = result.course.title
        _ = result.semester.year


@pytest.mark.django_db
def test_get_by_course_returns_offerings_for_course(repo):
    # Arrange
    course = CourseFactory()
    CourseOfferingFactory.create_batch(3, course=course)
    CourseOfferingFactory.create_batch(2)  # Other course offerings

    # Act
    result = repo.get_by_course(course.id)

    # Assert
    assert len(result) == 3
    assert all(offering.course_id == course.id for offering in result)


@pytest.mark.django_db
def test_get_by_course_returns_empty_list_when_no_offerings(repo):
    # Arrange
    course = CourseFactory()

    # Act
    result = repo.get_by_course(course.id)

    # Assert
    assert result == []


@pytest.mark.django_db
def test_get_or_upsert_creates_new_offering_when_not_exists(repo):
    # Arrange
    course = CourseFactory()
    semester = SemesterFactory()
    data = {
        "course": course,
        "semester": semester,
        "code": "CS101-001",
        "exam_type": "EXAM",
        "practice_type": "LAB",
        "credits": 3.0,
        "weekly_hours": 4,
        "lecture_count": 14,
        "practice_count": 14,
        "max_students": 30,
        "max_groups": 2,
        "group_size_min": 10,
        "group_size_max": 20,
    }

    # Act
    offering, created = repo.get_or_upsert(**data)

    # Assert
    assert created is True
    assert offering.code == "CS101-001"
    assert offering.course == course
    assert offering.semester == semester


@pytest.mark.django_db
def test_get_or_upsert_updates_existing_offering_when_code_matches(repo):
    # Arrange
    course1 = CourseFactory()
    course2 = CourseFactory()
    semester1 = SemesterFactory()
    semester2 = SemesterFactory()
    existing = CourseOfferingFactory(
        code="CS101-001", course=course1, semester=semester1, credits=3.0
    )

    # Act - same code but different data
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

    # Assert
    assert created is False
    assert offering.id == existing.id
    assert offering.credits == 4.0
    assert offering.course == course2
    assert offering.semester == semester2


@pytest.mark.django_db
def test_filter_returns_all_offerings(repo):
    # Arrange
    CourseOfferingFactory.create_batch(3)

    # Act
    result = repo.filter()

    # Assert
    assert len(result) == 3


@pytest.mark.django_db
def test_create_creates_offering_with_provided_data(repo):
    # Arrange
    course = CourseFactory()
    semester = SemesterFactory()
    data = {
        "course": course,
        "semester": semester,
        "code": "CS101-001",
        "exam_type": "EXAM",
        "practice_type": "LAB",
        "credits": 3.0,
        "weekly_hours": 4,
    }

    # Act
    result = repo.create(**data)

    # Assert
    assert result.code == "CS101-001"
    assert result.course == course
    assert CourseOffering.objects.filter(id=result.id).exists()


@pytest.mark.django_db
def test_update_persists_updates_to_database(repo):
    # Arrange
    offering = CourseOfferingFactory(credits=3.0)

    # Act
    repo.update(offering, credits=4.0)

    # Assert
    updated = CourseOffering.objects.get(id=offering.id)
    assert updated.credits == 4.0


@pytest.mark.django_db
def test_delete_deletes_offering_from_database(repo):
    # Arrange
    offering = CourseOfferingFactory()
    offering_id = offering.id

    # Act
    repo.delete(offering)

    # Assert
    assert not CourseOffering.objects.filter(id=offering_id).exists()


@pytest.mark.django_db
def test_delete_deletes_correct_offering(repo):
    # Arrange
    keep1 = CourseOfferingFactory()
    to_delete = CourseOfferingFactory()
    keep2 = CourseOfferingFactory()

    # Act
    repo.delete(to_delete)

    # Assert
    remaining_ids = set(CourseOffering.objects.values_list("id", flat=True))
    assert keep1.id in remaining_ids
    assert keep2.id in remaining_ids
    assert to_delete.id not in remaining_ids
