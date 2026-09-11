"""`0037_feedevent` backfill — indexes the rows that predate `FeedEvent`."""

from datetime import timedelta

from django.contrib.contenttypes.models import ContentType
from django.utils import timezone

import pytest

from rating_app.models import FeedEvent, FeedPost, Rating
from rating_app.models.choices import FeedEventType

pytestmark = [pytest.mark.django_db, pytest.mark.integration]

MIGRATION = "0037_feedevent"


def _event_for(source) -> FeedEvent:
    return FeedEvent.objects.get(
        content_type=ContentType.objects.get_for_model(source), object_id=source.id
    )


class TestBackfill:
    def test_projects_commented_ratings_only(self, run_data_migration, rating_factory):
        commented = rating_factory(comment="Варто брати")
        rating_factory(comment="")

        run_data_migration(MIGRATION)

        events = FeedEvent.objects.filter(event_type=FeedEventType.REVIEW_PUBLISHED)
        assert [event.object_id for event in events] == [commented.id]

        event = _event_for(commented)
        assert event.occurred_at == commented.created_at
        assert event.is_visible is True
        assert event.pinned is False

    def test_mirrors_post_state_onto_the_event(self, run_data_migration, feed_post_factory):
        scheduled_for = timezone.now() + timedelta(days=1)
        pinned = feed_post_factory(pinned=True)
        inactive = feed_post_factory(is_active=False)
        scheduled = feed_post_factory(published_at=scheduled_for)

        run_data_migration(MIGRATION)

        assert FeedEvent.objects.filter(event_type=FeedEventType.POST_PUBLISHED).count() == 3
        assert _event_for(pinned).pinned is True
        assert _event_for(inactive).is_visible is False
        assert _event_for(scheduled).occurred_at == scheduled_for

    def test_rerun_is_a_noop(self, run_data_migration, rating_factory, feed_post_factory):
        rating_factory(comment="Цікаво")
        feed_post_factory()

        run_data_migration(MIGRATION)
        run_data_migration(MIGRATION)

        assert FeedEvent.objects.count() == 2

    def test_reverse_removes_what_forward_wrote(
        self, run_data_migration, rating_factory, feed_post_factory
    ):
        rating_factory(comment="Цікаво")
        feed_post_factory()
        run_data_migration(MIGRATION)

        run_data_migration(MIGRATION, backwards=True)

        assert not FeedEvent.objects.exists()
        # only the index is undone, never the sources
        assert Rating.objects.count() == 1
        assert FeedPost.objects.count() == 1
