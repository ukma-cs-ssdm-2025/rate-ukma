from rest_framework import serializers

from rating_app.models.choices import CourseStatus
from rating_app.serializers.course.course_speciality import CourseSpecialityInlineSerializer


class CourseListSerializer(serializers.Serializer):
    """
    Serializer for course list responses based on CourseDTO.
    """

    id = serializers.CharField(read_only=True)
    title = serializers.CharField(max_length=255, read_only=True)
    description = serializers.CharField(allow_null=True, allow_blank=True, read_only=True)
    status = serializers.ChoiceField(choices=CourseStatus.choices, read_only=True)
    department = serializers.UUIDField(read_only=True)
    department_name = serializers.CharField(read_only=True)
    faculty = serializers.UUIDField(read_only=True)
    faculty_name = serializers.CharField(read_only=True)
    faculty_custom_abbreviation = serializers.CharField(
        read_only=True, allow_null=True, default=None, max_length=255
    )
    avg_difficulty = serializers.FloatField(read_only=True, allow_null=True, required=False)
    avg_usefulness = serializers.FloatField(read_only=True, allow_null=True, required=False)
    ratings_count = serializers.IntegerField(read_only=True, required=False, default=0)
    specialities = CourseSpecialityInlineSerializer(many=True, read_only=True)
