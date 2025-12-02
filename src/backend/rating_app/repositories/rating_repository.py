from django.db import IntegrityError
from django.db.models import QuerySet

import structlog

from rating_app.application_schemas.rating import (
    RatingCreateParams,
    RatingFilterCriteria,
    RatingPatchParams,
    RatingPutParams,
)
from rating_app.exception.rating_exceptions import DuplicateRatingException, RatingNotFoundError
from rating_app.models import Rating
from rating_app.repositories.protocol import IRepository

logger = structlog.get_logger(__name__)


class RatingRepository(IRepository[Rating]):
    def get_all(self) -> list[Rating]:
        return list(
            Rating.objects.select_related(
                "course_offering__course",
                "course_offering__semester",
                "student",
            ).all()
        )

    def get_by_id(self, rating_id: str) -> Rating:
        try:
            return Rating.objects.select_related(
                "course_offering__course",
                "course_offering__semester",
                "student",
            ).get(pk=rating_id)
        except Rating.DoesNotExist as err:
            raise RatingNotFoundError() from err

    def get_or_create(self, create_params: RatingCreateParams) -> tuple[Rating, bool]:
        return Rating.objects.get_or_create(
            student_id=str(create_params.student),
            course_offering_id=str(create_params.course_offering),
            defaults={
                "difficulty": create_params.difficulty,
                "usefulness": create_params.usefulness,
                "comment": create_params.comment,
                "is_anonymous": create_params.is_anonymous,
            },
        )

    def exists(self, student_id: str, course_offering_id: str) -> bool:
        return Rating.objects.filter(
            student_id=student_id,
            course_offering_id=course_offering_id,
        ).exists()

    def filter(
        self,
        criteria: RatingFilterCriteria,
    ) -> QuerySet[Rating]:
        # find a cleaner way to do this
        filters = criteria.model_dump(exclude_none=True, exclude={"page", "page_size"})

        if "course_id" in filters:
            filters["course_offering__course_id"] = filters.pop("course_id")

        ratings = (
            Rating.objects.select_related(
                "course_offering__course",
                "course_offering__semester",
                "student",
            )
            .filter(**filters)
            .order_by("-created_at")
        )

        return ratings

    def create(self, create_params: RatingCreateParams) -> Rating:
        try:
            return Rating.objects.create(
                student_id=str(create_params.student),
                course_offering_id=str(create_params.course_offering),
                difficulty=create_params.difficulty,
                usefulness=create_params.usefulness,
                comment=create_params.comment,
                is_anonymous=create_params.is_anonymous,
            )
        except IntegrityError as err:
            raise DuplicateRatingException() from err

    def update(self, rating: Rating, update_data: RatingPutParams | RatingPatchParams) -> Rating:
        allow_unset = isinstance(update_data, RatingPatchParams)
        update_data_map = update_data.model_dump(exclude_unset=allow_unset)

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

        return rating

    def delete(self, rating: Rating) -> None:
        rating.delete()
        logger.info(
            "rating_deleted",
            rating_id=rating.id,
            student_id=str(rating.student.id),  # type: ignore
        )
