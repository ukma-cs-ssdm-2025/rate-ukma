"""
Integration tests for rating cache invalidation.

These tests verify the full flow: API mutation → cache invalidation → fresh data
on subsequent reads. They catch bugs where the invalidator fails to bump the
correct namespace (e.g., anonymous ratings with privacy-nulled student_id).
"""

import pytest
from freezegun import freeze_time

from rating_app.tests.factories import (
    CourseFactory,
    CourseOfferingFactory,
    EnrollmentFactory,
    RatingFactory,
    SemesterFactory,
    StudentFactory,
)

DEFAULT_AFTER_MIDTERM_DATE = "2023-11-25"
DEFAULT_YEAR = 2023
DEFAULT_TERM = "FALL"

pytestmark = [pytest.mark.django_db, pytest.mark.integration]


@pytest.fixture(autouse=True)
def _frozen_time():
    with freeze_time(DEFAULT_AFTER_MIDTERM_DATE):
        yield


def _setup_enrolled_student(token_client):
    """Create a student enrolled in a course offering that is open for rating."""
    student = StudentFactory(user=token_client.user)
    course = CourseFactory()
    semester = SemesterFactory(year=DEFAULT_YEAR, term=DEFAULT_TERM)
    offering = CourseOfferingFactory(course=course, semester=semester)
    EnrollmentFactory(student=student, offering=offering)
    return student, course, offering


# ---------------------------------------------------------------------------
# /students/me/courses/ — cache invalidation on create
# ---------------------------------------------------------------------------


def test_create_anonymous_rating_invalidates_student_courses_cache(token_client):
    """After creating an anonymous rating, /students/me/courses/ must return it."""
    student, course, offering = _setup_enrolled_student(token_client)

    # Warm the cache — no rating yet
    resp = token_client.get("/api/v1/students/me/courses/")
    assert resp.status_code == 200
    assert resp.json()[0]["offerings"][0]["rated"] is None

    # Create anonymous rating via API
    token_client.post(
        f"/api/v1/courses/{course.id}/ratings/",
        data={
            "course_offering": str(offering.id),
            "difficulty": 3,
            "usefulness": 4,
            "comment": "anon review",
            "is_anonymous": True,
        },
        format="json",
    )

    # Cache must be invalidated — fresh data should show the rating
    resp = token_client.get("/api/v1/students/me/courses/")
    assert resp.status_code == 200
    rated = resp.json()[0]["offerings"][0]["rated"]
    assert rated is not None
    assert rated["comment"] == "anon review"
    assert rated["is_anonymous"] is True


def test_create_identified_rating_invalidates_student_courses_cache(token_client):
    """Same flow for a non-anonymous rating — baseline sanity check."""
    student, course, offering = _setup_enrolled_student(token_client)

    resp = token_client.get("/api/v1/students/me/courses/")
    assert resp.json()[0]["offerings"][0]["rated"] is None

    token_client.post(
        f"/api/v1/courses/{course.id}/ratings/",
        data={
            "course_offering": str(offering.id),
            "difficulty": 5,
            "usefulness": 5,
            "comment": "public review",
            "is_anonymous": False,
        },
        format="json",
    )

    resp = token_client.get("/api/v1/students/me/courses/")
    rated = resp.json()[0]["offerings"][0]["rated"]
    assert rated is not None
    assert rated["comment"] == "public review"
    assert rated["is_anonymous"] is False


# ---------------------------------------------------------------------------
# /students/me/courses/ — cache invalidation on delete
# ---------------------------------------------------------------------------


def test_delete_anonymous_rating_invalidates_student_courses_cache(token_client):
    student, course, offering = _setup_enrolled_student(token_client)
    rating = RatingFactory(
        student=student,
        course_offering=offering,
        difficulty=3,
        usefulness=4,
        comment="to be deleted",
        is_anonymous=True,
    )

    # Warm the cache — rating exists
    resp = token_client.get("/api/v1/students/me/courses/")
    assert resp.json()[0]["offerings"][0]["rated"] is not None

    # Delete via API
    del_resp = token_client.delete(f"/api/v1/courses/{course.id}/ratings/{rating.id}/")
    assert del_resp.status_code == 204

    # Cache must be invalidated
    resp = token_client.get("/api/v1/students/me/courses/")
    assert resp.json()[0]["offerings"][0]["rated"] is None


