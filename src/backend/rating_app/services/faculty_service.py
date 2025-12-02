from typing import Any

from rating_app.repositories import FacultyRepository
from rating_app.services.protocols import IFilterable


class FacultyService(IFilterable):
    def __init__(self, faculty_repository: FacultyRepository):
        self.faculty_repository = faculty_repository

    def get_filter_options(self) -> list[dict[str, Any]]:
        faculties = self._get_sorted_faculties()
        return [
            {
                "id": faculty.id,
                "name": faculty.name,
                "custom_abbreviation": faculty.custom_abbreviation,
            }
            for faculty in faculties
        ]

    def _get_sorted_faculties(self):
        return sorted(
            self.faculty_repository.get_all(),
            key=lambda faculty: str(faculty.name or "").lower(),
        )
