from rest_framework import serializers

from rating_app.models import Rating


class RatingSerializer(serializers.ModelSerializer):
    """
    Serializer for Rating using raw UUIDs for relations to avoid DB lookups.
    """

    student = serializers.UUIDField(source="student_id", read_only=True)
    course_offering = serializers.UUIDField(source="course_offering_id", read_only=True)

    class Meta:
        model = Rating
        fields = [
            "id",
            "student",
            "course_offering",
            "difficulty",
            "usefulness",
            "comment",
            "is_anonymous",
            "created_at",
        ]
        read_only_fields = ["id", "created_at", "student", "course_offering"]

    def validate_difficulty(self, v):
        if not 1 <= int(v) <= 5:
            raise serializers.ValidationError("Difficulty must be between 1 and 5.")
        return v

    def validate_usefulness(self, v):
        if not 1 <= int(v) <= 5:
            raise serializers.ValidationError("Usefulness must be between 1 and 5.")
        return v
