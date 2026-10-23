from rest_framework import status, viewsets
from rest_framework.response import Response

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema

from rating_app.models import Student
from rating_app.serializers import StudentRatingsDetailedSerializer, StudentRatingsLightSerializer
from rating_app.serializers.rating_suggestions import (
    RatingSuggestionQuerySerializer,
    RatingSuggestionSerializer,
)
from rating_app.services import StudentService
from rating_app.views.decorators import require_student

from .responses import R_STUDENT_RATINGS, R_STUDENT_RATINGS_DETAILED, common_errors


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
    def get_detailed_ratings(self, request, student: Student) -> Response:
        assert self.student_service is not None

        items = self.student_service.get_ratings_detail(student_id=str(student.id))

        serializer = StudentRatingsDetailedSerializer(items, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Up to three attended courses to rate next.",
        description="Unrated offerings with an open rating window, newest semester first, "
        "then fewest ratings. One offering per course.",
        parameters=[OpenApiParameter("exclude_course", OpenApiTypes.UUID)],
        responses={200: RatingSuggestionSerializer(many=True), **common_errors()},
    )
    @require_student
    def get_rating_suggestions(self, request, student: Student) -> Response:
        assert self.student_service is not None
        query = RatingSuggestionQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        params = query.validated_data
        assert isinstance(params, dict)
        excluded = params.get("exclude_course")
        items = self.student_service.get_rating_suggestions(
            student_id=str(student.id), exclude_course=str(excluded) if excluded else None
        )
        return Response(RatingSuggestionSerializer(items, many=True).data)
