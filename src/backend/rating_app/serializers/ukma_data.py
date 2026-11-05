from typing import get_args

from rest_framework import serializers

from rating_app.application_schemas.ukma_data import (
    Control,
    Level,
    OfferingStatus,
    ProgrammeKind,
    ReviewCaseKind,
    ReviewCaseStatus,
    Season,
)


class UkmaDataTermSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    code = serializers.CharField(read_only=True)
    academic_year = serializers.IntegerField(read_only=True)
    season = serializers.ChoiceField(choices=get_args(Season), read_only=True)
    change_no = serializers.IntegerField(read_only=True)


class UkmaDataFacultySerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    name = serializers.CharField(read_only=True)
    saz_filter_id = serializers.CharField(read_only=True, allow_null=True)
    change_no = serializers.IntegerField(read_only=True)
    removed_at = serializers.DateTimeField(read_only=True, allow_null=True)


class UkmaDataDepartmentSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    name = serializers.CharField(read_only=True)
    saz_filter_id = serializers.CharField(read_only=True, allow_null=True)
    faculty_id = serializers.CharField(read_only=True, allow_null=True)
    change_no = serializers.IntegerField(read_only=True)
    removed_at = serializers.DateTimeField(read_only=True, allow_null=True)


class UkmaDataProgrammeSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    name = serializers.CharField(read_only=True)
    level = serializers.ChoiceField(choices=get_args(Level), read_only=True, allow_null=True)
    saz_filter_id = serializers.CharField(read_only=True, allow_null=True)
    change_no = serializers.IntegerField(read_only=True)
    removed_at = serializers.DateTimeField(read_only=True, allow_null=True)


class UkmaDataOfferingTermSerializer(serializers.Serializer):
    term_id = serializers.CharField(read_only=True)
    semesters = serializers.ListField(child=serializers.IntegerField(), read_only=True)
    credits = serializers.FloatField(read_only=True)
    hours_per_week = serializers.IntegerField(read_only=True, allow_null=True)
    lecture_hours = serializers.IntegerField(read_only=True, allow_null=True)
    seminar_hours = serializers.IntegerField(read_only=True, allow_null=True)
    practice_hours = serializers.IntegerField(read_only=True, allow_null=True)
    control = serializers.ChoiceField(choices=get_args(Control), read_only=True, allow_null=True)


class UkmaDataOfferingProgrammeSerializer(serializers.Serializer):
    programme_id = serializers.CharField(read_only=True)
    kind = serializers.ChoiceField(choices=get_args(ProgrammeKind), read_only=True)


class UkmaDataOfferingSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    saz_code = serializers.CharField(read_only=True)
    academic_year = serializers.IntegerField(read_only=True)
    title = serializers.CharField(read_only=True)
    faculty_id = serializers.CharField(read_only=True, allow_null=True)
    department_id = serializers.CharField(read_only=True, allow_null=True)
    level = serializers.ChoiceField(choices=get_args(Level), read_only=True)
    format = serializers.CharField(read_only=True)
    credits = serializers.FloatField(read_only=True)
    hours = serializers.IntegerField(read_only=True)
    study_year = serializers.IntegerField(read_only=True)
    status = serializers.ChoiceField(choices=get_args(OfferingStatus), read_only=True)
    is_practical = serializers.BooleanField(read_only=True)
    annotation = serializers.CharField(read_only=True, allow_null=True)
    max_students = serializers.IntegerField(read_only=True, allow_null=True)
    max_groups = serializers.IntegerField(read_only=True, allow_null=True)
    computed_max_students = serializers.IntegerField(read_only=True, allow_null=True)
    group_size_min = serializers.IntegerField(read_only=True)
    group_size_max = serializers.IntegerField(read_only=True)
    enrolled_active = serializers.IntegerField(read_only=True, allow_null=True)
    terms = UkmaDataOfferingTermSerializer(many=True, read_only=True)
    programmes = UkmaDataOfferingProgrammeSerializer(many=True, read_only=True)
    change_no = serializers.IntegerField(read_only=True)
    removed_at = serializers.DateTimeField(read_only=True, allow_null=True)


class UkmaDataReviewCaseSerializer(serializers.Serializer):
    id = serializers.CharField(read_only=True)
    kind = serializers.ChoiceField(choices=get_args(ReviewCaseKind), read_only=True)
    subject_id = serializers.CharField(read_only=True)
    candidates = serializers.JSONField(read_only=True, help_text="Ids only")
    safe_answer = serializers.JSONField(read_only=True, help_text="What was published")
    status = serializers.ChoiceField(choices=get_args(ReviewCaseStatus), read_only=True)
    run_id = serializers.CharField(read_only=True, allow_null=True)
    decision_id = serializers.CharField(read_only=True, allow_null=True)
    opened_at = serializers.DateTimeField(read_only=True)
    change_no = serializers.IntegerField(read_only=True)


class UkmaDataPageSerializer(serializers.Serializer):
    cursor = serializers.IntegerField(
        read_only=True,
        help_text="Pass as `after` for the next page; the last item's change number",
    )
    has_more = serializers.BooleanField(read_only=True)
    data_updated_at = serializers.DateTimeField(
        read_only=True,
        allow_null=True,
        help_text="When UKMA Data last finished a successful read of its source",
    )


class UkmaDataTermPageSerializer(UkmaDataPageSerializer):
    items = UkmaDataTermSerializer(many=True, read_only=True)


class UkmaDataFacultyPageSerializer(UkmaDataPageSerializer):
    items = UkmaDataFacultySerializer(many=True, read_only=True)


class UkmaDataDepartmentPageSerializer(UkmaDataPageSerializer):
    items = UkmaDataDepartmentSerializer(many=True, read_only=True)


class UkmaDataProgrammePageSerializer(UkmaDataPageSerializer):
    items = UkmaDataProgrammeSerializer(many=True, read_only=True)


class UkmaDataOfferingPageSerializer(UkmaDataPageSerializer):
    items = UkmaDataOfferingSerializer(many=True, read_only=True)


class UkmaDataReviewCasePageSerializer(UkmaDataPageSerializer):
    items = UkmaDataReviewCaseSerializer(many=True, read_only=True)


class UkmaDataStatusSerializer(serializers.Serializer):
    key_id = serializers.CharField(read_only=True)
    scopes = serializers.ListField(child=serializers.CharField(), read_only=True)
    key_expires_at = serializers.DateTimeField(read_only=True)
    data_updated_at = serializers.DateTimeField(read_only=True, allow_null=True)