def test_delete_identified_rating_invalidates_student_courses_cache(token_client):
    student, course, offering = _setup_enrolled_student(token_client)
    rating = RatingFactory(
        student=student,
        course_offering=offering,
        difficulty=3,
        usefulness=4,
        is_anonymous=False,
    )

    resp = token_client.get("/api/v1/students/me/courses/")
    assert resp.json()[0]["offerings"][0]["rated"] is not None

    del_resp = token_client.delete(f"/api/v1/courses/{course.id}/ratings/{rating.id}/")
    assert del_resp.status_code == 204

    resp = token_client.get("/api/v1/students/me/courses/")
    assert resp.json()[0]["offerings"][0]["rated"] is None


# ---------------------------------------------------------------------------
# /students/me/courses/ — cache invalidation on update
# ---------------------------------------------------------------------------


def test_update_anonymous_rating_invalidates_student_courses_cache(token_client):
    student, course, offering = _setup_enrolled_student(token_client)
    rating = RatingFactory(
        student=student,
        course_offering=offering,
        difficulty=3,
        usefulness=4,
        comment="original",
        is_anonymous=True,
    )

    # Warm the cache
    resp = token_client.get("/api/v1/students/me/courses/")
    assert resp.json()[0]["offerings"][0]["rated"]["comment"] == "original"

    # Patch via API
    token_client.patch(
        f"/api/v1/courses/{course.id}/ratings/{rating.id}/",
        data={"comment": "updated"},
        format="json",
    )

    # Cache must be invalidated
    resp = token_client.get("/api/v1/students/me/courses/")
    assert resp.json()[0]["offerings"][0]["rated"]["comment"] == "updated"


def test_update_identified_rating_invalidates_student_courses_cache(token_client):
    student, course, offering = _setup_enrolled_student(token_client)
    rating = RatingFactory(
        student=student,
        course_offering=offering,
        difficulty=3,
        usefulness=4,
        comment="original",
        is_anonymous=False,
    )

    resp = token_client.get("/api/v1/students/me/courses/")
    assert resp.json()[0]["offerings"][0]["rated"]["comment"] == "original"

    token_client.patch(
        f"/api/v1/courses/{course.id}/ratings/{rating.id}/",
        data={"comment": "updated"},
        format="json",
    )

    resp = token_client.get("/api/v1/students/me/courses/")
    assert resp.json()[0]["offerings"][0]["rated"]["comment"] == "updated"


# ---------------------------------------------------------------------------
# /students/me/grades/ — cache invalidation (cached endpoint)
# ---------------------------------------------------------------------------


def test_delete_anonymous_rating_invalidates_grades_cache(token_client):
    student, course, offering = _setup_enrolled_student(token_client)
    rating = RatingFactory(
        student=student,
        course_offering=offering,
        difficulty=3,
        usefulness=4,
        comment="graded",
        is_anonymous=True,
    )

    # Warm the grades cache
    resp = token_client.get("/api/v1/students/me/grades/")
    assert resp.status_code == 200
    assert resp.json()[0]["rated"] is not None

    # Delete
    del_resp = token_client.delete(f"/api/v1/courses/{course.id}/ratings/{rating.id}/")
    assert del_resp.status_code == 204

    # Cache must be invalidated
    resp = token_client.get("/api/v1/students/me/grades/")
    assert resp.json()[0]["rated"] is None


def test_update_anonymous_rating_invalidates_grades_cache(token_client):
    student, course, offering = _setup_enrolled_student(token_client)
    rating = RatingFactory(
        student=student,
        course_offering=offering,
        difficulty=3,
        usefulness=4,
        comment="before",
        is_anonymous=True,
    )

    resp = token_client.get("/api/v1/students/me/grades/")
    assert resp.json()[0]["rated"]["comment"] == "before"

    token_client.patch(
        f"/api/v1/courses/{course.id}/ratings/{rating.id}/",
        data={"comment": "after"},
        format="json",
    )

    resp = token_client.get("/api/v1/students/me/grades/")
    assert resp.json()[0]["rated"]["comment"] == "after"


