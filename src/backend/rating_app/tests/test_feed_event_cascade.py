"""Deleting a source row takes its feed index entry with it, on every delete path."""

from django.contrib.contenttypes.models import ContentType

import pytest

from rating_app.models import FeedEvent, FeedPost, Rating
from rating_app.tests.factories import FeedPostFactory, RatingFactory

pytestmark = [pytest.mark.django_db, pytest.mark.integration]


def _assert_indexed(source) -> None:
    """Factories and the FeedPost receiver keep the index in step; make that explicit."""
    assert FeedEvent.objects.filter(
        content_type=ContentType.objects.get_for_model(source), object_id=source.id
    ).exists()


class TestSourceDeletionCascades:
    def test_deleting_a_rating_removes_its_entry(self):
        rating = RatingFactory(comment="Варто брати")
        _assert_indexed(rating)

        rating.delete()

        assert not FeedEvent.objects.exists()

    def test_deleting_a_post_removes_its_entry(self):
        post = FeedPostFactory()
        _assert_indexed(post)

        post.delete()

        assert not FeedEvent.objects.exists()

    def test_cascade_from_a_parent_row_reaches_the_entry(self):
        """The reason this is a GenericRelation and not application code.

        Nothing in the service layer sees a rating go when its student is
        deleted; the collector does, and follows the relation.
        """
        rating = RatingFactory(comment="Варто брати")
        _assert_indexed(rating)

        rating.student.delete()

        assert not Rating.objects.exists()
        assert not FeedEvent.objects.exists()

    def test_queryset_delete_reaches_the_entry(self):
        """Admin bulk actions and `QuerySet.delete()` go through the collector too."""
        for _ in range(2):
            _assert_indexed(FeedPostFactory())

        FeedPost.objects.all().delete()

        assert not FeedEvent.objects.exists()

    def test_only_the_deleted_source_loses_its_entry(self):
        kept = RatingFactory(comment="Лишається")
        gone = RatingFactory(comment="Зникає")
        _assert_indexed(kept)
        _assert_indexed(gone)

        gone.delete()

        assert [event.object_id for event in FeedEvent.objects.all()] == [kept.id]
