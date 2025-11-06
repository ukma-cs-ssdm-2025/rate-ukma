from dataclasses import asdict

from rest_framework import status, viewsets
from rest_framework.request import Request
from rest_framework.response import Response

from drf_spectacular.utils import extend_schema

from rating_app.filters.course_filters import (
    COURSES_LIST_QUERY_PARAMS,
    SINGLE_COURSE_QUERY_PARAMS,
)
from rating_app.filters.course_payload import CourseFilterPayload
from rating_app.filters.filters_parsers.course import CourseFilterParser, CourseQueryParams
from rating_app.serializers.analytics import CourseAnalyticsSerializer
from rating_app.services.course_service import CourseService
from rating_app.views.responses import R_ANALYTICS


@extend_schema(tags=["analytics"])
class AnalyticsViewSet(viewsets.ViewSet):
    serializer_class = CourseAnalyticsSerializer
    lookup_url_kwarg = "course_id"

    # IoC args
    course_service: CourseService | None = None
    course_filter_parser: CourseFilterParser | None = None

    @extend_schema(
        summary="Get course analytics",
        description="Get course analytics with optional filters"
        "Returns courses analytics with aggregated ratings.",
        parameters=COURSES_LIST_QUERY_PARAMS,
        responses=R_ANALYTICS,
    )
    def list(self, request: Request, *args, **kwargs):
        assert self.course_service is not None
        assert self.course_filter_parser is not None

        query_filters: CourseQueryParams = self.course_filter_parser.parse(
            request.query_params, paginate=False
        )
        payload: CourseFilterPayload = self.course_service.filter_courses(**asdict(query_filters))
        serialized = self.serializer_class(payload.items, many=True).data

        return Response(serialized, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Get course analytics",
        description="Get course analytics with optional filters"
        "Returns courses analytics with aggregated ratings.",
        parameters=SINGLE_COURSE_QUERY_PARAMS,
        responses=R_ANALYTICS,
    )
    def retrieve(self, request: Request, *args, **kwargs):
        assert self.course_service is not None

        course_id = kwargs.get(self.lookup_url_kwarg)
        course = self.course_service.get_course(course_id)
        serialized = self.serializer_class(course).data
        return Response(serialized, status=status.HTTP_200_OK)
