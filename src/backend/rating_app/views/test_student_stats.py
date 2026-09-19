from django.urls import reverse

import pytest
from freezegun import freeze_time

from rateukma.caching.patterns import student_ratings_namespace
from rating_app.models.choices import SemesterTerm
from rating_app.tests.semester_dates import (
    DEFAULT_AFTER_MIDTERM_DATE,
    DEFAULT_DATE,
    DEFAULT_TERM,
    DEFAULT_YEAR,
)

DEFAULT_INVALID_DATE = "2023-9-25"


@pytest.mark.django_db
@pytest.mark.integration
def test_get_courses_stats_requires_student_record(token_client):
    # Arrange - user without student record

    # Act
    response = token_client.get("/api/v1/students/me/courses/")

    # Assert
    assert response.status_code == 403
    assert response.json()["detail"] == "Only students can perform this action."


@pytest.mark.django_db
@pytest.mark.integration
@freeze_time(DEFAULT_DATE)
def test_get_courses_stats_returns_empty_list_for_student_with_no_courses(
    token_client,
    student_factory,
    semester_factory,
):
    # Arrange
    _student = student_factory(user=token_client.user)
    _semester = semester_factory(year=DEFAULT_YEAR, term=DEFAULT_TERM)

    # Act
    response = token_client.get("/api/v1/students/me/courses/")

    # Assert
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.django_db
@pytest.mark.integration
@freeze_time(DEFAULT_DATE)
def test_get_courses_stats_returns_enrolled_courses(
    token_client,
    student_factory,
    course_factory,
    semester_factory,
    course_offering_factory,
    enrollment_factory,
):
    # Arrange
    student = student_factory(user=token_client.user)
    course = course_factory(title="Test Course")
    semester = semester_factory(term=DEFAULT_TERM, year=DEFAULT_YEAR)
    offering = course_offering_factory(course=course, semester=semester)
    enrollment_factory(student=student, offering=offering)

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
    assert data[0]["offerings"][0]["season"] == DEFAULT_TERM
    assert data[0]["offerings"][0]["rated"] is None


