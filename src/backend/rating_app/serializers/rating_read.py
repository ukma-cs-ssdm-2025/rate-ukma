from rest_framework import serializers

from rating_app.models.choices import RatingVoteStrType


class RatingReadSerializer(serializers.Serializer):
    """
    Serializer for reading RatingDTO.
    Privacy protection (nulling student_id/student_name for anonymous) is handled internally.
    """

    id = serializers.UUIDField(read_only=True)
    student_id = serializers.UUIDField(read_only=True, allow_null=True)
    student_name = serializers.CharField(read_only=True, allow_null=True)
    course_offering = serializers.UUIDField(read_only=True)
    course = serializers.UUIDField(read_only=True)
    difficulty = serializers.IntegerField(read_only=True)
    usefulness = serializers.IntegerField(read_only=True)
    comment = serializers.CharField(read_only=True, allow_null=True)
    is_anonymous = serializers.BooleanField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    upvotes = serializers.IntegerField(read_only=True)
    downvotes = serializers.IntegerField(read_only=True)
    viewer_vote = serializers.ChoiceField(
        choices=RatingVoteStrType.choices, read_only=True, allow_null=True
    )
