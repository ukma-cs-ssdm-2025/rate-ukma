import uuid
from datetime import datetime
from typing import Any

import structlog

from rateukma.caching.decorators import rcached
from rateukma.caching.patterns import course_ratings_namespace
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
from rating_app.application_schemas.semester import (
    Semester,
    SemesterInput,
)
from rating_app.exception.instructor_exceptions import InvalidInstructorIdsError
from rating_app.exception.rating_exceptions import (
    DuplicateRatingException,
    NotEnrolledException,
    RatingPeriodNotStarted,
)
from rating_app.repositories import (
    EnrollmentRepository,
    RatingRepository,
    RatingVoteMapper,
    RatingVoteRepository,
)
from rating_app.repositories.instructor_repository import InstructorRepository
from rating_app.services.comment_normalizer import CommentNormalizer
from rating_app.services.course_offering_service import CourseOfferingService
from rating_app.services.semester_service import SemesterService

logger = structlog.get_logger(__name__)


def _ratings_course_namespace(
    _self,
    filters: RatingFilterCriteria,
    paginate: bool = True,
) -> str | None:
    if filters.course_id is None:
        return None
    return course_ratings_namespace(str(filters.course_id))


class RatingService(IObservable[RatingDTO]):
    def __init__(
        self,
        rating_repository: RatingRepository,
        enrollment_repository: EnrollmentRepository,
        course_offering_service: CourseOfferingService,
        semester_service: SemesterService,
        vote_repository: RatingVoteRepository,
        vote_mapper: RatingVoteMapper,
        comment_normalizer: CommentNormalizer,
        instructor_repository: InstructorRepository,
    ):
        self.rating_repository = rating_repository
        self.enrollment_repository = enrollment_repository
        self.course_offering_service = course_offering_service
        self.semester_service = semester_service
        self.vote_repository = vote_repository
        self.vote_mapper = vote_mapper
        self.comment_normalizer = comment_normalizer
        self.instructor_repository = instructor_repository
        self._listeners: list[IEventListener[RatingDTO]] = []

    @implements
    def notify(self, event: RatingDTO, *args, **kwargs) -> None:
        for listener in self._listeners:
            listener.on_event(event, *args, **kwargs)

    @implements
    def add_observer(self, observer: IEventListener[RatingDTO]) -> None:
        self._listeners.append(observer)

    def get_rating(self, rating_id: str) -> RatingDTO:
        return self.rating_repository.get_by_id(rating_id)

    def check_rating_ownership(self, rating_id: str, student_id: str) -> bool:
        author_id = self.rating_repository.get_student_id_by_rating_id(rating_id)
        if author_id is None:
            return False
        return author_id == student_id

    def get_aggregated_course_stats(self, course: CourseDTO) -> AggregatedCourseRatingStats:
        return self.rating_repository.get_aggregated_course_stats(course)

    @rcached(ttl=300, versioned_by=_ratings_course_namespace)
    def filter_ratings(
        self,
        filters: RatingFilterCriteria,
        paginate: bool = True,
    ) -> RatingSearchResult:
        # TODO: refactor to have cleaner logic

        user_ratings: list[RatingDTO] | None = None
        if filters.separate_current_user and filters.page == 1 and filters.viewer_id:
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
        semester = self.semester_service.get_by_id(str(course_offering.semester_id))
        if not self.is_semester_open_for_rating(semester):
            raise RatingPeriodNotStarted()

        rating_exists = self.rating_repository.exists(
            student_id=student_id, course_offering_id=offering_id
        )
        if rating_exists:
            raise DuplicateRatingException()

        params.comment = self.comment_normalizer.normalize_comment(params.comment)
        self._validate_instructor_ids(params.instructor_ids)

        rating = self.rating_repository.create(params)
        self.notify(rating)
        return rating

    def update_rating(
        self, rating: RatingDTO, update_data: RatingPutParams | RatingPatchParams
    ) -> RatingDTO:
        update_data.comment = self.comment_normalizer.normalize_comment(update_data.comment)
        self._validate_instructor_ids(update_data.instructor_ids)
        updated_rating = self.rating_repository.update(rating, update_data)
        self.notify(updated_rating)
        return updated_rating

    def _validate_instructor_ids(self, instructor_ids: list[uuid.UUID] | None) -> None:
        """Reject ids that do not reference an existing Instructor.

        Django's M2M ``.set()`` silently ignores unknown primary keys, which
        would let a client persist a rating with fewer instructors than it asked
        for and no error. Fail loudly with a 400 instead.
        """
        if not instructor_ids:
            return

        unique_ids = set(instructor_ids)
        found = self.instructor_repository.get_many_by_ids(list(unique_ids))
        missing = unique_ids - {instructor.id for instructor in found}
        if missing:
            raise InvalidInstructorIdsError(
                detail=f"Unknown instructor ids: {sorted(str(i) for i in missing)}"
            )

    def delete_rating(self, rating: RatingDTO) -> None:
        self.rating_repository.delete(str(rating.id))
        self.notify(rating)

    def is_semester_open_for_rating(
        self,
        semester: Semester | SemesterInput,
        *,
        current_semester: Semester | SemesterInput | None = None,
        current_date: datetime | None = None,
    ) -> bool:
        return self.semester_service.is_past_semester(
            semester, current_semester
        ) or self.semester_service.is_midpoint(semester, current_date)

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
