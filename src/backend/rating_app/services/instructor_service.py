from typing import Any

from rating_app.models import Instructor
from rating_app.repositories import InstructorRepository
from rating_app.services.protocols import IFilterable


class InstructorService(IFilterable):
    def __init__(self, instructor_repository: InstructorRepository):
        self.instructor_repository = instructor_repository

    def get_instructor_by_id(self, instructor_id: str) -> Instructor:
        return self.instructor_repository.get_by_id(instructor_id)

    def get_filter_options(self) -> list[dict[str, Any]]:
        instructors = self._get_sorted_instructors()
        return [
            {
                "id": instructor.id,
                "name": f"{instructor.first_name} {instructor.last_name}",
                "department": None,
            }
            for instructor in instructors
        ]

    def _get_sorted_instructors(self):
        return sorted(
            self.instructor_repository.get_all(),
            key=lambda instructor: (
                str(instructor.last_name or "").lower(),
                str(instructor.first_name or "").lower(),
            ),
        )
