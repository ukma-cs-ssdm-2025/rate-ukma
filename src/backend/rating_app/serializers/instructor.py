from rest_framework import serializers

from rating_app.models import Instructor


class InstructorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Instructor
        fields = [
            "id",
            "first_name",
            "patronymic",
            "last_name",
        ]
        read_only_fields = ["id"]


class CourseInstructorMentionsSerializer(serializers.Serializer):
    instructor = InstructorSerializer()
    ratings_count = serializers.IntegerField(
        help_text="Ratings on any offering of the course that name this instructor"
    )
    offering_ratings_count = serializers.IntegerField(
        help_text="Of those, ratings on the requested offering (0 without offering_id)"
    )


class CourseInstructorListSerializer(serializers.Serializer):
    """Schema for GET /api/v1/courses/{course_id}/instructors/."""

    items = CourseInstructorMentionsSerializer(many=True)
