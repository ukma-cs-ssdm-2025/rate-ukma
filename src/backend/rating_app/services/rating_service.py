from django.db.models import QuerySet

from rating_app.application_schemas.pagination import PaginationMetadata
from rating_app.application_schemas.rating import (
    RatingCreateParams,
    RatingFilterCriteria,
    RatingPatchParams,
    RatingPutParams,
    RatingSearchResult,
)
from rating_app.constants import DEFAULT_PAGE_SIZE
from rating_app.exception.rating_exceptions import (
    DuplicateRatingException,
    EnrolledButNotCompleted,
    NotEnrolledException,
)
from rating_app.models import Rating
from rating_app.repositories import CourseOfferingRepository, EnrollmentRepository, RatingRepository
from rating_app.services.paginator import QuerysetPaginator
from rating_app.services.semester_service import SemesterService


class RatingService:
    def __init__(
        self,
        rating_repository: RatingRepository,
        enrollment_repository: EnrollmentRepository,
        course_offering_repository: CourseOfferingRepository,
        semester_service: SemesterService,
        paginator: QuerysetPaginator,
    ):
        self.rating_repository = rating_repository
        self.enrollment_repository = enrollment_repository
        self.course_offering_repository = course_offering_repository
        self.semester_service = semester_service
        self.paginator = paginator

    def create_rating(self, params: RatingCreateParams):
        student_id = str(params.student)
        offering_id = str(params.course_offering)

        is_enrolled = self.enrollment_repository.is_student_enrolled(
            student_id=student_id, offering_id=offering_id
        )

        if not is_enrolled:
            raise NotEnrolledException()

        course_offering = self.course_offering_repository.get_by_id(offering_id)
        course_semester = course_offering.semester
        if not (
            self.semester_service.is_past_semester(course_semester)
            or self.semester_service.is_midpoint(course_semester)
        ):
            raise EnrolledButNotCompleted()

        rating_exists = self.rating_repository.exists(
            student_id=student_id, course_offering_id=offering_id
        )
        if rating_exists:
            raise DuplicateRatingException()

        return self.rating_repository.create(params)

    def get_rating(self, rating_id):
        return self.rating_repository.get_by_id(rating_id)

    def filter_ratings(
        self,
        filters: RatingFilterCriteria,
        paginate: bool = True,
    ) -> RatingSearchResult:
        ratings = self.rating_repository.filter(filters)

        if paginate:
            return self._paginated_result(ratings, filters)

        return RatingSearchResult(
            items=list(ratings),
            pagination=self._empty_pagination_metadata(ratings.count()),
            applied_filters=filters.model_dump(by_alias=True),
        )

    def update_rating(self, rating: Rating, update_data: RatingPutParams | RatingPatchParams):
        return self.rating_repository.update(rating, update_data)

    def delete_rating(self, rating_id):
        rating = self.rating_repository.get_by_id(rating_id)
        self.rating_repository.delete(rating)

    def _paginated_result(
        self, ratings: QuerySet[Rating], criteria: RatingFilterCriteria
    ) -> RatingSearchResult:
        page_size = criteria.page_size or DEFAULT_PAGE_SIZE
        obj_list, metadata = self.paginator.process(ratings, criteria.page, page_size)

        return RatingSearchResult(
            items=obj_list,
            pagination=metadata,
            applied_filters=criteria.model_dump(by_alias=True),
        )

    def _empty_pagination_metadata(self, ratings_count: int) -> PaginationMetadata:
        return PaginationMetadata(
            total=ratings_count,
            page=1,
            page_size=ratings_count,
            total_pages=1,
        )
