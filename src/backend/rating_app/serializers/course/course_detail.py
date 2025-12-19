from rest_framework import serializers

from rating_app.models.choices import CourseStatus

from .course_speciality import CourseSpecialityInlineSerializer


class CourseDetailSerializer(serializers.Serializer):
    """
    Read-only serializer for course details based on Course DTO.
    """

    id = serializers.CharField(read_only=True)
    title = serializers.CharField(read_only=True, max_length=255)
    description = serializers.CharField(read_only=True, allow_null=True, allow_blank=True)
    status = serializers.ChoiceField(choices=CourseStatus.choices, read_only=True)
    department = serializers.UUIDField(read_only=True)
    department_name = serializers.CharField(read_only=True)
    faculty = serializers.UUIDField(read_only=True)
    faculty_name = serializers.CharField(read_only=True)
    faculty_custom_abbreviation = serializers.CharField(
        read_only=True, allow_null=True, default=None, max_length=255
    )
    course_specialities = CourseSpecialityInlineSerializer(many=True, read_only=True)
    avg_difficulty = serializers.FloatField(read_only=True, allow_null=True, required=False)
    avg_usefulness = serializers.FloatField(read_only=True, allow_null=True, required=False)
    ratings_count = serializers.IntegerField(read_only=True, required=False, default=0)
