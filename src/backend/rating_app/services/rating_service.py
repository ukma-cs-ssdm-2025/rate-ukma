import re
from datetime import datetime
from typing import Any

import structlog

from rateukma.caching.decorators import rcached
from rateukma.protocols import implements
from rateukma.protocols.generic import IEventListener, IObservable
from rating_app.application_schemas.course import Course as CourseDTO
from rating_app.application_schemas.pagination import PaginationFilters, PaginationMetadata
from rating_app.application_schemas.rating import (
    AggregatedCourseRatingStats,
    RatingCreateParams,
    RatingFilterCriteria,
    RatingPatchParams,
    RatingPutParams,
    RatingSearchResult,
    RatingsWithUserList,
)
from rating_app.application_schemas.rating import (
    Rating as RatingDTO,
)
from rating_app.exception.rating_exceptions import (
    DuplicateRatingException,
    NotEnrolledException,
    RatingPeriodNotStarted,
)
from rating_app.models import Semester
from rating_app.repositories import (
    EnrollmentRepository,
    RatingRepository,
    RatingVoteMapper,
    RatingVoteRepository,
)
from rating_app.services.course_offering_service import CourseOfferingService
from rating_app.services.semester_service import SemesterService

logger = structlog.get_logger(__name__)


class RatingService(IObservable[RatingDTO]):
    def __init__(
        self,
        rating_repository: RatingRepository,
        enrollment_repository: EnrollmentRepository,
        course_offering_service: CourseOfferingService,
        semester_service: SemesterService,
        vote_repository: RatingVoteRepository,
        vote_mapper: RatingVoteMapper,
    ):
        self.rating_repository = rating_repository
        self.enrollment_repository = enrollment_repository
        self.course_offering_service = course_offering_service
        self.semester_service = semester_service
        self.vote_repository = vote_repository
        self.vote_mapper = vote_mapper
        self._listeners: list[IEventListener[RatingDTO]] = []

    @implements
    def notify(self, event: RatingDTO, *args, **kwargs) -> None:
        for listener in self._listeners:
            listener.on_event(event, *args, **kwargs)

    @implements
    def add_observer(self, listener: IEventListener[RatingDTO]) -> None:
        self._listeners.append(listener)

    def get_rating(self, rating_id: str) -> RatingDTO:
        return self.rating_repository.get_by_id(rating_id)

    def check_rating_ownership(self, rating_id: str, student_id: str) -> bool:
        author_id = self.rating_repository.get_student_id_by_rating_id(rating_id)
        if author_id is None:
            return False
        return author_id == student_id

    def get_aggregated_course_stats(self, course: CourseDTO) -> AggregatedCourseRatingStats:
        return self.rating_repository.get_aggregated_course_stats(course)

    @rcached(ttl=300)
    def filter_ratings(
        self,
        filters: RatingFilterCriteria,
        paginate: bool = True,
    ) -> RatingSearchResult:
        # TODO: refactor to have cleaner logic

        user_ratings: list[RatingDTO] | None = None
        if filters.separate_current_user and filters.page == 1:
            user_ratings = self.rating_repository.get_by_student_id_course_id(
                student_id=str(filters.viewer_id),
                course_id=str(filters.course_id),
            )

        if paginate:
            pagination_filters = PaginationFilters(
                page=filters.page,
                page_size=filters.page_size,
            )
            pagination_result = self.rating_repository.filter(filters, pagination_filters)
            ratings = pagination_result.page_objects
            metadata = pagination_result.metadata
        else:
            ratings = self.rating_repository.filter(filters)
            metadata = self._create_single_page_metadata(len(ratings))

        if user_ratings:
            metadata = metadata.model_copy(update={"total": metadata.total + len(user_ratings)})

        if filters.viewer_id:
            all_ratings = ratings + (user_ratings or [])
            self._enrich_with_viewer_votes(all_ratings, str(filters.viewer_id))

        applied_filters = self._format_applied_filters(filters)

        return RatingSearchResult(
            items=RatingsWithUserList(
                ratings=ratings,
                user_ratings=user_ratings,
            ),
            pagination=metadata,
            applied_filters=applied_filters,
        )

    def _create_single_page_metadata(self, total: int) -> PaginationMetadata:
        return PaginationMetadata(
            page=1,
            page_size=total,
            total=total,
            total_pages=1,
        )

    def create_rating(self, params: RatingCreateParams) -> RatingDTO:
        student_id = str(params.student)
        offering_id = str(params.course_offering)

        is_enrolled = self.enrollment_repository.is_student_enrolled(
            student_id=student_id, offering_id=offering_id
        )

        if not is_enrolled:
            raise NotEnrolledException()

        course_offering = self.course_offering_service.get_course_offering(offering_id)
        if not self.is_semester_open_for_rating(course_offering.semester):
            raise RatingPeriodNotStarted()

        rating_exists = self.rating_repository.exists(
            student_id=student_id, course_offering_id=offering_id
        )
        if rating_exists:
            raise DuplicateRatingException()

        params.comment = self._normalize_comment(params.comment)

        rating = self.rating_repository.create(params)
        self.notify(rating)
        return rating

    def update_rating(
        self, rating: RatingDTO, update_data: RatingPutParams | RatingPatchParams
    ) -> RatingDTO:
        update_data.comment = self._normalize_comment(update_data.comment)
        updated_rating = self.rating_repository.update(rating, update_data)
        self.notify(updated_rating)
        return updated_rating

    def delete_rating(self, rating: RatingDTO) -> None:
        self.rating_repository.delete(str(rating.id))
        self.notify(rating)

    def is_semester_open_for_rating(
        self,
        semester: Semester,
        *,
        current_semester: Semester | None = None,
        current_date: datetime | None = None,
    ) -> bool:
        return self.semester_service.is_past_semester(
            semester, current_semester
        ) or self.semester_service.is_midpoint(semester, current_date)

    @staticmethod
    def _normalize_comment(comment: str | None) -> str | None:
        if not comment or comment == "":
            return comment

        # normalize line breaks
        comment = comment.replace("\r\n", "\n").replace("\r", "\n")

        # collapse 4+ newlines into exactly 3
        comment = re.sub(r"\n{4,}", "\n\n\n", comment)

        # strip trailing spaces on each line
        lines = [line.rstrip() for line in comment.split("\n")]
        comment = "\n".join(lines).strip()

        return comment

    def _enrich_with_viewer_votes(self, ratings: list[RatingDTO], viewer_id: str) -> None:
        if not ratings:
            return

        rating_ids = [str(r.id) for r in ratings]
        viewer_votes = self.vote_repository.get_viewer_votes_by_rating_ids(
            student_id=viewer_id, rating_ids=rating_ids
        )

        for rating in ratings:
            vote_type = viewer_votes.get(str(rating.id))
            if vote_type:
                rating.viewer_vote = self.vote_mapper.to_domain(vote_type)

    def _format_applied_filters(self, filters: RatingFilterCriteria) -> dict[str, Any]:
        return filters.model_dump(by_alias=True, exclude={"page", "page_size"}, exclude_none=True)
