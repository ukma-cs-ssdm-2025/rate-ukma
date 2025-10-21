from rest_framework import status, viewsets
from rest_framework.exceptions import NotFound
from rest_framework.response import Response

import structlog
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema

from ..constants import (
    DEFAULT_PAGE_NUMBER,
    DEFAULT_PAGE_SIZE,
)
from ..exception.rating_exceptions import DuplicateRatingException, NotEnrolledException
from ..ioc_container.services import rating_service
from ..models import Rating, Student
from ..serializers import RatingCreateUpdateSerializer, RatingReadSerializer
from .responses import R_NO_CONTENT, R_RATING, R_RATING_CREATE, R_RATING_LIST

logger = structlog.get_logger(__name__)


@extend_schema(tags=["ratings"])
class RatingViewSet(viewsets.ViewSet):
    lookup_url_kwarg = "rating_id"
    serializer_class = RatingReadSerializer

    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        self.rating_service = rating_service()

    def _to_int(self, value: str | None, default: int) -> int:
        if value is None:
            return default
        try:
            return int(value)
        except (ValueError, TypeError):
            return default

    def _get_student_or_403(self, request):
        """Get student for current user or return 403 response."""
        student = Student.objects.filter(user_id=request.user.id).first()
        if not student:
            error = Response(
                {"detail": "Only students can perform this action."},
                status=status.HTTP_403_FORBIDDEN,
            )
            return None, error
        return student, None

    def _check_ownership(self, rating: Rating, student_id) -> bool:
        return rating.student.id == student_id

    @extend_schema(
        summary="List ratings for a course",
        description="List all ratings for a specific course with filters and pagination.",
        parameters=[
            OpenApiParameter(
                name="course_id",
                type=OpenApiTypes.UUID,
                location=OpenApiParameter.PATH,
                description="Course ID from URL path",
                required=False,
            ),
            OpenApiParameter(
                name="page",
                type=OpenApiTypes.INT,
                location=OpenApiParameter.QUERY,
                description="Page number (default: 1)",
                required=False,
            ),
            OpenApiParameter(
                name="page_size",
                type=OpenApiTypes.INT,
                location=OpenApiParameter.QUERY,
                description=f"Items per page (default: {DEFAULT_PAGE_SIZE})",
                required=False,
            ),
        ],
        responses=R_RATING_LIST,
    )
    def list(self, request, course_id=None):
        page = self._to_int(request.query_params.get("page"), DEFAULT_PAGE_NUMBER)
        page_size = self._to_int(request.query_params.get("page_size"), DEFAULT_PAGE_SIZE)

        result = self.rating_service.filter_ratings(
            course_id=course_id,
            page_size=page_size,
            page_number=page,
        )

        serializer = RatingReadSerializer(result["items"], many=True)
        return Response(
            {
                "items": serializer.data,
                "page": result["page"],
                "page_size": result["page_size"],
                "total": result["total"],
                "total_pages": result["total_pages"],
            },
            status=status.HTTP_200_OK,
        )

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
    def create(self, request, course_id=None):
        student, error_response = self._get_student_or_403(request)
        if error_response is not None:
            return error_response

        serializer = RatingCreateUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # course_offering_id = serializer.validated_data["course_offering"]  # type: ignore
        co = serializer.validated_data["course_offering"]  # type: ignore
        course_offering_id = getattr(co, "id", co)

        # Create rating through service (handles duplicate and enrollment checks)
        try:
            rating = self.rating_service.create_rating(
                student_id=str(student.id),  # type: ignore[union-attr]
                course_offering_id=str(course_offering_id),
                **{k: v for k, v in serializer.validated_data.items() if k != "course_offering"},  # type: ignore[union-attr]
            )
        except DuplicateRatingException as exc:
            return Response(
                {"detail": str(exc.detail)},
                status=status.HTTP_409_CONFLICT,
            )
        except NotEnrolledException as exc:
            return Response(
                {"detail": str(exc.detail)},
                status=status.HTTP_403_FORBIDDEN,
            )

        response_serializer = RatingReadSerializer(rating)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    @extend_schema(
        summary="Get rating details",
        description="Retrieve a specific rating by ID.",
        responses=R_RATING,
    )
    def retrieve(self, request, rating_id=None, *args, **kwargs):
        try:
            rating = self.rating_service.get_rating(rating_id)
            serializer = RatingReadSerializer(rating)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Rating.DoesNotExist as exc:
            raise NotFound("Rating not found") from exc

    @extend_schema(
        summary="Update a rating",
        description="Update an existing rating. Only the owner can update their rating.",
        request=RatingCreateUpdateSerializer,
        responses=R_RATING,
    )
    def update(self, request, course_id=None, rating_id=None):
        student, error_response = self._get_student_or_403(request)
        if error_response is not None:
            return error_response

        try:
            rating = self.rating_service.get_rating(rating_id)

            if not self._check_ownership(rating, student.id):  # type: ignore[union-attr]
                return Response(
                    {"detail": "You do not have permission to update this rating."},
                    status=status.HTTP_403_FORBIDDEN,
                )

            serializer = RatingCreateUpdateSerializer(rating, data=request.data, partial=False)
            serializer.is_valid(raise_exception=True)
            rating = self.rating_service.update_rating(
                rating_id=rating_id,
                **serializer.validated_data,  # type: ignore[arg-type]
            )
            response_serializer = RatingReadSerializer(rating)
            return Response(response_serializer.data, status=status.HTTP_200_OK)
        except Rating.DoesNotExist as exc:
            raise NotFound("Rating not found") from exc

    @extend_schema(
        summary="Partially update a rating",
        description="Partially update an existing rating. Only the owner can update their rating.",
        request=RatingCreateUpdateSerializer,
        responses=R_RATING,
    )
    def partial_update(self, request, course_id=None, rating_id=None):
        student, error_response = self._get_student_or_403(request)
        if error_response is not None:
            return error_response

        try:
            rating = self.rating_service.get_rating(rating_id)

            if not self._check_ownership(rating, student.id):  # type: ignore[union-attr]
                return Response(
                    {"detail": "You do not have permission to update this rating."},
                    status=status.HTTP_403_FORBIDDEN,
                )

            serializer = RatingCreateUpdateSerializer(rating, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            rating = self.rating_service.update_rating(
                rating_id=rating_id,
                **serializer.validated_data,  # type: ignore[arg-type]
            )
            response_serializer = RatingReadSerializer(rating)
            return Response(response_serializer.data, status=status.HTTP_200_OK)
        except Rating.DoesNotExist as exc:
            raise NotFound("Rating not found") from exc

    @extend_schema(
        summary="Delete a rating",
        description="Delete a rating. Only the owner can delete their rating.",
        responses=R_NO_CONTENT,
    )
    def destroy(self, request, course_id=None, rating_id=None):
        student, error_response = self._get_student_or_403(request)
        if error_response is not None:
            return error_response

        try:
            rating = self.rating_service.get_rating(rating_id)

            if not self._check_ownership(rating, student.id):  # type: ignore[union-attr]
                return Response(
                    {"detail": "You do not have permission to delete this rating."},
                    status=status.HTTP_403_FORBIDDEN,
                )

            self.rating_service.delete_rating(rating_id)
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Rating.DoesNotExist as exc:
            raise NotFound("Rating not found") from exc
