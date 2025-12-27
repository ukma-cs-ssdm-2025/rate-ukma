from rest_framework import serializers

from rating_app.models.choices import CourseTypeKind


class CourseSpecialityInlineSerializer(serializers.Serializer):
    """Inline serializer for course speciality"""

    speciality_id = serializers.UUIDField(read_only=True)
    speciality_title = serializers.CharField(max_length=255, read_only=True)
    speciality_alias = serializers.CharField(
        max_length=255, allow_blank=True, required=False, read_only=True
    )
    faculty_name = serializers.CharField(max_length=255, read_only=True)
    faculty_id = serializers.UUIDField(read_only=True)
    type_kind = serializers.ChoiceField(choices=CourseTypeKind.choices, read_only=True)
