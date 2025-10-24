from rating_app.models import Department, Faculty


class DepartmentRepository:
    def get_all(self) -> list[Department]:
        return list(Department.objects.select_related("faculty").all())

    def get_by_id(self, department_id: str) -> Department:
        return Department.objects.select_related("faculty").get(id=department_id)

    def get_or_create(self, *, name: str, faculty: Faculty) -> tuple[Department, bool]:
        return Department.objects.get_or_create(name=name, faculty=faculty)

    def create(self, **department_data) -> Department:
        return Department.objects.create(**department_data)

    def update(self, department: Department, **department_data) -> Department:
        for field, value in department_data.items():
            setattr(department, field, value)
        department.save()
        return department

    def delete(self, department: Department) -> None:
        department.delete()
