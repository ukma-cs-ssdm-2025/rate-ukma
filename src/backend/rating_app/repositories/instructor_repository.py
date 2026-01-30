from typing import Any

from django.db.models import QuerySet

from rating_app.application_schemas.instructor import Instructor
from rating_app.exception.instructor_exceptions import InstructorNotFoundError
from rating_app.models import Instructor as InstructorModel
from rating_app.repositories.protocol import IRepository
from rating_app.repositories.to_domain_mappers import InstructorMapper


class InstructorRepository(IRepository[Instructor]):
    def __init__(self, mapper: InstructorMapper) -> None:
        self.mapper = mapper

    def get_all(self) -> list[Instructor]:
        qs = InstructorModel.objects.all()
        return self._map_to_domain_models(qs)

    def get_by_id(self, id: str) -> Instructor:
        model = self._get_by_id(id)
        return self._map_to_domain_model(model)

    def get_or_create(
        self,
        *,
        first_name: str,
        last_name: str,
        patronymic: str | None,
        academic_degree: str | None,
        academic_title: str | None,
        **kwargs,
    ) -> tuple[Instructor, bool]:
        obj, created = InstructorModel.objects.get_or_create(
            first_name=first_name,
            last_name=last_name,
            patronymic=patronymic,
            academic_degree=academic_degree,
            academic_title=academic_title,
        )

        domain_model = self._map_to_domain_model(obj)
        return (domain_model, created)

    def create(self, **instructor_data) -> Instructor:
        obj = InstructorModel.objects.create(**instructor_data)
        return self._map_to_domain_model(obj)

    def update(self, obj: Instructor, **instructor_data) -> Instructor:
        model = self._get_by_id(str(obj.id))
        for field, value in instructor_data.items():
            setattr(model, field, value)
        model.save()
        return self._map_to_domain_model(model)

    def delete(self, id: str) -> None:
        model = self._get_by_id(id)
        model.delete()

    def filter(self, *args: Any, **kwargs: Any) -> list[Instructor]:
        # not used in filtering yet, returns plain queryset
        return self.get_all()

    def _get_by_id(self, id: str) -> InstructorModel:
        try:
            return InstructorModel.objects.get(id=id)
        except InstructorModel.DoesNotExist as e:
            raise InstructorNotFoundError() from e

    def _map_to_domain_models(self, qs: QuerySet[InstructorModel]) -> list[Instructor]:
        return [self._map_to_domain_model(obj) for obj in qs]

    def _map_to_domain_model(self, obj: InstructorModel) -> Instructor:
        return self.mapper.process(obj)
