import pytest

from rating_app.models import CourseInstructor
from rating_app.models.choices import InstructorRole
from rating_app.repositories.course_instructor_repository import CourseInstructorRepository
from rating_app.tests.factories import (
    CourseInstructorFactory,
    CourseOfferingFactory,
    InstructorFactory,
)


@pytest.fixture
def repo():
    return CourseInstructorRepository()


@pytest.mark.django_db
class TestGetAll:
    def test_returns_all_course_instructors(self, repo):
        # Arrange
        CourseInstructorFactory.create_batch(3)

        # Act
        result = repo.get_all()

        # Assert
        assert len(result) == 3
        assert all(isinstance(ci, CourseInstructor) for ci in result)

    def test_returns_empty_list_when_no_course_instructors(self, repo):
        # Act
        result = repo.get_all()

        # Assert
        assert result == []

    def test_prefetches_related_instructor_and_course_offering(
        self, repo, django_assert_num_queries
    ):
        # Arrange
        CourseInstructorFactory.create_batch(3)

        # Act
        result = repo.get_all()

        # Assert
        with django_assert_num_queries(0):
            for ci in result:
                _ = ci.instructor.first_name
                _ = ci.course_offering.code


@pytest.mark.django_db
class TestGetById:
    def test_returns_course_instructor_by_id(self, repo):
        # Arrange
        course_instructor = CourseInstructorFactory()

        # Act
        result = repo.get_by_id(course_instructor.id)

        # Assert
        assert result.id == course_instructor.id
        assert isinstance(result, CourseInstructor)

    def test_raises_error_when_id_not_found(self, repo):
        # Arrange
        invalid_id = "00000000-0000-0000-0000-000000000000"

        # Act & Assert
        with pytest.raises(CourseInstructor.DoesNotExist):
            repo.get_by_id(invalid_id)

    def test_prefetches_related_instructor_and_course_offering(
        self, repo, django_assert_num_queries
    ):
        # Arrange
        course_instructor = CourseInstructorFactory()

        # Act
        result = repo.get_by_id(course_instructor.id)

        # Assert
        with django_assert_num_queries(0):
            _ = result.instructor.first_name
            _ = result.course_offering.code


@pytest.mark.django_db
class TestGetOrCreate:
    def test_creates_new_course_instructor_when_not_exists(self, repo):
        # Arrange
        instructor = InstructorFactory()
        course_offering = CourseOfferingFactory()
        role = InstructorRole.LECTURE_INSTRUCTOR

        # Act
        course_instructor, created = repo.get_or_create(
            instructor=instructor, course_offering=course_offering, role=role
        )

        # Assert
        assert created is True
        assert course_instructor.instructor == instructor
        assert course_instructor.course_offering == course_offering
        assert course_instructor.role == role

    def test_returns_existing_course_instructor_when_exists(self, repo):
        # Arrange
        existing = CourseInstructorFactory(role=InstructorRole.LECTURE_INSTRUCTOR)

        # Act
        course_instructor, created = repo.get_or_create(
            instructor=existing.instructor,
            course_offering=existing.course_offering,
            role=existing.role,
        )

        # Assert
        assert created is False
        assert course_instructor.id == existing.id

    def test_creates_different_instructor_with_different_role(self, repo):
        # Arrange
        existing = CourseInstructorFactory(role=InstructorRole.LECTURE_INSTRUCTOR)

        # Act
        course_instructor, created = repo.get_or_create(
            instructor=existing.instructor,
            course_offering=existing.course_offering,
            role=InstructorRole.PRACTICUM_INSTRUCTOR,
        )

        # Assert
        assert created is True
        assert course_instructor.id != existing.id
        assert course_instructor.role == InstructorRole.PRACTICUM_INSTRUCTOR


@pytest.mark.django_db
class TestCreate:
    def test_creates_course_instructor_with_provided_data(self, repo):
        # Arrange
        instructor = InstructorFactory()
        course_offering = CourseOfferingFactory()
        data = {
            "instructor": instructor,
            "course_offering": course_offering,
            "role": InstructorRole.LECTURE_INSTRUCTOR,
        }

        # Act
        result = repo.create(**data)

        # Assert
        assert result.instructor == instructor
        assert result.course_offering == course_offering
        assert result.role == InstructorRole.LECTURE_INSTRUCTOR
        assert CourseInstructor.objects.filter(id=result.id).exists()


@pytest.mark.django_db
class TestUpdate:
    def test_updates_course_instructor_fields(self, repo):
        # Arrange
        course_instructor = CourseInstructorFactory(role=InstructorRole.LECTURE_INSTRUCTOR)
        new_role = InstructorRole.PRACTICUM_INSTRUCTOR

        # Act
        result = repo.update(course_instructor, role=new_role)

        # Assert
        assert result.id == course_instructor.id
        assert result.role == new_role

    def test_persists_updates_to_database(self, repo):
        # Arrange
        course_instructor = CourseInstructorFactory(role=InstructorRole.LECTURE_INSTRUCTOR)
        new_role = InstructorRole.PRACTICUM_INSTRUCTOR

        # Act
        repo.update(course_instructor, role=new_role)

        # Assert
        updated = CourseInstructor.objects.get(id=course_instructor.id)
        assert updated.role == new_role


@pytest.mark.django_db
class TestDelete:
    def test_deletes_course_instructor_from_database(self, repo):
        # Arrange
        course_instructor = CourseInstructorFactory()
        ci_id = course_instructor.id

        # Act
        repo.delete(course_instructor)

        # Assert
        assert not CourseInstructor.objects.filter(id=ci_id).exists()

    def test_deletes_correct_course_instructor(self, repo):
        # Arrange
        keep1 = CourseInstructorFactory()
        to_delete = CourseInstructorFactory()
        keep2 = CourseInstructorFactory()

        # Act
        repo.delete(to_delete)

        # Assert
        remaining_ids = set(CourseInstructor.objects.values_list("id", flat=True))
        assert keep1.id in remaining_ids
        assert keep2.id in remaining_ids
        assert to_delete.id not in remaining_ids
