from rest_framework import serializers

from drf_spectacular.utils import extend_schema_field

from rating_app.models import CourseOffering


class CourseOfferingSerializer(serializers.ModelSerializer):
    semester_year = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = CourseOffering
        fields = [
            "id",
            "course_id",
            "semester_id",
            "semester_year",
            "code",
            "exam_type",
            "practice_type",
            "credits",
            "weekly_hours",
            "lecture_count",
            "practice_count",
            "max_students",
            "max_groups",
            "group_size_min",
            "group_size_max",
        ]
        read_only_fields = fields

    @extend_schema_field(serializers.IntegerField(allow_null=True))
    def get_semester_year(self, obj):
        return obj.semester.year


class CourseOfferingListResponseSerializer(serializers.Serializer):
    course_offerings = CourseOfferingSerializer(many=True)
