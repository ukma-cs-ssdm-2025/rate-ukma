from rating_app.models import Course
from rating_app.serializers import CourseSerializer
from rest_framework import generics
from drf_spectacular.utils import extend_schema_view, extend_schema


@extend_schema_view(
    list=extend_schema(
        summary="List all courses",
        description="Retrieve a list of all courses ordered by year (descending) and name",
        tags=["courses"],
        deprecated=False,
    )
)
class CourseListView(generics.ListAPIView):
    queryset = Course.objects.all().order_by("-year", "name")
    serializer_class = CourseSerializer
