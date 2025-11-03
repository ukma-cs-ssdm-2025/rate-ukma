from dataclasses import asdict

from rest_framework import status, viewsets
from rest_framework.response import Response

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema

from ..constants import (
    MAX_RATING_VALUE,
    MIN_RATING_VALUE,
)
from ..filters.course_payload import CourseFilterPayload
from ..serializers.analytics import CourseAnalyticsSerializer
from ..services.course_service import CourseService
from ..views.filters_parsers.course import CourseFilterParser, CourseQueryParams
from ..views.responses import R_ANALYTICS


@extend_schema(tags=["analytics"])
class AnalyticsViewSet(viewsets.ViewSet):
    serializer_class = CourseAnalyticsSerializer

    # IoC args
    course_service: CourseService | None = None
    course_filter_parser: CourseFilterParser | None = None

    @extend_schema(
        summary="Get course analytics",
        description="Get course analytics with optional filters"
        "Returns courses analytics with aggregated ratings.",
        parameters=[
            OpenApiParameter(
                name="name",
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                description="Filter courses by name (case-insensitive partial match)",
                required=False,
            ),
            OpenApiParameter(
                name="typeKind",
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                description="Filter by course type (COMPULSORY, ELECTIVE, PROF_ORIENTED)",
                required=False,
            ),
            OpenApiParameter(
                name="instructor",
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.QUERY,
                description="Filter by instructor ID",
                required=False,
            ),
            OpenApiParameter(
                name="faculty",
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.QUERY,
                description="Filter by faculty ID",
                required=False,
            ),
            OpenApiParameter(
                name="department",
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.QUERY,
                description="Filter by department ID",
                required=False,
            ),
            OpenApiParameter(
                name="speciality",
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.QUERY,
                description="Filter by speciality ID",
                required=False,
            ),
            OpenApiParameter(
                name="semesterYear",
                type=OpenApiTypes.INT,
                location=OpenApiParameter.QUERY,
                description="Filter by semester year",
                required=False,
            ),
            OpenApiParameter(
                name="semesterTerm",
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                description="Filter by semester term (FALL, SPRING, SUMMER)",
                required=False,
            ),
            OpenApiParameter(
                name="avg_difficulty_order",
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                description="Sort by average difficulty (values: 'asc' or 'desc')",
                enum=["asc", "desc"],
                required=False,
            ),
            OpenApiParameter(
                name="avg_usefulness_order",
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                description="Sort by average usefulness (values: 'asc' or 'desc')",
                enum=["asc", "desc"],
                required=False,
            ),
            OpenApiParameter(
                name="avg_difficulty_min",
                type=OpenApiTypes.FLOAT,
                location=OpenApiParameter.QUERY,
                description=f"Minimum average difficulty ({MIN_RATING_VALUE}-{MAX_RATING_VALUE})",
                required=False,
            ),
            OpenApiParameter(
                name="avg_difficulty_max",
                type=OpenApiTypes.FLOAT,
                location=OpenApiParameter.QUERY,
                description=f"Maximum average difficulty ({MIN_RATING_VALUE}-{MAX_RATING_VALUE})",
                required=False,
            ),
            OpenApiParameter(
                name="avg_usefulness_min",
                type=OpenApiTypes.FLOAT,
                location=OpenApiParameter.QUERY,
                description=f"Minimum average usefulness ({MIN_RATING_VALUE}-{MAX_RATING_VALUE})",
                required=False,
            ),
            OpenApiParameter(
                name="avg_usefulness_max",
                type=OpenApiTypes.FLOAT,
                location=OpenApiParameter.QUERY,
                description=f"Maximum average usefulness ({MIN_RATING_VALUE}-{MAX_RATING_VALUE})",
                required=False,
            ),
        ],
        responses=R_ANALYTICS,
    )
    def list(self, request, *args, **kwargs):
        assert self.course_service is not None
        assert self.course_filter_parser is not None

        query_filters: CourseQueryParams = self.course_filter_parser.parse(request.query_params)
        payload: CourseFilterPayload = self.course_service.filter_courses(**asdict(query_filters))
        serialized = self.serializer_class(payload.items, many=True).data

        return Response(serialized, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Get course analytics",
        description="Get course analytics with optional filters"
        "Returns courses analytics with aggregated ratings.",
        parameters=[
            OpenApiParameter(
                name="course_id",
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.PATH,
                description="Course ID",
                required=True,
            ),
        ],
        responses=R_ANALYTICS,
    )
    def retrieve(self, request, *args, **kwargs):
        assert self.course_service is not None

        course_id = kwargs.get("course_id")
        course = self.course_service.get_course(course_id)
        serialized = self.serializer_class(course).data
        return Response(serialized, status=status.HTTP_200_OK)
