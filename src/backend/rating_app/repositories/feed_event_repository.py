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
