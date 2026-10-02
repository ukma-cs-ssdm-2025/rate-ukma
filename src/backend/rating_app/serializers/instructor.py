from rest_framework import serializers

from rating_app.models import Instructor


class InstructorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Instructor
        fields = [
            "id",
            "first_name",
            "patronymic",
            "last_name",
        ]
        read_only_fields = ["id"]


class InstructorSuggestionSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    first_name = serializers.CharField()
    patronymic = serializers.CharField(allow_blank=True)
    last_name = serializers.CharField()
    courses_count = serializers.IntegerField(
        help_text="Distinct courses whose ratings mention this instructor"
    )


class InstructorSuggestionListSerializer(serializers.Serializer):
    """Schema for GET /api/v1/instructors/suggestions/."""

    items = InstructorSuggestionSerializer(many=True)
