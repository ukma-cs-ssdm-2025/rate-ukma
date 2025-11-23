import pytest

from rating_app.models import Enrollment
from rating_app.models.choices import EnrollmentStatus
from rating_app.repositories.enrollment_repository import EnrollmentRepository
from rating_app.tests.factories import CourseOfferingFactory, EnrollmentFactory, StudentFactory


@pytest.fixture
def repo():
    return EnrollmentRepository()


@pytest.mark.django_db
def test_get_all_returns_all_enrollments(repo):
    # Arrange
    EnrollmentFactory.create_batch(3)

    # Act
    result = repo.get_all()

    # Assert
    assert len(result) == 3
    assert all(isinstance(enrollment, Enrollment) for enrollment in result)


@pytest.mark.django_db
def test_get_all_returns_empty_list_when_no_enrollments(repo):
    # Act
    result = repo.get_all()

    # Assert
    assert result == []


@pytest.mark.django_db
def test_get_all_prefetches_related_student_and_offering(repo, django_assert_num_queries):
    # Arrange
    EnrollmentFactory.create_batch(3)

    # Act
    result = repo.get_all()

    # Assert
    with django_assert_num_queries(0):
        for enrollment in result:
            _ = enrollment.student.first_name
            _ = enrollment.offering.code


@pytest.mark.django_db
def test_get_by_id_returns_enrollment_by_id(repo):
    # Arrange
    enrollment = EnrollmentFactory()

    # Act
    result = repo.get_by_id(enrollment.id)

    # Assert
    assert result.id == enrollment.id


@pytest.mark.django_db
def test_get_by_id_raises_error_when_id_not_found(repo):
    # Arrange
    invalid_id = "00000000-0000-0000-0000-000000000000"

    # Act & Assert
    with pytest.raises(Enrollment.DoesNotExist):
        repo.get_by_id(invalid_id)


@pytest.mark.django_db
def test_get_by_id_prefetches_related_student_and_offering(repo, django_assert_num_queries):
    # Arrange
    enrollment = EnrollmentFactory()

    # Act
    result = repo.get_by_id(enrollment.id)

    # Assert
    with django_assert_num_queries(0):
        _ = result.student.first_name
        _ = result.offering.code


@pytest.mark.django_db
def test_get_or_upsert_creates_new_enrollment_when_not_exists(repo):
    # Arrange
    student = StudentFactory()
    offering = CourseOfferingFactory()

    # Act
    enrollment, created = repo.get_or_upsert(
        student=student, offering=offering, status=EnrollmentStatus.ENROLLED
    )

    # Assert
    assert created is True
    assert enrollment.student == student
    assert enrollment.offering == offering
    assert enrollment.status == EnrollmentStatus.ENROLLED


@pytest.mark.django_db
def test_get_or_upsert_updates_status_when_enrollment_exists(repo):
    # Arrange
    student = StudentFactory()
    offering = CourseOfferingFactory()
    existing = EnrollmentFactory(
        student=student, offering=offering, status=EnrollmentStatus.ENROLLED
    )

    # Act
    enrollment, created = repo.get_or_upsert(
        student=student, offering=offering, status=EnrollmentStatus.DROPPED
    )

    # Assert
    assert created is False
    assert enrollment.id == existing.id
    assert enrollment.status == EnrollmentStatus.DROPPED


@pytest.mark.django_db
def test_is_student_enrolled_returns_true_when_student_enrolled(repo):
    # Arrange
    enrollment = EnrollmentFactory(status=EnrollmentStatus.ENROLLED)

    # Act
    result = repo.is_student_enrolled(str(enrollment.student.id), str(enrollment.offering.id))

    # Assert
    assert result is True


@pytest.mark.django_db
def test_is_student_enrolled_returns_true_when_student_forced(repo):
    # Arrange
    enrollment = EnrollmentFactory(status=EnrollmentStatus.FORCED)

    # Act
    result = repo.is_student_enrolled(str(enrollment.student.id), str(enrollment.offering.id))

    # Assert
    assert result is True


@pytest.mark.django_db
def test_is_student_enrolled_returns_false_when_student_dropped(repo):
    # Arrange
    enrollment = EnrollmentFactory(status=EnrollmentStatus.DROPPED)

    # Act
    result = repo.is_student_enrolled(str(enrollment.student.id), str(enrollment.offering.id))

    # Assert
    assert result is False


@pytest.mark.django_db
def test_is_student_enrolled_returns_false_when_no_enrollment(repo):
    # Arrange
    student = StudentFactory()
    offering = CourseOfferingFactory()

    # Act
    result = repo.is_student_enrolled(str(student.id), str(offering.id))

    # Assert
    assert result is False


@pytest.mark.django_db
def test_create_creates_enrollment_with_provided_data(repo):
    # Arrange
    student = StudentFactory()
    offering = CourseOfferingFactory()
    data = {"student": student, "offering": offering, "status": EnrollmentStatus.ENROLLED}

    # Act
    result = repo.create(**data)

    # Assert
    assert result.student == student
    assert result.offering == offering
    assert Enrollment.objects.filter(id=result.id).exists()


@pytest.mark.django_db
def test_update_persists_updates_to_database(repo):
    # Arrange
    enrollment = EnrollmentFactory(status=EnrollmentStatus.ENROLLED)

    # Act
    repo.update(enrollment, status=EnrollmentStatus.DROPPED)

    # Assert
    updated = Enrollment.objects.get(id=enrollment.id)
    assert updated.status == EnrollmentStatus.DROPPED


@pytest.mark.django_db
def test_delete_deletes_enrollment_from_database(repo):
    # Arrange
    enrollment = EnrollmentFactory()
    enrollment_id = enrollment.id

    # Act
    repo.delete(enrollment)

    # Assert
    assert not Enrollment.objects.filter(id=enrollment_id).exists()


@pytest.mark.django_db
def test_delete_deletes_correct_enrollment(repo):
    # Arrange
    keep1 = EnrollmentFactory()
    to_delete = EnrollmentFactory()
    keep2 = EnrollmentFactory()

    # Act
    repo.delete(to_delete)

    # Assert
    remaining_ids = set(Enrollment.objects.values_list("id", flat=True))
    assert keep1.id in remaining_ids
    assert keep2.id in remaining_ids
    assert to_delete.id not in remaining_ids
