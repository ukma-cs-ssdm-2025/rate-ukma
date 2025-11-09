from rest_framework import status, viewsets
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
from rating_app.serializers.analytics import CourseAnalyticsSerializer
from rating_app.services.course_service import CourseService
from rating_app.views.api_spec.course import (
    COURSES_LIST_QUERY_PARAMS,
    SINGLE_COURSE_QUERY_PARAMS,
)
from rating_app.views.responses import R_ANALYTICS

logger = structlog.get_logger(__name__)


@extend_schema(tags=["analytics"])
class AnalyticsViewSet(viewsets.ViewSet):
    serializer_class = CourseAnalyticsSerializer
    lookup_url_kwarg = "course_id"

    # IoC args
    course_service: CourseService | None = None

    @extend_schema(
        summary="Get course analytics",
        description="Get course analytics with optional filters"
        "Returns courses analytics with aggregated ratings.",
        parameters=COURSES_LIST_QUERY_PARAMS,
        responses=R_ANALYTICS,
    )
    def list(self, request, *args, **kwargs):
        assert self.course_service is not None

        try:
            filters = CourseFilterCriteria.model_validate(request.query_params.dict())
        except ModelValidationError as e:
            logger.error("validation_error", errors=e.errors())
            raise ValidationError(detail=e.errors()) from e

        payload: CourseSearchResult = self.course_service.filter_courses(filters, paginate=False)
        serialized = self.serializer_class(payload.items, many=True).data

        return Response(serialized, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Get course analytics",
        description="Get course analytics with optional filters"
        "Returns courses analytics with aggregated ratings.",
        parameters=SINGLE_COURSE_QUERY_PARAMS,
        responses=R_ANALYTICS,
    )
    def retrieve(self, request, course_id=None, *args, **kwargs):
        assert self.course_service is not None

        if course_id is None:
            raise ValidationError({"course_id": "Course id is required"})

        try:
            course = self.course_service.get_course(course_id)

        except InvalidCourseIdentifierError as exc:
            logger.error("invalid_course_identifier", course_id=course_id, error=str(exc))
            raise ValidationError({"course_id": "Invalid course identifier"}) from exc

        except CourseNotFoundError as exc:
            logger.error("course_not_found", course_id=course_id)
            raise NotFound(detail=str(exc)) from exc

        serialized = self.serializer_class(course).data
        return Response(serialized, status=status.HTTP_200_OK)
