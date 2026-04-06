import uuid
from datetime import datetime
from typing import cast
from unittest.mock import MagicMock

import pytest

from rating_app.application_schemas.rating import Rating as RatingDTO
from rating_app.application_schemas.rating_vote import RatingVote as RatingVoteDTO
from rating_app.application_schemas.student import Student as StudentDTO
from rating_app.exception.student_exceptions import StudentNotFoundError
from rating_app.models.choices import NotificationEventType, RatingVoteType, SemesterTerm
from rating_app.models.rating_vote import RatingVote as RatingVoteModel
from rating_app.services.domain_event_listeners.vote_notification import (
    VoteNotificationObserver,
)

_SENTINEL: object = object()


def _make_rating_dto(
    *, student_id: uuid.UUID | None | object = _SENTINEL, course_id: uuid.UUID | None = None
):
    resolved_student_id = (
        uuid.uuid4() if student_id is _SENTINEL else cast(uuid.UUID | None, student_id)
    )
    return RatingDTO(
        id=uuid.uuid4(),
        course_offering=uuid.uuid4(),
        course_offering_term=SemesterTerm.FALL,
        course_offering_year=2024,
        student_id=resolved_student_id,
        student_name="Rating Author",
        course=course_id or uuid.uuid4(),
        difficulty=3,
        usefulness=4,
        comment="Good course",
        is_anonymous=False,
        created_at=datetime.now(),
        upvotes=0,
        downvotes=0,
        viewer_vote=None,
    )


def _make_vote_dto(*, student_id=None, rating_id=None, vote_type=RatingVoteType.UPVOTE):
    return RatingVoteDTO(
        id=uuid.uuid4(),
        student_id=student_id or uuid.uuid4(),
        rating_id=rating_id or uuid.uuid4(),
        vote_type=vote_type,
    )


def _make_student_dto(student_id: uuid.UUID, user_id: int | None = None) -> StudentDTO:
    return StudentDTO(
        id=student_id,
        first_name="Test",
        last_name="User",
        patronymic=None,
        education_level=None,
        speciality_id=uuid.uuid4(),
        user_id=user_id,
    )


RECIPIENT_USER_ID = 42
ACTOR_USER_ID = 99


class TestVoteNotificationObserver:
    @pytest.fixture
    def notification_service(self):
        return MagicMock()

    @pytest.fixture
    def rating_repository(self):
        return MagicMock()

    @pytest.fixture
    def student_repository(self):
        return MagicMock()

    @pytest.fixture
    def observer(self, notification_service, rating_repository, student_repository):
        return VoteNotificationObserver(
            notification_service=notification_service,
            rating_repository=rating_repository,
            student_repository=student_repository,
        )

    def _setup_student_lookups(self, student_repository, rating_student_id, voter_student_id):
        """Configure student_repository to return proper DTOs for recipient and actor."""

        def get_by_id(sid):
            if sid == str(rating_student_id):
                return _make_student_dto(rating_student_id, user_id=RECIPIENT_USER_ID)
            if sid == str(voter_student_id):
                return _make_student_dto(voter_student_id, user_id=ACTOR_USER_ID)
            raise StudentNotFoundError()

        student_repository.get_by_id.side_effect = get_by_id

    def test_creates_notification_on_upvote(
        self, observer, notification_service, rating_repository, student_repository
    ):
        rating = _make_rating_dto()
        rating_repository.get_by_id.return_value = rating
        vote = _make_vote_dto(rating_id=rating.id, vote_type=RatingVoteType.UPVOTE)
        self._setup_student_lookups(student_repository, rating.student_id, vote.student_id)

        observer.on_event(vote)

        notification_service.create_notification.assert_called_once_with(
            recipient_id=RECIPIENT_USER_ID,
            event_type=NotificationEventType.RATING_UPVOTED,
            group_key=f"{NotificationEventType.RATING_UPVOTED}:{vote.rating_id}",
            source_model=RatingVoteModel,
            source_id=str(vote.id),
            actor_id=ACTOR_USER_ID,
        )

    def test_creates_notification_on_downvote(
        self, observer, notification_service, rating_repository, student_repository
    ):
        rating = _make_rating_dto()
        rating_repository.get_by_id.return_value = rating
        vote = _make_vote_dto(rating_id=rating.id, vote_type=RatingVoteType.DOWNVOTE)
        self._setup_student_lookups(student_repository, rating.student_id, vote.student_id)

        observer.on_event(vote)

        notification_service.create_notification.assert_called_once()
        call_kwargs = notification_service.create_notification.call_args.kwargs
        assert call_kwargs["event_type"] == NotificationEventType.RATING_DOWNVOTED

    def test_skips_self_vote(self, observer, notification_service, rating_repository):
        shared_student_id = uuid.uuid4()
        rating = _make_rating_dto(student_id=shared_student_id)
        rating_repository.get_by_id.return_value = rating
        vote = _make_vote_dto(student_id=shared_student_id, rating_id=rating.id)

        observer.on_event(vote)

        notification_service.create_notification.assert_not_called()

    def test_skips_anonymous_rating_without_student(
        self, observer, notification_service, rating_repository
    ):
        rating = _make_rating_dto(student_id=None)
        rating_repository.get_by_id.return_value = rating
        vote = _make_vote_dto(rating_id=rating.id)

        observer.on_event(vote)

        notification_service.create_notification.assert_not_called()

    def test_skips_when_recipient_not_found(
        self, observer, notification_service, rating_repository, student_repository
    ):
        rating = _make_rating_dto()
        rating_repository.get_by_id.return_value = rating
        vote = _make_vote_dto(rating_id=rating.id)
        student_repository.get_by_id.side_effect = StudentNotFoundError()

        observer.on_event(vote)

        notification_service.create_notification.assert_not_called()

    def test_group_key_contains_event_type_and_rating_id(
        self, observer, notification_service, rating_repository, student_repository
    ):
        rating = _make_rating_dto()
        rating_repository.get_by_id.return_value = rating
        vote = _make_vote_dto(rating_id=rating.id, vote_type=RatingVoteType.UPVOTE)
        self._setup_student_lookups(student_repository, rating.student_id, vote.student_id)

        observer.on_event(vote)

        call_kwargs = notification_service.create_notification.call_args.kwargs
        expected_group_key = f"{NotificationEventType.RATING_UPVOTED}:{vote.rating_id}"
        assert call_kwargs["group_key"] == expected_group_key
