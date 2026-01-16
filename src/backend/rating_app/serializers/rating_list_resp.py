from rest_framework import serializers

from rating_app.serializers.rating_read import RatingReadSerializer


class InlineRatingsItems(serializers.Serializer):
    ratings = RatingReadSerializer(many=True)
    user_ratings = RatingReadSerializer(many=True, allow_null=True, required=False)


class RatingsWithUserListSerializer(serializers.Serializer):
    items = InlineRatingsItems()
    filters = serializers.DictField()
    page = serializers.IntegerField()
    page_size = serializers.IntegerField()
    total = serializers.IntegerField()
    total_pages = serializers.IntegerField()
    next_page = serializers.IntegerField(allow_null=True, min_value=1)
    previous_page = serializers.IntegerField(allow_null=True, min_value=1)
