import uuid

from django.core.validators import FileExtensionValidator
from django.db import models
from django.utils import timezone

from .choices import FeedPostAccent

FEED_IMAGE_EXTENSIONS = ["svg", "png", "webp", "jpg", "jpeg"]


class FeedPost(models.Model):
    """
    An admin-authored post in the feed.

    Unlike `PromoBanner`, many posts are live at once — they are interleaved
    with review activity by `published_at`. `is_active` is the kill switch,
    `published_at` is the schedule: a post dated in the future stays hidden
    until then.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=120)
    body = models.TextField()
    label = models.CharField(
        max_length=40,
        blank=True,
        default="",
        help_text="Small tag above the title, e.g. the announcement category.",
    )
    cta_label = models.CharField(
        max_length=40,
        blank=True,
        default="",
    )
    cta_href = models.URLField(
        max_length=500,
        blank=True,
        default="",
        help_text="Where the call-to-action links to.",
    )
    image = models.FileField(
        upload_to="feed/",
        blank=True,
        validators=[FileExtensionValidator(FEED_IMAGE_EXTENSIONS)],
        help_text=f"Allowed: {', '.join(FEED_IMAGE_EXTENSIONS)}.",
    )
    accent = models.CharField(
        max_length=16,
        choices=FeedPostAccent.choices,
        default=FeedPostAccent.BRAND,
        help_text="Defines treatment of the card.",
    )
    pinned = models.BooleanField(
        default=False,
        db_index=True,
        help_text="Pinned posts lead the feed until unpinned.",
    )
    is_active = models.BooleanField(default=True, db_index=True)
    published_at = models.DateTimeField(
        default=timezone.now,
        db_index=True,
        help_text="Places the post in the timeline. A future date schedules it.",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-published_at"]
        verbose_name = "Feed Post"
        verbose_name_plural = "Feed Posts"
        indexes = [
            models.Index(fields=["is_active", "-published_at"], name="feed_post_live_idx"),
        ]

    def __str__(self):
        state = "active" if self.is_active else "inactive"
        return f"{self.title} ({state})"

    def __repr__(self):
        return (
            f"<FeedPost id={self.id} title={self.title} "
            f"pinned={self.pinned} is_active={self.is_active}>"
        )
