import pytest

from rating_app.models.choices import RatingVoteType


@pytest.mark.django_db
@pytest.mark.integration
def test_create_vote_upvote(token_client, rating_factory, student_factory, enrollment_factory):
    rating = rating_factory()
    offering = rating.course_offering
    student = student_factory(user=token_client.user)
    enrollment_factory(offering=offering, student=student)  # must be enrolled to vote

    url = f"/api/v1/ratings/{rating.id}/votes/"
    payload = {
        "vote_type": RatingVoteType.UPVOTE,
    }

    response = token_client.put(url, data=payload, format="json")

    assert response.status_code == 201
    assert response.json()["vote_type"] == RatingVoteType.UPVOTE
    assert response.json()["rating"] == str(rating.id)


@pytest.mark.django_db
@pytest.mark.integration
def test_create_vote_downvote(token_client, rating_factory, student_factory, enrollment_factory):
    rating = rating_factory()
    offering = rating.course_offering
    student = student_factory(user=token_client.user)
    enrollment_factory(offering=offering, student=student)

    url = f"/api/v1/ratings/{rating.id}/votes/"
    payload = {
        "vote_type": RatingVoteType.DOWNVOTE,
    }

    response = token_client.put(url, data=payload, format="json")

    assert response.status_code == 201
    assert response.json()["vote_type"] == RatingVoteType.DOWNVOTE


@pytest.mark.django_db
@pytest.mark.integration
def test_create_vote_toggle(
    token_client, rating_factory, student_factory, enrollment_factory, vote_factory
):
    # Setup: Existing UPVOTE
    rating = rating_factory()
    offering = rating.course_offering
    student = student_factory(user=token_client.user)
    enrollment_factory(offering=offering, student=student)
    vote_factory(rating=rating, student=student, type=RatingVoteType.UPVOTE)

    url = f"/api/v1/ratings/{rating.id}/votes/"
    payload = {
        "vote_type": RatingVoteType.DOWNVOTE,
    }

    response = token_client.put(url, data=payload, format="json")

    assert response.status_code == 200
    assert response.json()["vote_type"] == RatingVoteType.DOWNVOTE


@pytest.mark.django_db
@pytest.mark.integration
def test_delete_vote(
    token_client, rating_factory, student_factory, enrollment_factory, vote_factory
):
    rating = rating_factory()
    offering = rating.course_offering
    student = student_factory(user=token_client.user)
    enrollment_factory(offering=offering, student=student)
    vote_factory(rating=rating, student=student, type=RatingVoteType.UPVOTE)

    url = f"/api/v1/ratings/{rating.id}/votes/"
    response = token_client.delete(url)

    assert response.status_code == 204


@pytest.mark.django_db
@pytest.mark.integration
def test_create_vote_not_enrolled_fails(token_client, rating_factory, student_factory):
    rating = rating_factory()
    # Student exists but is NOT enrolled in the course associated with the rating
    student_factory(user=token_client.user)

    url = f"/api/v1/ratings/{rating.id}/votes/"
    payload = {
        "vote_type": RatingVoteType.UPVOTE,
    }

    response = token_client.put(url, data=payload, format="json")

    assert response.status_code == 403
    assert "must be enrolled" in response.json()["detail"]


@pytest.mark.django_db
@pytest.mark.integration
def test_create_vote_not_student_fails(token_client, rating_factory):
    rating = rating_factory()
    # User is logged in but has no Student profile

    url = f"/api/v1/ratings/{rating.id}/votes/"
    payload = {
        "vote_type": RatingVoteType.UPVOTE,
    }

    response = token_client.put(url, data=payload, format="json")

    assert response.status_code == 403
    assert "Only students can perform this action" in response.json()["detail"]


@pytest.mark.django_db
@pytest.mark.integration
def test_create_vote_invalid_type_fails(
    token_client, rating_factory, student_factory, enrollment_factory
):
    rating = rating_factory()
    offering = rating.course_offering
    student = student_factory(user=token_client.user)
    enrollment_factory(offering=offering, student=student)

    url = f"/api/v1/ratings/{rating.id}/votes/"
    payload = {"vote_type": "INVALID_TYPE"}

    response = token_client.put(url, data=payload, format="json")

    assert response.status_code == 400
