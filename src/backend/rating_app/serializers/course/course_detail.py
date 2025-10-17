from django.db import transaction
from rest_framework import serializers

from drf_spectacular.utils import extend_schema_field

from rating_app.models import Course, CourseSpeciality, Department, Rating
from rating_app.models.choices import CourseTypeKind


class RatingInlineSerializer(serializers.ModelSerializer):
    """Inline serializer for displaying ratings within course detail."""

    student_id = serializers.SerializerMethodField()
    student_name = serializers.SerializerMethodField()
    course_offering_code = serializers.CharField(source="course_offering.code", read_only=True)
    semester = serializers.CharField(source="course_offering.semester.__str__", read_only=True)

    class Meta:
        model = Rating
        fields = [
            "id",
            "student_id",
            "student_name",
            "course_offering_code",
            "semester",
            "difficulty",
            "usefulness",
            "comment",
            "is_anonymous",
            "created_at",
        ]
        read_only_fields = fields

    @extend_schema_field(serializers.UUIDField(allow_null=True))
    def get_student_id(self, obj):
        """Return student ID if not anonymous, otherwise return None."""
        if obj.is_anonymous:
            return None
        return obj.student.id

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_student_name(self, obj):
        """Return student name if not anonymous, otherwise return None."""
        if obj.is_anonymous:
            return None
        # Student inherits from Person, so we access fields directly
        return obj.student.full_name if hasattr(obj.student, "full_name") else str(obj.student)


class CourseSpecialityInlineSerializer(serializers.ModelSerializer):
    speciality_id = serializers.UUIDField(source="speciality.id", read_only=True)
    speciality_title = serializers.CharField(source="speciality.title", read_only=True)

    class Meta:
        model = CourseSpeciality
        fields = ["speciality_id", "speciality_title", "type_kind"]


class SpecialityWithKindPayload(serializers.Serializer):
    speciality = serializers.UUIDField()
    type_kind = serializers.ChoiceField(choices=CourseTypeKind.choices)


class CourseDetailSerializer(serializers.ModelSerializer):
    avg_difficulty = serializers.FloatField(read_only=True, allow_null=True)
    avg_usefulness = serializers.FloatField(read_only=True, allow_null=True)
    ratings_count = serializers.IntegerField(read_only=True)

    course_specialities = CourseSpecialityInlineSerializer(many=True, read_only=True)
    ratings = serializers.SerializerMethodField()
    department = serializers.PrimaryKeyRelatedField(queryset=Department.objects.all())
    department_name = serializers.CharField(source="department.name", read_only=True)
    faculty_name = serializers.CharField(source="department.faculty.name", read_only=True)
    specialities_with_kind = SpecialityWithKindPayload(many=True, write_only=True, required=False)

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
            "course_specialities",
            "ratings",
            "avg_difficulty",
            "avg_usefulness",
            "ratings_count",
            # write
            "specialities_with_kind",
        ]
        read_only_fields = [
            "id",
            "department_name",
            "faculty_name",
            "avg_difficulty",
            "avg_usefulness",
            "ratings_count",
            "ratings",
        ]

    @extend_schema_field(RatingInlineSerializer(many=True))
    def get_ratings(self, obj):
        """Get all ratings for this course across all course offerings."""
        # Collect ratings from all offerings
        all_ratings = []
        for offering in obj.offerings.all():
            all_ratings.extend(offering.ratings.all())

        # Sort by most recent first
        all_ratings.sort(key=lambda r: r.created_at, reverse=True)

        return RatingInlineSerializer(all_ratings, many=True).data

    def validate_specialities_with_kind(self, items: list[dict] | None):
        """
        Ensure no duplicate specialities are provided in the payload.
        """
        if items is None:
            return items
        seen: set[str] = set()
        dups: set[str] = set()
        for raw in items:
            sid = str(raw.get("speciality"))
            if sid in seen:
                dups.add(sid)
            seen.add(sid)
        if dups:
            raise serializers.ValidationError(
                {"specialities_with_kind": [f"duplicate speciality ids: {', '.join(sorted(dups))}"]}
            )
        return items

    def _upsert_course_specialities(self, course: Course, items: list[dict]):
        if items is None:
            return

        from rating_app.models import Speciality

        rows: list[CourseSpeciality] = []
        for raw in items:
            speciality_id = raw["speciality"]
            type_kind = raw["type_kind"]

            try:
                spec = Speciality.objects.get(pk=speciality_id)
            except Speciality.DoesNotExist:
                raise serializers.ValidationError(
                    {"specialities_with_kind": [f"speciality not found: {speciality_id}"]}
                ) from None

            rows.append(CourseSpeciality(course=course, speciality=spec, type_kind=type_kind))

        with transaction.atomic():
            CourseSpeciality.objects.filter(course=course).delete()
            CourseSpeciality.objects.bulk_create(rows)

    def create(self, validated_data):
        items = validated_data.pop("specialities_with_kind", None)
        course = Course.objects.create(**validated_data)
        self._upsert_course_specialities(course, items)
        return course

    def update(self, instance: Course, validated_data):
        items = validated_data.pop("specialities_with_kind", serializers.empty)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if items is not serializers.empty:
            self._upsert_course_specialities(instance, items)

        return instance
