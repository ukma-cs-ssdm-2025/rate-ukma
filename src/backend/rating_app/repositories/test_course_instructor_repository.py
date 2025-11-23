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
def test_get_all_returns_all_course_instructors(repo):
    CourseInstructorFactory.create_batch(3)

    result = repo.get_all()

    assert len(result) == 3
    assert all(isinstance(ci, CourseInstructor) for ci in result)


@pytest.mark.django_db
def test_get_all_returns_empty_list_when_no_course_instructors(repo):
    result = repo.get_all()

    assert result == []


@pytest.mark.django_db
def test_get_all_prefetches_related_instructor_and_course_offering(repo, django_assert_num_queries):
    CourseInstructorFactory.create_batch(3)

    result = repo.get_all()

    with django_assert_num_queries(0):
        for ci in result:
            _ = ci.instructor.first_name
            _ = ci.course_offering.code




@pytest.mark.django_db
def test_get_by_id_returns_course_instructor_by_id(repo):
    course_instructor = CourseInstructorFactory()

    result = repo.get_by_id(course_instructor.id)

    assert result.id == course_instructor.id


@pytest.mark.django_db
def test_get_by_id_raises_error_when_id_not_found(repo):
    invalid_id = "00000000-0000-0000-0000-000000000000"

    with pytest.raises(CourseInstructor.DoesNotExist):
        repo.get_by_id(invalid_id)


@pytest.mark.django_db
def test_get_by_id_prefetches_related_instructor_and_course_offering(
    repo, django_assert_num_queries
):
    course_instructor = CourseInstructorFactory()

    result = repo.get_by_id(course_instructor.id)

    with django_assert_num_queries(0):
        _ = result.instructor.first_name
        _ = result.course_offering.code




@pytest.mark.django_db
def test_get_or_create_creates_new_course_instructor_when_not_exists(repo):
    instructor = InstructorFactory()
    course_offering = CourseOfferingFactory()
    role = InstructorRole.LECTURE_INSTRUCTOR

    course_instructor, created = repo.get_or_create(
        instructor=instructor, course_offering=course_offering, role=role
    )

    assert created is True
    assert course_instructor.instructor == instructor
    assert course_instructor.course_offering == course_offering
    assert course_instructor.role == role


@pytest.mark.django_db
def test_get_or_create_returns_existing_course_instructor_when_exists(repo):
    existing = CourseInstructorFactory(role=InstructorRole.LECTURE_INSTRUCTOR)

    course_instructor, created = repo.get_or_create(
        instructor=existing.instructor,
        course_offering=existing.course_offering,
        role=existing.role,
    )

    assert created is False
    assert course_instructor.id == existing.id


@pytest.mark.django_db
def test_get_or_create_creates_different_instructor_with_different_role(repo):
    existing = CourseInstructorFactory(role=InstructorRole.LECTURE_INSTRUCTOR)

    course_instructor, created = repo.get_or_create(
        instructor=existing.instructor,
        course_offering=existing.course_offering,
        role=InstructorRole.PRACTICUM_INSTRUCTOR,
    )

    assert created is True
    assert course_instructor.id != existing.id
    assert course_instructor.role == InstructorRole.PRACTICUM_INSTRUCTOR




@pytest.mark.django_db
def test_create_creates_course_instructor_with_provided_data(repo):
    instructor = InstructorFactory()
    course_offering = CourseOfferingFactory()
    data = {
        "instructor": instructor,
        "course_offering": course_offering,
        "role": InstructorRole.LECTURE_INSTRUCTOR,
    }

    result = repo.create(**data)

    assert result.instructor == instructor
    assert result.course_offering == course_offering
    assert result.role == InstructorRole.LECTURE_INSTRUCTOR
    assert CourseInstructor.objects.filter(id=result.id).exists()




@pytest.mark.django_db
def test_update_persists_updates_to_database(repo):
    course_instructor = CourseInstructorFactory(role=InstructorRole.LECTURE_INSTRUCTOR)
    new_role = InstructorRole.PRACTICUM_INSTRUCTOR

    repo.update(course_instructor, role=new_role)

    updated = CourseInstructor.objects.get(id=course_instructor.id)
    assert updated.role == new_role




@pytest.mark.django_db
def test_delete_deletes_course_instructor_from_database(repo):
    course_instructor = CourseInstructorFactory()
    ci_id = course_instructor.id

    repo.delete(course_instructor)

    assert not CourseInstructor.objects.filter(id=ci_id).exists()


@pytest.mark.django_db
def test_delete_deletes_correct_course_instructor(repo):
    keep1 = CourseInstructorFactory()
    to_delete = CourseInstructorFactory()
    keep2 = CourseInstructorFactory()

    repo.delete(to_delete)

    remaining_ids = set(CourseInstructor.objects.values_list("id", flat=True))
    assert keep1.id in remaining_ids
    assert keep2.id in remaining_ids
    assert to_delete.id not in remaining_ids
