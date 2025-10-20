from rest_framework import serializers

from drf_spectacular.utils import extend_schema_field

from rating_app.models import Rating


class RatingReadSerializer(serializers.ModelSerializer):
    """
    Serializer for reading Rating with privacy protection.
    Returns null for student_id and student_name when is_anonymous is True.
    """

    student_id = serializers.SerializerMethodField(read_only=True, required=False)
    student_name = serializers.SerializerMethodField(read_only=True, required=False)
    comment = serializers.CharField(required=False, allow_null=True, read_only=True)
    course = serializers.UUIDField(source="course_offering.course_id", read_only=True)
    course_offering = serializers.UUIDField(source="course_offering_id", read_only=True)

    class Meta:
        model = Rating
        fields = [
            "id",
            "student_id",
            "student_name",
            "course_offering",
            "course",
            "difficulty",
            "usefulness",
            "comment",
            "is_anonymous",
            "created_at",
        ]
        read_only_fields = fields

    @extend_schema_field(serializers.UUIDField(allow_null=True))
    def get_student_id(self, obj):
        """Return student ID only if not anonymous."""
        if obj.is_anonymous:
            return None
        return obj.student_id

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_student_name(self, obj):
        """Return student name only if not anonymous."""
        if obj.is_anonymous:
            return None
        parts = [obj.student.last_name, obj.student.first_name]
        if obj.student.patronymic:
            parts.append(obj.student.patronymic)
        return " ".join(parts)
