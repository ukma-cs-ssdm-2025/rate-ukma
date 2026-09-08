from rest_framework import serializers

from rating_app.serializers.rating_read import RatingReadSerializer


class InlineRatingsItems(serializers.Serializer):
    ratings = RatingReadSerializer(many=True)
    user_ratings = RatingReadSerializer(many=True, allow_null=True, required=False)


class RatingListFiltersSerializer(serializers.Serializer):
    """Typed mirror of RatingService._format_applied_filters().

    Spec-only: the service already returns these keys at runtime (sparse —
    only non-null criteria, without page/page_size); this documents them.
    """

    course_id = serializers.UUIDField(required=False)
    separate_current_user = serializers.BooleanField(required=False)
    viewer_id = serializers.UUIDField(required=False)
    time_order = serializers.ChoiceField(choices=["asc", "desc"], required=False)
    popularity_order = serializers.BooleanField(required=False)


class RatingsWithUserListSerializer(serializers.Serializer):
    items = InlineRatingsItems()
    filters = RatingListFiltersSerializer()
    page = serializers.IntegerField()
    page_size = serializers.IntegerField()
    total = serializers.IntegerField()
    total_pages = serializers.IntegerField()
    next_page = serializers.IntegerField(allow_null=True, min_value=1)
    previous_page = serializers.IntegerField(allow_null=True, min_value=1)
