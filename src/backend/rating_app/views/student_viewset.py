from rest_framework import status, viewsets
from rest_framework.response import Response

from drf_spectacular.utils import extend_schema

from rating_app.ioc_container.services import student_service
from rating_app.models import Student
from rating_app.serializers import StudentRatingsDetailedSerializer, StudentRatingsLightSerializer

from .responses import R_STUDENT_RATINGS, R_STUDENT_RATINGS_DETAILED


@extend_schema(tags=["student", "courses"])
class StudentStatisticsViewSet(viewsets.ViewSet):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.student_service = student_service()

    def _get_student_or_403(self, request):
        """Get student for current user or return 403 response."""

        student = Student.objects.filter(user_id=request.user.id).first()

        if not student:
            error = Response(
                {"detail": "Only students can perform this action."},
                status=status.HTTP_403_FORBIDDEN,
            )
            return None, error
        return student, None

    @extend_schema(
        summary="Student's statistics on course rating.",
        description="List all courses that "
        "student is/was enrolled in with information about the rating.",
        responses=R_STUDENT_RATINGS,
    )
    def get_ratings(self, request):
        student, error_response = self._get_student_or_403(request)
        if error_response is not None:
            return error_response
        assert student is not None

        items = self.student_service.get_ratings(student_id=str(student.id))

        serializer = StudentRatingsLightSerializer(items, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary='Student\'s detailed statistics on course rating (for "My Grades" page).',
        description="List all courses that "
        "student is/was enrolled in with information about the rating.",
        responses=R_STUDENT_RATINGS_DETAILED,
    )
    def get_detailed_ratings(self, request):
        student, error_response = self._get_student_or_403(request)
        if error_response is not None:
            return error_response
        assert student is not None

        items = self.student_service.get_ratings_detail(student_id=str(student.id))

        serializer = StudentRatingsDetailedSerializer(items, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
