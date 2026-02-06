import pytest

from rating_app.application_schemas.enrollment import EnrollmentInput
from rating_app.models.choices import EnrollmentStatus
from rating_app.repositories.enrollment_repository import EnrollmentRepository
from rating_app.repositories.to_domain_mappers import EnrollmentMapper
from rating_app.tests.factories import CourseOfferingFactory, EnrollmentFactory, StudentFactory


@pytest.fixture
def repo():
    return EnrollmentRepository(mapper=EnrollmentMapper())


@pytest.mark.django_db
@pytest.mark.integration
def test_get_all_returns_domain_models(repo):
    EnrollmentFactory.create_batch(3)

    result = repo.get_all()

    assert len(result) == 3
    for enrollment in result:
        assert hasattr(enrollment, "student_id")
        assert hasattr(enrollment, "offering_id")
        assert hasattr(enrollment, "status")


@pytest.mark.django_db
@pytest.mark.integration
def test_get_or_upsert_updates_status_when_enrollment_exists(repo):
    enrollment = EnrollmentFactory(status=EnrollmentStatus.ENROLLED)

    enrollment_input = EnrollmentInput(
        student_id=enrollment.student_id,
        offering_id=enrollment.offering_id,
        status=EnrollmentStatus.DROPPED,
    )
    updated_enrollment, created = repo.get_or_upsert(enrollment_input)

    assert created is False
    assert updated_enrollment.id == enrollment.id
    assert updated_enrollment.status == EnrollmentStatus.DROPPED


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.parametrize("status", [EnrollmentStatus.ENROLLED, EnrollmentStatus.FORCED])
def test_is_student_enrolled_returns_true_for_active_status(repo, status):
    enrollment = EnrollmentFactory(status=status)

    result = repo.is_student_enrolled(enrollment.student_id, enrollment.offering_id)

    assert result is True


@pytest.mark.django_db
@pytest.mark.integration
def test_is_student_enrolled_returns_false_when_no_enrollment(repo):
    student = StudentFactory()
    offering = CourseOfferingFactory()

    result = repo.is_student_enrolled(student.id, offering.id)

    assert result is False
