from rest_framework import serializers

import structlog

from rating_app.application_schemas.course import Course as CourseDTO

from ..models import Course

logger = structlog.get_logger()


# TODO: CourseDTO is now used instead of CourseModel
# Serializer is updated, but it should be verified and explained


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

    def get_ratings_count(self, obj: CourseDTO) -> int:
        return obj.ratings_count or 0

    def get_faculty_name(self, obj: CourseDTO) -> str | None:
        return obj.faculty_name
