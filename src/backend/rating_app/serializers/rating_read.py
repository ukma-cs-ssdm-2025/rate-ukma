from rest_framework import serializers

from rating_app.models.choices import RatingVoteStrType, SemesterTerm


class RatingReadSerializer(serializers.Serializer):
    """Serializer for reading RatingDTO. Nulls identity fields for anonymous ratings."""

    _ANONYMOUS_HIDDEN_FIELDS = ("student_id", "student_name", "student_avatar_url")

    id = serializers.UUIDField(read_only=True)
    student_id = serializers.UUIDField(read_only=True, allow_null=True)
    student_name = serializers.CharField(read_only=True, allow_null=True)
    student_avatar_url = serializers.CharField(read_only=True, allow_null=True)
    course = serializers.UUIDField(read_only=True)
    course_offering = serializers.UUIDField(read_only=True)
    course_offering_term = serializers.ChoiceField(choices=SemesterTerm.choices, read_only=True)
    course_offering_year = serializers.IntegerField(read_only=True)
    difficulty = serializers.IntegerField(read_only=True)
    usefulness = serializers.IntegerField(read_only=True)
    comment = serializers.CharField(read_only=True, allow_null=True)
    instructor = serializers.CharField(read_only=True, allow_null=True)
    is_anonymous = serializers.BooleanField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    upvotes = serializers.IntegerField(read_only=True)
    downvotes = serializers.IntegerField(read_only=True)
    viewer_vote = serializers.ChoiceField(
        choices=RatingVoteStrType.choices, read_only=True, allow_null=True
    )

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if data.get("is_anonymous"):
            for field in self._ANONYMOUS_HIDDEN_FIELDS:
                data[field] = None
        return data
