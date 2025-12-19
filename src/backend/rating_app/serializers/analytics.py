from rest_framework import serializers


class CourseAnalyticsSerializer(serializers.Serializer):
    """
    Serializer for course analytics based on Course DTO.
    """

    id = serializers.CharField(read_only=True)
    name = serializers.CharField(source="title", read_only=True, max_length=255)
    avg_usefulness = serializers.FloatField(read_only=True, default=0.0)
    avg_difficulty = serializers.FloatField(read_only=True, default=0.0)
    ratings_count = serializers.IntegerField(read_only=True, default=0)
    faculty_name = serializers.CharField(read_only=True, default=None)
