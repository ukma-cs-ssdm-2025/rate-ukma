from typing import Any

from rating_app.models import Department, Faculty
from rating_app.repositories.protocol import IRepository


class DepartmentRepository(IRepository[Department]):
    def get_all(self) -> list[Department]:  # type: ignore[override]
        return list(Department.objects.select_related("faculty").all())

    def get_by_id(self, department_id: str) -> Department:  # type: ignore[override]
        return Department.objects.select_related("faculty").get(id=department_id)

    def filter(self, *args: Any, **kwargs: Any) -> list[Department]:  # type: ignore[override]
        #! TODO: not implemented
        return self.get_all()

    def get_or_create(self, *, name: str, faculty: Faculty) -> tuple[Department, bool]:  # type: ignore[override]
        return Department.objects.get_or_create(name=name, faculty=faculty)

    def create(self, **department_data) -> Department:
        return Department.objects.create(**department_data)

    def update(self, department: Department, **department_data) -> Department:  # type: ignore[override]
        for field, value in department_data.items():
            setattr(department, field, value)
        department.save()
        return department

    def delete(self, department: Department) -> None:  # type: ignore[override]
        department.delete()
