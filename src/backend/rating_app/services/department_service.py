from typing import Any

from rating_app.repositories import DepartmentRepository
from rating_app.services.protocols import IFilterable


class DepartmentService(IFilterable):
    def __init__(self, department_repository: DepartmentRepository):
        self.department_repository = department_repository

    def get_filter_options(self) -> list[dict[str, Any]]:
        departments = self._get_sorted_departments()
        return [
            {
                "id": department.id,
                "name": department.name,
                "faculty_id": department.faculty_id,
                "faculty_name": department.faculty_name,
                "faculty_custom_abbreviation": None,  # TODO: add to DepartmentDTO if needed
            }
            for department in departments
        ]

    def _get_sorted_departments(self):
        return sorted(
            self.department_repository.get_all(),
            key=lambda department: str(department.name or "").lower(),
        )
