from rest_framework import serializers

from rating_app.serializers.instructor import InstructorSerializer


class InstructorListResponseSerializer(serializers.Serializer):
    """Schema for GET /api/v1/instructors/ response envelope."""

    items = InstructorSerializer(many=True)
    page = serializers.IntegerField()
    page_size = serializers.IntegerField()
    total = serializers.IntegerField()
    total_pages = serializers.IntegerField()
    next_page = serializers.IntegerField(allow_null=True, min_value=1)
    previous_page = serializers.IntegerField(allow_null=True, min_value=1)
