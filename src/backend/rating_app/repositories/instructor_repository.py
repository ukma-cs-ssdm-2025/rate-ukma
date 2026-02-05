from typing import Literal, overload

from django.db.models import QuerySet

from rating_app.application_schemas.instructor import Instructor, InstructorInput
from rating_app.exception.instructor_exceptions import InstructorNotFoundError
from rating_app.models import Instructor as InstructorModel
from rating_app.repositories.protocol import IDomainOrmRepository
from rating_app.repositories.to_domain_mappers import InstructorMapper


class InstructorRepository(IDomainOrmRepository[Instructor, InstructorModel]):
    def __init__(self, mapper: InstructorMapper) -> None:
        self.mapper = mapper

    def get_all(self) -> list[Instructor]:
        qs = InstructorModel.objects.all()
        return self._map_to_domain_models(qs)

    def get_by_id(self, id: str) -> Instructor:
        model = self._get_by_id(id)
        return self._map_to_domain_model(model)

    @overload
    def get_or_create(
        self,
        data: InstructorInput | Instructor,
        *,
        return_model: Literal[False] = ...,
    ) -> tuple[Instructor, bool]: ...

    @overload
    def get_or_create(
        self,
        data: InstructorInput | Instructor,
        *,
        return_model: Literal[True],
    ) -> tuple[InstructorModel, bool]: ...

    def get_or_create(
        self,
        data: InstructorInput | Instructor,
        *,
        return_model: bool = False,
    ) -> tuple[Instructor, bool] | tuple[InstructorModel, bool]:
        obj, created = InstructorModel.objects.get_or_create(
            first_name=data.first_name,
            last_name=data.last_name,
            patronymic=data.patronymic,
            academic_degree=data.academic_degree,
            academic_title=data.academic_title,
        )

        if return_model:
            return obj, created

        return self._map_to_domain_model(obj), created

    @overload
    def get_or_upsert(
        self,
        data: InstructorInput | Instructor,
        *,
        return_model: Literal[False] = ...,
    ) -> tuple[Instructor, bool]: ...

    @overload
    def get_or_upsert(
        self,
        data: InstructorInput | Instructor,
        *,
        return_model: Literal[True],
    ) -> tuple[InstructorModel, bool]: ...

    def get_or_upsert(
        self,
        data: InstructorInput | Instructor,
        *,
        return_model: bool = False,
    ) -> tuple[Instructor, bool] | tuple[InstructorModel, bool]:
        defaults = {
            "academic_degree": data.academic_degree,
            "academic_title": data.academic_title,
        }
        obj, created = InstructorModel.objects.update_or_create(
            first_name=data.first_name,
            last_name=data.last_name,
            patronymic=data.patronymic,
            defaults=defaults,
        )

        if return_model:
            return obj, created

        return self._map_to_domain_model(obj), created

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

    def filter(self, **kwargs: object) -> list[Instructor]:
        # not used in filtering yet, returns all
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
