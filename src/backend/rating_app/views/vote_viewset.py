from rest_framework import status, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

import structlog
from drf_spectacular.utils import extend_schema
from pydantic import ValidationError as ModelValidationError

from rateukma.caching.cache_manager import ICacheManager
from rating_app.application_schemas.rating_vote import RatingVoteCreateSchema
from rating_app.models import Student
from rating_app.serializers import RatingVoteReadSerializer
from rating_app.services import RatingFeedbackService, RatingService, StudentService
from rating_app.views.decorators import require_student
from rating_app.views.responses import R_VOTE_CREATE, R_VOTE_DELETE

logger = structlog.get_logger(__name__)


@extend_schema(tags=["votes"])
class RatingVoteViewSet(viewsets.ViewSet):
    lookup_url_kwarg = "rating_id"
    serializer_class = RatingVoteReadSerializer

    vote_service: RatingFeedbackService | None = None
    student_service: StudentService | None = None
    rating_service: RatingService | None = None
    cache_manager: ICacheManager | None = None

    @extend_schema(
        summary="Create or update a vote on a rating",
        description=(
            "Create or update a vote on a rating. Only students enrolled in the course can vote. "
            "Each student can have at most one vote per rating."
        ),
        request=RatingVoteCreateSchema,
        responses=R_VOTE_CREATE,
    )
    @require_student
    def create(self, request, student: Student, rating_id=None):
        assert self.vote_service is not None
        assert self.rating_service is not None

        try:
            data = {**request.data, "student_id": str(student.id), "rating_id": rating_id}
            schema = RatingVoteCreateSchema.model_validate(data)
        except ModelValidationError as e:
            raise ValidationError(detail=e.errors()) from e

        vote = self.vote_service.create(schema)

        self._invalidate_caches()

        serializer = RatingVoteReadSerializer(vote)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @extend_schema(
        summary="Remove the authenticated student's vote from a rating",
        description="Remove the authenticated student's vote from a rating.",
        responses=R_VOTE_DELETE,
    )
    @require_student
    def destroy(self, request, student: Student, rating_id: str):
        assert self.vote_service is not None

        self.vote_service.delete_vote_by_student(
            student_id=str(student.id),
            rating_id=rating_id,
        )
        self._invalidate_caches()

        return Response(status=status.HTTP_204_NO_CONTENT)

    def _invalidate_caches(self):
        if self.cache_manager:
            self.cache_manager.invalidate_pattern("*RatingViewSet.list*")
            logger.info("votes_cache_invalidated")
