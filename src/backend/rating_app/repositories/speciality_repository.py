from typing import Literal, overload

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import DataError
from django.db.models import QuerySet

import structlog

from rating_app.application_schemas.speciality import Speciality as SpecialityDTO
from rating_app.application_schemas.speciality import SpecialityInput
from rating_app.exception.speciality_exceptions import (
    InvalidSpecialityIdentifierError,
    SpecialityNotFoundError,
)
from rating_app.models import Speciality
from rating_app.repositories.protocol import IDomainOrmRepository
from rating_app.repositories.to_domain_mappers import SpecialityMapper

logger = structlog.get_logger(__name__)


class SpecialityRepository(IDomainOrmRepository[SpecialityDTO, Speciality]):
    def __init__(self, mapper: SpecialityMapper) -> None:
        self._mapper = mapper

    def get_all(self) -> list[SpecialityDTO]:
        qs = self._build_base_queryset().all()
        return self._map_to_domain_models(qs)

    def get_by_id(self, id: str) -> SpecialityDTO:
        model = self._get_by_id(id)
        return self._map_to_domain_model(model)

    def get_by_name(self, name: str) -> SpecialityDTO | None:
        model = self._build_base_queryset().filter(name=name).first()
        if model is None:
            return None
        return self._map_to_domain_model(model)

    @overload
    def get_or_create(
        self,
        data: SpecialityInput | SpecialityDTO,
        *,
        return_model: Literal[False] = ...,
    ) -> tuple[SpecialityDTO, bool]: ...

    @overload
    def get_or_create(
        self,
        data: SpecialityInput | SpecialityDTO,
        *,
        return_model: Literal[True],
    ) -> tuple[Speciality, bool]: ...

    def get_or_create(
        self,
        data: SpecialityInput | SpecialityDTO,
        *,
        return_model: bool = False,
    ) -> tuple[SpecialityDTO, bool] | tuple[Speciality, bool]:
        model, created = Speciality.objects.get_or_create(
            name=data.name,
            faculty_id=data.faculty_id,
            defaults=self._build_defaults(data),
        )

        if return_model:
            return model, created
        return self._map_to_domain_model(model), created

    @overload
    def get_or_upsert(
        self,
        data: SpecialityInput | SpecialityDTO,
        *,
        return_model: Literal[False] = ...,
    ) -> tuple[SpecialityDTO, bool]: ...

    @overload
    def get_or_upsert(
        self,
        data: SpecialityInput | SpecialityDTO,
        *,
        return_model: Literal[True],
    ) -> tuple[Speciality, bool]: ...

    def get_or_upsert(
        self,
        data: SpecialityInput | SpecialityDTO,
        *,
        return_model: bool = False,
    ) -> tuple[SpecialityDTO, bool] | tuple[Speciality, bool]:
        model, created = Speciality.objects.update_or_create(
            name=data.name,
            faculty_id=data.faculty_id,
            defaults=self._build_defaults(data),
        )

        if return_model:
            return model, created
        return self._map_to_domain_model(model), created

    def update(self, obj: SpecialityDTO, **speciality_data: object) -> SpecialityDTO:
        model = self._get_by_id(str(obj.id))
        for field, value in speciality_data.items():
            setattr(model, field, value)
        model.save()
        return self._map_to_domain_model(model)

    def delete(self, id: str) -> None:
        model = self._get_by_id(id)
        model.delete()

    def filter(self, **kwargs: object) -> list[SpecialityDTO]:
        # not used in filtering yet, returns all
        return self.get_all()

    def _build_defaults(self, data: SpecialityInput | SpecialityDTO) -> dict:
        return {
            "alias": data.alias or "",
        }

    def _get_by_id(self, id: str) -> Speciality:
        try:
            return self._build_base_queryset().get(id=id)
        except Speciality.DoesNotExist as exc:
            logger.warning("speciality_not_found", speciality_id=id, error=str(exc))
            raise SpecialityNotFoundError() from exc
        except (ValueError, TypeError, DjangoValidationError, DataError) as exc:
            logger.warning("invalid_speciality_identifier", speciality_id=id, error=str(exc))
            raise InvalidSpecialityIdentifierError() from exc

    def _build_base_queryset(self) -> QuerySet[Speciality]:
        return Speciality.objects.select_related("faculty")

    def _map_to_domain_models(self, qs: QuerySet[Speciality]) -> list[SpecialityDTO]:
        return [self._map_to_domain_model(model) for model in qs]

    def _map_to_domain_model(self, model: Speciality) -> SpecialityDTO:
        return self._mapper.process(model)
