from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response

import structlog
from drf_spectacular.utils import extend_schema

from rating_app.dto.course import CourseQueryParams
from rating_app.filters.course_filters import (
    COURSES_LIST_PAGINATED_QUERY_PARAMS,
    SINGLE_COURSE_QUERY_PARAMS,
)
from rating_app.filters.course_payload import CourseFilteredPayload
from rating_app.models import Course
from rating_app.serializers import FilterOptionsSerializer
from rating_app.serializers.course.course_detail import CourseDetailSerializer
from rating_app.serializers.course.course_list import CourseListSerializer
from rating_app.services.course_service import CourseService
from rating_app.views.responses import R_COURSE, R_COURSE_LIST, R_FILTER_OPTIONS

logger = structlog.get_logger(__name__)


@extend_schema(tags=["courses"])
class CourseViewSet(viewsets.ViewSet):
    lookup_url_kwarg = "course_id"
    serializer_class = CourseListSerializer

    # IoC args
    course_service: CourseService | None = None

    @extend_schema(
        summary="List courses",
        description="List courses with optional filters and pagination. "
        "Returns courses with aggregated ratings.",
        parameters=COURSES_LIST_PAGINATED_QUERY_PARAMS,
        responses=R_COURSE_LIST,
    )
    def list(self, request, *args, **kwargs):
        assert self.course_service is not None

        try:
            filters = CourseQueryParams(**request.query_params.dict())
        except ValidationError as e:
            logger.error("validation_error", errors=e.detail)
            return Response({"detail": "Validation error"}, status=status.HTTP_400_BAD_REQUEST)

        payload: CourseFilteredPayload = self.course_service.filter_courses(filters)
        next_page = payload.page + 1 if payload.page < payload.total_pages else None
        previous_page = payload.page - 1 if payload.page > 1 else None
        serializer = self.serializer_class(payload.items, many=True)

        response_data = {
            "items": serializer.data,
            "filters": payload.filters,
            "page": payload.page,
            "page_size": payload.page_size,
            "total": payload.total,
            "total_pages": payload.total_pages,
            "next_page": next_page,
            "previous_page": previous_page,
        }
        return Response(response_data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Get filter options for course listing",
        description="Retrieve available filter values.",
        responses=R_FILTER_OPTIONS,
    )
    @action(detail=False, methods=["get"], url_path="filter-options")
    def filter_options(self, request):
        assert self.course_service is not None

        filter_options = self.course_service.get_filter_options()

        serializer = FilterOptionsSerializer(filter_options)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Retrieve a course",
        description="Retrieve a single course by its ID with detailed information.",
        parameters=SINGLE_COURSE_QUERY_PARAMS,
        responses=R_COURSE,
    )
    def retrieve(self, request, course_id=None, *args, **kwargs):
        assert self.course_service is not None

        try:
            course = self.course_service.get_course(course_id)
            serializer = CourseDetailSerializer(course)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except (Course.DoesNotExist, ValueError) as e:  # type: ignore - temporary fix for type error
            logger.error(f"Error retrieving course: {e}")
            raise NotFound(detail="Course not found") from None
