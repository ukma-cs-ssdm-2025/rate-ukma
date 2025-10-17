from rest_framework import serializers

from rating_app.models import Course, Department


class CourseListSerializer(serializers.ModelSerializer):
    """
    Lighter serializer for listing courses.
    """

    department = serializers.PrimaryKeyRelatedField(queryset=Department.objects.all())
    department_name = serializers.CharField(source="department.name", read_only=True)
    faculty_name = serializers.CharField(source="department.faculty.name", read_only=True)
    avg_difficulty = serializers.FloatField(read_only=True, allow_null=True)
    avg_usefulness = serializers.FloatField(read_only=True, allow_null=True)
    ratings_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Course
        fields = [
            "id",
            "title",
            "description",
            "status",
            "department",
            "department_name",
            "faculty_name",
            # read
            "avg_difficulty",
            "avg_usefulness",
            "ratings_count",
        ]
        read_only_fields = [
            "id",
            "department_name",
            "faculty_name",
            "avg_difficulty",
            "avg_usefulness",
            "ratings_count",
        ]
