from rest_framework import serializers

from rating_app.models.choices import CourseTypeKind, EducationLevel, SemesterTerm
from rating_app.serializers.course.course_list import CourseListSerializer


class CourseListFiltersSerializer(serializers.Serializer):
    """Typed mirror of the `applied_filters` dict returned for course search.

    Spec-only: CourseService already returns every key below at runtime
    (full Criteria.model_dump()); this just documents them for the schema.
    """

    name = serializers.CharField(allow_null=True)
    type_kind = serializers.ChoiceField(choices=CourseTypeKind.choices, allow_null=True)
    instructor = serializers.UUIDField(allow_null=True)
    faculty = serializers.UUIDField(allow_null=True)
    department = serializers.UUIDField(allow_null=True)
    speciality = serializers.UUIDField(allow_null=True)
    education_level = serializers.ChoiceField(choices=EducationLevel.choices, allow_null=True)
    semester_year = serializers.CharField(allow_null=True)
    semester_terms = serializers.ListField(
        child=serializers.ChoiceField(choices=SemesterTerm.choices), allow_null=True
    )
    # Decimal at runtime; FloatField preserves the JSON number encoding
    # (DecimalField would coerce to string and change response bytes).
    credits_max = serializers.FloatField(allow_null=True)
    credits_min = serializers.FloatField(allow_null=True)
    avg_difficulty_min = serializers.FloatField(allow_null=True)
    avg_difficulty_max = serializers.FloatField(allow_null=True)
    avg_usefulness_min = serializers.FloatField(allow_null=True)
    avg_usefulness_max = serializers.FloatField(allow_null=True)
    ratings_count_min = serializers.IntegerField(allow_null=True)
    avg_difficulty_order = serializers.ChoiceField(choices=["asc", "desc"], allow_null=True)
    avg_usefulness_order = serializers.ChoiceField(choices=["asc", "desc"], allow_null=True)
    last_review_order = serializers.ChoiceField(choices=["asc", "desc"], allow_null=True)
    page = serializers.IntegerField(allow_null=True)
    page_size = serializers.IntegerField(allow_null=True)


class CourseListResponseSerializer(serializers.Serializer):
    """
    Schema for GET /api/v1/courses response envelope.
    """

    items = CourseListSerializer(many=True)
    filters = CourseListFiltersSerializer()
    page = serializers.IntegerField()
    page_size = serializers.IntegerField()
    total = serializers.IntegerField()
    total_pages = serializers.IntegerField()
    next_page = serializers.IntegerField(allow_null=True, min_value=1)
    previous_page = serializers.IntegerField(allow_null=True, min_value=1)
