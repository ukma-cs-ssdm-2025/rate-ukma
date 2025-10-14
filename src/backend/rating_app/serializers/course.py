from rest_framework import serializers

from rating_app.models import Course


class CourseSerializer(serializers.ModelSerializer):
    """
    Read serializer for Course.
    - Relateds exposed as UUIDs (no DB lookup)
    - Computed fields included as read-only
    """
    faculty = serializers.UUIDField(source="department.faculty_id", read_only=True)
    department = serializers.UUIDField(source="department_id", read_only=True)
    specialities = serializers.PrimaryKeyRelatedField(many=True, read_only=True)

    avg_difficulty = serializers.FloatField(read_only=True)
    avg_usefulness = serializers.FloatField(read_only=True)
    ratings_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Course
        fields = [
            "id", "title", "description", "status",
            "faculty", "department", "specialities",
            "avg_difficulty", "avg_usefulness", "ratings_count",
        ]
        read_only_fields = fields
