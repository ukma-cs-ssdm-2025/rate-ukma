from rest_framework import viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from drf_spectacular.utils import extend_schema

from rating_app.application_schemas.instructor import InstructorReadParams
from rating_app.serializers import InstructorSerializer
from rating_app.services import InstructorService
from rating_app.views.api_spec.instructor import INSTRUCTOR_DETAIL_PATH_PARAMS
from rating_app.views.rating_viewset import ModelValidationError

from .responses import R_INSTRUCTOR


class InstructorViewSet(viewsets.ModelViewSet):
    serializer_class = InstructorSerializer

    instructor_service: InstructorService | None = None

    @extend_schema(
        summary="Retrieve an instructor",
        description="Retrieve a single instructor by their ID with detailed information.",
        parameters=INSTRUCTOR_DETAIL_PATH_PARAMS,
        responses=R_INSTRUCTOR,
    )
    def retrieve(self, request, instructor_id):
        assert self.instructor_service is not None

        try:
            params = InstructorReadParams.model_validate({"instructor_id": instructor_id})
        except ModelValidationError as e:
            raise ValidationError(detail=e.errors()) from e

        instructor = self.instructor_service.get_instructor_by_id(params.instructor_id)

        return Response(self.get_serializer(instructor).data)
