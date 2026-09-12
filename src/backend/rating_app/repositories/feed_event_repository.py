from collections.abc import Iterable

from rating_app.application_schemas.feed import FeedEventUpsertData
from rating_app.models import FeedEvent


class FeedEventRepository:
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
