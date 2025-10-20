from typing import Any

from ..constants import DEFAULT_PAGE_NUMBER, DEFAULT_PAGE_SIZE
from ..exception.rating_exceptions import NotEnrolledException
from ..repositories import EnrollmentRepository, RatingRepository


class RatingService:
    def __init__(
        self,
        rating_repository: RatingRepository,
        enrollment_repository: EnrollmentRepository,
    ):
        self.rating_repository = rating_repository
        self.enrollment_repository = enrollment_repository

    def create_rating(self, **rating_data):
        student_id = rating_data.get("student_id")
        offering_id = rating_data.get("course_offering_id")

        if not isinstance(student_id, str) or not isinstance(offering_id, str):
            raise ValueError("student_id and course_offering_id must be provided as strings")

        # Check if student is enrolled in the course offering
        if not self.enrollment_repository.is_student_enrolled(
            student_id=student_id, offering_id=offering_id
        ):
            raise NotEnrolledException()

        return self.rating_repository.create(**rating_data)

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
        rating = self.rating_repository.get_by_id(rating_id)
        return self.rating_repository.update(rating, **update_data)

    def delete_rating(self, rating_id):
        rating = self.rating_repository.get_by_id(rating_id)
        self.rating_repository.delete(rating)
