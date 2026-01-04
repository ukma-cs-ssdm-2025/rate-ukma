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
from rating_app.models.choices import RatingVoteType
from rating_app.repositories import RatingRepository, RatingVoteRepository
from rating_app.services.paginator import QuerysetPaginator


# TODO: this is WIP
class PaginationRatingAdapter:
    def __init__(
        self,
        rating_repository: RatingRepository,
        rating_vote_repository: RatingVoteRepository,
        paginator: QuerysetPaginator,
        mapper: IProcessor[[Rating], RatingDTO],
    ):
        self._rating_repository = rating_repository
        self._rating_vote_repository = rating_vote_repository
        self._paginator = paginator
        self._mapper = mapper

    def paginate(self, filters: RatingFilterCriteria) -> RatingSearchResult:
        ratings_qs = self._rating_repository.filter_qs(filters)

        # paginate
        page_size = filters.page_size or DEFAULT_COURSE_PAGE_SIZE
        result: tuple[list[Any], PaginationMetadata] = self._paginator.process(
            ratings_qs, filters.page, page_size
        )
        page_ratings, metadata = result

        # map to domain models
        items = self._map_to_domain_models(page_ratings)

        applied_filters = filters.model_dump(
            by_alias=True, exclude={"page", "page_size"}, exclude_none=True
        )

        return RatingSearchResult(
            items=RatingsWithUserList(
                ratings=items,
                user_ratings=None,
            ),
            pagination=metadata,
            applied_filters=applied_filters,
        )

    def paginate_with_user_ratings(
        self,
        ratings: list[RatingDTO],
        filters: RatingFilterCriteria,
        user_ratings: list[RatingDTO] | None = None,
    ) -> RatingSearchResult:
        ratings_qs = self._rating_repository.filter_qs(filters)

        # paginate the ratings
        page_size = filters.page_size or DEFAULT_COURSE_PAGE_SIZE
        result: tuple[list[Any], PaginationMetadata] = self._paginator.process(
            ratings_qs, filters.page, page_size
        )
        page_ratings, metadata = result

        # attach votes and map to domain models
        items = self._attach_votes_and_map(page_ratings, filters.viewer_id)

        applied_filters = filters.model_dump(
            by_alias=True, exclude={"page", "page_size"}, exclude_none=True
        )

        # adjust pagination metadata if user ratings are separated
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

        return RatingSearchResult(
            items=RatingsWithUserList(
                ratings=ratings,
                user_ratings=user_ratings if filters.separate_current_user is not None else None,
            ),
            pagination=metadata,
            applied_filters=applied_filters,
        )

    def _attach_votes_and_map(
        self, ratings: list[RatingDTO], viewer_id: Any | None
    ) -> list[RatingDTO]:
        # TODO: service still is coupled to ORM models, refactor to use DTOs
        rating_ids = [str(r.id) for r in ratings]

        # get vote counts and viewer votes
        counts = self._rating_vote_repository.get_vote_counts_by_rating_ids(rating_ids)
        viewer_votes = (
            self._rating_vote_repository.get_viewer_votes_by_rating_ids(str(viewer_id), rating_ids)
            if viewer_id is not None
            else {}
        )

        results: list[RatingDTO] = []
        for rating in ratings:
            rid = str(rating.id)
            up = counts.get(rid, {}).get("upvotes", 0)
            down = counts.get(rid, {}).get("downvotes", 0)
            student_vote = viewer_votes.get(rid)

            # new instance with vote information
            rating = rating.model_copy(
                update={
                    "upvotes": up,
                    "downvotes": down,
                    "viewer_vote": RatingVoteType(student_vote) if student_vote else None,
                }
            )
            results.append(rating)

        return results

    def map_ratings_with_votes(
        self, ratings: list[RatingDTO], viewer_id: Any | None
    ) -> list[RatingDTO]:
        return self._attach_votes_and_map(ratings, viewer_id)

    def _map_to_domain_models(self, models: list[Rating]) -> list[RatingDTO]:
        return [self._mapper.process(model) for model in models]
