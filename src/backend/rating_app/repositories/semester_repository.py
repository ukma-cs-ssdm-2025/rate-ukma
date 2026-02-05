from typing import Literal, overload

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import DataError
from django.db.models import QuerySet

import structlog

from rating_app.application_schemas.semester import Semester as SemesterDTO
from rating_app.exception.semester_exception import (
    InvalidSemesterIdentifierError,
    SemesterNotFoundError,
)
from rating_app.models import Semester
from rating_app.models.choices import SemesterTerm
from rating_app.repositories.protocol import IDomainOrmRepository
from rating_app.repositories.to_domain_mappers import SemesterMapper

logger = structlog.get_logger(__name__)


class SemesterRepository(IDomainOrmRepository[SemesterDTO, Semester]):
    def __init__(self, mapper: SemesterMapper) -> None:
        self._mapper = mapper

    def get_all(self) -> list[SemesterDTO]:
        qs = Semester.objects.all()
        return self._map_to_domain_models(qs)

    def get_by_id(self, id: str) -> SemesterDTO:
        model = self._get_by_id(id)
        return self._map_to_domain_model(model)

    def get_by_year_and_term(self, year: int, term: SemesterTerm) -> SemesterDTO:
        try:
            model = Semester.objects.get(year=year, term=term)
            return self._map_to_domain_model(model)
        except Semester.DoesNotExist as exc:
            logger.warning("semester_not_found", year=year, term=term, error=str(exc))
            raise SemesterNotFoundError() from exc

    @overload
    def get_or_create(
        self,
        data: SemesterDTO,
        *,
        return_model: Literal[False] = ...,
    ) -> tuple[SemesterDTO, bool]: ...

    @overload
    def get_or_create(
        self,
        data: SemesterDTO,
        *,
        return_model: Literal[True],
    ) -> tuple[Semester, bool]: ...

    def get_or_create(
        self,
        data: SemesterDTO,
        *,
        return_model: bool = False,
    ) -> tuple[SemesterDTO, bool] | tuple[Semester, bool]:
        model, created = Semester.objects.get_or_create(
            year=data.year,
            term=data.term,
        )

        if return_model:
            return model, created
        return self._map_to_domain_model(model), created

    @overload
    def get_or_upsert(
        self,
        data: SemesterDTO,
        *,
        return_model: Literal[False] = ...,
    ) -> tuple[SemesterDTO, bool]: ...

    @overload
    def get_or_upsert(
        self,
        data: SemesterDTO,
        *,
        return_model: Literal[True],
    ) -> tuple[Semester, bool]: ...

    def get_or_upsert(
        self,
        data: SemesterDTO,
        *,
        return_model: bool = False,
    ) -> tuple[SemesterDTO, bool] | tuple[Semester, bool]:
        model, created = Semester.objects.update_or_create(
            year=data.year,
            term=data.term,
        )

        if return_model:
            return model, created
        return self._map_to_domain_model(model), created

    def update(self, obj: SemesterDTO, **semester_data: object) -> SemesterDTO:
        model = self._get_by_id(str(obj.id))
        for field, value in semester_data.items():
            setattr(model, field, value)
        model.save()
        return self._map_to_domain_model(model)

    def delete(self, id: str) -> None:
        model = self._get_by_id(id)
        model.delete()

    def filter(self, **kwargs: object) -> list[SemesterDTO]:
        # not used in filtering yet, returns all
        return self.get_all()

    def _get_by_id(self, id: str) -> Semester:
        try:
            return Semester.objects.get(id=id)
        except Semester.DoesNotExist as exc:
            logger.warning("semester_not_found", semester_id=id, error=str(exc))
            raise SemesterNotFoundError() from exc
        except (ValueError, TypeError, DjangoValidationError, DataError) as exc:
            logger.warning("invalid_semester_identifier", semester_id=id, error=str(exc))
            raise InvalidSemesterIdentifierError() from exc

    def _map_to_domain_models(self, qs: QuerySet[Semester]) -> list[SemesterDTO]:
        return [self._map_to_domain_model(model) for model in qs]

    def _map_to_domain_model(self, model: Semester) -> SemesterDTO:
        return self._mapper.process(model)
