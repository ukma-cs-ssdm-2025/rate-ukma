from rest_framework import serializers

from drf_spectacular.utils import extend_schema_field

from rating_app.models import CourseOffering


class CourseOfferingSerializer(serializers.ModelSerializer):
    semester_year = serializers.SerializerMethodField(read_only=True)
    course_title = serializers.SerializerMethodField(read_only=True)
    semester_term = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = CourseOffering
        fields = [
            "id",
            "course_id",
            "course_title",
            "semester_id",
            "semester_year",
            "semester_term",
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

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_course_title(self, obj):
        return obj.course.title

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_semester_term(self, obj):
        return obj.semester.label


class CourseOfferingListResponseSerializer(serializers.Serializer):
    course_offerings = CourseOfferingSerializer(many=True)
