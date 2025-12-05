from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

import structlog
from drf_spectacular.utils import OpenApiParameter, extend_schema
from pydantic import ValidationError as ModelValidationError

from rateukma.caching.decorators import rcached
from rating_app.application_schemas.course import (
    CourseFilterCriteria,
    CourseReadParams,
    CourseSearchResult,
)
from rating_app.ioc_container.common import pydantic_to_openapi_request_mapper
from rating_app.serializers import FilterOptionsSerializer
from rating_app.serializers.course.course_detail import CourseDetailSerializer
from rating_app.serializers.course.course_list_resp import CourseListResponseSerializer
from rating_app.services import CourseService
from rating_app.views.responses import R_COURSE, R_COURSE_LIST, R_FILTER_OPTIONS

logger = structlog.get_logger(__name__)
to_openapi = pydantic_to_openapi_request_mapper().map


@extend_schema(tags=["courses"])
class CourseViewSet(viewsets.ViewSet):
    lookup_url_kwarg = "course_id"

    # IoC args
    course_service: CourseService | None = None

    @extend_schema(
        summary="List courses",
        description="List courses with optional filters and pagination. "
        "Returns courses with aggregated ratings.",
        parameters=to_openapi((CourseFilterCriteria, OpenApiParameter.QUERY)),
        responses=R_COURSE_LIST,
    )
    @rcached(ttl=300)
    def list(self, request, *args, **kwargs) -> Response:
        assert self.course_service is not None

        try:
            filters = CourseFilterCriteria.model_validate(request.query_params.dict())
        except ModelValidationError as e:
            raise ValidationError(detail=e.errors()) from e

        courses: CourseSearchResult = self.course_service.filter_courses(filters)
        payload = CourseListResponseSerializer(
            {
                "items": courses.items,
                "filters": courses.applied_filters,
                **courses.pagination.model_dump(),
            },
        )

        return Response(payload.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Get filter options for course listing",
        description="Retrieve available filter values.",
        responses=R_FILTER_OPTIONS,
    )
    @action(detail=False, methods=["get"], url_path="filter-options")
    @rcached(ttl=300)
    def filter_options(self, request) -> Response:
        assert self.course_service is not None

        filter_options = self.course_service.get_filter_options()

        serializer = FilterOptionsSerializer(filter_options)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Retrieve a course",
        description="Retrieve a single course by its ID with detailed information.",
        parameters=to_openapi((CourseReadParams, OpenApiParameter.PATH)),
        responses=R_COURSE,
    )
    @rcached(ttl=300)
    def retrieve(self, request, course_id=None, *args, **kwargs) -> Response:
        assert self.course_service is not None

        try:
            params = CourseReadParams.model_validate({"course_id": course_id})
        except ModelValidationError as e:
            logger.error("validation_error", errors=e.errors())
            raise ValidationError(detail=e.errors()) from e

        course = self.course_service.get_course(str(params.course_id))

        serializer = CourseDetailSerializer(course)
        return Response(serializer.data, status=status.HTTP_200_OK)
