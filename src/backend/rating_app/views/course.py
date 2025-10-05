from rating_app.models import Course
from rating_app.serializers import CourseSerializer
from rest_framework import generics
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema


class CourseListView(generics.ListAPIView):
    """
    API endpoint that allows courses to be viewed.
    """
    serializer_class = CourseSerializer

    @extend_schema(
        summary="List all courses",
        description="Retrieve a list of all courses ordered by year (descending) and name",
        tags=["courses"]
    )

    def get(self, request):
        courses = Course.objects.all().order_by("-year", "name")  # type: ignore
        serializer = CourseSerializer(courses, many=True)
        return Response(serializer.data)
