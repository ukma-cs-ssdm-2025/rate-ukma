from django.utils import timezone
from rest_framework.test import APIClient

import pytest
from freezegun import freeze_time

from rating_app.models import Notification
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


def _create_comment(client, rating_id, *, is_anonymous=False, content="Comment"):
    url = f"/api/v1/ratings/{rating_id}/comments/"
    return client.post(
        url,
        data={
            "content": content,
            "is_anonymous": is_anonymous,
            "created_at": timezone.now().isoformat(),
        },
        format="json",
    )


def _update_comment(client, comment_id, *, content="Updated comment", is_anonymous=False):
    url = f"/api/v1/comments/{comment_id}/"
    return client.patch(
        url,
        data={
            "content": content,
            "is_anonymous": is_anonymous,
        },
        format="json",
    )


def _make_author_client(rating_author):
    client = APIClient()
    client.force_authenticate(user=rating_author.user)
    return client


def _make_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
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
    assert response.status_code == 200
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
    assert response.status_code == 200
    notification = response.json()[0]

    assert "message" in notification
    assert len(notification["message"]) > 0


@pytest.mark.django_db
@pytest.mark.integration
def test_comment_creates_named_notification_for_rating_author(
    user_factory,
    student_factory,
    rating_factory,
):
    author_user = user_factory()
    author_student = student_factory(user=author_user)
    rating = rating_factory(student=author_student)
    commenter_user = user_factory(first_name="Commenter", last_name="Person")
    commenter_client = _make_client(commenter_user)

    create_response = _create_comment(commenter_client, rating.id)
    assert create_response.status_code == 201
    comment_id = create_response.json()["id"]

    author_client = _make_author_client(author_student)
    response = author_client.get(NOTIFICATIONS_URL)
    assert response.status_code == 200

    notification = response.json()[0]
    assert notification["event_type"] == "RATING_COMMENT_CREATED"
    assert notification["group_key"] == f"RATING_COMMENT_CREATED:{rating.id}:{comment_id}"
    assert notification["count"] == 1
    assert notification["is_unread"] is True
    assert notification["message"] == "Person Commenter прокоментував(-ла) ваш відгук"
    assert notification["rating_id"] == str(rating.id)
    assert notification["course_id"] == str(rating.course_offering.course_id)


@pytest.mark.django_db
@pytest.mark.integration
def test_two_comments_create_separate_notifications(
    user_factory,
    student_factory,
    rating_factory,
):
    author_user = user_factory()
    author_student = student_factory(user=author_user)
    rating = rating_factory(student=author_student)

    first_commenter_client = _make_client(user_factory(first_name="First", last_name="Commenter"))
    second_commenter_client = _make_client(user_factory(first_name="Second", last_name="Commenter"))

    first_response = _create_comment(first_commenter_client, rating.id)
    assert first_response.status_code == 201

    second_response = _create_comment(second_commenter_client, rating.id)
    assert second_response.status_code == 201

    author_client = _make_author_client(author_student)
    response = author_client.get(NOTIFICATIONS_URL)
    assert response.status_code == 200

    notifications = response.json()
    assert len(notifications) == 2
    assert {notification["count"] for notification in notifications} == {1}
    assert {notification["source_object_id"] for notification in notifications} == {
        first_response.json()["id"],
        second_response.json()["id"],
    }

    # messages should be singular (one notification per comment)
    messages = {n["message"] for n in notifications}
    assert messages == {
        "Commenter First прокоментував(-ла) ваш відгук",
        "Commenter Second прокоментував(-ла) ваш відгук",
    }


@pytest.mark.django_db
@pytest.mark.integration
def test_anonymous_comment_notification_hides_commenter_name(
    user_factory,
    student_factory,
    rating_factory,
):
    author_user = user_factory()
    author_student = student_factory(user=author_user)
    rating = rating_factory(student=author_student)
    commenter_user = user_factory(first_name="Hidden", last_name="Person")
    commenter_client = _make_client(commenter_user)

    response = _create_comment(commenter_client, rating.id, is_anonymous=True)
    assert response.status_code == 201

    author_client = _make_author_client(author_student)
    response = author_client.get(NOTIFICATIONS_URL)
    assert response.status_code == 200

    notification = response.json()[0]

    stored_notification = Notification.objects.get()
    assert stored_notification.actor_id == commenter_user.id
    assert "latest_actor_id" not in notification
    assert notification["message"] == "Хтось прокоментував(-ла) ваш відгук"
    assert "Hidden" not in notification["message"]
    assert "Person" not in notification["message"]


@pytest.mark.django_db
@pytest.mark.integration
def test_rating_author_does_not_receive_notification_for_own_comment(
    user_factory,
    student_factory,
    rating_factory,
):
    author_student = student_factory(user=user_factory())
    rating = rating_factory(student=author_student)
    author_client = _make_author_client(author_student)

    response = _create_comment(author_client, rating.id)
    assert response.status_code == 201

    response = author_client.get(NOTIFICATIONS_URL)
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.django_db
@pytest.mark.integration
def test_comment_update_does_not_create_another_notification(
    user_factory,
    student_factory,
    rating_factory,
):
    author_student = student_factory(user=user_factory())
    rating = rating_factory(student=author_student)
    commenter_client = _make_client(user_factory(first_name="Commenter", last_name="Person"))
    create_response = _create_comment(commenter_client, rating.id)
    assert create_response.status_code == 201

    comment_id = create_response.json()["id"]

    update_response = _update_comment(commenter_client, comment_id)
    assert update_response.status_code == 200

    author_client = _make_author_client(author_student)
    response = author_client.get(NOTIFICATIONS_URL)
    assert response.status_code == 200

    notifications = response.json()

    assert len(notifications) == 1
    assert notifications[0]["count"] == 1


@pytest.mark.django_db
@pytest.mark.integration
def test_comment_delete_removes_comment_notification(
    user_factory,
    student_factory,
    rating_factory,
):
    author_student = student_factory(user=user_factory())
    rating = rating_factory(student=author_student)
    commenter_client = _make_client(user_factory(first_name="Commenter", last_name="Person"))
    create_response = _create_comment(commenter_client, rating.id, is_anonymous=True)
    assert create_response.status_code == 201

    comment_id = create_response.json()["id"]

    author_client = _make_author_client(author_student)
    response = author_client.get(NOTIFICATIONS_URL)
    assert response.status_code == 200
    assert len(response.json()) == 1

    delete_response = commenter_client.delete(f"/api/v1/comments/{comment_id}/")
    assert delete_response.status_code == 204

    response = author_client.get(NOTIFICATIONS_URL)
    assert response.status_code == 200
    assert response.json() == []


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
@freeze_time(DEFAULT_AFTER_MIDTERM_DATE)
def test_toggling_vote_does_not_increment_count(
    token_client,
    enrolled_voter_setup,
):
    rating = enrolled_voter_setup["rating"]

    _cast_vote(token_client, rating.id, RatingVoteStrType.UPVOTE)
    _cast_vote(token_client, rating.id, RatingVoteStrType.DOWNVOTE)
    _cast_vote(token_client, rating.id, RatingVoteStrType.UPVOTE)

    author_client = _make_author_client(rating.student)
    response = author_client.get(NOTIFICATIONS_URL)
    assert response.status_code == 200

    notifications = response.json()

    assert len(notifications) == 1
    assert notifications[0]["count"] == 1


@pytest.mark.django_db
@pytest.mark.integration
def test_notifications_list_with_pagination(token_client):
    response = token_client.get(f"{NOTIFICATIONS_URL}?limit=5&offset=0")

    assert response.status_code == 200
    assert isinstance(response.json(), list)
