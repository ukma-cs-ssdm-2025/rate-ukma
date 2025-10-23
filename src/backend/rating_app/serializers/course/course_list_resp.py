from rest_framework import serializers

from rating_app.serializers.course.course_list import CourseListSerializer


class CourseListResponseSerializer(serializers.Serializer):
    """
    Schema for GET /api/v1/courses response envelope.
    """

    items = CourseListSerializer(many=True)
    filters = serializers.DictField()
    page = serializers.IntegerField()
    page_size = serializers.IntegerField()
    total = serializers.IntegerField()
