import re
from datetime import datetime
from decimal import Decimal
from typing import Any, cast

from django.db.models import QuerySet

from rateukma.protocols import implements
from rateukma.protocols.generic import IEventListener, IObservable
from rating_app.application_schemas.pagination import PaginationMetadata
from rating_app.application_schemas.rating import (
    AggregatedCourseRatingStats,
    RatingCreateParams,
    RatingFilterCriteria,
    RatingListResponse,
    RatingPatchParams,
    RatingPutParams,
    RatingRead,
    RatingSearchResult,
)
from rating_app.constants import DEFAULT_PAGE_SIZE
from rating_app.exception.rating_exceptions import (
    DuplicateRatingException,
    NotEnrolledException,
    RatingPeriodNotStarted,
)
from rating_app.models import Course, Rating, Semester
from rating_app.models.choices import RatingVoteType
from rating_app.repositories import EnrollmentRepository, RatingRepository, RatingVoteRepository
from rating_app.services.course_offering_service import CourseOfferingService
from rating_app.services.paginator import QuerysetPaginator
from rating_app.services.semester_service import SemesterService


class RatingService(IObservable[Rating]):
    def __init__(
        self,
        rating_repository: RatingRepository,
        enrollment_repository: EnrollmentRepository,
        course_offering_service: CourseOfferingService,
        semester_service: SemesterService,
        rating_vote_repository: RatingVoteRepository,
        paginator: QuerysetPaginator,
    ):
        self.rating_repository = rating_repository
        self.enrollment_repository = enrollment_repository
        self.course_offering_service = course_offering_service
        self.semester_service = semester_service
        self.rating_vote_repository = rating_vote_repository
        self.paginator = paginator
        self._listeners: list[IEventListener[Rating]] = []

    @implements
    def notify(self, event: Rating, *args, **kwargs) -> None:
        for listener in self._listeners:
            listener.on_event(event, *args, **kwargs)

    @implements
    def add_observer(self, listener: IEventListener[Rating]) -> None:
        self._listeners.append(listener)

    def get_rating(self, rating_id):
        return self.rating_repository.get_by_id(rating_id)

    def get_avg_difficulty(self, course: Course) -> Decimal:
        return cast(Decimal, course.avg_difficulty)

    def get_aggregated_course_stats(self, course: Course) -> AggregatedCourseRatingStats:
        return self.rating_repository.get_aggregated_course_stats(course)

    def filter_ratings(
        self,
        filters: RatingFilterCriteria,
        paginate: bool = True,
    ) -> RatingSearchResult:
        user_ratings = []
        if filters.separate_current_user is not None:
            user_ratings = self.rating_repository.get_by_student_id_course_id(
                student_id=str(filters.separate_current_user),
                course_id=str(filters.course_id),
            )
            user_ratings = self._attach_votes_to_ratings(list(user_ratings), filters.viewer_id)

        ratings = self.rating_repository.filter(filters)

        if paginate:
            return self._paginated_result(ratings, filters, user_ratings)

        items = self._attach_votes_to_ratings(list(ratings), filters.viewer_id)

        applied_filters = filters.model_dump(
            by_alias=True, exclude={"page", "page_size"}, exclude_none=True
        )

        total_count = len(items) + (len(user_ratings) if user_ratings else 0)

        return RatingSearchResult(
            items=RatingListResponse(
                ratings=items,
                user_ratings=user_ratings if filters.separate_current_user is not None else None,
            ),
            pagination=self._empty_pagination_metadata(total_count),
            applied_filters=applied_filters,
        )

    def create_rating(self, params: RatingCreateParams) -> Rating:
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

    def update_rating(self, rating: Rating, update_data: RatingPutParams | RatingPatchParams):
        update_data.comment = self._normalize_comment(update_data.comment)
        updated_rating = self.rating_repository.update(rating, update_data)
        self.notify(updated_rating)
        return updated_rating

    def delete_rating(self, rating_id):
        rating = self.rating_repository.get_by_id(rating_id)
        self.rating_repository.delete(rating)
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

    def _paginated_result(
        self,
        ratings: QuerySet[Rating],
        criteria: RatingFilterCriteria,
        user_ratings: list[RatingRead] | None = None,
    ) -> RatingSearchResult:
        page_size = criteria.page_size or DEFAULT_PAGE_SIZE
        obj_list, metadata = self.paginator.process(ratings, criteria.page, page_size)

        items = self._attach_votes_to_ratings(obj_list, criteria.viewer_id)

        applied_filters = criteria.model_dump(
            by_alias=True, exclude={"page", "page_size"}, exclude_none=True
        )
        # if current user's ratings are separated, include them in totals
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
            items=RatingListResponse(
                ratings=items,
                user_ratings=user_ratings if criteria.separate_current_user is not None else None,
            ),
            pagination=metadata,
            applied_filters=applied_filters,
        )

    def _attach_votes_to_ratings(
        self, ratings: list[Rating], viewer_id: Any | None
    ) -> list[RatingRead]:
        rating_ids = [str(r.id) for r in ratings]

        counts = self.rating_vote_repository.get_vote_counts_by_rating_ids(rating_ids)
        viewer_votes = (
            self.rating_vote_repository.get_viewer_votes_by_rating_ids(str(viewer_id), rating_ids)
            if viewer_id is not None
            else {}
        )

        results: list[RatingRead] = []
        for rating in ratings:
            rid = str(rating.id)
            up = counts.get(rid, {}).get("upvotes", 0)
            down = counts.get(rid, {}).get("downvotes", 0)
            student_vote = viewer_votes.get(rid)

            results.append(
                RatingRead(
                    id=rating.id,
                    course_offering_id=rating.course_offering.id,
                    difficulty=rating.difficulty,
                    usefulness=rating.usefulness,
                    comment=rating.comment,
                    created_at=rating.created_at,
                    is_anonymous=rating.is_anonymous,
                    student_id=rating.student.id if not rating.is_anonymous else None,
                    student_name=(
                        f"{rating.student.last_name} {rating.student.first_name}"
                        if not rating.is_anonymous
                        else None
                    ),
                    course_offering=rating.course_offering.id,
                    course=rating.course_offering.course.id,
                    upvotes=up,
                    downvotes=down,
                    viewer_vote=RatingVoteType(student_vote) if student_vote else None,
                )
            )

        return results

    def _empty_pagination_metadata(self, ratings_count: int) -> PaginationMetadata:
        return PaginationMetadata(
            total=ratings_count,
            page=1,
            page_size=ratings_count,
            total_pages=1,
        )

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
