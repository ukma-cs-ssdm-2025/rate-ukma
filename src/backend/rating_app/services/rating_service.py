from typing import Any

from django.db import IntegrityError

from ..constants import DEFAULT_PAGE_NUMBER, DEFAULT_PAGE_SIZE
from ..exception.rating_exceptions import DuplicateRatingException, NotEnrolledException
from ..ioc_container.repositories import enrollment_repository, rating_repository


class RatingService:
    def __init__(self):
        self.rating_repository = rating_repository()
        self.enrollment_repository = enrollment_repository()

    def create_rating(self, **rating_data):
        student_id = rating_data.get("student_id")
        offering_id = rating_data.get("course_offering_id")

        # Presence checks
        if student_id is None:
            raise ValueError("Missing required parameter: student_id")
        if offering_id is None:
            raise ValueError("Missing required parameter: course_offering_id")

        # Type checks
        if not isinstance(student_id, str):
            raise TypeError("student_id must be a string")
        if not isinstance(offering_id, str):
            raise TypeError("course_offering_id must be a string")

        if not self.enrollment_repository.is_student_enrolled(
            student_id=student_id, offering_id=offering_id
        ):
            raise NotEnrolledException()

        if self.rating_repository.exists(student_id=student_id, course_offering_id=offering_id):
            raise DuplicateRatingException()

        try:
            return self.rating_repository.create(**rating_data)
        except IntegrityError as err:
            raise DuplicateRatingException() from err

    def get_rating(self, rating_id):
        return self.rating_repository.get_by_id(rating_id)

    def filter_ratings(
        self,
        course_id: str | None = None,
        student_id: str | None = None,
        page_size: int = DEFAULT_PAGE_SIZE,
        page_number: int = DEFAULT_PAGE_NUMBER,
    ) -> dict[str, Any]:
        return self.rating_repository.filter(
            course_id=course_id, student_id=student_id, page_size=page_size, page_number=page_number
        )

    def update_rating(self, rating_id, **update_data):
        immutable_fields = {"student", "student_id", "course_offering", "course_offering_id"}
        attempted = immutable_fields.intersection(update_data.keys())
        if attempted:
            raise ValueError(f"Updating identity fields is not allowed: {', '.join(attempted)}")
        rating = self.rating_repository.get_by_id(rating_id)
        return self.rating_repository.update(rating, **update_data)

    def delete_rating(self, rating_id):
        rating = self.rating_repository.get_by_id(rating_id)
        self.rating_repository.delete(rating)
