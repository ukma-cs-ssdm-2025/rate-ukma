from rest_framework import serializers

from rating_app.models import Course, CourseSpeciality, Department
from rating_app.models.choices import CourseTypeKind


class CourseSpecialityInlineSerializer(serializers.ModelSerializer):
    speciality_id = serializers.UUIDField(source="speciality.id", read_only=True)
    speciality_title = serializers.CharField(source="speciality.name", read_only=True)

    class Meta:
        model = CourseSpeciality
        fields = ["speciality_id", "speciality_title", "type_kind"]


class SpecialityWithKindPayload(serializers.Serializer):
    speciality = serializers.UUIDField()
    type_kind = serializers.ChoiceField(choices=CourseTypeKind.choices)


class CourseListSerializer(serializers.ModelSerializer):
    """
    Lighter serializer for listing courses.
    """

    department = serializers.PrimaryKeyRelatedField(queryset=Department.objects.all())
    department_name = serializers.CharField(source="department.name", read_only=True)
    faculty_name = serializers.CharField(source="department.faculty.name", read_only=True)
    avg_difficulty = serializers.FloatField(
        source="avg_difficulty_annot", read_only=True, allow_null=True
    )
    avg_usefulness = serializers.FloatField(
        source="avg_usefulness_annot", read_only=True, allow_null=True
    )
    ratings_count = serializers.IntegerField(source="ratings_count_annot", read_only=True)
    course_specialities = CourseSpecialityInlineSerializer(many=True, read_only=True)

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
            "course_specialities",
        ]
        read_only_fields = [
            "id",
            "department_name",
            "faculty_name",
            "avg_difficulty",
            "avg_usefulness",
            "ratings_count",
        ]
