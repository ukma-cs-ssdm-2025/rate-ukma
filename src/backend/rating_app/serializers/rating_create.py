from rest_framework import serializers

from rating_app.models import Rating


class RatingCreateUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for documenting rating creation/update API endpoints in OpenAPI spec.
    This serializer is currently used only for API documentation (drf-spectacular).
    Actual validation is done via Pydantic models.
    """

    course_offering = serializers.UUIDField(help_text="UUID of the course offering being rated")

    class Meta:
        model = Rating
        fields = [
            "course_offering",
            "difficulty",
            "usefulness",
            "comment",
            "is_anonymous",
        ]
