from decimal import Decimal
from typing import Any

from django.db import IntegrityError
from django.db.models import Avg, Count, QuerySet

import structlog

from rateukma.protocols import IProcessor
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
from rating_app.exception.rating_exceptions import DuplicateRatingException, RatingNotFoundError
from rating_app.models import Course, Rating
from rating_app.repositories.protocol import IRepository

logger = structlog.get_logger(__name__)


class RatingRepository(IRepository[Rating]):
    def __init__(self, mapper: IProcessor[[Rating], RatingDTO]):
        self.mapper = mapper

    def get_all(self) -> list[RatingDTO]:
        ratings = Rating.objects.select_related(
            "course_offering__course",
            "course_offering__semester",
            "student",
        ).all()

        return self._map_to_domain_models(ratings)

    def get_by_id(self, rating_id: str) -> RatingDTO:
        try:
            rating = Rating.objects.select_related(
                "course_offering__course",
                "course_offering__semester",
                "student",
            ).get(pk=rating_id)
        except Rating.DoesNotExist as err:
            raise RatingNotFoundError() from err

        return self._map_to_domain_model(rating)

    def get_by_student_id_course_id(self, student_id: str, course_id: str) -> list[RatingDTO]:
        ratings = Rating.objects.select_related(
            "course_offering__course",
            "course_offering__semester",
            "student",
        ).filter(
            student_id=student_id,
            course_offering__course_id=course_id,
        )

        return self._map_to_domain_models(ratings)

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
        return self._map_to_domain_model(rating), created

    def get_aggregated_course_stats(self, course: Course) -> AggregatedCourseRatingStats:
        aggregates = Rating.objects.filter(course_offering__course=course).aggregate(
            avg_difficulty=Avg("difficulty"),
            avg_usefulness=Avg("usefulness"),
            ratings_count=Count("id", distinct=True),
        )
        return AggregatedCourseRatingStats(
            avg_difficulty=aggregates.get("avg_difficulty", Decimal(0)),
            avg_usefulness=aggregates.get("avg_usefulness", Decimal(0)),
            ratings_count=aggregates.get("ratings_count", 0),
        )

    def exists(self, student_id: str, course_offering_id: str) -> bool:
        return Rating.objects.filter(
            student_id=student_id,
            course_offering_id=course_offering_id,
        ).exists()

    def filter(
        self,
        criteria: RatingFilterCriteria,
    ) -> list[RatingDTO]:
        ratings = self._build_base_queryset()
        ratings = self._apply_filters(ratings, criteria).order_by("-created_at")

        if criteria.separate_current_user is not None:
            ratings = ratings.exclude(student_id=str(criteria.separate_current_user))

        return self._map_to_domain_models(ratings)

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

        return self._map_to_domain_model(rating)

    def update(self, rating: Rating, update_data: RatingPutParams | RatingPatchParams) -> RatingDTO:
        is_patch = isinstance(update_data, RatingPatchParams)
        update_data_map = update_data.model_dump(exclude_unset=is_patch)

        # TODO: find a cleaner way to do this validation
        if update_data_map.get("comment") is None:
            update_data_map["comment"] = ""

        for attr, value in update_data_map.items():
            setattr(rating, attr, value)

        try:
            rating.save()
        except IntegrityError as err:
            raise DuplicateRatingException() from err

        logger.info(
            "rating_partially_updated",
            rating_id=rating.id,
            student_id=str(rating.student.id),  # type: ignore
            updated_fields=list(update_data_map.keys()),
        )

        return self._map_to_domain_model(rating)

    def delete(self, rating: RatingDTO) -> None:
        rating_model = self._get_by_id_shallow(str(rating.id))
        rating_model.delete()
        logger.info(
            "rating_deleted",
            rating_id=rating.id,
            student_id=str(rating_model.student.id),
        )

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
        )

    def _apply_filters(
        self, queryset: QuerySet[Rating], criteria: RatingFilterCriteria
    ) -> QuerySet[Rating]:
        query_filters = self._build_query_filters(criteria)
        return queryset.filter(**query_filters)

    def _get_by_id_shallow(self, rating_id: str) -> Rating:
        return Rating.objects.get(pk=rating_id)
