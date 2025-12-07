from rest_framework import status, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.request import Request
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
from rating_app.serializers.analytics import CourseAnalyticsSerializer
from rating_app.services import CourseService
from rating_app.views.responses import R_ANALYTICS

logger = structlog.get_logger(__name__)
to_openapi = pydantic_to_openapi_request_mapper().map


@extend_schema(tags=["analytics"])
class AnalyticsViewSet(viewsets.ViewSet):
    serializer_class = CourseAnalyticsSerializer
    lookup_url_kwarg = "course_id"

    # IoC args
    course_service: CourseService | None = None

    @extend_schema(
        summary="Get courses analytics",
        description="Get courses analytics with optional filters.\n"
        "Returns courses analytics with aggregated ratings.",
        parameters=to_openapi((CourseFilterCriteria, OpenApiParameter.QUERY)),
        responses=R_ANALYTICS,
    )
    @rcached(ttl=300)
    def list(self, request: Request, *args, **kwargs) -> Response:
        assert self.course_service is not None

        try:
            filters = CourseFilterCriteria.model_validate(request.query_params.dict())
        except ModelValidationError as e:
            raise ValidationError(detail=e.errors()) from e

        payload: CourseSearchResult = self.course_service.filter_courses(filters, paginate=False)
        serialized = self.serializer_class(payload.items, many=True).data

        return Response(serialized, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Get course analytics",
        description="Get course analytics with optional filters"
        "Returns course's analytics with aggregated ratings.",
        parameters=to_openapi((CourseReadParams, OpenApiParameter.PATH)),
        responses=R_ANALYTICS,
    )
    @rcached(ttl=300)
    def retrieve(self, request, course_id=None, *args, **kwargs) -> Response:
        assert self.course_service is not None

        try:
            params = CourseReadParams.model_validate({"course_id": course_id})
        except ModelValidationError as e:
            raise ValidationError(detail=e.errors()) from e

        course = self.course_service.get_course(str(params.course_id))

        serialized = self.serializer_class(course).data
        return Response(serialized, status=status.HTTP_200_OK)
