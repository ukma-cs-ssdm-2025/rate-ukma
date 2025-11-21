import pytest
from freezegun import freeze_time

from rating_app.models.choices import SemesterTerm
from rating_app.tests.factories import (
    CourseFactory,
    CourseOfferingFactory,
    EnrollmentFactory,
    RatingFactory,
    SemesterFactory,
    StudentFactory,
)

DEFAULT_DATE = "2023-10-25"
DEFAULT_YEAR = 2023
DEFAULT_TERM = "FALL"


@pytest.mark.django_db
def test_get_courses_stats_requires_student_record(token_client):
    # Arrange - user without student record

    # Act
    response = token_client.get("/api/v1/students/me/courses/")

    # Assert
    assert response.status_code == 403
    assert response.json()["detail"] == "Only students can perform this action."


@freeze_time(DEFAULT_DATE)
@pytest.mark.django_db
def test_get_courses_stats_returns_empty_list_for_student_with_no_courses(token_client):
    # Arrange
    _student = StudentFactory(user=token_client.user)
    _semester = SemesterFactory(year=DEFAULT_YEAR, term=DEFAULT_TERM)

    # Act
    response = token_client.get("/api/v1/students/me/courses/")

    # Assert
    assert response.status_code == 200
    assert response.json() == []


@freeze_time(DEFAULT_DATE)
@pytest.mark.django_db
def test_get_courses_stats_returns_enrolled_courses(token_client):
    # Arrange
    student = StudentFactory(user=token_client.user)
    course = CourseFactory(title="Test Course")
    semester = SemesterFactory(term=SemesterTerm[DEFAULT_TERM], year=DEFAULT_YEAR)
    offering = CourseOfferingFactory(course=course, semester=semester)
    EnrollmentFactory(student=student, offering=offering)

    # Act
    response = token_client.get("/api/v1/students/me/courses/")

    # Assert
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == str(course.id)
    assert len(data[0]["offerings"]) == 1
    assert data[0]["offerings"][0]["id"] == str(offering.id)
    assert data[0]["offerings"][0]["course_id"] == str(course.id)
    assert data[0]["offerings"][0]["year"] == DEFAULT_YEAR
    assert data[0]["offerings"][0]["season"] == SemesterTerm[DEFAULT_TERM]
    assert data[0]["offerings"][0]["rated"] is None


@freeze_time(DEFAULT_DATE)
@pytest.mark.django_db
def test_get_courses_stats_returns_rated_courses(token_client):
    # Arrange
    student = StudentFactory(user=token_client.user)
    course = CourseFactory(title="Rated Course")
    semester = SemesterFactory(term=DEFAULT_TERM, year=DEFAULT_YEAR)
    offering = CourseOfferingFactory(course=course, semester=semester)
    EnrollmentFactory(student=student, offering=offering)
    _rating = RatingFactory(
        student=student,
        course_offering=offering,
        difficulty=4,
        usefulness=5,
        comment="Great course!",
    )

    # Act
    response = token_client.get("/api/v1/students/me/courses/")

    # Assert
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert len(data[0]["offerings"]) == 1
    # Since offerings are unordered, find the one with rating
    offering_data = data[0]["offerings"][0]
    assert offering_data["course_id"] == str(course.id)
    assert offering_data["rated"] is not None
    assert offering_data["rated"]["difficulty"] == 4
    assert offering_data["rated"]["usefulness"] == 5
    assert offering_data["rated"]["comment"] == "Great course!"
    assert "created_at" in offering_data["rated"]


@freeze_time(DEFAULT_DATE)
@pytest.mark.django_db
def test_get_courses_stats_returns_multiple_offerings_same_course(token_client):
    # Arrange
    student = StudentFactory(user=token_client.user)
    course = CourseFactory(title="Multi-offering Course")

    # Fall (default) - enrolled only
    fall_semester = SemesterFactory(term=SemesterTerm.FALL, year=DEFAULT_YEAR)
    fall_offering = CourseOfferingFactory(course=course, semester=fall_semester)
    EnrollmentFactory(student=student, offering=fall_offering)

    # Spring (next) - enrolled and rated
    spring_semester = SemesterFactory(term=SemesterTerm.SPRING, year=DEFAULT_YEAR)
    spring_offering = CourseOfferingFactory(course=course, semester=spring_semester)
    EnrollmentFactory(student=student, offering=spring_offering)
    RatingFactory(
        student=student,
        course_offering=spring_offering,
        difficulty=5,
        usefulness=4,
        comment="Better the second time",
    )

    # Act
    response = token_client.get("/api/v1/students/me/courses/")

    # Assert
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == str(course.id)
    assert len(data[0]["offerings"]) == 2

    if data[0]["offerings"][0]["season"] == SemesterTerm.FALL:
        fall_offering = data[0]["offerings"][0]
        spring_offering = data[0]["offerings"][1]
    else:
        fall_offering = data[0]["offerings"][1]
        spring_offering = data[0]["offerings"][0]

    assert fall_offering["year"] == DEFAULT_YEAR
    assert fall_offering["season"] == SemesterTerm.FALL
    assert fall_offering["rated"] is None

    assert spring_offering["year"] == DEFAULT_YEAR
    assert spring_offering["season"] == SemesterTerm.SPRING
    assert spring_offering["rated"] is not None


@freeze_time(DEFAULT_DATE)
@pytest.mark.django_db
def test_get_courses_stats_excludes_other_students_courses(token_client):
    # Arrange
    student = StudentFactory(user=token_client.user)
    semester = SemesterFactory(year=DEFAULT_YEAR, term=DEFAULT_TERM)

    # Student's course
    course1 = CourseFactory(title="My Course")
    offering1 = CourseOfferingFactory(course=course1, semester=semester)
    EnrollmentFactory(student=student, offering=offering1)

    # Other student's course
    other_student = StudentFactory()
    course2 = CourseFactory(title="Other Student Course")
    offering2 = CourseOfferingFactory(course=course2, semester=semester)
    EnrollmentFactory(student=other_student, offering=offering2)

    # Act
    response = token_client.get("/api/v1/students/me/courses/")

    # Assert
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == str(course1.id)


@pytest.mark.django_db
@freeze_time(DEFAULT_DATE)
def test_get_courses_stats_serializes_response_correctly(token_client):
    # Arrange
    student = StudentFactory(user=token_client.user)
    course = CourseFactory(title="Test Course")
    semester = SemesterFactory(term=DEFAULT_TERM, year=DEFAULT_YEAR)
    offering = CourseOfferingFactory(course=course, semester=semester)
    EnrollmentFactory(student=student, offering=offering)
    RatingFactory(
        student=student, course_offering=offering, difficulty=3, usefulness=4, comment="Good course"
    )

    # Act
    response = token_client.get("/api/v1/students/me/courses/")

    # Assert
    assert response.status_code == 200
    data = response.json()

    # Check response structure
    assert isinstance(data, list)
    assert "id" in data[0]
    assert "offerings" in data[0]
    assert isinstance(data[0]["offerings"], list)

    offering_data = data[0]["offerings"][0]
    assert "id" in offering_data
    assert "course_id" in offering_data
    assert "year" in offering_data
    assert "season" in offering_data
    assert "rated" in offering_data

    rating_data = offering_data["rated"]
    assert "difficulty" in rating_data
    assert "usefulness" in rating_data
    assert "comment" in rating_data
    assert "created_at" in rating_data
    assert "is_anonymous" in rating_data
