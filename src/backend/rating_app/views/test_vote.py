import pytest
from freezegun import freeze_time

from rating_app.models.choices import RatingVoteStrType, RatingVoteType

from .test_rating import (
    DEFAULT_AFTER_MIDTERM_DATE,
    DEFAULT_BEFORE_MIDTERM_DATE,
    DEFAULT_TERM,
    DEFAULT_YEAR,
)


@pytest.mark.django_db
@pytest.mark.integration
@freeze_time(DEFAULT_AFTER_MIDTERM_DATE)
def test_create_vote_upvote(
    token_client,
    rating_factory,
    student_factory,
    enrollment_factory,
    semester_factory,
):
    semester = semester_factory(year=DEFAULT_YEAR, term=DEFAULT_TERM)
    rating = rating_factory(course_offering__semester=semester)
    offering = rating.course_offering
    student = student_factory(user=token_client.user)
    enrollment_factory(offering=offering, student=student)  # must be enrolled to vote

    url = f"/api/v1/ratings/{rating.id}/votes/"
    payload = {
        "vote_type": RatingVoteStrType.UPVOTE,
    }

    response = token_client.put(url, data=payload, format="json")

    assert response.status_code == 201
    assert response.json()["vote_type"] == RatingVoteStrType.UPVOTE
    assert response.json()["rating"] == str(rating.id)


@pytest.mark.django_db
@pytest.mark.integration
@freeze_time(DEFAULT_AFTER_MIDTERM_DATE)
def test_create_vote_downvote(
    token_client,
    rating_factory,
    student_factory,
    enrollment_factory,
    semester_factory,
):
    semester = semester_factory(year=DEFAULT_YEAR, term=DEFAULT_TERM)
    rating = rating_factory(course_offering__semester=semester)
    offering = rating.course_offering
    student = student_factory(user=token_client.user)
    enrollment_factory(offering=offering, student=student)

    url = f"/api/v1/ratings/{rating.id}/votes/"
    payload = {
        "vote_type": RatingVoteStrType.DOWNVOTE,
    }

    response = token_client.put(url, data=payload, format="json")

    assert response.status_code == 201
    assert response.json()["vote_type"] == RatingVoteStrType.DOWNVOTE


@pytest.mark.django_db
@pytest.mark.integration
@freeze_time(DEFAULT_AFTER_MIDTERM_DATE)
def test_create_vote_different_enrollment(
    token_client,
    rating_factory,
    student_factory,
    enrollment_factory,
    course_offering_factory,
    course_factory,
    semester_factory,
):
    semester = semester_factory(year=DEFAULT_YEAR, term=DEFAULT_TERM)
    course = course_factory()
    course_offering_1 = course_offering_factory(course=course, semester=semester)
    course_offering_2 = course_offering_factory(course=course, semester=semester)

    enrollment_factory(offering=course_offering_1, student=student_factory(user=token_client.user))

    rating = rating_factory(course_offering=course_offering_2)

    url = f"/api/v1/ratings/{rating.id}/votes/"
    payload = {
        "vote_type": RatingVoteStrType.UPVOTE,
    }

    response = token_client.put(url, data=payload, format="json")

    assert response.status_code == 201
    assert response.json()["vote_type"] == RatingVoteStrType.UPVOTE
    assert response.json()["rating"] == str(rating.id)


@pytest.mark.django_db
@pytest.mark.integration
@freeze_time(DEFAULT_AFTER_MIDTERM_DATE)
def test_create_vote_toggle(
    token_client,
    rating_factory,
    student_factory,
    enrollment_factory,
    vote_factory,
    semester_factory,
):
    semester = semester_factory(year=DEFAULT_YEAR, term=DEFAULT_TERM)
    # Setup: Existing UPVOTE
    rating = rating_factory(course_offering__semester=semester)
    offering = rating.course_offering
    student = student_factory(user=token_client.user)
    enrollment_factory(offering=offering, student=student)
    vote_factory(rating=rating, student=student, type=RatingVoteType.UPVOTE)

    url = f"/api/v1/ratings/{rating.id}/votes/"
    payload = {
        "vote_type": RatingVoteStrType.DOWNVOTE,
    }

    response = token_client.put(url, data=payload, format="json")

    assert response.status_code == 200
    assert response.json()["vote_type"] == RatingVoteStrType.DOWNVOTE


@pytest.mark.django_db
@pytest.mark.integration
@freeze_time(DEFAULT_AFTER_MIDTERM_DATE)
def test_delete_vote(
    token_client,
    rating_factory,
    student_factory,
    enrollment_factory,
    vote_factory,
    semester_factory,
):
    semester = semester_factory(year=DEFAULT_YEAR, term=DEFAULT_TERM)
    rating = rating_factory(course_offering__semester=semester)
    offering = rating.course_offering
    student = student_factory(user=token_client.user)
    enrollment_factory(offering=offering, student=student)
    vote_factory(rating=rating, student=student, type=RatingVoteType.UPVOTE)

    url = f"/api/v1/ratings/{rating.id}/votes/"
    response = token_client.delete(url)

    assert response.status_code == 204


