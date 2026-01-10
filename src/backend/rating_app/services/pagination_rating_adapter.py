from typing import Any

from rateukma.protocols import IProcessor
from rating_app.application_schemas.pagination import PaginationMetadata
from rating_app.application_schemas.rating import (
    Rating as RatingDTO,
)
from rating_app.application_schemas.rating import (
    RatingFilterCriteria,
    RatingSearchResult,
    RatingsWithUserList,
)
from rating_app.constants import DEFAULT_COURSE_PAGE_SIZE
from rating_app.models import Rating
from rating_app.repositories.to_domain_mappers import ViewerId
from rating_app.services.paginator import QuerysetPaginator


# TODO: create a new paginator for domain models
class PaginationRatingAdapter:
    def __init__(
        self,
        paginator: QuerysetPaginator,
        mapper: IProcessor[[Rating, ViewerId | None], RatingDTO],
    ):
        self._paginator = paginator
        self._mapper = mapper

    def paginate(
        self,
        ratings: list[RatingDTO],
        filters: RatingFilterCriteria,
        user_ratings: list[RatingDTO] | None = None,
    ) -> RatingSearchResult:
        # Paginate the already-mapped ratings
        page_size = filters.page_size or DEFAULT_COURSE_PAGE_SIZE
        page = filters.page or 1

        # Manual pagination on list
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        page_ratings = ratings[start_idx:end_idx]

        total = len(ratings)
        total_pages = (total + page_size - 1) // page_size

        metadata = PaginationMetadata(
            page=page,
            page_size=page_size,
            total=total,
            total_pages=total_pages,
        )

        # Adjust pagination metadata if user ratings are separated
        if user_ratings:
            added = len(user_ratings)
            if added:
                new_total = metadata.total + added
                new_total_pages = (new_total + metadata.page_size - 1) // metadata.page_size
                metadata = PaginationMetadata(
                    page=metadata.page,
                    page_size=metadata.page_size,
                    total=new_total,
                    total_pages=new_total_pages,
                )

        applied_filters = self._format_applied_filters(filters)

        return RatingSearchResult(
            items=RatingsWithUserList(
                ratings=page_ratings,
                user_ratings=user_ratings if filters.separate_current_user is not None else None,
            ),
            pagination=metadata,
            applied_filters=applied_filters,
        )

    def _map_to_domain_models(self, models: list[Rating]) -> list[RatingDTO]:
        return [self._mapper.process(model, None) for model in models]

    def _format_applied_filters(self, filters: RatingFilterCriteria) -> dict[str, Any]:
        return filters.model_dump(by_alias=True, exclude={"page", "page_size"}, exclude_none=True)
