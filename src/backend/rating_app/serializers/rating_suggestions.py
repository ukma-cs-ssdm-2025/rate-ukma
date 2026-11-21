from rest_framework import serializers

from rating_app.models.choices import SemesterTerm


class RatingSuggestionQuerySerializer(serializers.Serializer):
    exclude_course = serializers.UUIDField(required=False)


class RatingSuggestionSemesterSerializer(serializers.Serializer):
    year = serializers.IntegerField()
    season = serializers.ChoiceField(choices=SemesterTerm.choices)


class RatingSuggestionSerializer(serializers.Serializer):
    course_id = serializers.UUIDField()
    course_offering_id = serializers.UUIDField()
    course_title = serializers.CharField()
    semester = RatingSuggestionSemesterSerializer()
    ratings_count = serializers.IntegerField()
