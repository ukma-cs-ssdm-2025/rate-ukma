from typing import Generic, TypeVar

from django.core.paginator import Paginator
from django.db.models import Model, QuerySet

from rating_app.application_schemas.pagination import PaginationMetadata

T = TypeVar("T", bound=Model)


class QuerysetPaginator(Generic[T]):
    def process(
        self, queryset: QuerySet[T], page_num: int | None, page_size: int
    ) -> tuple[list[T], PaginationMetadata]:
        paginator = Paginator(queryset, page_size)
        page = paginator.get_page(page_num)

        return (
            list(page.object_list),
            PaginationMetadata(
                page=page.number,
                page_size=page.paginator.per_page,
                total=paginator.count,  # type: ignore
                total_pages=paginator.num_pages,  # type: ignore
            ),
        )
