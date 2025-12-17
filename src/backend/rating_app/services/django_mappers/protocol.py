from typing import Any, Protocol, TypeVar

from django.db.models import Model

DjangoModelType = TypeVar("DjangoModelType", bound=Model)
DomainModelType = TypeVar("DomainModelType", bound=Any)  # a dataclass or a pydantic model usually


class IDjangoToDomainModelMapper[DjangoModelType, DomainModelType](Protocol):
    def map_to_dto(self, model: DjangoModelType) -> DomainModelType: ...
