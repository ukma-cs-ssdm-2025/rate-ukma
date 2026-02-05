from typing import Literal, overload

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import DataError
from django.db.models import QuerySet

import structlog

from rating_app.application_schemas.faculty import Faculty as FacultyDTO
from rating_app.exception.faculty_exceptions import (
    FacultyNotFoundError,
    InvalidFacultyIdentifierError,
)
from rating_app.models import Faculty
from rating_app.repositories.protocol import IDomainOrmRepository
from rating_app.repositories.to_domain_mappers import FacultyMapper

logger = structlog.get_logger(__name__)


class FacultyRepository(IDomainOrmRepository[FacultyDTO, Faculty]):
    def __init__(self, mapper: FacultyMapper) -> None:
        self._mapper = mapper

    def get_all(self) -> list[FacultyDTO]:
        qs = Faculty.objects.all()
        return self._map_to_domain_models(qs)

    def get_by_id(self, id: str) -> FacultyDTO:
        model = self._get_by_id(id)
        return self._map_to_domain_model(model)

    def get_by_speciality_name(self, speciality_name: str) -> Faculty | None:
        """Returns ORM model for M2M operations in injector."""
        return Faculty.objects.filter(specialities__name=speciality_name).first()

    @overload
    def get_or_create(
        self,
        data: FacultyDTO,
        *,
        return_model: Literal[False] = ...,
    ) -> tuple[FacultyDTO, bool]: ...

    @overload
    def get_or_create(
        self,
        data: FacultyDTO,
        *,
        return_model: Literal[True],
    ) -> tuple[Faculty, bool]: ...

    def get_or_create(
        self,
        data: FacultyDTO,
        *,
        return_model: bool = False,
    ) -> tuple[FacultyDTO, bool] | tuple[Faculty, bool]:
        model, created = Faculty.objects.get_or_create(
            name=data.name,
            defaults=self._build_defaults(data),
        )

        if return_model:
            return model, created
        return self._map_to_domain_model(model), created

    @overload
    def get_or_upsert(
        self,
        data: FacultyDTO,
        *,
        return_model: Literal[False] = ...,
    ) -> tuple[FacultyDTO, bool]: ...

    @overload
    def get_or_upsert(
        self,
        data: FacultyDTO,
        *,
        return_model: Literal[True],
    ) -> tuple[Faculty, bool]: ...

    def get_or_upsert(
        self,
        data: FacultyDTO,
        *,
        return_model: bool = False,
    ) -> tuple[FacultyDTO, bool] | tuple[Faculty, bool]:
        model, created = Faculty.objects.update_or_create(
            name=data.name,
            defaults=self._build_defaults(data),
        )

        if return_model:
            return model, created
        return self._map_to_domain_model(model), created

    def update(self, obj: FacultyDTO, **faculty_data: object) -> FacultyDTO:
        model = self._get_by_id(str(obj.id))
        for field, value in faculty_data.items():
            setattr(model, field, value)
        model.save()
        return self._map_to_domain_model(model)

    def delete(self, id: str) -> None:
        model = self._get_by_id(id)
        model.delete()

    def filter(self, **kwargs: object) -> list[FacultyDTO]:
        # not used in filtering yet, returns all
        return self.get_all()

    def _build_defaults(self, data: FacultyDTO) -> dict:
        return {
            "custom_abbreviation": data.custom_abbreviation,
        }

    def _get_by_id(self, id: str) -> Faculty:
        try:
            return Faculty.objects.get(id=id)
        except Faculty.DoesNotExist as exc:
            logger.warning("faculty_not_found", faculty_id=id, error=str(exc))
            raise FacultyNotFoundError() from exc
        except (ValueError, TypeError, DjangoValidationError, DataError) as exc:
            logger.warning("invalid_faculty_identifier", faculty_id=id, error=str(exc))
            raise InvalidFacultyIdentifierError() from exc

    def _map_to_domain_models(self, qs: QuerySet[Faculty]) -> list[FacultyDTO]:
        return [self._map_to_domain_model(model) for model in qs]

    def _map_to_domain_model(self, model: Faculty) -> FacultyDTO:
        return self._mapper.process(model)
