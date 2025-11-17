from rest_framework import serializers


class FilterOptionSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()


class InstructorOptionSerializer(FilterOptionSerializer):
    department = serializers.CharField(allow_null=True, required=False)


class FacultyOptionSerializer(FilterOptionSerializer):
    pass


class DepartmentOptionSerializer(FilterOptionSerializer):
    faculty_id = serializers.UUIDField()
    faculty_name = serializers.CharField(allow_null=True, required=False)


class SemesterTermOptionSerializer(serializers.Serializer):
    value = serializers.CharField()
    label = serializers.CharField()  # type: ignore[assignment]


class SemesterYearOptionSerializer(serializers.Serializer):
    value = serializers.CharField()
    label = serializers.CharField()  # type: ignore[assignment]


class CourseTypeOptionSerializer(serializers.Serializer):
    value = serializers.CharField()
    label = serializers.CharField()  # type: ignore[assignment]


class SpecialityOptionSerializer(FilterOptionSerializer):
    faculty_id = serializers.UUIDField()
    faculty_name = serializers.CharField(allow_null=True, required=False)


class FilterOptionsSerializer(serializers.Serializer):
    instructors = InstructorOptionSerializer(many=True)
    faculties = FacultyOptionSerializer(many=True)
    departments = DepartmentOptionSerializer(many=True)
    semester_terms = SemesterTermOptionSerializer(many=True)
    semester_years = SemesterYearOptionSerializer(many=True)
    course_types = CourseTypeOptionSerializer(many=True)
    specialities = SpecialityOptionSerializer(many=True)
