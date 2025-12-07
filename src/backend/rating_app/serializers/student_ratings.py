from rest_framework import serializers


class InlineRatingSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    difficulty = serializers.IntegerField()
    usefulness = serializers.IntegerField()
    comment = serializers.CharField(allow_blank=True, required=False, allow_null=True)
    created_at = serializers.DateTimeField(read_only=True)
    is_anonymous = serializers.BooleanField()


class InlineCourseOfferingSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    course_id = serializers.CharField(read_only=True)
    year = serializers.IntegerField(read_only=True)
    season = serializers.CharField(read_only=True)
    can_rate = serializers.BooleanField(read_only=True)
    rated = InlineRatingSerializer(allow_null=True, read_only=True)


class StudentRatingsLightSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    offerings = InlineCourseOfferingSerializer(many=True, read_only=True)
