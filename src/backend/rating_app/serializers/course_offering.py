from rest_framework import serializers

from rating_app.models.choices import AcademicDegree, AcademicTitle, ExamType, PracticeType


class InstructorDTOSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    first_name = serializers.CharField(read_only=True)
    patronymic = serializers.CharField(read_only=True, allow_null=True)
    last_name = serializers.CharField(read_only=True)
    academic_degree = serializers.ChoiceField(
        choices=AcademicDegree.choices, read_only=True, allow_blank=True
    )
    academic_title = serializers.ChoiceField(
        choices=AcademicTitle.choices, read_only=True, allow_blank=True
    )


class CourseOfferingSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    course_id = serializers.UUIDField(read_only=True)
    course_title = serializers.CharField(read_only=True, allow_null=True)
    semester_id = serializers.UUIDField(read_only=True)
    semester_year = serializers.IntegerField(read_only=True, allow_null=True)
    semester_term = serializers.CharField(read_only=True, allow_null=True)
    code = serializers.CharField(read_only=True)
    exam_type = serializers.ChoiceField(choices=ExamType.choices, read_only=True)
    practice_type = serializers.ChoiceField(
        choices=PracticeType.choices, read_only=True, allow_null=True
    )
    credits = serializers.DecimalField(max_digits=4, decimal_places=1, read_only=True)
    weekly_hours = serializers.IntegerField(read_only=True)
    lecture_count = serializers.IntegerField(read_only=True, allow_null=True)
    practice_count = serializers.IntegerField(read_only=True, allow_null=True)
    max_students = serializers.IntegerField(read_only=True, allow_null=True)
    max_groups = serializers.IntegerField(read_only=True, allow_null=True)
    group_size_min = serializers.IntegerField(read_only=True, allow_null=True)
    group_size_max = serializers.IntegerField(read_only=True, allow_null=True)
    instructors = InstructorDTOSerializer(many=True, read_only=True)


class CourseOfferingListResponseSerializer(serializers.Serializer):
    course_offerings = CourseOfferingSerializer(many=True)
