from decimal import Decimal
from typing import Any, overload

from django.db import DataError, IntegrityError
from django.db.models import Avg, Count, Q, QuerySet

import structlog

from rateukma.protocols import IProcessor
from rating_app.application_schemas.course import Course as CourseDTO
from rating_app.application_schemas.pagination import PaginationFilters, PaginationResult
from rating_app.application_schemas.rating import (
    AggregatedCourseRatingStats,
    RatingCreateParams,
    RatingFilterCriteria,
    RatingPatchParams,
    RatingPutParams,
)
from rating_app.application_schemas.rating import (
    Rating as RatingDTO,
)
from rating_app.exception.rating_exceptions import (
    DuplicateRatingException,
    InvalidRatingIdentifierError,
    RatingNotFoundError,
)
from rating_app.models import Rating
from rating_app.models.choices import RatingVoteType
from rating_app.pagination import GenericQuerysetPaginator
from rating_app.repositories.protocol import IRepository

logger = structlog.get_logger(__name__)


class RatingRepository(IRepository[RatingDTO]):
    def __init__(
        self,
        mapper: IProcessor[[Rating], RatingDTO],
        paginator: GenericQuerysetPaginator[Rating],
    ):
        self.mapper = mapper
        self.paginator = paginator

    def get_all(self) -> list[RatingDTO]:
        ratings = self._build_base_queryset().all()
        return self._map_to_domain_models(ratings)

    def get_by_id(self, id: str) -> RatingDTO:
        try:
            rating = self._build_base_queryset().get(pk=id)
        except Rating.DoesNotExist as err:
            raise RatingNotFoundError() from err

        return self._map_to_domain_model(rating)

    def get_by_student_id_course_id(self, student_id: str, course_id: str) -> list[RatingDTO]:
        ratings = self._build_base_queryset().filter(
            student_id=student_id,
            course_offering__course_id=course_id,
        )
        return self._map_to_domain_models(ratings)

    def get_student_id_by_rating_id(self, rating_id: str) -> str | None:
        try:
            rating = Rating.objects.only("student").get(pk=rating_id)
            return str(rating.student.id)
        except Rating.DoesNotExist:
            return None

    def get_or_create(self, create_params: RatingCreateParams) -> tuple[RatingDTO, bool]:
        rating, created = Rating.objects.get_or_create(
            student_id=str(create_params.student),
            course_offering_id=str(create_params.course_offering),
            defaults={
                "difficulty": create_params.difficulty,
                "usefulness": create_params.usefulness,
                "comment": create_params.comment,
                "is_anonymous": create_params.is_anonymous,
            },
        )
        # Refetch with prefetching to get votes (for existing ratings) and related fields
        rating = self._build_base_queryset().get(pk=rating.pk)
        return self._map_to_domain_model(rating), created

    def get_aggregated_course_stats(self, course: CourseDTO) -> AggregatedCourseRatingStats:
        aggregates = Rating.objects.filter(course_offering__course=str(course.id)).aggregate(
            avg_difficulty=Avg("difficulty"),
            avg_usefulness=Avg("usefulness"),
            ratings_count=Count("id", distinct=True),
        )
        return AggregatedCourseRatingStats(
            avg_difficulty=aggregates.get("avg_difficulty") or Decimal(0),
            avg_usefulness=aggregates.get("avg_usefulness") or Decimal(0),
            ratings_count=aggregates.get("ratings_count") or 0,
        )

    def exists(self, student_id: str, course_offering_id: str) -> bool:
        return Rating.objects.filter(
            student_id=student_id,
            course_offering_id=course_offering_id,
        ).exists()

    @overload
    def filter(
        self,
        criteria: RatingFilterCriteria,
        pagination: PaginationFilters,
    ) -> PaginationResult[RatingDTO]: ...

    @overload
    def filter(
        self,
        criteria: RatingFilterCriteria,
    ) -> list[RatingDTO]: ...

    def filter(
        self,
        criteria: RatingFilterCriteria,
        pagination: PaginationFilters | None = None,
    ) -> PaginationResult[RatingDTO] | list[RatingDTO]:
        qs = self._filter(criteria)

        if pagination is not None:
            result = self.paginator.process(qs, pagination)
            dtos = [self.mapper.process(model) for model in result.page_objects]
            return PaginationResult(
                page_objects=dtos,
                metadata=result.metadata,
            )

        return self._map_to_domain_models(qs)

    def create(self, create_params: RatingCreateParams) -> RatingDTO:
        try:
            rating = Rating.objects.create(
                student_id=str(create_params.student),
                course_offering_id=str(create_params.course_offering),
                difficulty=create_params.difficulty,
                usefulness=create_params.usefulness,
                comment=create_params.comment or "",
                is_anonymous=create_params.is_anonymous,
            )
        except IntegrityError as err:
            raise DuplicateRatingException() from err

        # Refetch with prefetching to get related fields for mapper
        rating = self._build_base_queryset().get(pk=rating.pk)
        return self._map_to_domain_model(rating)

    def update(
        self,
        obj: RatingDTO,
        update_data: RatingPutParams | RatingPatchParams,
    ) -> RatingDTO:
        rating_model = self._get_by_id_shallow(str(obj.id))
        is_patch = isinstance(update_data, RatingPatchParams)
        update_data_map = update_data.model_dump(exclude_unset=is_patch)

        # TODO: find a cleaner way to do this validation
        if update_data_map.get("comment") is None:
            update_data_map["comment"] = ""

        for attr, value in update_data_map.items():
            setattr(rating_model, attr, value)

        try:
            rating_model.save()
        except IntegrityError as err:
            raise DuplicateRatingException() from err

        logger.info(
            "rating_partially_updated",
            rating_id=obj.id,
            student_id=str(obj.student_id) if obj.student_id else None,
            updated_fields=list(update_data_map.keys()),
        )

        rating_model = self._build_base_queryset().get(pk=rating_model.pk)
        return self._map_to_domain_model(rating_model)

    def delete(self, id: str) -> None:
        rating_model = self._get_by_id_shallow(id)
        rating_model.delete()
        logger.info("rating_deleted", rating_id=id)

    def _filter(self, criteria: RatingFilterCriteria) -> QuerySet[Rating]:
        ratings = self._build_base_queryset()
        ratings = self._apply_filters(ratings, criteria).order_by("-created_at")

        if criteria.separate_current_user:
            ratings = ratings.exclude(student_id=str(criteria.viewer_id))

        return ratings

    def _map_to_domain_models(self, models: QuerySet[Rating]) -> list[RatingDTO]:
        return [self._map_to_domain_model(model) for model in models]

    def _map_to_domain_model(self, model: Rating) -> RatingDTO:
        return self.mapper.process(model)

    def _build_query_filters(self, criteria: RatingFilterCriteria) -> dict[str, Any]:
        field_mapping = {
            "course_id": "course_offering__course_id",
        }
        query_filters = {}
        criteria_dict = criteria.model_dump(
            exclude_none=True, exclude={"page", "page_size", "separate_current_user", "viewer_id"}
        )
        for field_name, value in criteria_dict.items():
            orm_field_name = field_mapping.get(field_name, field_name)
            query_filters[orm_field_name] = value
        return query_filters

    def _build_base_queryset(self) -> QuerySet[Rating]:
        return Rating.objects.select_related(
            "course_offering__course",
            "course_offering__semester",
            "student",
        ).annotate(
            upvotes_count=Count("rating_vote", filter=Q(rating_vote__type=RatingVoteType.UPVOTE)),
            downvotes_count=Count(
                "rating_vote", filter=Q(rating_vote__type=RatingVoteType.DOWNVOTE)
            ),
        )

    def _apply_filters(
        self, queryset: QuerySet[Rating], criteria: RatingFilterCriteria
    ) -> QuerySet[Rating]:
        query_filters = self._build_query_filters(criteria)
        return queryset.filter(**query_filters)

    def _get_by_id_shallow(self, rating_id: str) -> Rating:
        try:
            return Rating.objects.get(pk=rating_id)
        except Rating.DoesNotExist as exc:
            logger.warning("rating_not_found", rating_id=rating_id, error=str(exc))
            raise RatingNotFoundError(rating_id) from exc
        except (ValueError, TypeError, DataError) as exc:
            logger.warning("invalid_rating_identifier", rating_id=rating_id, error=str(exc))
            raise InvalidRatingIdentifierError(rating_id) from exc
