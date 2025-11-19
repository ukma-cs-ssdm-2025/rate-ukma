from rest_framework import status, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

import structlog
from drf_spectacular.utils import OpenApiParameter, extend_schema
from pydantic import ValidationError as ModelValidationError

from rating_app.application_schemas.course_offering import (
    CourseOfferingCourseFilterParams,
    CourseOfferingRetrieveParams,
)
from rating_app.ioc_container.common import pydantic_to_openapi_request_mapper
from rating_app.serializers.course_offering import (
    CourseOfferingListResponseSerializer,
    CourseOfferingSerializer,
)
from rating_app.services import CourseOfferingService
from rating_app.views.responses import R_COURSE_OFFERING, R_COURSE_OFFERING_LIST

logger = structlog.get_logger(__name__)
to_openapi = pydantic_to_openapi_request_mapper().map


@extend_schema(tags=["course-offerings"])
class CourseOfferingViewSet(viewsets.ViewSet):
    lookup_url_kwarg = "course_offering_id"

    # IoC args
    course_offering_service: CourseOfferingService | None = None

    @extend_schema(
        summary="List offerings for a course",
        description="List all offerings  for a specific course.",
        parameters=[
            *to_openapi((CourseOfferingCourseFilterParams, OpenApiParameter.PATH)),
        ],
        responses=R_COURSE_OFFERING_LIST,
    )
    def list(self, request, course_id=None):
        assert self.course_offering_service is not None

        try:
            params = CourseOfferingCourseFilterParams.model_validate({"course_id": course_id})
        except ModelValidationError as e:
            logger.error("validation_error", errors=e.errors())
            raise ValidationError(detail=e.errors()) from e

        course_offerings = self.course_offering_service.get_course_offerings_by_course(
            str(params.course_id)
        )

        payload = CourseOfferingListResponseSerializer(
            {
                "course_offerings": course_offerings,
            },
        )

        return Response(payload.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Get course offering details",
        description="Retrieve a specific course offering by ID.",
        parameters=[*to_openapi((CourseOfferingRetrieveParams, OpenApiParameter.PATH))],
        responses=R_COURSE_OFFERING,
    )
    def retrieve(self, request, course_offering_id: str | None = None, *args, **kwargs):
        assert self.course_offering_service is not None

        try:
            params = CourseOfferingRetrieveParams.model_validate(
                {"course_offering_id": course_offering_id}
            )
        except ModelValidationError as e:
            raise ValidationError(detail=e.errors()) from e

        course_offering = self.course_offering_service.get_course_offering(
            str(params.course_offering_id)
        )

        serializer = CourseOfferingSerializer(course_offering)
        return Response(serializer.data, status=status.HTTP_200_OK)
