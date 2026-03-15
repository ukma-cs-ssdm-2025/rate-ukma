from rest_framework.test import APIClient

import pytest
from freezegun import freeze_time

from rating_app.models.choices import RatingVoteStrType

from .test_rating import (
    DEFAULT_AFTER_MIDTERM_DATE,
    DEFAULT_TERM,
    DEFAULT_YEAR,
)

NOTIFICATIONS_URL = "/api/v1/notifications/"
UNREAD_COUNT_URL = "/api/v1/notifications/unread-count/"
MARK_READ_URL = "/api/v1/notifications/mark-read/"


@pytest.fixture
def default_semester(semester_factory):
    return semester_factory(year=DEFAULT_YEAR, term=DEFAULT_TERM)


@pytest.fixture
def enrolled_voter_setup(
    token_client,
    rating_factory,
    student_factory,
    enrollment_factory,
    user_factory,
    default_semester,
):
    author_user = user_factory()
    author_student = student_factory(user=author_user)
    rating = rating_factory(
        student=author_student,
        course_offering__semester=default_semester,
    )
    offering = rating.course_offering
    voter = student_factory(user=token_client.user)
    enrollment_factory(offering=offering, student=voter)
    return {"rating": rating, "voter": voter, "offering": offering}


def _cast_vote(client, rating_id, vote_type=RatingVoteStrType.UPVOTE):
    url = f"/api/v1/ratings/{rating_id}/votes/"
    return client.put(url, data={"vote_type": vote_type}, format="json")


def _make_author_client(rating_author):
    client = APIClient()
    client.force_authenticate(user=rating_author.user)
    return client


@pytest.mark.django_db
@pytest.mark.integration
def test_notifications_list_empty(token_client):
    response = token_client.get(NOTIFICATIONS_URL)

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.django_db
@pytest.mark.integration
def test_notifications_unauthenticated(api_client):
    response = api_client.get(NOTIFICATIONS_URL)

    assert response.status_code in (401, 403)


@pytest.mark.django_db
@pytest.mark.integration
def test_unread_count_initially_zero(token_client):
    response = token_client.get(UNREAD_COUNT_URL)

    assert response.status_code == 200
    assert response.json()["count"] == 0


@pytest.mark.django_db
@pytest.mark.integration
def test_mark_read_succeeds(token_client):
    response = token_client.post(MARK_READ_URL)

    assert response.status_code == 204


@pytest.mark.django_db
@pytest.mark.integration
@freeze_time(DEFAULT_AFTER_MIDTERM_DATE)
def test_vote_creates_notification_for_rating_author(
    token_client,
    enrolled_voter_setup,
):
    rating = enrolled_voter_setup["rating"]

    response = _cast_vote(token_client, rating.id)
    assert response.status_code == 201

    author_client = _make_author_client(rating.student)

    response = author_client.get(NOTIFICATIONS_URL)
    assert response.status_code == 200

    notifications = response.json()
    assert len(notifications) == 1
    assert notifications[0]["event_type"] == "RATING_UPVOTED"
    assert notifications[0]["count"] == 1
    assert notifications[0]["is_unread"] is True


@pytest.mark.django_db
@pytest.mark.integration
@freeze_time(DEFAULT_AFTER_MIDTERM_DATE)
def test_unread_count_increments_after_vote(
    token_client,
    enrolled_voter_setup,
):
    rating = enrolled_voter_setup["rating"]

    _cast_vote(token_client, rating.id)

    author_client = _make_author_client(rating.student)

    response = author_client.get(UNREAD_COUNT_URL)
    assert response.status_code == 200
    assert response.json()["count"] == 1


@pytest.mark.django_db
@pytest.mark.integration
@freeze_time(DEFAULT_AFTER_MIDTERM_DATE)
def test_mark_read_clears_unread_count(
    token_client,
    enrolled_voter_setup,
):
    rating = enrolled_voter_setup["rating"]

    _cast_vote(token_client, rating.id)

    author_client = _make_author_client(rating.student)
    author_client.post(MARK_READ_URL)

    response = author_client.get(UNREAD_COUNT_URL)
    assert response.status_code == 200
    assert response.json()["count"] == 0


@pytest.mark.django_db
@pytest.mark.integration
@freeze_time(DEFAULT_AFTER_MIDTERM_DATE)
def test_multiple_votes_on_same_rating_group_together(
    token_client,
    enrolled_voter_setup,
    user_factory,
    student_factory,
    enrollment_factory,
):
    rating = enrolled_voter_setup["rating"]
    offering = enrolled_voter_setup["offering"]

    _cast_vote(token_client, rating.id)

    second_user = user_factory()
    second_student = student_factory(user=second_user)
    enrollment_factory(offering=offering, student=second_student)

    second_client = APIClient()
    second_client.force_authenticate(user=second_user)
    _cast_vote(second_client, rating.id)

    author_client = _make_author_client(rating.student)

    response = author_client.get(NOTIFICATIONS_URL)
    notifications = response.json()

    assert len(notifications) == 1
    assert notifications[0]["count"] == 2
    assert "message" in notifications[0]


@pytest.mark.django_db
@pytest.mark.integration
@freeze_time(DEFAULT_AFTER_MIDTERM_DATE)
def test_notification_has_message_field(
    token_client,
    enrolled_voter_setup,
):
    rating = enrolled_voter_setup["rating"]
    _cast_vote(token_client, rating.id)

    author_client = _make_author_client(rating.student)

    response = author_client.get(NOTIFICATIONS_URL)
    notification = response.json()[0]

    assert "message" in notification
    assert len(notification["message"]) > 0


@pytest.mark.django_db
@pytest.mark.integration
@freeze_time(DEFAULT_AFTER_MIDTERM_DATE)
def test_voter_does_not_receive_own_notification(
    token_client,
    enrolled_voter_setup,
):
    rating = enrolled_voter_setup["rating"]
    _cast_vote(token_client, rating.id)

    response = token_client.get(NOTIFICATIONS_URL)
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.django_db
@pytest.mark.integration
def test_notifications_list_with_pagination(token_client):
    response = token_client.get(f"{NOTIFICATIONS_URL}?limit=5&offset=0")

    assert response.status_code == 200
    assert isinstance(response.json(), list)
