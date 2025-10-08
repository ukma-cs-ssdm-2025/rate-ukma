from rest_framework import serializers
from rating_app.models import Rating

class RatingSerializer(serializers.ModelSerializer):
    """
    Serializer for Rating using raw UUIDs for relations to avoid DB lookups.
    """
    student = serializers.UUIDField(help_text="Student ID (UUID)")
    course = serializers.UUIDField(help_text="Course ID (UUID)")

    class Meta:
        model = Rating
        fields = [
            "id", "student", "course",
            "difficulty", "usefulness", "comment",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def validate_difficulty(self, v):
        if not 1 <= int(v) <= 5:
            raise serializers.ValidationError("Difficulty must be between 1 and 5.")
        return v

    def validate_usefulness(self, v):
        if not 1 <= int(v) <= 5:
            raise serializers.ValidationError("Usefulness must be between 1 and 5.")
        return v
