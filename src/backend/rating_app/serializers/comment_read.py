from rest_framework import serializers


class CommentAuthorSerializer(serializers.Serializer):
    user_id = serializers.IntegerField(read_only=True, allow_null=True)
    user_name = serializers.CharField(read_only=True, allow_null=True)
    user_avatar_url = serializers.CharField(read_only=True, allow_null=True)
    is_anonymous = serializers.BooleanField(read_only=True)


class CommentReadSerializer(serializers.Serializer):
    """Serializer for reading CommentDto. Nulls identity fields for anonymous comment."""

    _ANONYMOUS_HIDDEN_FIELDS = ("user_id", "user_name", "user_avatar_url")

    id = serializers.UUIDField(read_only=True)
    parent_id = serializers.UUIDField(read_only=True, allow_null=True)
    rating_id = serializers.UUIDField(read_only=True)
    content = serializers.CharField(read_only=True)
    user_id = serializers.IntegerField(read_only=True, allow_null=True)
    user_name = serializers.CharField(read_only=True, allow_null=True)
    user_avatar_url = serializers.CharField(read_only=True, allow_null=True)
    is_anonymous = serializers.BooleanField(read_only=True)
    can_manage = serializers.BooleanField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    replies_count = serializers.IntegerField(read_only=True)
    reply_authors = CommentAuthorSerializer(many=True, read_only=True)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if data.get("is_anonymous"):
            for field in self._ANONYMOUS_HIDDEN_FIELDS:
                data[field] = None
        return data
