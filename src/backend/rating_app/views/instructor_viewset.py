import uuid

from rest_framework import viewsets
from rest_framework.response import Response

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema

from rating_app.exception.instructor_exceptions import InstructorNotFoundError
from rating_app.serializers import InstructorSerializer
from rating_app.services import InstructorService

from .responses import R_INSTRUCTOR


class InstructorViewSet(viewsets.ModelViewSet):
    serializer_class = InstructorSerializer

    instructor_service: InstructorService | None = None

    @extend_schema(
        summary="Retrieve an instructor",
        description="Retrieve a single instructor by their ID with detailed information.",
        parameters=[
            OpenApiParameter(
                name="instructor_id",
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.PATH,
                description="Instructor ID",
            )
        ],
        responses=R_INSTRUCTOR,
    )
    def retrieve(self, request, instructor_id):
        assert self.instructor_service is not None

        if instructor_id is None:
            return Response({"detail": "Instructor ID is required."}, status=400)

        # TODO:UUID validation is the same in all entities retrieval views
        try:
            uuid.UUID(instructor_id)
        except ValueError:
            return Response({"detail": "Invalid UUID."}, status=400)

        try:
            instructor = self.instructor_service.get_instructor_by_id(instructor_id)
        except InstructorNotFoundError:
            return Response(status=404)

        return Response(self.get_serializer(instructor).data)