@pytest.mark.django_db
@pytest.mark.integration
@freeze_time(DEFAULT_DATE)
def test_get_courses_stats_returns_rated_courses(
    token_client,
    student_factory,
    course_factory,
    semester_factory,
    course_offering_factory,
    enrollment_factory,
    rating_factory,
):
    # Arrange
    student = student_factory(user=token_client.user)
    course = course_factory(title="Rated Course")
    semester = semester_factory(term=DEFAULT_TERM, year=DEFAULT_YEAR)
    offering = course_offering_factory(course=course, semester=semester)
    enrollment_factory(student=student, offering=offering)
    _rating = rating_factory(
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


@pytest.mark.django_db
@pytest.mark.integration
@freeze_time(DEFAULT_DATE)
def test_get_courses_stats_returns_multiple_offerings_same_course(
    token_client,
    student_factory,
    course_factory,
    semester_factory,
    course_offering_factory,
    enrollment_factory,
    rating_factory,
):
    # Arrange
    student = student_factory(user=token_client.user)
    course = course_factory(title="Multi-offering Course")

    # Fall (default) - enrolled only
    fall_semester = semester_factory(term=SemesterTerm.FALL, year=DEFAULT_YEAR)
    fall_offering = course_offering_factory(course=course, semester=fall_semester)
    enrollment_factory(student=student, offering=fall_offering)

    # Spring (next) - enrolled and rated
    spring_semester = semester_factory(term=SemesterTerm.SPRING, year=DEFAULT_YEAR)
    spring_offering = course_offering_factory(course=course, semester=spring_semester)
    enrollment_factory(student=student, offering=spring_offering)
    rating_factory(
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


@pytest.mark.django_db
@pytest.mark.integration
@freeze_time(DEFAULT_DATE)
def test_get_courses_stats_excludes_other_students_courses(
    token_client,
    student_factory,
    course_factory,
    semester_factory,
    course_offering_factory,
    enrollment_factory,
):
    # Arrange
    student = student_factory(user=token_client.user)
    semester = semester_factory(year=DEFAULT_YEAR, term=DEFAULT_TERM)

    # Student's course
    course1 = course_factory(title="My Course")
    offering1 = course_offering_factory(course=course1, semester=semester)
    enrollment_factory(student=student, offering=offering1)

    # Other student's course
    other_student = student_factory()
    course2 = course_factory(title="Other Student Course")
    offering2 = course_offering_factory(course=course2, semester=semester)
    enrollment_factory(student=other_student, offering=offering2)

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
def test_get_courses_stats_serializes_response_correctly(
    token_client,
    student_factory,
    course_factory,
    semester_factory,
    course_offering_factory,
    enrollment_factory,
    rating_factory,
):
    # Arrange
    student = student_factory(user=token_client.user)
    course = course_factory(title="Test Course")
    semester = semester_factory(term=DEFAULT_TERM, year=DEFAULT_YEAR)
    offering = course_offering_factory(course=course, semester=semester)
    enrollment_factory(student=student, offering=offering)
    rating_factory(
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


@pytest.fixture
def create_student_course_setup(
    token_client,
    student_factory,
    course_factory,
    semester_factory,
    course_offering_factory,
    enrollment_factory,
):
    def _create(term=DEFAULT_TERM, year=DEFAULT_YEAR, title="Test Course"):
        student = student_factory(user=token_client.user)
        course = course_factory(title=title)
        semester = semester_factory(term=term, year=year)
        offering = course_offering_factory(course=course, semester=semester)
        enrollment_factory(student=student, offering=offering)
        return student, course, semester, offering

    return _create


@pytest.mark.django_db
@pytest.mark.integration
@freeze_time(DEFAULT_INVALID_DATE)  # Before midpoint (September)
def test_get_courses_stats_cannot_rate_before_midpoint(token_client, create_student_course_setup):
    # Arrange
    create_student_course_setup()

    # Act
    response = token_client.get("/api/v1/students/me/courses/")

    # Assert
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert len(data[0]["offerings"]) == 1
    assert data[0]["offerings"][0]["can_rate"] is False


@pytest.mark.django_db
@pytest.mark.integration
@freeze_time(DEFAULT_DATE)  # Just before midpoint (October)
def test_get_courses_stats_cannot_rate_just_before_midpoint(
    token_client,
    create_student_course_setup,
):
    # Arrange
    create_student_course_setup()

    # Act
    response = token_client.get("/api/v1/students/me/courses/")

    # Assert
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert len(data[0]["offerings"]) == 1
    assert data[0]["offerings"][0]["can_rate"] is False


@pytest.mark.django_db
@pytest.mark.integration
@freeze_time(DEFAULT_AFTER_MIDTERM_DATE)  # At midpoint (November)
def test_get_courses_stats_can_rate_at_midpoint(token_client, create_student_course_setup):
    # Arrange
    create_student_course_setup()

    # Act
    response = token_client.get("/api/v1/students/me/courses/")

    # Assert
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert len(data[0]["offerings"]) == 1
    assert data[0]["offerings"][0]["can_rate"] is True


@pytest.mark.django_db
@pytest.mark.integration
@freeze_time(DEFAULT_AFTER_MIDTERM_DATE)  # At midpoint
def test_get_courses_stats_can_rate_past_semester(
    token_client,
    semester_factory,
    create_student_course_setup,
):
    # Arrange
    _, _, _past_semester, _ = create_student_course_setup(
        term=SemesterTerm.SPRING, year=DEFAULT_YEAR, title="Past Course"
    )
    # Create current semester so get_current() works
    _current_semester = semester_factory(term=DEFAULT_TERM, year=DEFAULT_YEAR)

    # Act
    response = token_client.get("/api/v1/students/me/courses/")

    # Assert
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert len(data[0]["offerings"]) == 1
    assert data[0]["offerings"][0]["can_rate"] is True


@pytest.mark.django_db
@pytest.mark.integration
@freeze_time(DEFAULT_AFTER_MIDTERM_DATE)  # At midpoint
def test_get_courses_stats_multiple_offerings_different_can_rate(
    token_client,
    student_factory,
    course_factory,
    semester_factory,
    course_offering_factory,
    enrollment_factory,
):
    # Arrange
    student = student_factory(user=token_client.user)
    course = course_factory(title="Multi-offering Course")

    # Past semester - can rate
    past_semester = semester_factory(term=SemesterTerm.SPRING, year=DEFAULT_YEAR)
    past_offering = course_offering_factory(course=course, semester=past_semester)
    enrollment_factory(student=student, offering=past_offering)

    # Current semester at midpoint - can rate
    current_semester = semester_factory(term=DEFAULT_TERM, year=DEFAULT_YEAR)
    current_offering = course_offering_factory(course=course, semester=current_semester)
    enrollment_factory(student=student, offering=current_offering)

    # Future semester - cannot rate
    future_semester = semester_factory(term=SemesterTerm.SPRING, year=DEFAULT_YEAR + 1)
    future_offering = course_offering_factory(course=course, semester=future_semester)
    enrollment_factory(student=student, offering=future_offering)

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


@pytest.mark.django_db
@pytest.mark.integration
@freeze_time(DEFAULT_AFTER_MIDTERM_DATE)  # At midpoint
def test_get_courses_stats_rated_course_still_shows_can_rate(
    token_client,
    rating_factory,
    create_student_course_setup,
):
    # Arrange - verify that can_rate is still True even if already rated
    student, _, _, offering = create_student_course_setup(title="Rated Course")
    rating_factory(
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


# ---------------------------------------------------------------------------
# Caching behaviour
# ---------------------------------------------------------------------------


@pytest.mark.django_db
@pytest.mark.integration
@freeze_time(DEFAULT_AFTER_MIDTERM_DATE)
def test_student_courses_response_is_cached_between_calls(
    token_client,
    mock_cache_manager,
    student_factory,
    course_factory,
    semester_factory,
    course_offering_factory,
    enrollment_factory,
):
    """Second call returns the cached result without hitting the DB again."""
    student = student_factory(user=token_client.user)
    course = course_factory(title="Cached Course")
    semester = semester_factory(term=DEFAULT_TERM, year=DEFAULT_YEAR)
    offering = course_offering_factory(course=course, semester=semester)
    enrollment_factory(student=student, offering=offering)

    course_id = str(course.id)

    response1 = token_client.get("/api/v1/students/me/courses/")
    assert response1.status_code == 200
    assert response1.json()[0]["id"] == course_id

    # Remove the course from the DB to prove the second response is cached
    course.delete()

    response2 = token_client.get("/api/v1/students/me/courses/")
    assert response2.status_code == 200
    assert response2.json()[0]["id"] == course_id  # stale data — still cached


@pytest.mark.django_db
@pytest.mark.integration
@freeze_time(DEFAULT_AFTER_MIDTERM_DATE)
def test_student_courses_cache_is_busted_after_version_bump(
    token_client,
    mock_cache_manager,
    student_factory,
    course_factory,
    semester_factory,
    course_offering_factory,
    enrollment_factory,
    rating_factory,
):
    """
    Bumping the student ratings namespace invalidates the cached response, so
    the next request reflects the new DB state. This is the contract that
    RatingCacheInvalidator.on_event() must uphold when a rating is created or
    deleted.
    """
    student = student_factory(user=token_client.user)
    course = course_factory(title="Bust Me")
    semester = semester_factory(term=DEFAULT_TERM, year=DEFAULT_YEAR)
    offering = course_offering_factory(course=course, semester=semester)
    enrollment_factory(student=student, offering=offering)

    # Warm the cache: offering not yet rated
    response1 = token_client.get("/api/v1/students/me/courses/")
    assert response1.status_code == 200
    assert response1.json()[0]["offerings"][0]["rated"] is None

    # Simulate a rating being created in DB (no HTTP round-trip needed here)
    rating_factory(
        student=student,
        course_offering=offering,
        difficulty=3,
        usefulness=4,
        comment="Late rating",
    )

    # Without cache bust the stale cached response would still show rated=None
    stale = token_client.get("/api/v1/students/me/courses/")
    assert stale.json()[0]["offerings"][0]["rated"] is None

    # Bump the namespace — this is what RatingCacheInvalidator does on rating events
    mock_cache_manager.bump_version(student_ratings_namespace(str(student.id)))

    # Now the endpoint must return fresh data
    fresh = token_client.get("/api/v1/students/me/courses/")
    assert fresh.status_code == 200
    offering_data = fresh.json()[0]["offerings"][0]
    assert offering_data["rated"] is not None
    assert offering_data["rated"]["comment"] == "Late rating"


@pytest.mark.django_db
@pytest.mark.integration
@freeze_time(DEFAULT_DATE)
def test_get_courses_stats_returns_m2m_instructors_on_rated(
    token_client,
    student_factory,
    course_factory,
    semester_factory,
    course_offering_factory,
    enrollment_factory,
    rating_factory,
    instructor_factory,
):
    # Regression: the light /students/me/courses/ endpoint must expose the
    # rating's M2M instructors so the edit modal can pre-populate them.
    student = student_factory(user=token_client.user)
    course = course_factory(title="Course With Instructors")
    semester = semester_factory(term=DEFAULT_TERM, year=DEFAULT_YEAR)
    offering = course_offering_factory(course=course, semester=semester)
    enrollment_factory(student=student, offering=offering)
    rating = rating_factory(student=student, course_offering=offering)
    instructor = instructor_factory(
        first_name="Олена", patronymic="Ігорівна", last_name="Коваленко"
    )
    rating.instructors.set([instructor])

    response = token_client.get("/api/v1/students/me/courses/")

    assert response.status_code == 200
    rated = response.json()[0]["offerings"][0]["rated"]
    assert len(rated["instructors"]) == 1
    assert rated["instructors"][0]["id"] == str(instructor.id)
    assert rated["instructors"][0]["last_name"] == "Коваленко"
    assert rated["instructors"][0]["patronymic"] == "Ігорівна"
    assert "email" not in rated["instructors"][0]


@pytest.mark.django_db
@pytest.mark.integration
@freeze_time(DEFAULT_DATE)
def test_grades_returns_rated_offering_when_enrolled_and_rated(
    token_client,
    student_factory,
    course_factory,
    semester_factory,
    course_offering_factory,
    enrollment_factory,
    rating_factory,
):
    # Arrange
    student = student_factory(user=token_client.user)
    course = course_factory(title="Graded Course")
    semester = semester_factory(term=DEFAULT_TERM, year=DEFAULT_YEAR)
    offering = course_offering_factory(course=course, semester=semester)
    enrollment_factory(student=student, offering=offering)
    rating = rating_factory(
        student=student,
        course_offering=offering,
        difficulty=4,
        usefulness=5,
        comment="Great course!",
    )

    # Act
    response = token_client.get(reverse("student-courses-grades"))

    # Assert
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["course_id"] == str(course.id)
    assert data[0]["course_title"] == "Graded Course"
    assert data[0]["course_code"] == offering.code
    assert data[0]["course_offering_id"] == str(offering.id)
    assert data[0]["semester"] == {"year": DEFAULT_YEAR, "season": DEFAULT_TERM}
    assert data[0]["rated"]["id"] == str(rating.id)
    assert data[0]["rated"]["difficulty"] == 4
    assert data[0]["rated"]["usefulness"] == 5
    assert data[0]["rated"]["comment"] == "Great course!"
    assert data[0]["rated"]["instructors"] == []
    assert data[0]["can_rate"] is False


@pytest.mark.django_db
@pytest.mark.integration
def test_get_grades_requires_student_record_when_caller_not_student(token_client):
    # Arrange - user without student record

    # Act
    response = token_client.get(reverse("student-courses-grades"))

    # Assert
    assert response.status_code == 403
    assert response.json()["detail"] == "Only students can perform this action."
