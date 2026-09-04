from typing import Any, cast

from rest_framework import serializers

from drf_spectacular.utils import PolymorphicProxySerializer, extend_schema_field

from rating_app.application_schemas.feed import FeedPromoItem, FeedReviewItem
from rating_app.models.choices import FeedPostAccent, SemesterTerm

REVIEW_KIND = "review"
PROMO_KIND = "promo"


class FeedReviewItemSerializer(serializers.Serializer):
    kind = serializers.SerializerMethodField()
    id = serializers.UUIDField(read_only=True)
    occurred_at = serializers.DateTimeField(read_only=True)
    course_id = serializers.UUIDField(read_only=True)
    course_title = serializers.CharField(read_only=True)
    difficulty = serializers.IntegerField(read_only=True)
    usefulness = serializers.IntegerField(read_only=True)
    comment = serializers.CharField(read_only=True)
    semester_year = serializers.IntegerField(read_only=True)
    semester_term = serializers.ChoiceField(choices=SemesterTerm.choices, read_only=True)
    course_avg_difficulty = serializers.FloatField(read_only=True)
    course_avg_usefulness = serializers.FloatField(read_only=True)

    @extend_schema_field({"type": "string", "enum": [REVIEW_KIND]})
    def get_kind(self, _obj) -> str:
        return REVIEW_KIND


class FeedPromoItemSerializer(serializers.Serializer):
    kind = serializers.SerializerMethodField()
    id = serializers.UUIDField(read_only=True)
    occurred_at = serializers.DateTimeField(read_only=True)
    pinned = serializers.BooleanField(read_only=True)
    title = serializers.CharField(read_only=True)
    body = serializers.CharField(read_only=True)
    accent = serializers.ChoiceField(choices=FeedPostAccent.choices, read_only=True)
    label = serializers.CharField(read_only=True, allow_blank=True)
    cta_label = serializers.CharField(read_only=True, allow_blank=True)
    cta_href = serializers.CharField(read_only=True, allow_blank=True)
    image_url = serializers.CharField(read_only=True, allow_null=True)

    @extend_schema_field({"type": "string", "enum": [PROMO_KIND]})
    def get_kind(self, _obj) -> str:
        return PROMO_KIND


FeedItemSerializer = PolymorphicProxySerializer(
    component_name="FeedItem",
    resource_type_field_name="kind",
    serializers={
        REVIEW_KIND: FeedReviewItemSerializer,
        PROMO_KIND: FeedPromoItemSerializer,
    },
    many=True,
)


class FeedPageSerializer(serializers.Serializer):
    items = serializers.SerializerMethodField()
    next_cursor = serializers.CharField(read_only=True, allow_null=True)

    @extend_schema_field(FeedItemSerializer)
    def get_items(self, page) -> list:
        # PolymorphicProxySerializer documents the union but cannot serialize;
        # dispatch on the DTO type instead.
        return [self._serialize(item) for item in page.items]

    def _serialize(self, item: FeedReviewItem | FeedPromoItem) -> dict[str, Any]:
        serializer = (
            FeedPromoItemSerializer if isinstance(item, FeedPromoItem) else FeedReviewItemSerializer
        )
        return cast(dict[str, Any], serializer(item).data)
