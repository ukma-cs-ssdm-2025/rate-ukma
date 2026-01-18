from typing import cast

from django.core.paginator import Paginator
from django.db.models import Model, QuerySet

from rateukma.protocols import IProcessor, implements
from rating_app.application_schemas.pagination import (
    PaginationFilters,
    PaginationMetadata,
    PaginationResult,
    QuerySetPaginationResult,
)
from rating_app.constants import DEFAULT_PAGE_NUMBER, DEFAULT_PAGE_SIZE


class GenericListPaginator[T](IProcessor[[list[T], PaginationFilters | None], PaginationResult[T]]):
    @implements
    def process(
        self, domain_models: list[T], filters: PaginationFilters | None = None
    ) -> PaginationResult[T]:
        if filters is None:
            filters = PaginationFilters()

        page_size = filters.page_size or DEFAULT_PAGE_SIZE
        page = filters.page or 1
        if page < 1:
            raise ValueError(f"Page must be >= 1, got {page}")

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


class GenericQuerysetPaginator[TModel: Model](
    IProcessor[[QuerySet[TModel], PaginationFilters | None], QuerySetPaginationResult[TModel]]
):
    @implements
    def process(
        self,
        queryset: QuerySet[TModel],
        filters: PaginationFilters | None = None,
    ) -> QuerySetPaginationResult[TModel]:
        page_num = filters.page if filters else DEFAULT_PAGE_NUMBER
        page_size = filters.page_size if filters else DEFAULT_PAGE_SIZE
        page_num = page_num or DEFAULT_PAGE_NUMBER
        page_size = page_size or DEFAULT_PAGE_SIZE

        paginator = Paginator(queryset, page_size)
        page = paginator.get_page(page_num)
        objects = cast(QuerySet[TModel], page.object_list)

        metadata = PaginationMetadata(
            page=page.number,
            page_size=paginator.per_page,
            total=paginator.count,
            total_pages=paginator.num_pages,
        )

        return QuerySetPaginationResult[TModel](page_objects=objects, metadata=metadata)
