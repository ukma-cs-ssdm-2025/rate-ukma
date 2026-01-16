from rest_framework import status, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

import structlog
from drf_spectacular.utils import extend_schema
from pydantic import ValidationError as ModelValidationError

from rating_app.application_schemas.rating_vote import (
    RatingVoteCreateRequest,
    RatingVoteCreateSchema,
)
from rating_app.models import Student
from rating_app.serializers import RatingVoteReadSerializer
from rating_app.services import RatingFeedbackService, RatingService, StudentService
from rating_app.views.decorators import require_student
from rating_app.views.responses import R_VOTE_DELETE, R_VOTE_UPSERT

logger = structlog.get_logger(__name__)


@extend_schema(tags=["votes"])
class RatingVoteViewSet(viewsets.ViewSet):
    lookup_url_kwarg = "rating_id"

    serializer_class = RatingVoteReadSerializer

    vote_service: RatingFeedbackService | None = None
    student_service: StudentService | None = None
    rating_service: RatingService | None = None

    @extend_schema(
        summary="Create or update a vote on a rating",
        description=(
            "Create or update a vote on a rating. Only students enrolled in the course can vote. "
            "Each student can have at most one vote per rating."
        ),
        request=RatingVoteCreateRequest,
        responses=R_VOTE_UPSERT,
    )
    @require_student
    def upsert(self, request, student: Student, rating_id: str) -> Response:
        assert self.vote_service is not None

        assert self.rating_service is not None

        try:
            payload = RatingVoteCreateRequest.model_validate(request.data)
            schema = RatingVoteCreateSchema(
                vote_type=payload.vote_type,
                student_id=str(student.id),
                rating_id=rating_id,
            )

        except ModelValidationError as e:
            raise ValidationError(detail=e.errors()) from e

        vote, created = self.vote_service.upsert(schema)
        serializer = RatingVoteReadSerializer(vote)

        response_status = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(serializer.data, status=response_status)

    @extend_schema(
        summary="Remove the authenticated student's vote from a rating",
        description="Remove the authenticated student's vote from a rating.",
        responses=R_VOTE_DELETE,
    )
    @require_student
    def destroy(self, request, student: Student, rating_id: str) -> Response:
        assert self.vote_service is not None

        self.vote_service.delete_vote_by_student(
            student_id=str(student.id),
            rating_id=rating_id,
        )

        return Response(status=status.HTTP_204_NO_CONTENT)
