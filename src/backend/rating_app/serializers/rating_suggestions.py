from rest_framework import serializers

from .student_ratings_detailed import InlineSemesterSerializer


class RatingSuggestionQuerySerializer(serializers.Serializer):
    exclude_course = serializers.UUIDField(required=False)


class RatingSuggestionSerializer(serializers.Serializer):
    course_id = serializers.UUIDField(read_only=True)
    course_offering_id = serializers.UUIDField(read_only=True)
    course_title = serializers.CharField(read_only=True)
    semester = InlineSemesterSerializer(read_only=True)
    ratings_count = serializers.IntegerField(read_only=True)
