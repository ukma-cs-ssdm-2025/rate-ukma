from django.contrib.contenttypes.models import ContentType

import structlog

from rating_app.application_schemas.notification import (
    NotificationCreateData,
    NotificationGroup,
)
from rating_app.repositories.notification_repository import (
    NotificationCursorRepository,
    NotificationRepository,
)

logger = structlog.get_logger(__name__)

DEFAULT_NOTIFICATION_PAGE_SIZE = 20


class NotificationService:
    def __init__(
        self,
        notification_repository: NotificationRepository,
        cursor_repository: NotificationCursorRepository,
    ) -> None:
        self._notification_repository = notification_repository
        self._cursor_repository = cursor_repository

    def create_notification(
        self,
        *,
        recipient_id: int,
        event_type: str,
        group_key: str,
        source_model: type,
        source_id: str,
        actor_id: int | None = None,
    ) -> NotificationGroup:
        content_type = ContentType.objects.get_for_model(source_model)

        data = NotificationCreateData(
            recipient_id=recipient_id,
            event_type=event_type,
            group_key=group_key,
            content_type=content_type,
            object_id=source_id,
            actor_id=actor_id,
        )
        return self._notification_repository.create(data)

    def get_notifications_for_user(
        self,
        user_id: int,
        limit: int = DEFAULT_NOTIFICATION_PAGE_SIZE,
        offset: int = 0,
    ) -> list[NotificationGroup]:
        cursor_value = self._cursor_repository.get_cursor_value(user_id)
        return self._notification_repository.get_grouped_for_user(
            user_id=user_id,
            cursor_value=cursor_value,
            limit=limit,
            offset=offset,
        )

    def get_unread_count(self, user_id: int) -> int:
        cursor_value = self._cursor_repository.get_cursor_value(user_id)
        return self._notification_repository.get_unread_group_count(
            user_id=user_id,
            cursor_value=cursor_value,
        )

    def mark_all_read(self, user_id: int) -> None:
        self._cursor_repository.advance_cursor(user_id)

    def mark_group_read(self, user_id: int, group_key: str) -> None:
        self._cursor_repository.mark_group_read(user_id, group_key)
