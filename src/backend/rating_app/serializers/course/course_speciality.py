"""Shared serializers used across multiple course serializers."""

from rest_framework import serializers

from rating_app.models import CourseSpeciality
from rating_app.models.choices import CourseTypeKind


class CourseSpecialityInlineSerializer(serializers.ModelSerializer):
    """Inline serializer for displaying course specialities with type kind."""

    speciality_id = serializers.UUIDField(source="speciality.id", read_only=True)
    speciality_title = serializers.CharField(source="speciality.name", read_only=True)

    class Meta:
        model = CourseSpeciality
        fields = ["speciality_id", "speciality_title", "type_kind"]


class SpecialityWithKindPayload(serializers.Serializer):
    """Payload serializer for creating/updating course speciality associations (write-only)."""

    speciality = serializers.UUIDField()
    type_kind = serializers.ChoiceField(choices=CourseTypeKind.choices)
