from rest_framework import serializers


class InlineRatingSerializer(serializers.Serializer):
    difficulty = serializers.IntegerField()
    usefulness = serializers.IntegerField()
    comment = serializers.CharField(allow_blank=True)
    created_at = serializers.DateTimeField(read_only=True)


class InlineCourseOfferingSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    year = serializers.IntegerField(read_only=True)
    season = serializers.CharField(read_only=True)
    rated = InlineRatingSerializer(allow_null=True, read_only=True)


class StudentRatingsLightSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    offerings = InlineCourseOfferingSerializer(many=True, read_only=True)
