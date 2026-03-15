from rest_framework import serializers

from rating_app.models.choices import NotificationEventType

NOTIFICATION_MESSAGE_TEMPLATES = {
    NotificationEventType.RATING_UPVOTED: {
        "singular": "{actor} upvoted your rating",
        "plural": "{actor} and {others_count} others upvoted your rating",
    },
    NotificationEventType.RATING_DOWNVOTED: {
        "singular": "{actor} downvoted your rating",
        "plural": "{actor} and {others_count} others downvoted your rating",
    },
}

FALLBACK_ACTOR_NAME = "Someone"
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

    def get_message(self, obj) -> str:
        templates = NOTIFICATION_MESSAGE_TEMPLATES.get(obj.event_type)
        if templates is None:
            return str(obj.event_type)

        actor = obj.latest_actor_name or FALLBACK_ACTOR_NAME

        if obj.count < PLURAL_THRESHOLD:
            return templates["singular"].format(actor=actor)

        return templates["plural"].format(actor=actor, others_count=obj.count - 1)


class UnreadCountSerializer(serializers.Serializer):
    count = serializers.IntegerField(read_only=True)
