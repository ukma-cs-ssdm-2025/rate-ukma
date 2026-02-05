from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from rating_app.application_schemas.student import Student as StudentDTO
from rating_app.ioc_container.services import student_service
from rating_app.models import Student
from rating_app.repositories.to_domain_mappers import StudentMapper
from rating_app.services.student_service import StudentService
from rating_app.tests.factories import SpecialityFactory, StudentFactory
from scraper.ioc_container.common import course_db_injector
from scraper.models.deduplicated import (
    CourseStatus,
    DeduplicatedCourse,
    DeduplicatedCourseOffering,
    DeduplicatedEnrollment,
    DeduplicatedSemester,
    DeduplicatedStudent,
    EducationLevel,
    EnrollmentStatus,
    ExamType,
    SemesterTerm,
)


@pytest.fixture
def student_stats_repo():
    return MagicMock()


@pytest.fixture
def student_repo():
    return MagicMock()


@pytest.fixture
def user_repo():
    return MagicMock()


@pytest.fixture
def semester_service():
    return MagicMock()


@pytest.fixture
def rating_service():
    return MagicMock()


@pytest.fixture
def service(student_stats_repo, student_repo, user_repo, semester_service, rating_service):
    return StudentService(
        student_stats_repository=student_stats_repo,
        student_repository=student_repo,
        user_repository=user_repo,
        semester_service=semester_service,
        rating_service=rating_service,
    )


class TestLinkStudentToUser:
    def test_returns_false_when_student_has_no_email(self, service):
        # Arrange
        student = SimpleNamespace(email="", user_id=None)

        # Act
        result = service.link_student_to_user(student)

        # Assert
        assert result is False

    def test_returns_false_when_student_already_has_user(self, service):
        # Arrange
        student = SimpleNamespace(email="test@ukma.edu.ua", user_id=1)

        # Act
        result = service.link_student_to_user(student)

        # Assert
        assert result is False

    def test_returns_false_when_no_user_with_email(self, service, user_repo):
        # Arrange
        student = SimpleNamespace(email="test@ukma.edu.ua", user_id=None, id="student-id")
        user_repo.get_by_email.return_value = None

        # Act
        result = service.link_student_to_user(student)

        # Assert
        assert result is False
        user_repo.get_by_email.assert_called_once_with("test@ukma.edu.ua")

    def test_returns_false_when_user_already_linked_to_another_student(self, service, user_repo):
        # Arrange
        student = SimpleNamespace(email="test@ukma.edu.ua", user_id=None, id="new-student")
        existing_user = SimpleNamespace(
            id=1,
            email="test@ukma.edu.ua",
            student_profile=SimpleNamespace(id="existing-student"),
        )
        user_repo.get_by_email.return_value = existing_user

        # Act
        result = service.link_student_to_user(student)

        # Assert
        assert result is False

    def test_links_student_to_user_successfully(self, service, user_repo, student_repo):
        # Arrange
        student = SimpleNamespace(email="test@ukma.edu.ua", user_id=None, id="student-id")
        user = SimpleNamespace(id=1, email="test@ukma.edu.ua", student_profile=None)
        user_repo.get_by_email.return_value = user

        # Act
        result = service.link_student_to_user(student)

        # Assert
        assert result is True
        student_repo.link_to_user.assert_called_once_with("student-id", user)


class TestLinkUserToStudent:
    def test_returns_false_when_user_has_no_email(self, service):
        # Arrange
        user = SimpleNamespace(email="", id=1)

        # Act
        result = service.link_user_to_student(user)

        # Assert
        assert result is False

    def test_returns_false_when_user_already_linked_to_student(self, service):
        # Arrange
        user = SimpleNamespace(
            email="test@ukma.edu.ua",
            id=1,
            student_profile=SimpleNamespace(id="existing-student"),
        )

        # Act
        result = service.link_user_to_student(user)

        # Assert
        assert result is False

    def test_returns_false_when_no_student_with_email(self, service, student_repo):
        # Arrange
        user = SimpleNamespace(email="test@ukma.edu.ua", id=1, student_profile=None)
        student_repo.get_by_email.return_value = None

        # Act
        result = service.link_user_to_student(user)

        # Assert
        assert result is False
        student_repo.get_by_email.assert_called_once_with("test@ukma.edu.ua")

    def test_links_user_to_student_successfully(self, service, student_repo):
        # Arrange
        user = SimpleNamespace(email="test@ukma.edu.ua", id=1, student_profile=None)
        student = SimpleNamespace(id="student-id", email="test@ukma.edu.ua", user_id=None)
        student_repo.get_by_email.return_value = student

        # Act
        result = service.link_user_to_student(user)

        # Assert
        assert result is True
        student_repo.link_to_user.assert_called_once_with("student-id", user)


