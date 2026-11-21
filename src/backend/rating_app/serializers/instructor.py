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
    students_count = serializers.IntegerField(
        help_text="Distinct students behind ratings_count; one may rate several offerings"
    )
    recent_students_count = serializers.IntegerField(
        help_text=(
            "Of those, students who rated an offering of the current or previous academic year"
        )
    )
    planned = serializers.BooleanField(
        help_text=(
            "UKMA Data plans this teacher for the offering (offering_id, else the course's "
            "latest). Always false while fe_course_instructors is off for the user"
        )
    )


class CourseInstructorListSerializer(serializers.Serializer):
    """Schema for GET /api/v1/courses/{course_id}/instructors/."""

    items = CourseInstructorMentionsSerializer(many=True)
