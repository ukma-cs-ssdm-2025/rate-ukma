from rating_app.models import Course
from rating_app.serializers import CourseSerializer
from rest_framework.response import Response
from rest_framework.views import APIView


class CourseListView(APIView):
    # * boilerplate demo view

    def get(self, request):
        # TODO: fix warnings at Model.objects() methods type recognition
        courses = Course.objects.all().order_by("-year", "name")  # type: ignore
        serializer = CourseSerializer(courses, many=True)
        return Response(serializer.data)
