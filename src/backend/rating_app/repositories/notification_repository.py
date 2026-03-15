from datetime import datetime

from django.db.models import Count, Max, OuterRef, QuerySet, Subquery
from django.utils import timezone

import structlog

from rating_app.application_schemas.notification import (
    NotificationCreateData,
    NotificationGroup,
)
from rating_app.models.notification import Notification, NotificationCursor
from rating_app.repositories.protocol import IAppendOnlyRepository, ICursorRepository

from .to_domain_mappers import NotificationGroupMapper

logger = structlog.get_logger(__name__)


class NotificationRepository(
    IAppendOnlyRepository[NotificationGroup, NotificationCreateData, datetime],
):
    def __init__(self, mapper: NotificationGroupMapper) -> None:
        self._mapper = mapper

    def create(self, data: NotificationCreateData) -> NotificationGroup:
        model = Notification.objects.create(
            recipient_id=data.recipient_id,
            event_type=data.event_type,
            group_key=data.group_key,
            content_type=data.content_type,
            object_id=data.object_id,
            actor_id=data.actor_id,
        )
        return self._mapper.process(model)

    def get_grouped_for_user(
        self,
        user_id: int,
        cursor_value: datetime,
        limit: int,
        offset: int = 0,
    ) -> list[NotificationGroup]:
        group_aggregates = (
            self._build_base_queryset(user_id)
            .values("group_key")
            .annotate(
                count=Count("id"),
                latest_created_at=Max("created_at"),
            )
            .order_by("-latest_created_at")
        )[offset : offset + limit]

        group_keys = [row["group_key"] for row in group_aggregates]
        if not group_keys:
            return []

        aggregates_by_key = {row["group_key"]: row for row in group_aggregates}
        latest_per_group = self._get_latest_notification_per_group(user_id, group_keys)

        return self._build_notification_groups(
            latest_per_group,
            aggregates_by_key,
            cursor_value,
        )

    def get_unread_group_count(self, user_id: int, cursor_value: datetime) -> int:
        return (
            self._build_base_queryset(user_id)
            .filter(created_at__gt=cursor_value)
            .values("group_key")
            .distinct()
            .count()
        )

    def _build_base_queryset(self, user_id: int) -> QuerySet[Notification]:
        return Notification.objects.filter(recipient_id=user_id)

    def _get_latest_notification_per_group(
        self,
        user_id: int,
        group_keys: list[str],
    ) -> QuerySet[Notification]:
        latest_id_per_group = (
            Notification.objects.filter(
                recipient_id=user_id,
                group_key=OuterRef("group_key"),
            )
            .order_by("-created_at")
            .values("id")[:1]
        )

        latest_ids = (
            Notification.objects.filter(
                recipient_id=user_id,
                group_key__in=group_keys,
            )
            .values("group_key")
            .annotate(latest_id=Subquery(latest_id_per_group))
            .values("latest_id")
        )

        return Notification.objects.filter(
            id__in=Subquery(latest_ids),
        ).select_related("actor")

    def _build_notification_groups(
        self,
        latest_notifications: QuerySet[Notification],
        aggregates_by_key: dict[str, dict],
        cursor_value: datetime,
    ) -> list[NotificationGroup]:
        latest_by_key = {n.group_key: n for n in latest_notifications}

        groups = []
        for group_key, agg in aggregates_by_key.items():
            latest = latest_by_key.get(group_key)
            if latest is None:
                continue

            groups.append(
                self._mapper.process(
                    latest,
                    count=agg["count"],
                    latest_created_at=agg["latest_created_at"],
                    is_unread=agg["latest_created_at"] > cursor_value,
                )
            )

        groups.sort(key=lambda g: g.latest_created_at, reverse=True)
        return groups


class NotificationCursorRepository(ICursorRepository[datetime]):
    def get_cursor_value(self, user_id: int) -> datetime:
        cursor, _ = NotificationCursor.objects.get_or_create(user_id=user_id)
        return cursor.last_read_at

    def advance_cursor(self, user_id: int) -> None:
        NotificationCursor.objects.update_or_create(
            user_id=user_id,
            defaults={"last_read_at": timezone.now()},
        )
