import base64
import binascii
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from django.db.models import Q

from rating_app.exception.feed_exceptions import InvalidCursorError


@dataclass(frozen=True, slots=True)
class FeedCursor:
    """A position in the feed's `(occurred_at, id)` descending order."""

    _SEPARATOR = "|"

    occurred_at: datetime
    item_id: UUID

    def encode(self) -> str:
        # isoformat() keeps microseconds and the UTC offset
        payload = f"{self.occurred_at.isoformat()}{self._SEPARATOR}{self.item_id}"
        return base64.urlsafe_b64encode(payload.encode()).decode().rstrip("=")

    @classmethod
    def decode(cls, token: str) -> "FeedCursor":
        # decode the base64-encoded token
        try:
            padded = token + "=" * (-len(token) % 4)
            payload = base64.urlsafe_b64decode(padded.encode()).decode()
        except (binascii.Error, UnicodeDecodeError) as exc:
            raise InvalidCursorError from exc

        # parse the decoded payload
        try:
            occurred_at, item_id = cls._parse_decoded(payload)
        except ValueError as exc:
            raise InvalidCursorError from exc

        return cls(occurred_at=occurred_at, item_id=item_id)

    def filter(self, timestamp_field: str) -> Q:
        """The "strictly after this position" predicate, in descending order.

        Both feed sources call this with their own timestamp column
        (`created_at` for ratings, `published_at` for posts), which is what lets
        a single cursor address a position in the merged stream.
        """
        is_older = Q(**{f"{timestamp_field}__lt": self.occurred_at})
        is_tied_but_after = Q(**{timestamp_field: self.occurred_at, "id__lt": self.item_id})
        return is_older | is_tied_but_after

    @classmethod
    def _parse_decoded(cls, payload: str) -> tuple[datetime, UUID]:
        try:
            raw_occurred_at, raw_id = payload.split(cls._SEPARATOR)
            occurred_at = datetime.fromisoformat(raw_occurred_at)
            item_id = UUID(raw_id)
        except ValueError as exc:
            raise exc

        if occurred_at.tzinfo is None:
            occurred_at = occurred_at.replace(tzinfo=UTC)

        return occurred_at, item_id
