from rest_framework import serializers
from .course import CourseSerializer

class CourseListResponseSerializer(serializers.Serializer):
    """
    Schema for GET /api/v1/courses response envelope.
    """
    results = CourseSerializer(many=True)
    filters = serializers.DictField()
    page = serializers.IntegerField()
    pageSize = serializers.IntegerField()
    total = serializers.IntegerField()
