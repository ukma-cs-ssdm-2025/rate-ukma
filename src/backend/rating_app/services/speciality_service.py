from typing import Any

from rating_app.repositories import SpecialityRepository
from rating_app.services.protocols import IFilterable


class SpecialityService(IFilterable):
    def __init__(self, speciality_repository: SpecialityRepository):
        self.speciality_repository = speciality_repository

    def get_filter_options(self) -> list[dict[str, Any]]:
        specialities = self._get_sorted_specialities()
        return [
            {
                "id": speciality.id,
                "name": speciality.name,
                "faculty_id": speciality.faculty.id if speciality.faculty else None,
                "faculty_name": speciality.faculty.name if speciality.faculty else None,
            }
            for speciality in specialities
        ]

    def _get_sorted_specialities(self):
        return sorted(
            self.speciality_repository.get_all(),
            key=lambda speciality: str(speciality.name or "").lower(),
        )
