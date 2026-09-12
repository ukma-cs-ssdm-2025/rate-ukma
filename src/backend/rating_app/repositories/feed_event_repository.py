from collections.abc import Iterable
from datetime import datetime

from django.db.models import QuerySet
from django.utils import timezone

from rating_app.application_schemas.feed import FeedEventRow, FeedEventUpsertData
from rating_app.models import FeedEvent
from rating_app.pagination import FeedCursor
from rating_app.repositories.to_domain_mappers import FeedEventRowMapper

# Pinned items lead every first page, so an unbounded count would push the
# homepage strip past its intended size.
MAX_PINNED = 3


class FeedEventRepository:
    def __init__(self, mapper: FeedEventRowMapper) -> None:
        self._mapper = mapper

    def get_page(self, cursor: FeedCursor | None, limit: int) -> list[FeedEventRow]:
        # unpinned entries older than cursor, newest first, plus one as lookahead
        events = self._build_live_queryset().filter(pinned=False)

        if cursor is not None:
            events = events.filter(cursor.filter("occurred_at"))

        return self._map(events[: limit + 1])

    def get_pinned(self) -> list[FeedEventRow]:
        return self._map(self._build_live_queryset().filter(pinned=True)[:MAX_PINNED])

    def get_next_future_occurrence(self) -> datetime | None:
        return (
            FeedEvent.objects.filter(is_visible=True, occurred_at__gt=timezone.now())
            .order_by("occurred_at")
            .values_list("occurred_at", flat=True)
            .first()
        )

    def upsert(self, data: FeedEventUpsertData) -> None:
        """Idempotent on `unique_feed_event_source`: rewriting a source row rewrites its event."""
        FeedEvent.objects.update_or_create(
            content_type=data.content_type,
            object_id=data.object_id,
            defaults={
                "event_type": data.event_type,
                "occurred_at": data.occurred_at,
                "is_visible": data.is_visible,
                "pinned": data.pinned,
            },
        )

    def replace_all(self, entries: Iterable[FeedEventUpsertData]) -> int:
        """Wipe the index and write it afresh. Returns the number of entries written."""
        FeedEvent.objects.all().delete()
        created = FeedEvent.objects.bulk_create(
            FeedEvent(
                event_type=entry.event_type,
                content_type=entry.content_type,
                object_id=entry.object_id,
                occurred_at=entry.occurred_at,
                is_visible=entry.is_visible,
                pinned=entry.pinned,
            )
            for entry in entries
        )
        return len(created)

    def _build_live_queryset(self) -> QuerySet[FeedEvent]:
        return (
            FeedEvent.objects.filter(is_visible=True, occurred_at__lte=timezone.now())
            .only("id", "event_type", "occurred_at", "object_id")
            .order_by("-occurred_at", "-id")
        )

    def _map(self, events: QuerySet[FeedEvent]) -> list[FeedEventRow]:
        return [self._mapper.process(event) for event in events]
