from typing import Any

from rating_app.models import Faculty
from rating_app.repositories.protocol import IRepository


class FacultyRepository(IRepository[Faculty]):
    def get_all(self) -> list[Faculty]:
        return list(Faculty.objects.all())

    def get_by_id(self, faculty_id: str) -> Faculty:
        return Faculty.objects.get(id=faculty_id)

    def get_by_speciality_name(self, speciality_name: str) -> Faculty | None:
        return Faculty.objects.filter(specialities__name=speciality_name).first()

    def get_or_create(self, *, name: str) -> tuple[Faculty, bool]:
        return Faculty.objects.get_or_create(name=name)

    def create(self, **faculty_data) -> Faculty:
        return Faculty.objects.create(**faculty_data)

    def update(self, faculty: Faculty, **faculty_data) -> Faculty:
        for field, value in faculty_data.items():
            setattr(faculty, field, value)
        faculty.save()
        return faculty

    def delete(self, faculty: Faculty) -> None:
        faculty.delete()

    def filter(self, *args: Any, **kwargs: Any) -> list[Faculty]:
        #! TODO: not implemented
        return self.get_all()
