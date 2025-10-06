from rating_app.models import Course
from rating_app.serializers import CourseSerializer
from rest_framework import generics
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema


class CourseListView(generics.ListAPIView):
    """
    API v1 endpoint that allows courses to be viewed.
    """
    serializer_class = CourseSerializer
    versioning_class = None  # Use global versioning

    @extend_schema(
        summary="List all courses (v1)",
        description="API v1: Retrieve a list of all courses ordered by year (descending) and name",
        tags=["courses"],
        deprecated=False,
        operation_id="courses_v1_list"
    )

    def get(self, request, *args, **kwargs):
        courses = Course.objects.all().order_by("-year", "name")  # type: ignore
        serializer = CourseSerializer(courses, many=True)
        return Response(serializer.data)