# ---------------------------------------------------------------------------
# Course ratings list — cache invalidation
# ---------------------------------------------------------------------------


def test_delete_anonymous_rating_invalidates_course_ratings_cache(token_client):
    student, course, offering = _setup_enrolled_student(token_client)
    rating = RatingFactory(
        student=student,
        course_offering=offering,
        difficulty=3,
        usefulness=4,
        is_anonymous=True,
    )

    # Warm the course ratings cache
    resp = token_client.get(f"/api/v1/courses/{course.id}/ratings/")
    assert resp.json()["total"] == 1

    # Delete
    del_resp = token_client.delete(f"/api/v1/courses/{course.id}/ratings/{rating.id}/")
    assert del_resp.status_code == 204

    # Cache must be invalidated
    resp = token_client.get(f"/api/v1/courses/{course.id}/ratings/")
    assert resp.json()["total"] == 0


def test_create_anonymous_rating_invalidates_course_ratings_cache(token_client):
    student, course, offering = _setup_enrolled_student(token_client)

    # Warm the cache — empty
    resp = token_client.get(f"/api/v1/courses/{course.id}/ratings/")
    assert resp.json()["total"] == 0

    # Create anonymous rating
    token_client.post(
        f"/api/v1/courses/{course.id}/ratings/",
        data={
            "course_offering": str(offering.id),
            "difficulty": 3,
            "usefulness": 4,
            "comment": "anon",
            "is_anonymous": True,
        },
        format="json",
    )

    resp = token_client.get(f"/api/v1/courses/{course.id}/ratings/")
    assert resp.json()["total"] == 1


# ---------------------------------------------------------------------------
# Privacy: anonymous ratings must never leak identity in API responses
# ---------------------------------------------------------------------------


def test_anonymous_rating_hides_identity_in_create_response(token_client):
    """POST response for anonymous rating must not contain student identity."""
    _student, course, offering = _setup_enrolled_student(token_client)

    resp = token_client.post(
        f"/api/v1/courses/{course.id}/ratings/",
        data={
            "course_offering": str(offering.id),
            "difficulty": 3,
            "usefulness": 4,
            "comment": "secret",
            "is_anonymous": True,
        },
        format="json",
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["is_anonymous"] is True
    assert data["student_id"] is None
    assert data["student_name"] is None
    assert data["student_avatar_url"] is None


def test_anonymous_rating_hides_identity_in_list_response(token_client):
    """GET ratings list must not leak identity for anonymous ratings."""
    student, course, offering = _setup_enrolled_student(token_client)
    RatingFactory(
        student=student,
        course_offering=offering,
        difficulty=3,
        usefulness=4,
        is_anonymous=True,
    )

    resp = token_client.get(f"/api/v1/courses/{course.id}/ratings/")
    rating_data = resp.json()["items"]["ratings"][0]
    assert rating_data["is_anonymous"] is True
    assert rating_data["student_id"] is None
    assert rating_data["student_name"] is None
    assert rating_data["student_avatar_url"] is None


def test_anonymous_rating_hides_identity_in_retrieve_response(token_client):
    """GET single rating must not leak identity for anonymous ratings."""
    student, course, offering = _setup_enrolled_student(token_client)
    rating = RatingFactory(
        student=student,
        course_offering=offering,
        difficulty=3,
        usefulness=4,
        is_anonymous=True,
    )

    resp = token_client.get(f"/api/v1/courses/{course.id}/ratings/{rating.id}/")
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_anonymous"] is True
    assert data["student_id"] is None
    assert data["student_name"] is None
    assert data["student_avatar_url"] is None


def test_identified_rating_exposes_identity(token_client):
    """Non-anonymous ratings must include student identity."""
    student, course, offering = _setup_enrolled_student(token_client)
    RatingFactory(
        student=student,
        course_offering=offering,
        difficulty=3,
        usefulness=4,
        is_anonymous=False,
    )

    resp = token_client.get(f"/api/v1/courses/{course.id}/ratings/")
    rating_data = resp.json()["items"]["ratings"][0]
    assert rating_data["is_anonymous"] is False
    assert rating_data["student_id"] is not None
    assert rating_data["student_name"] is not None
