import uuid
from datetime import UTC, datetime

from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models

from .choices import NotificationEventType

NOTIFICATION_CURSOR_EPOCH = datetime(2020, 1, 1, tzinfo=UTC)


class Notification(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient_id: int
    actor_id: int | None
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    event_type = models.CharField(
        max_length=50,
        choices=NotificationEventType.choices,
    )
    group_key = models.CharField(max_length=255)

    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.UUIDField()
    source = GenericForeignKey("content_type", "object_id")

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Notification"
        verbose_name_plural = "Notifications"
        indexes = [
            models.Index(
                fields=["recipient", "-created_at"],
                name="notif_recipient_created_idx",
            ),
            models.Index(
                fields=["recipient", "group_key", "-created_at"],
                name="notif_recipient_group_idx",
            ),
        ]

    def __str__(self):
        return f"Notification({self.event_type}) for user={self.recipient_id}"

    def __repr__(self):
        return (
            f"<Notification id={self.id} type={self.event_type} "
            f"recipient={self.recipient_id} group={self.group_key}>"
        )


class NotificationCursor(models.Model):
    user_id: int
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notification_cursor",
    )
    last_read_at = models.DateTimeField(default=NOTIFICATION_CURSOR_EPOCH)

    class Meta:
        verbose_name = "Notification Cursor"
        verbose_name_plural = "Notification Cursors"

    def __str__(self):
        return f"NotificationCursor(user={self.user_id}, last_read_at={self.last_read_at})"


class NotificationGroupRead(models.Model):
    user_id: int
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notification_group_reads",
    )
    group_key = models.CharField(max_length=255)
    read_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Notification Group Read"
        verbose_name_plural = "Notification Group Reads"
        constraints = [
            models.UniqueConstraint(
                fields=["user", "group_key"],
                name="unique_user_group_read",
            ),
        ]

    def __str__(self):
        return f"NotificationGroupRead(user={self.user_id}, group_key={self.group_key})"
