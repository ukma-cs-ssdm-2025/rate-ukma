from typing import Literal, overload

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import DataError
from django.db.models import QuerySet

import structlog

from rating_app.application_schemas.department import Department as DepartmentDTO
from rating_app.application_schemas.department import DepartmentInput
from rating_app.exception.department_exceptions import (
    DepartmentNotFoundError,
    InvalidDepartmentIdentifierError,
)
from rating_app.models import Department
from rating_app.repositories.protocol import IDomainOrmRepository
from rating_app.repositories.to_domain_mappers import DepartmentMapper

logger = structlog.get_logger(__name__)


class DepartmentRepository(IDomainOrmRepository[DepartmentDTO, Department]):
    def __init__(self, mapper: DepartmentMapper) -> None:
        self._mapper = mapper

    def get_all(self) -> list[DepartmentDTO]:
        qs = self._build_base_queryset().all()
        return self._map_to_domain_models(qs)

    def get_by_id(self, id: str) -> DepartmentDTO:
        model = self._get_by_id(id)
        return self._map_to_domain_model(model)

    @overload
    def get_or_create(
        self,
        data: DepartmentInput | DepartmentDTO,
        *,
        return_model: Literal[False] = ...,
    ) -> tuple[DepartmentDTO, bool]: ...

    @overload
    def get_or_create(
        self,
        data: DepartmentInput | DepartmentDTO,
        *,
        return_model: Literal[True],
    ) -> tuple[Department, bool]: ...

    def get_or_create(
        self,
        data: DepartmentInput | DepartmentDTO,
        *,
        return_model: bool = False,
    ) -> tuple[DepartmentDTO, bool] | tuple[Department, bool]:
        model, created = Department.objects.get_or_create(
            name=data.name,
            faculty_id=data.faculty_id,
        )

        if return_model:
            return model, created
        return self._map_to_domain_model(model), created

    @overload
    def get_or_upsert(
        self,
        data: DepartmentInput | DepartmentDTO,
        *,
        return_model: Literal[False] = ...,
    ) -> tuple[DepartmentDTO, bool]: ...

    @overload
    def get_or_upsert(
        self,
        data: DepartmentInput | DepartmentDTO,
        *,
        return_model: Literal[True],
    ) -> tuple[Department, bool]: ...

    def get_or_upsert(
        self,
        data: DepartmentInput | DepartmentDTO,
        *,
        return_model: bool = False,
    ) -> tuple[DepartmentDTO, bool] | tuple[Department, bool]:
        model, created = Department.objects.update_or_create(
            name=data.name,
            faculty_id=data.faculty_id,
        )

        if return_model:
            return model, created
        return self._map_to_domain_model(model), created

    def update(self, obj: DepartmentDTO, **department_data: object) -> DepartmentDTO:
        model = self._get_by_id(str(obj.id))
        for field, value in department_data.items():
            setattr(model, field, value)
        model.save()
        return self._map_to_domain_model(model)

    def delete(self, id: str) -> None:
        model = self._get_by_id(id)
        model.delete()

    def filter(self, **kwargs: object) -> list[DepartmentDTO]:
        # not used in filtering yet, returns all
        return self.get_all()

    def _get_by_id(self, id: str) -> Department:
        try:
            return self._build_base_queryset().get(id=id)
        except Department.DoesNotExist as exc:
            logger.warning("department_not_found", department_id=id, error=str(exc))
            raise DepartmentNotFoundError() from exc
        except (ValueError, TypeError, DjangoValidationError, DataError) as exc:
            logger.warning("invalid_department_identifier", department_id=id, error=str(exc))
            raise InvalidDepartmentIdentifierError() from exc

    def _build_base_queryset(self) -> QuerySet[Department]:
        return Department.objects.select_related("faculty")

    def _map_to_domain_models(self, qs: QuerySet[Department]) -> list[DepartmentDTO]:
        return [self._map_to_domain_model(model) for model in qs]

    def _map_to_domain_model(self, model: Department) -> DepartmentDTO:
        return self._mapper.process(model)
