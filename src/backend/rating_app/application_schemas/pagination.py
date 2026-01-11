from dataclasses import dataclass

from django.db.models import Model, QuerySet

from pydantic import BaseModel, computed_field


class PaginationMetadata(BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int

    @computed_field
    @property
    def next_page(self) -> int | None:
        return self.page + 1 if self.page < self.total_pages else None

    @computed_field
    @property
    def previous_page(self) -> int | None:
        return self.page - 1 if self.page > 1 else None


@dataclass
class QuerySetPaginationResult[T: Model]:
    page_objects: QuerySet[T]
    metadata: PaginationMetadata


@dataclass
class PaginationResult[T]:
    page_objects: list[T]
    metadata: PaginationMetadata


@dataclass
class PaginationFilters:
    page: int | None = None
    page_size: int | None = None
