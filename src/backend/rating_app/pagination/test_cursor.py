import base64
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from django.db.models import Q

import pytest

from rating_app.exception.feed_exceptions import InvalidCursorError
from rating_app.pagination.cursor import FeedCursor


class TestEncodeDecodeCursor:
    def test_round_trip_preserves_position(self):
        occurred_at = datetime(2026, 9, 1, 12, 30, 45, 123456, tzinfo=UTC)
        item_id = uuid4()

        cursor = FeedCursor.decode(FeedCursor(occurred_at, item_id).encode())

        assert cursor.occurred_at == occurred_at
        assert cursor.item_id == item_id

    def test_round_trip_preserves_microseconds(self):
        """Truncating to seconds would skip or repeat rows at the boundary."""
        base = datetime(2026, 9, 1, 12, 30, 45, tzinfo=UTC)
        item_id = uuid4()

        first = FeedCursor.decode(FeedCursor(base, item_id).encode()).occurred_at
        later = FeedCursor(base + timedelta(microseconds=1), item_id)
        second = FeedCursor.decode(later.encode()).occurred_at

        assert second - first == timedelta(microseconds=1)

    def test_round_trip_preserves_non_utc_offset(self):
        occurred_at = datetime(2026, 9, 1, 12, 0, tzinfo=UTC).astimezone()

        cursor = FeedCursor.decode(FeedCursor(occurred_at, uuid4()).encode())

        assert cursor.occurred_at == occurred_at

    def test_token_is_url_safe_and_unpadded(self):
        token = FeedCursor(datetime(2026, 9, 1, tzinfo=UTC), uuid4()).encode()

        assert "=" not in token
        assert "+" not in token
        assert "/" not in token

    def test_naive_datetime_decodes_as_utc(self):
        token = FeedCursor(datetime(2026, 9, 1, 12, 0), uuid4()).encode()  # noqa: DTZ001

        assert FeedCursor.decode(token).occurred_at.tzinfo is not None


class TestDecodeCursorRejectsMalformed:
    @pytest.mark.parametrize(
        "token",
        [
            "",
            "not-base64!!",
            "!!!!",
        ],
        ids=["empty", "invalid_chars", "undecodable"],
    )
    def test_rejects_undecodable_token(self, token):
        with pytest.raises(InvalidCursorError):
            FeedCursor.decode(token)

    def test_rejects_missing_separator(self):
        with pytest.raises(InvalidCursorError):
            FeedCursor.decode(_token_for("2026-09-01T12:00:00+00:00"))

    def test_rejects_bad_timestamp(self):
        with pytest.raises(InvalidCursorError):
            FeedCursor.decode(_token_for(f"not-a-date|{uuid4()}"))

    def test_rejects_bad_uuid(self):
        with pytest.raises(InvalidCursorError):
            FeedCursor.decode(_token_for("2026-09-01T12:00:00+00:00|not-a-uuid"))

    def test_rejects_extra_separator(self):
        with pytest.raises(InvalidCursorError):
            FeedCursor.decode(_token_for(f"2026-09-01T12:00:00+00:00|{uuid4()}|extra"))

    def test_truncated_token_does_not_raise_raw_error(self):
        token = FeedCursor(datetime(2026, 9, 1, tzinfo=UTC), uuid4()).encode()

        with pytest.raises(InvalidCursorError):
            FeedCursor.decode(token[:-8])


class TestFilter:
    def test_matches_strictly_older_or_tied_but_after(self):
        occurred_at = datetime(2026, 9, 1, 12, 0, tzinfo=UTC)
        item_id = UUID("00000000-0000-0000-0000-000000000010")
        cursor = FeedCursor.decode(FeedCursor(occurred_at, item_id).encode())

        condition = cursor.filter("published_at")

        assert condition == Q(published_at__lt=occurred_at) | Q(
            published_at=occurred_at, id__lt=item_id
        )


def _token_for(payload: str) -> str:
    return base64.urlsafe_b64encode(payload.encode()).decode().rstrip("=")
