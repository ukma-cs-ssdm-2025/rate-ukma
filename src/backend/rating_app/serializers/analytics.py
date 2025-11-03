from rest_framework import serializers

import structlog

from ..models import Course

logger = structlog.get_logger()


class CourseAnalyticsSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    name = serializers.CharField(source="title", read_only=True)
    avg_usefulness = serializers.FloatField(read_only=True)
    avg_difficulty = serializers.FloatField(read_only=True)
    ratings_count = serializers.SerializerMethodField(read_only=True)
    faculty_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Course
        fields = (
            "id",
            "avg_usefulness",
            "avg_difficulty",
            "ratings_count",
            "name",
            "faculty_name",
        )

    def get_ratings_count(self, obj: Course) -> int:
        return obj.ratings_count if obj.ratings_count is not None else 0

    def get_faculty_name(self, obj: Course) -> str | None:
        department = obj.department
        if not department:
            return None

        faculty = department.faculty  # type: ignore - temporary fix for type error
        return str(faculty.name) if faculty else None
