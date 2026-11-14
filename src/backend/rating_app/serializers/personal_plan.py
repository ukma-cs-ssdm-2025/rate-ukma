from rest_framework import serializers

from rating_app.models.choices import CourseTypeKind, PlanYearStatus, SemesterTerm


class PlanCourseSerializer(serializers.Serializer):
    course_id = serializers.UUIDField(read_only=True)
    title = serializers.CharField(read_only=True)
    type_kind = serializers.ChoiceField(choices=CourseTypeKind.choices, read_only=True)
    faculty_name = serializers.CharField(read_only=True)
    credits = serializers.DecimalField(max_digits=3, decimal_places=1, read_only=True)
    weekly_hours = serializers.IntegerField(read_only=True)
    is_mandatory = serializers.BooleanField(read_only=True)


class PlanSemesterSerializer(serializers.Serializer):
    semester_term = serializers.ChoiceField(choices=SemesterTerm.choices, read_only=True)
    is_graduation_summer = serializers.BooleanField(read_only=True)
    main = PlanCourseSerializer(many=True, read_only=True)
    backup = PlanCourseSerializer(many=True, read_only=True)


class PlanYearSerializer(serializers.Serializer):
    study_year = serializers.IntegerField(read_only=True)
    academic_year_start = serializers.IntegerField(read_only=True)
    year_status = serializers.ChoiceField(
        choices=PlanYearStatus.choices,
        read_only=True,
        help_text="done: past, read-only. current: follows САЗ. planned: the student's picks.",
    )
    semesters = PlanSemesterSerializer(many=True, read_only=True)


class PersonalPlanSerializer(serializers.Serializer):
    enrollment_year_start = serializers.IntegerField(read_only=True)
    current_year_start = serializers.IntegerField(read_only=True)
    plan_years = PlanYearSerializer(many=True, read_only=True)
