from django.contrib.auth import get_user_model

import pytest

from rating_app.ioc_container.services import student_service
from rating_app.models import Student
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

User = get_user_model()


@pytest.mark.django_db
def test_db_ingestion_links_student_to_existing_user():
    """When ingesting student data, link to user with matching email."""
    # Arrange
    email = "student@ukma.edu.ua"
    user = User.objects.create_user(
        username=email,
        email=email,
        password="testpass123",
    )
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

    # Act
    injector = course_db_injector()
    injector.execute(course_data)

    # Assert
    student = Student.objects.get(email=email)
    assert student.user == user
    assert student.user.id == user.id


@pytest.mark.django_db
def test_db_ingestion_does_not_link_when_no_matching_user():
    """When ingesting student data without matching user, student remains unlinked."""
    # Arrange
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

    # Act
    injector = course_db_injector()
    injector.execute(course_data)

    # Assert
    student = Student.objects.get(email=email)
    assert student.user is None


@pytest.mark.django_db
def test_service_links_user_to_existing_student():
    """StudentService links user to existing student with matching email."""
    # Arrange
    email = "existing@ukma.edu.ua"
    student = StudentFactory(email=email, user=None)
    user = User.objects.create_user(
        username=email,
        email=email,
        password="testpass123",
    )

    # Act
    service = student_service()
    result = service.link_user_to_student(user)

    # Assert
    assert result is True
    student.refresh_from_db()
    assert student.user == user


@pytest.mark.django_db
def test_service_does_not_link_when_user_already_has_student():
    """StudentService does not re-link if user already has a student."""
    # Arrange
    email = "linked@ukma.edu.ua"
    existing_student = StudentFactory(email=email, user=None)
    user = User.objects.create_user(
        username=email,
        email=email,
        password="testpass123",
    )
    existing_student.user = user
    existing_student.save()

    another_student = StudentFactory(email=email, user=None)

    # Act
    service = student_service()
    result = service.link_user_to_student(user)

    # Assert
    assert result is False
    another_student.refresh_from_db()
    assert another_student.user is None


@pytest.mark.django_db
def test_service_links_student_to_existing_user():
    """StudentService links student to existing user with matching email."""
    # Arrange
    email = "newstudent@ukma.edu.ua"
    user = User.objects.create_user(
        username=email,
        email=email,
        password="testpass123",
    )
    student = StudentFactory(email=email, user=None)

    # Act
    service = student_service()
    result = service.link_student_to_user(student)

    # Assert
    assert result is True
    student.refresh_from_db()
    assert student.user == user
