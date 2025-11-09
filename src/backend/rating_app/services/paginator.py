from django.core.paginator import Paginator
from django.db.models import Model, QuerySet

from rateukma.protocols import IProcessor, implements
from rating_app.application_schemas.pagination import PaginationMetadata


class QuerysetPaginator(
    IProcessor[[QuerySet[Model], int | None, int], tuple[list[Model], PaginationMetadata]]
):
    @implements
    def process(
        self, queryset: QuerySet[Model], page_num: int | None, page_size: int
    ) -> tuple[list[Model], PaginationMetadata]:
        paginator = Paginator(queryset, page_size)
        page = paginator.get_page(page_num)

        return (
            page.object_list,
            PaginationMetadata(
                page=page.number,
                page_size=page.paginator.per_page,
                total=paginator.count,  # type: ignore
                total_pages=paginator.num_pages,  # type: ignore
            ),
        )
