from rest_framework import serializers

import structlog

from rating_app.models import Rating
from rating_app.models.choices import NotificationEventType

logger = structlog.get_logger(__name__)

NOTIFICATION_MESSAGE_TEMPLATES = {
    NotificationEventType.RATING_UPVOTED: {
        "singular": "Хтось вподобав ваш відгук",
        "plural": "{count} людей вподобали ваш відгук",
    },
    NotificationEventType.RATING_DOWNVOTED: {
        "singular": "Хтось не вподобав ваш відгук",
        "plural": "{count} людей не вподобали ваш відгук",
    },
}

PLURAL_THRESHOLD = 2


class NotificationGroupSerializer(serializers.Serializer):
    group_key = serializers.CharField(read_only=True)
    event_type = serializers.ChoiceField(choices=NotificationEventType.choices, read_only=True)
    latest_notification_id = serializers.UUIDField(read_only=True)
    source_object_id = serializers.UUIDField(read_only=True)
    count = serializers.IntegerField(read_only=True)
    latest_created_at = serializers.DateTimeField(read_only=True)
    is_unread = serializers.BooleanField(read_only=True)
    message = serializers.SerializerMethodField()
    rating_id = serializers.SerializerMethodField()
    course_id = serializers.SerializerMethodField()

    def get_message(self, obj) -> str:
        templates = NOTIFICATION_MESSAGE_TEMPLATES.get(obj.event_type)
        if templates is None:
            return str(obj.event_type)

        if obj.count < PLURAL_THRESHOLD:
            return templates["singular"]

        return templates["plural"].format(count=obj.count)

    def get_rating_id(self, obj) -> str | None:
        return _parse_rating_id(obj.group_key)

    def get_course_id(self, obj) -> str | None:
        rating_id = _parse_rating_id(obj.group_key)
        if rating_id is None:
            return None
        return self._get_course_id_cache().get(rating_id)

    def _get_course_id_cache(self) -> dict[str, str]:
        cache = self.context.get("_course_id_cache")
        if cache is not None:
            return cache

        # Build cache from the full list of objects being serialized
        parent = self.parent
        objects = parent.instance if parent and hasattr(parent, "instance") else []
        rating_ids = []
        for item in objects or []:
            rid = _parse_rating_id(item.group_key)
            if rid:
                rating_ids.append(rid)

        cache = {}
        if rating_ids:
            qs = Rating.objects.filter(pk__in=rating_ids).values_list(
                "pk", "course_offering__course_id"
            )
            cache = {str(pk): str(cid) for pk, cid in qs}

        # Store on context to avoid re-querying per item
        if isinstance(self.context, dict):
            self.context["_course_id_cache"] = cache
        return cache


def _parse_rating_id(group_key: str) -> str | None:
    parts = group_key.split(":", 1)
    if len(parts) == 2:  # noqa: PLR2004
        return parts[1]
    return None


class UnreadCountSerializer(serializers.Serializer):
    count = serializers.IntegerField(read_only=True)


class MarkGroupReadSerializer(serializers.Serializer):
    group_key = serializers.CharField(max_length=255)
