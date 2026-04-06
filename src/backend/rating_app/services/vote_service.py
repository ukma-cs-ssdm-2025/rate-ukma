from rateukma.protocols import implements
from rateukma.protocols.generic import IEventListener, IObservable
from rating_app.application_schemas.rating import Rating as RatingDTO
from rating_app.application_schemas.rating_vote import RatingVote as RatingVoteDTO
from rating_app.application_schemas.rating_vote import RatingVoteCreateSchema
from rating_app.exception.vote_exceptions import (
    VoteOnOwnRatingException,
    VoteOnRatingBeforeMidterm,
    VoteOnUnenrolledCourseException,
)
from rating_app.repositories import (
    EnrollmentRepository,
    RatingRepository,
    RatingVoteMapper,
    RatingVoteRepository,
)
from rating_app.services import CourseOfferingService, RatingService, SemesterService


class RatingFeedbackService(IObservable[RatingVoteDTO]):
    def __init__(
        self,
        vote_repository: RatingVoteRepository,
        enrollment_repository: EnrollmentRepository,
        rating_repository: RatingRepository,
        rating_service: RatingService,
        course_offering_service: CourseOfferingService,
        semester_service: SemesterService,
        vote_mapper: RatingVoteMapper,
    ):
        self.vote_repository = vote_repository
        self.enrollment_repository = enrollment_repository
        self.rating_repository = rating_repository
        self.rating_service = rating_service
        self.course_offering_service = course_offering_service
        self.semester_service = semester_service
        self.vote_mapper = vote_mapper
        self._listeners: list[IEventListener[RatingVoteDTO]] = []

    @implements
    def notify(self, event: RatingVoteDTO, *args, **kwargs) -> None:
        for listener in self._listeners:
            listener.on_event(event, *args, **kwargs)

    @implements
    def add_observer(self, observer: IEventListener[RatingVoteDTO]) -> None:
        self._listeners.append(observer)

    def upsert(self, params: RatingVoteCreateSchema) -> tuple[RatingVoteDTO, bool]:
        rating = self.rating_repository.get_by_id(params.rating_id)
        self._assert_student_can_vote_on_rating(rating, params.student_id)

        existing = self.vote_repository.get_vote_by_student_and_rating(
            student_id=params.student_id, rating_id=params.rating_id
        )

        db_vote_type = self.vote_mapper.to_db(params.vote_type)
        if existing and existing.vote_type == db_vote_type:
            return existing, False

        vote = (
            self.vote_repository.update(existing, type=db_vote_type)
            if existing
            else self.vote_repository.create_vote(params)
        )

        self.notify(vote)
        return vote, not existing

    def delete_vote_by_student(self, student_id: str, rating_id: str) -> None:
        vote = self.vote_repository.get_vote_by_student_and_rating(
            student_id=student_id, rating_id=rating_id
        )
        if vote:
            self.vote_repository.delete(str(vote.id))
            self.notify(vote)

    def get_votes_by_rating_id(self, rating_id: str) -> list[RatingVoteDTO]:
        return self.vote_repository.get_by_rating_id(rating_id)

    def get_vote_for_student(self, student_id: str, rating_id: str) -> RatingVoteDTO | None:
        return self.vote_repository.get_vote_by_student_and_rating(
            student_id=student_id, rating_id=rating_id
        )

    def _is_enrolled_in_the_rating_course(self, rating: RatingDTO, student_id: str) -> bool:
        return self.enrollment_repository.is_student_enrolled_in_course(
            student_id=student_id, course_id=str(rating.course)
        )

    def _owns_rating(self, rating: RatingDTO, student_id: str) -> bool:
        if rating.student_id is None:
            return False
        return str(rating.student_id) == student_id

    def _assert_student_can_vote_on_rating(self, rating: RatingDTO, student_id: str) -> None:
        course_offering = self.course_offering_service.get_course_offering(
            str(rating.course_offering)
        )
        semester = self.semester_service.get_by_id(str(course_offering.semester_id))
        if not self.rating_service.is_semester_open_for_rating(semester):
            raise VoteOnRatingBeforeMidterm()

        if not self._is_enrolled_in_the_rating_course(rating, student_id):
            raise VoteOnUnenrolledCourseException(
                "A student must be enrolled in the course to vote on its rating"
            )

        if self._owns_rating(rating, student_id):
            raise VoteOnOwnRatingException("Students cannot vote on their own rating")
