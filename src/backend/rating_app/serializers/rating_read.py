from rest_framework import serializers

from drf_spectacular.utils import extend_schema_field

from rating_app.models import Rating
from rating_app.models.choices import RatingVoteType


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
    upvotes = serializers.IntegerField(read_only=True)
    downvotes = serializers.IntegerField(read_only=True)
    viewer_vote = serializers.ChoiceField(
        choices=RatingVoteType.choices, allow_null=True, read_only=True
    )

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
            "upvotes",
            "downvotes",
            "viewer_vote",
        ]
        read_only_fields = fields

    @extend_schema_field(serializers.UUIDField(allow_null=True))
    def get_student_id(self, obj):
        if isinstance(obj, str | bytes):
            return obj

        if getattr(obj, "is_anonymous", False):
            return None

        # Try to get from student_id attribute (Model FK or Pydantic field)
        return getattr(obj, "student_id", None)

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_student_name(self, obj):
        if getattr(obj, "is_anonymous", False):
            return None

        # Try to get from pre-calculated attribute (Pydantic RatingRead)
        if hasattr(obj, "student_name"):
            return obj.student_name

        # Try to calculate from student relation (Rating Model)
        student = getattr(obj, "student", None)
        if student:
            return f"{student.last_name} {student.first_name}"

        return None
