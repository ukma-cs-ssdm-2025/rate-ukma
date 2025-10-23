from rest_framework import serializers

from rating_app.models import Rating


class RatingCreateUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating and updating Ratings.
    Student is automatically set from authenticated user.
    """

    course_offering = serializers.UUIDField(help_text="UUID of the course offering being rated")

    class Meta:
        model = Rating
        fields = [
            "course_offering",
            "difficulty",
            "usefulness",
            "comment",
            "is_anonymous",
        ]

    def create(self, validated_data):
        """Create a new rating. Student ID should be passed via save(student_id=...)."""
        course_offering_id = validated_data.pop("course_offering")
        return Rating.objects.create(course_offering_id=course_offering_id, **validated_data)

    def update(self, instance, validated_data):
        """Update a rating. Student and course_offering cannot be changed."""
        validated_data.pop("student", None)
        validated_data.pop("course_offering", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance
