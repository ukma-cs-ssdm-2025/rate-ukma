from rest_framework import status, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

import structlog
from drf_spectacular.utils import extend_schema
from pydantic import ValidationError as ModelValidationError

from rating_app.application_schemas.rating import (
    RatingCreateParams,
    RatingFilterCriteria,
    RatingPatchParams,
    RatingPutParams,
    RatingReadParams,
)
from rating_app.models import Rating, Student
from rating_app.serializers import (
    RatingCreateUpdateSerializer,
    RatingListResponseSerializer,
    RatingReadSerializer,
)
from rating_app.services import RatingService, StudentService
from rating_app.views.api_spec.rating import RATING_LIST_QUERY_PARAMS
from rating_app.views.decorators import require_rating_ownership, require_student
from rating_app.views.responses import (
    R_NO_CONTENT,
    R_RATING,
    R_RATING_CREATE,
    R_RATING_LIST,
)

logger = structlog.get_logger(__name__)


@extend_schema(tags=["ratings"])
class RatingViewSet(viewsets.ViewSet):
    lookup_url_kwarg = "rating_id"
    serializer_class = RatingReadSerializer

    rating_service: RatingService | None = None
    student_service: StudentService | None = None

    @extend_schema(
        summary="List ratings for a course",
        description="List all ratings for a specific course with filters and pagination.",
        parameters=RATING_LIST_QUERY_PARAMS,
        responses=R_RATING_LIST,
    )
    def list(self, request, course_id=None):
        assert self.rating_service is not None

        try:
            filter_data = {**request.query_params.dict(), "course_id": course_id}
            filters = RatingFilterCriteria.model_validate(filter_data)
        except ModelValidationError as e:
            logger.error("validation_error", errors=e.errors())
            raise ValidationError(detail=e.errors()) from e

        ratings = self.rating_service.filter_ratings(filters)

        payload = RatingListResponseSerializer(
            {
                "items": ratings.items,
                "filters": ratings.applied_filters,
                **ratings.pagination.model_dump(),
            },
        )

        return Response(payload.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Create a new rating",
        description=(
            "Create a new rating for a course offering. "
            "Each student can only rate a course offering once and must be enrolled in the course. "
            "The student is automatically determined from the authenticated user."
        ),
        request=RatingCreateUpdateSerializer,
        responses=R_RATING_CREATE,
    )
    @require_student
    def create(self, request, student: Student, course_id=None):
        assert self.rating_service is not None
        # TODO: find a more consistent way to generate request body schema
        # course_id is not used, will be potentially removed after using a different endpoint

        try:
            rating_params = RatingCreateParams.model_validate(
                {**request.data, "student": student.id}
            )
        except ModelValidationError as e:
            raise ValidationError(detail=e.errors()) from e

        rating = self.rating_service.create_rating(rating_params)

        logger.info(
            "rating_created",
            rating_id=str(rating.id),
            student_id=str(student.id),
            course_offering_id=str(rating_params.course_offering),
        )
        response_serializer = RatingReadSerializer(rating)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    @extend_schema(
        summary="Get rating details",
        description="Retrieve a specific rating by ID.",
        responses=R_RATING,
    )
    def retrieve(self, request, rating_id: str | None = None, *args, **kwargs):
        assert self.rating_service is not None

        try:
            params = RatingReadParams.model_validate({"rating_id": rating_id})
        except ModelValidationError as e:
            raise ValidationError(detail=e.errors()) from e

        rating = self.rating_service.get_rating(params.rating_id)

        serializer = RatingReadSerializer(rating)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Update a rating",
        description="Update an existing rating. Only the owner can update their rating.",
        request=RatingCreateUpdateSerializer,
        responses=R_RATING,
    )
    @require_rating_ownership
    def update(self, request, rating: Rating, student: Student, **kwargs):
        assert self.rating_service is not None

        try:
            update_params = RatingPutParams.model_validate(request.data)
        except ModelValidationError as e:
            raise ValidationError(detail=e.errors()) from e

        rating = self.rating_service.update_rating(rating, update_params)

        logger.info("rating_updated", rating_id=rating.id)
        response_serializer = RatingReadSerializer(rating)
        return Response(response_serializer.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Partially update a rating",
        description="Partially update an existing rating. Only the owner can update their rating.",
        request=RatingCreateUpdateSerializer,
        responses=R_RATING,
    )
    @require_rating_ownership
    def partial_update(self, request, rating: Rating, student: Student, **kwargs):
        assert self.rating_service is not None

        try:
            update_params = RatingPatchParams.model_validate(request.data)
        except ModelValidationError as e:
            raise ValidationError(detail=e.errors()) from e

        rating = self.rating_service.update_rating(rating, update_params)

        response_serializer = RatingReadSerializer(rating)
        return Response(response_serializer.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Delete a rating",
        description="Delete a rating. Only the owner can delete their rating.",
        responses=R_NO_CONTENT,
    )
    @require_rating_ownership
    def destroy(self, request, rating: Rating, student: Student, **kwargs):
        assert self.rating_service is not None

        self.rating_service.delete_rating(rating.id)
        return Response(status=status.HTTP_204_NO_CONTENT)
