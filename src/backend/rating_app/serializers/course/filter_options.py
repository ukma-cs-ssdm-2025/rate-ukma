from rest_framework import serializers


class FilterOptionSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()


class InstructorOptionSerializer(FilterOptionSerializer):
    department = serializers.CharField(allow_null=True, required=False)


class SemesterTermOptionSerializer(serializers.Serializer):
    value = serializers.CharField()
    label = serializers.CharField()


class DepartmentOptionSerializer(FilterOptionSerializer):
    pass


class SpecialityOptionSerializer(FilterOptionSerializer):
    pass


class FacultyOptionSerializer(FilterOptionSerializer):
    custom_abbreviation = serializers.CharField(allow_null=True, required=False)
    departments = DepartmentOptionSerializer(many=True)
    specialities = SpecialityOptionSerializer(many=True)


class SemesterYearOptionSerializer(serializers.Serializer):
    value = serializers.CharField()
    label = serializers.CharField()


class CourseTypeOptionSerializer(serializers.Serializer):
    value = serializers.CharField()
    label = serializers.CharField()


class FilterOptionsSerializer(serializers.Serializer):
    instructors = InstructorOptionSerializer(many=True)
    faculties = FacultyOptionSerializer(many=True)
    semester_terms = SemesterTermOptionSerializer(many=True)
    semester_years = SemesterYearOptionSerializer(many=True)
    course_types = CourseTypeOptionSerializer(many=True)
