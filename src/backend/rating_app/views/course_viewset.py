from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response

import structlog
from drf_spectacular.utils import extend_schema
from pydantic import ValidationError as ModelValidationError

from rating_app.application_schemas.course import CourseFilterCriteria, CourseSearchResult
from rating_app.exception.course_exceptions import (
    CourseNotFoundError,
    InvalidCourseIdentifierError,
)
from rating_app.serializers import FilterOptionsSerializer
from rating_app.serializers.course.course_detail import CourseDetailSerializer
from rating_app.serializers.course.course_list_resp import CourseListResponseSerializer
from rating_app.services.course_service import CourseService
from rating_app.views.api_spec.course import (
    COURSES_LIST_PAGINATED_QUERY_PARAMS,
    SINGLE_COURSE_QUERY_PARAMS,
)
from rating_app.views.responses import R_COURSE, R_COURSE_LIST, R_FILTER_OPTIONS

logger = structlog.get_logger(__name__)


@extend_schema(tags=["courses"])
class CourseViewSet(viewsets.ViewSet):
    lookup_url_kwarg = "course_id"
    serializer_class = CourseListResponseSerializer

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
            filters = CourseFilterCriteria.model_validate(request.query_params.dict())
        except ModelValidationError as e:
            logger.error("validation_error", errors=e.errors())
            raise ValidationError(detail=e.errors()) from e

        courses: CourseSearchResult = self.course_service.filter_courses(filters)
        payload = self.serializer_class(
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

        if course_id is None:
            raise ValidationError({"course_id": "Course id is required"})

        try:
            course = self.course_service.get_course(course_id)
        except InvalidCourseIdentifierError as exc:
            logger.warning("invalid_course_identifier", course_id=course_id, error=str(exc))
            raise ValidationError({"course_id": "Invalid course identifier"}) from exc
        except CourseNotFoundError as exc:
            logger.info("course_not_found", course_id=course_id)
            raise NotFound(detail=str(exc)) from exc

        serializer = CourseDetailSerializer(course)
        return Response(serializer.data, status=status.HTTP_200_OK)
