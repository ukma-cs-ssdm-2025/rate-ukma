from rest_framework import serializers


class InlineRatingSerializer(serializers.Serializer):
    difficulty = serializers.IntegerField(read_only=True)
    usefulness = serializers.IntegerField(read_only=True)
    comment = serializers.CharField(allow_blank=True, read_only=True)
    created_at = serializers.DateTimeField(read_only=True)


class InlineSemesterSerializer(serializers.Serializer):
    year = serializers.IntegerField(read_only=True)
    season = serializers.CharField(read_only=True)


class StudentRatingsDetailedSerializer(serializers.Serializer):
    course_id = serializers.CharField(read_only=True)
    course_title = serializers.CharField(read_only=True)
    course_code = serializers.CharField(read_only=True, allow_null=True)
    course_offering_id = serializers.CharField(read_only=True)
    semester = InlineSemesterSerializer(read_only=True)
    rated = InlineRatingSerializer(allow_null=True, read_only=True)
