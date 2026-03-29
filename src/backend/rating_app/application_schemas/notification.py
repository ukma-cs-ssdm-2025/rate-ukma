import uuid
from dataclasses import dataclass
from datetime import datetime

from django.contrib.contenttypes.models import ContentType


@dataclass(frozen=True)
class NotificationCreateData:
    recipient_id: int
    event_type: str
    group_key: str
    content_type: ContentType
    object_id: str
    actor_id: int | None = None


@dataclass(frozen=True)
class NotificationGroup:
    group_key: str
    event_type: str
    latest_notification_id: uuid.UUID
    latest_actor_id: int | None
    latest_actor_name: str | None
    source_object_id: uuid.UUID
    count: int
    latest_created_at: datetime
    is_unread: bool
