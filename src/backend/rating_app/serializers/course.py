from rating_app.models import Course
from rest_framework import serializers


class CourseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Course
        fields = ["id", "name", "faculty", "year", "ukma_id"]
        read_only_fields = ["id"]
