from rest_framework import status, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from drf_spectacular.utils import OpenApiParameter, extend_schema

from rating_app.application_schemas.instructor import (
    CourseInstructorsPathParams,
    CourseInstructorsQueryParams,
    InstructorListParams,
    InstructorReadParams,
)
from rating_app.ioc_container.common import pydantic_to_openapi_request_mapper
from rating_app.serializers import (
    CourseInstructorListSerializer,
    InstructorListResponseSerializer,
    InstructorSerializer,
)
from rating_app.services import InstructorService
from rating_app.views.rating_viewset import ModelValidationError

from .responses import R_COURSE_INSTRUCTORS, R_INSTRUCTOR, R_INSTRUCTOR_LIST

to_openapi = pydantic_to_openapi_request_mapper().map


@extend_schema(tags=["instructors"])
class InstructorViewSet(viewsets.ViewSet):
    instructor_service: InstructorService | None = None

    @extend_schema(
        summary="List instructors",
        description=(
            "Paginated instructor list ordered by mention count. Pass "
            "`course_offering_id` and/or `speciality_id` to boost instructors "
            "most mentioned on that course offering or speciality."
        ),
        parameters=to_openapi((InstructorListParams, OpenApiParameter.QUERY)),
        responses=R_INSTRUCTOR_LIST,
    )
    def list(self, request, *args, **kwargs) -> Response:
        assert self.instructor_service is not None

        try:
            params = InstructorListParams.model_validate(request.query_params.dict())
        except ModelValidationError as e:
            raise ValidationError(detail=e.errors()) from e

        result = self.instructor_service.list_instructors(params)
        payload = InstructorListResponseSerializer(
            {
                "items": result.items,
                **result.pagination.model_dump(),
            }
        )
        return Response(payload.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="List instructors named on a course",
        description=(
            "Instructors that ratings of this course name, with mention counts. "
            "Never-named instructors are left out, so an empty list means no "
            "signal. Pass `offering_id` to count and rank that offering first."
        ),
        parameters=[
            *to_openapi((CourseInstructorsPathParams, OpenApiParameter.PATH)),
            *to_openapi((CourseInstructorsQueryParams, OpenApiParameter.QUERY)),
        ],
        responses=R_COURSE_INSTRUCTORS,
    )
    def course_instructors(self, request, course_id: str | None = None, *args, **kwargs):
        assert self.instructor_service is not None

        try:
            path = CourseInstructorsPathParams.model_validate({"course_id": course_id})
            params = CourseInstructorsQueryParams.model_validate(request.query_params.dict())
        except ModelValidationError as e:
            raise ValidationError(detail=e.errors()) from e

        items = self.instructor_service.list_course_instructors(path.course_id, params)
        payload = CourseInstructorListSerializer({"items": items})
        return Response(payload.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Retrieve an instructor",
        description="Retrieve a single instructor by their ID with detailed information.",
        parameters=to_openapi((InstructorReadParams, OpenApiParameter.PATH)),
        responses=R_INSTRUCTOR,
    )
    def retrieve(self, request, instructor_id: str | None = None, *args, **kwargs):
        assert self.instructor_service is not None

        try:
            params = InstructorReadParams.model_validate({"instructor_id": instructor_id})
        except ModelValidationError as e:
            raise ValidationError(detail=e.errors()) from e

        instructor = self.instructor_service.get_instructor_by_id(str(params.instructor_id))

        return Response(InstructorSerializer(instructor).data)
