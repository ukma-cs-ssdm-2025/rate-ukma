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
DEFAULT_MID_TERM_DATE = "2023-11-25"
DEFAULT_INVALID_DATE = "2023-9-25"
DEFAULT_YEAR = 2023
DEFAULT_TERM = "FALL"


@pytest.mark.django_db
@pytest.mark.integration
def test_get_courses_stats_requires_student_record(token_client):
    # Arrange - user without student record

    # Act
    response = token_client.get("/api/v1/students/me/courses/")

    # Assert
    assert response.status_code == 403
    assert response.json()["detail"] == "Only students can perform this action."


@freeze_time(DEFAULT_DATE)
@pytest.mark.django_db
@pytest.mark.integration
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
@pytest.mark.integration
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
@pytest.mark.integration
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
@pytest.mark.integration
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
@pytest.mark.integration
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
@pytest.mark.integration
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


def _create_student_course_setup(
    token_client, term=DEFAULT_TERM, year=DEFAULT_YEAR, title="Test Course"
):
    """Helper function to create student, course, semester, offering, and enrollment."""
    student = StudentFactory(user=token_client.user)
    course = CourseFactory(title=title)
    semester = SemesterFactory(term=term, year=year)
    offering = CourseOfferingFactory(course=course, semester=semester)
    EnrollmentFactory(student=student, offering=offering)
    return student, course, semester, offering


@freeze_time(DEFAULT_INVALID_DATE)  # Before midpoint (September)
@pytest.mark.django_db
@pytest.mark.integration
def test_get_courses_stats_cannot_rate_before_midpoint(token_client):
    # Arrange
    _create_student_course_setup(token_client)

    # Act
    response = token_client.get("/api/v1/students/me/courses/")

    # Assert
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert len(data[0]["offerings"]) == 1
    assert data[0]["offerings"][0]["can_rate"] is False


@freeze_time(DEFAULT_DATE)  # Just before midpoint (October)
@pytest.mark.django_db
@pytest.mark.integration
def test_get_courses_stats_cannot_rate_just_before_midpoint(token_client):
    # Arrange
    _create_student_course_setup(token_client)

    # Act
    response = token_client.get("/api/v1/students/me/courses/")

    # Assert
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert len(data[0]["offerings"]) == 1
    assert data[0]["offerings"][0]["can_rate"] is False


@freeze_time(DEFAULT_MID_TERM_DATE)  # At midpoint (November)
@pytest.mark.django_db
@pytest.mark.integration
def test_get_courses_stats_can_rate_at_midpoint(token_client):
    # Arrange
    _create_student_course_setup(token_client)

    # Act
    response = token_client.get("/api/v1/students/me/courses/")

    # Assert
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert len(data[0]["offerings"]) == 1
    assert data[0]["offerings"][0]["can_rate"] is True


@freeze_time(DEFAULT_MID_TERM_DATE)  # At midpoint
@pytest.mark.django_db
@pytest.mark.integration
def test_get_courses_stats_can_rate_past_semester(token_client):
    # Arrange
    _, _, _past_semester, _ = _create_student_course_setup(
        token_client, term=SemesterTerm.SPRING, year=DEFAULT_YEAR, title="Past Course"
    )
    # Create current semester so get_current() works
    _current_semester = SemesterFactory(term=DEFAULT_TERM, year=DEFAULT_YEAR)

    # Act
    response = token_client.get("/api/v1/students/me/courses/")

    # Assert
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert len(data[0]["offerings"]) == 1
    assert data[0]["offerings"][0]["can_rate"] is True


@freeze_time(DEFAULT_MID_TERM_DATE)  # At midpoint
@pytest.mark.django_db
@pytest.mark.integration
def test_get_courses_stats_multiple_offerings_different_can_rate(token_client):
    # Arrange
    student = StudentFactory(user=token_client.user)
    course = CourseFactory(title="Multi-offering Course")

    # Past semester - can rate
    past_semester = SemesterFactory(term=SemesterTerm.SPRING, year=DEFAULT_YEAR)
    past_offering = CourseOfferingFactory(course=course, semester=past_semester)
    EnrollmentFactory(student=student, offering=past_offering)

    # Current semester at midpoint - can rate
    current_semester = SemesterFactory(term=DEFAULT_TERM, year=DEFAULT_YEAR)
    current_offering = CourseOfferingFactory(course=course, semester=current_semester)
    EnrollmentFactory(student=student, offering=current_offering)

    # Future semester - cannot rate
    future_semester = SemesterFactory(term=SemesterTerm.SPRING, year=DEFAULT_YEAR + 1)
    future_offering = CourseOfferingFactory(course=course, semester=future_semester)
    EnrollmentFactory(student=student, offering=future_offering)

    # Act
    response = token_client.get("/api/v1/students/me/courses/")

    # Assert
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == str(course.id)
    assert len(data[0]["offerings"]) == 3

    # Find each offering (season, year) and verify can_rate
    offerings_by_term_year = {
        (offering["season"], offering["year"]): offering for offering in data[0]["offerings"]
    }

    past_spring = offerings_by_term_year[(SemesterTerm.SPRING, DEFAULT_YEAR)]
    current_fall = offerings_by_term_year[(SemesterTerm.FALL, DEFAULT_YEAR)]
    future_spring = offerings_by_term_year[(SemesterTerm.SPRING, DEFAULT_YEAR + 1)]

    assert past_spring["can_rate"] is True
    assert current_fall["can_rate"] is True
    assert future_spring["can_rate"] is False


@freeze_time(DEFAULT_MID_TERM_DATE)  # At midpoint
@pytest.mark.django_db
@pytest.mark.integration
def test_get_courses_stats_rated_course_still_shows_can_rate(token_client):
    # Arrange - verify that can_rate is still True even if already rated
    student, _, _, offering = _create_student_course_setup(token_client, title="Rated Course")
    RatingFactory(
        student=student,
        course_offering=offering,
        difficulty=4,
        usefulness=5,
        comment="Already rated",
    )

    # Act
    response = token_client.get("/api/v1/students/me/courses/")

    # Assert
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert len(data[0]["offerings"]) == 1
    offering_data = data[0]["offerings"][0]
    assert offering_data["can_rate"] is True
    assert offering_data["rated"] is not None
