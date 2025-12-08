from rest_framework import status, viewsets
from rest_framework.response import Response

from drf_spectacular.utils import extend_schema

from rateukma.caching.decorators import rcached
from rating_app.models import Student
from rating_app.serializers import StudentRatingsDetailedSerializer, StudentRatingsLightSerializer
from rating_app.services import StudentService
from rating_app.views.decorators import require_student

from .responses import R_STUDENT_RATINGS, R_STUDENT_RATINGS_DETAILED


@extend_schema(tags=["student", "courses"])
class StudentStatisticsViewSet(viewsets.ViewSet):
    student_service: StudentService | None = None

    @extend_schema(
        summary="Student's statistics on course rating.",
        description="List all courses that "
        "student is/was enrolled in with information about the rating.",
        responses=R_STUDENT_RATINGS,
    )
    @require_student
    @rcached(ttl=3600)  # 1 hour - student grades/enrollments change infrequently
    def get_ratings(self, request, student: Student) -> Response:
        assert self.student_service is not None

        items = self.student_service.get_ratings(student_id=str(student.id))

        serializer = StudentRatingsLightSerializer(items, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary='Student\'s detailed statistics on course rating (for "My Grades" page).',
        description="List all courses that "
        "student is/was enrolled in with information about the rating.",
        responses=R_STUDENT_RATINGS_DETAILED,
    )
    @require_student
    @rcached(ttl=3600)  # 1 hour - student grades/enrollments change infrequently
    def get_detailed_ratings(self, request, student: Student) -> Response:
        assert self.student_service is not None

        items = self.student_service.get_ratings_detail(student_id=str(student.id))

        serializer = StudentRatingsDetailedSerializer(items, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
