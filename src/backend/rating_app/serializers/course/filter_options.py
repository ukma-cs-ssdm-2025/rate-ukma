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


class SemesterOptionSerializer(serializers.Serializer):
    id = serializers.CharField()
    year = serializers.IntegerField()
    term = serializers.CharField()
    label = serializers.CharField()


class CourseTypeOptionSerializer(serializers.Serializer):
    value = serializers.CharField()
    label = serializers.CharField()


class FilterOptionsSerializer(serializers.Serializer):
    instructors = InstructorOptionSerializer(many=True)
    faculties = FacultyOptionSerializer(many=True)
    departments = DepartmentOptionSerializer(many=True)
    semesters = SemesterOptionSerializer(many=True)
    course_types = CourseTypeOptionSerializer(many=True)
