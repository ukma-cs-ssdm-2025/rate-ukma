from typing import TypeVar

from pydantic.dataclasses import dataclass

from rateukma.protocols import IProcessor, implements
from rating_app.application_schemas.pagination import PaginationMetadata
from rating_app.constants import DEFAULT_COURSE_PAGE_SIZE

T = TypeVar("T")


@dataclass
class PaginationFilters:
    page: int | None = None
    page_size: int | None = None


@dataclass
class PaginationResult[T]:
    page_objects: list[T]
    metadata: PaginationMetadata


class GenericPaginator(IProcessor[[list[T], PaginationFilters | None], PaginationResult[T]]):
    @implements
    def process(
        self, domain_models: list[T], filters: PaginationFilters | None = None
    ) -> PaginationResult[T]:
        if filters is None:
            filters = PaginationFilters()

        page_size = filters.page_size or DEFAULT_COURSE_PAGE_SIZE
        page = filters.page or 1
        total = len(domain_models)

        page_objects = self._get_page_objects(domain_models, page, page_size)
        total_pages = self._calculate_total_pages(total, page_size)

        metadata = PaginationMetadata(
            page=page,
            page_size=page_size,
            total=total,
            total_pages=total_pages,
        )

        return PaginationResult(
            page_objects=page_objects,
            metadata=metadata,
        )

    def _get_page_objects(self, domain_models: list[T], page: int, page_size: int) -> list[T]:
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        return domain_models[start_idx:end_idx]

    def _calculate_total_pages(self, total: int, page_size: int) -> int:
        if page_size == 0:
            return 0
        return (total + page_size - 1) // page_size
