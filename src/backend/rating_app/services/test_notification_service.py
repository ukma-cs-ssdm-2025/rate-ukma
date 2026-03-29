from datetime import UTC, datetime
from unittest.mock import MagicMock

import pytest

from rating_app.services.notification_service import (
    DEFAULT_NOTIFICATION_PAGE_SIZE,
    NotificationService,
)


class TestNotificationService:
    @pytest.fixture
    def notification_repository(self):
        return MagicMock()

    @pytest.fixture
    def cursor_repository(self):
        return MagicMock()

    @pytest.fixture
    def service(self, notification_repository, cursor_repository):
        return NotificationService(
            notification_repository=notification_repository,
            cursor_repository=cursor_repository,
        )

    def test_get_notifications_uses_cursor_value(
        self, service, notification_repository, cursor_repository
    ):
        user_id = 1
        cursor_time = datetime(2024, 1, 1, tzinfo=UTC)
        cursor_repository.get_cursor_value.return_value = cursor_time
        notification_repository.get_grouped_for_user.return_value = []

        service.get_notifications_for_user(user_id)

        cursor_repository.get_cursor_value.assert_called_once_with(user_id)
        notification_repository.get_grouped_for_user.assert_called_once_with(
            user_id=user_id,
            cursor_value=cursor_time,
            limit=DEFAULT_NOTIFICATION_PAGE_SIZE,
            offset=0,
        )

    def test_get_notifications_passes_pagination_params(
        self, service, notification_repository, cursor_repository
    ):
        user_id = 1
        cursor_repository.get_cursor_value.return_value = datetime.now(tz=UTC)
        notification_repository.get_grouped_for_user.return_value = []

        service.get_notifications_for_user(user_id, limit=10, offset=5)

        call_kwargs = notification_repository.get_grouped_for_user.call_args.kwargs
        assert call_kwargs["limit"] == 10
        assert call_kwargs["offset"] == 5

    def test_get_unread_count_uses_cursor_value(
        self, service, notification_repository, cursor_repository
    ):
        user_id = 1
        cursor_time = datetime(2024, 1, 1, tzinfo=UTC)
        cursor_repository.get_cursor_value.return_value = cursor_time
        notification_repository.get_unread_group_count.return_value = 3

        count = service.get_unread_count(user_id)

        assert count == 3
        notification_repository.get_unread_group_count.assert_called_once_with(
            user_id=user_id,
            cursor_value=cursor_time,
        )

    def test_mark_all_read_advances_cursor(self, service, cursor_repository):
        user_id = 1

        service.mark_all_read(user_id)

        cursor_repository.advance_cursor.assert_called_once_with(user_id)

    @pytest.mark.django_db
    def test_create_notification_delegates_to_repository(self, service, notification_repository):
        from rating_app.models.rating_vote import RatingVote

        notification_repository.create.return_value = MagicMock()

        service.create_notification(
            recipient_id=1,
            event_type="RATING_UPVOTED",
            group_key="RATING_UPVOTED:some-id",
            source_model=RatingVote,
            source_id="some-id",
            actor_id=2,
        )

        notification_repository.create.assert_called_once()
        call_args = notification_repository.create.call_args
        data = call_args.args[0]
        assert data.recipient_id == 1
        assert data.event_type == "RATING_UPVOTED"
        assert data.group_key == "RATING_UPVOTED:some-id"
        assert data.object_id == "some-id"
        assert data.actor_id == 2
