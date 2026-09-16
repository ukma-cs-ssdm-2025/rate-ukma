import uuid
from collections import defaultdict
from collections.abc import Sequence
from typing import Protocol

from rating_app.application_schemas.feed import FeedEventRow, FeedItem
from rating_app.models.choices import FeedEventType

ItemKey = tuple[FeedEventType, uuid.UUID]


class IFeedItemSource(Protocol):
    def get_feed_items_by_ids(self, ids: list[uuid.UUID]) -> Sequence[FeedItem]: ...


class FeedItemProvider:
    def __init__(self, sources: dict[FeedEventType, IFeedItemSource]) -> None:
        self._sources = sources

    def provide_feed_items(self, rows: list[FeedEventRow]) -> list[FeedItem]:
        ids_by_type: dict[FeedEventType, list[uuid.UUID]] = defaultdict(list)
        for row in rows:
            ids_by_type[row.event_type].append(row.object_id)

        # one query per kind present, whatever the page size
        items_by_key: dict[ItemKey, FeedItem] = {}

        for event_type, ids in ids_by_type.items():
            items = self._sources[event_type].get_feed_items_by_ids(ids)

            # in-place dict merge, keys are unique per source, nothing is overwritten
            items_by_key |= {(event_type, item.id): item for item in items}

        keys = ((row.event_type, row.object_id) for row in rows)
        return [items_by_key[key] for key in keys if key in items_by_key]
