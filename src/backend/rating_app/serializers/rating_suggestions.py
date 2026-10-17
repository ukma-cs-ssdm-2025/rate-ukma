from rest_framework import serializers


class RatingSuggestionQuerySerializer(serializers.Serializer):
    exclude_course = serializers.UUIDField(required=False)


class RatingSuggestionSemesterSerializer(serializers.Serializer):
    year = serializers.IntegerField()
    season = serializers.CharField()


class RatingSuggestionSerializer(serializers.Serializer):
    course_id = serializers.UUIDField()
    course_offering_id = serializers.UUIDField()
    course_title = serializers.CharField()
    semester = RatingSuggestionSemesterSerializer()
    ratings_count = serializers.IntegerField()
