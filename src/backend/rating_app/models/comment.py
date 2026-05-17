import uuid

from django.conf import settings
from django.db import models


class Comment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    content = models.TextField()
    rating = models.ForeignKey(
        "rating_app.Rating",
        on_delete=models.CASCADE,
        related_name="comments",
    )
    parent_comment = models.ForeignKey(
        "self",
        null=True,
        on_delete=models.CASCADE,
        related_name="comments",
    )
    is_anonymous = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="comments",
    )

    class Meta:
        indexes = [
            models.Index(
                fields=["rating", "created_at", "id"],
                name="comment_rating_created_idx",
            ),
            models.Index(
                fields=["parent_comment", "created_at", "id"],
                name="comment_parent_created_idx",
            ),
        ]

    def __str__(self):
        return f"Comment {self.id}"