# Integration tests exercising real services/DB


@pytest.fixture
def student_mapper():
    return StudentMapper()


@pytest.mark.django_db
@pytest.mark.integration
def test_db_ingestion_links_student_to_existing_user(user_factory):
    email = "student@ukma.edu.ua"
    user = user_factory(email=email)
    speciality = SpecialityFactory(name="Computer Science")

    course_data = [
        DeduplicatedCourse(
            title="Test Course",
            description="Test",
            status=CourseStatus.ACTIVE,
            department="CS Department",
            faculty=speciality.faculty.name,
            offerings=[
                DeduplicatedCourseOffering(
                    code="CS101",
                    semester=DeduplicatedSemester(year=2024, term=SemesterTerm.FALL),
                    credits=3.0,
                    weekly_hours=4,
                    exam_type=ExamType.EXAM,
                    enrollments=[
                        DeduplicatedEnrollment(
                            student=DeduplicatedStudent(
                                first_name="Test",
                                last_name="Student",
                                email=email,
                                speciality=speciality.name,
                                education_level=EducationLevel.BACHELOR,
                            ),
                            status=EnrollmentStatus.ENROLLED,
                        )
                    ],
                )
            ],
        )
    ]

    injector = course_db_injector()
    injector.execute(course_data)

    student = Student.objects.get(email=email)
    assert student.user == user
    assert student.user.id == user.id


@pytest.mark.django_db
@pytest.mark.integration
def test_db_ingestion_does_not_link_when_no_matching_user():
    email = "no-user@ukma.edu.ua"
    speciality = SpecialityFactory(name="Mathematics")

    course_data = [
        DeduplicatedCourse(
            title="Math Course",
            description="Test",
            status=CourseStatus.ACTIVE,
            department="Math Department",
            faculty=speciality.faculty.name,
            offerings=[
                DeduplicatedCourseOffering(
                    code="MATH101",
                    semester=DeduplicatedSemester(year=2024, term=SemesterTerm.FALL),
                    credits=3.0,
                    weekly_hours=4,
                    exam_type=ExamType.EXAM,
                    enrollments=[
                        DeduplicatedEnrollment(
                            student=DeduplicatedStudent(
                                first_name="No",
                                last_name="User",
                                email=email,
                                speciality=speciality.name,
                                education_level=EducationLevel.BACHELOR,
                            ),
                            status=EnrollmentStatus.ENROLLED,
                        )
                    ],
                )
            ],
        )
    ]

    injector = course_db_injector()
    injector.execute(course_data)

    student = Student.objects.get(email=email)
    assert student.user is None


@pytest.mark.django_db
@pytest.mark.integration
def test_service_links_user_to_existing_student(user_factory):
    email = "existing@ukma.edu.ua"
    student = StudentFactory(email=email, user=None)
    user = user_factory(email=email)

    service = student_service()
    result = service.link_user_to_student(user)

    assert result is True
    student.refresh_from_db()
    assert student.user == user


@pytest.mark.django_db
@pytest.mark.integration
def test_service_does_not_link_when_user_already_has_student(user_factory):
    email = "linked@ukma.edu.ua"
    existing_student = StudentFactory(email=email, user=None)
    user = user_factory(email=email)
    existing_student.user = user
    existing_student.save()

    another_student = StudentFactory(email=email, user=None)

    service = student_service()
    result = service.link_user_to_student(user)

    assert result is False
    another_student.refresh_from_db()
    assert another_student.user is None


@pytest.mark.django_db
@pytest.mark.integration
def test_service_links_student_to_existing_user(user_factory, student_mapper):
    email = "newstudent@ukma.edu.ua"
    user = user_factory(email=email)
    student_model = StudentFactory(email=email, user=None)

    # Convert ORM model to DTO for service
    student_dto = student_mapper.process(student_model)

    service = student_service()
    result = service.link_student_to_user(student_dto)

    assert result is True
    student_model.refresh_from_db()
    assert student_model.user == user
