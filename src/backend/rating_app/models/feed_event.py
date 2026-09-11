import uuid

from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models
from django.db.models import Q

from .choices import FeedEventType


class FeedEvent(models.Model):
    """One row per feed-worthy occurrence: an index over the feed, not a copy of it.

    The row carries only what ordering and visibility need; the card's content is
    read live from the source row at request time. Nothing here goes stale when a
    review is edited or a post is retitled, and nothing has to be rewritten when it
    is — which is the whole reason there is no payload column.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    event_type = models.CharField(max_length=40, choices=FeedEventType.choices)

    occurred_at = models.DateTimeField(
        help_text="The source's own timestamp. A future value schedules the item.",
    )

    # Denormalised from the source so the read path needs no per-kind predicate:
    # "commented review", "active post" and every later rule collapse to one column.
    is_visible = models.BooleanField(default=True)
    pinned = models.BooleanField(default=False)

    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.UUIDField()
    source = GenericForeignKey("content_type", "object_id")

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-occurred_at", "-id"]
        verbose_name = "Feed Event"
        verbose_name_plural = "Feed Events"
        indexes = [
            # These two mirror the only two read queries — the body page and the
            # pinned prefix — so neither pays for invisible rows.
            models.Index(
                fields=["-occurred_at", "-id"],
                name="feed_event_keyset_idx",
                condition=Q(is_visible=True, pinned=False),
            ),
            models.Index(
                fields=["-occurred_at"],
                name="feed_event_pinned_idx",
                condition=Q(is_visible=True, pinned=True),
            ),
        ]
        constraints = [
            # The index is rewritten on every write to a source row, so it has to be
            # idempotent: this is what lets it be an upsert rather than an insert.
            models.UniqueConstraint(
                fields=["content_type", "object_id"],
                name="unique_feed_event_source",
            ),
        ]

    def __str__(self):
        return f"FeedEvent({self.event_type}) at {self.occurred_at.isoformat()}"

    def __repr__(self):
        return (
            f"<FeedEvent id={self.id} type={self.event_type} "
            f"source={self.content_type_id}:{self.object_id} "
            f"visible={self.is_visible} pinned={self.pinned}>"
        )