@pytest.mark.django_db
@pytest.mark.integration
@freeze_time(DEFAULT_AFTER_MIDTERM_DATE)
def test_create_vote_not_enrolled_fails(
    token_client,
    rating_factory,
    student_factory,
    semester_factory,
):
    semester = semester_factory(year=DEFAULT_YEAR, term=DEFAULT_TERM)
    rating = rating_factory(course_offering__semester=semester)
    # Student exists but is NOT enrolled in the course associated with the rating
    student_factory(user=token_client.user)

    url = f"/api/v1/ratings/{rating.id}/votes/"
    payload = {
        "vote_type": RatingVoteStrType.UPVOTE,
    }

    response = token_client.put(url, data=payload, format="json")

    assert response.status_code == 403
    assert "must be enrolled" in response.json()["detail"]


@pytest.mark.django_db
@pytest.mark.integration
@freeze_time(DEFAULT_AFTER_MIDTERM_DATE)
def test_create_vote_not_student_fails(
    token_client,
    rating_factory,
    semester_factory,
):
    semester = semester_factory(year=DEFAULT_YEAR, term=DEFAULT_TERM)
    rating = rating_factory(course_offering__semester=semester)
    # User is logged in but has no Student profile

    url = f"/api/v1/ratings/{rating.id}/votes/"
    payload = {
        "vote_type": RatingVoteStrType.UPVOTE,
    }

    response = token_client.put(url, data=payload, format="json")

    assert response.status_code == 403
    assert "Only students can perform this action" in response.json()["detail"]


@pytest.mark.django_db
@pytest.mark.integration
@freeze_time(DEFAULT_AFTER_MIDTERM_DATE)
def test_create_vote_invalid_type_fails(
    token_client,
    rating_factory,
    student_factory,
    enrollment_factory,
    semester_factory,
):
    semester = semester_factory(year=DEFAULT_YEAR, term=DEFAULT_TERM)
    rating = rating_factory(course_offering__semester=semester)
    offering = rating.course_offering
    student = student_factory(user=token_client.user)
    enrollment_factory(offering=offering, student=student)

    url = f"/api/v1/ratings/{rating.id}/votes/"
    payload = {"vote_type": "INVALID_TYPE"}

    response = token_client.put(url, data=payload, format="json")

    assert response.status_code == 400


@pytest.mark.django_db
@pytest.mark.integration
@freeze_time(DEFAULT_BEFORE_MIDTERM_DATE)
def test_create_vote_before_midterm_fails(
    token_client,
    rating_factory,
    student_factory,
    semester_factory,
    course_factory,
    course_offering_factory,
    enrollment_factory,
):
    semester = semester_factory(year=DEFAULT_YEAR, term=DEFAULT_TERM)
    course = course_factory()
    offering = course_offering_factory(course=course, semester=semester)
    student = student_factory(user=token_client.user)
    enrollment_factory(offering=offering, student=student)
    rating = rating_factory(course_offering=offering)

    url = f"/api/v1/ratings/{rating.id}/votes/"
    payload = {
        "vote_type": RatingVoteStrType.UPVOTE,
    }

    response = token_client.put(url, data=payload, format="json")

    assert response.status_code == 403
    assert "half of the semester has passed" in response.json()["detail"]


@pytest.mark.django_db
@pytest.mark.integration
@freeze_time("2023-11-25")  # After midterm
def test_create_vote_after_midterm_succeeds(
    token_client,
    rating_factory,
    student_factory,
    semester_factory,
    course_factory,
    course_offering_factory,
    enrollment_factory,
):
    semester = semester_factory(year=DEFAULT_YEAR, term=DEFAULT_TERM)
    course = course_factory()
    offering = course_offering_factory(course=course, semester=semester)
    student = student_factory(user=token_client.user)
    enrollment_factory(offering=offering, student=student)
    rating = rating_factory(course_offering=offering)

    url = f"/api/v1/ratings/{rating.id}/votes/"
    payload = {
        "vote_type": RatingVoteStrType.UPVOTE,
    }

    response = token_client.put(url, data=payload, format="json")

    assert response.status_code == 201
    assert response.json()["vote_type"] == RatingVoteStrType.UPVOTE


@pytest.mark.django_db
@pytest.mark.integration
@freeze_time("2024-09-15")  # Next year, same term - original semester is now past
def test_create_vote_on_past_semester_succeeds(
    token_client,
    rating_factory,
    student_factory,
    semester_factory,
    course_factory,
    course_offering_factory,
    enrollment_factory,
):
    # Create Fall 2023 (past) and Fall 2024 (current) semesters
    past_semester = semester_factory(year=DEFAULT_YEAR, term=DEFAULT_TERM)
    _current_semester = semester_factory(year=2024, term=DEFAULT_TERM)

    course = course_factory()
    offering = course_offering_factory(course=course, semester=past_semester)
    student = student_factory(user=token_client.user)
    enrollment_factory(offering=offering, student=student)
    rating = rating_factory(course_offering=offering)

    url = f"/api/v1/ratings/{rating.id}/votes/"
    payload = {
        "vote_type": RatingVoteStrType.DOWNVOTE,
    }

    response = token_client.put(url, data=payload, format="json")

    assert response.status_code == 201
    assert response.json()["vote_type"] == RatingVoteStrType.DOWNVOTE
