from typing import Any

from rating_app.models import Speciality
from rating_app.models.faculty import Faculty
from rating_app.repositories.protocol import IRepository


class SpecialityRepository(IRepository[Speciality]):
    def get_all(self) -> list[Speciality]:
        return list(Speciality.objects.select_related("faculty").all())

    def get_by_id(self, speciality_id: str) -> Speciality:
        return Speciality.objects.select_related("faculty").get(id=speciality_id)

    def get_by_name(self, name: str) -> Speciality:
        return Speciality.objects.select_related("faculty").filter(name=name).first()

    def get_or_create(self, *, name: str, faculty: "Faculty") -> tuple[Speciality, bool]:
        return Speciality.objects.get_or_create(name=name, faculty=faculty)

    def create(self, **speciality_data) -> Speciality:
        return Speciality.objects.create(**speciality_data)

    def update(self, speciality: Speciality, **speciality_data) -> Speciality:
        for field, value in speciality_data.items():
            setattr(speciality, field, value)
        speciality.save()
        return speciality

    def delete(self, speciality: Speciality) -> None:
        speciality.delete()

    def filter(self, *args: Any, **kwargs: Any) -> list[Speciality]:
        #! TODO: not implemented
        return self.get_all()
