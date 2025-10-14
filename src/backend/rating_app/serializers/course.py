from rest_framework import serializers

from rating_app.models import Course


class CourseSerializer(serializers.ModelSerializer):
    """
    Read serializer for Course.
    - Relateds exposed as UUIDs (no DB lookup)
    - Computed fields included as read-only
    """

    faculty = serializers.UUIDField(source="faculty_id")
    department = serializers.UUIDField(source="department_id")
    specialities = serializers.ListField(child=serializers.UUIDField(), allow_empty=True)

    avg_difficulty = serializers.FloatField(read_only=True)
    avg_usefulness = serializers.FloatField(read_only=True)
    ratings_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Course
        fields = [
            "id",
            "code",
            "title",
            "description",
            "status",
            "type_kind",
            "faculty",
            "department",
            "specialities",
            "avg_difficulty",
            "avg_usefulness",
            "ratings_count",
        ]
        read_only_fields = fields
