from rateukma.protocols import implements
from rateukma.protocols.generic import IEventListener, IObservable
from rating_app.application_schemas.rating import Rating as RatingDTO
from rating_app.application_schemas.rating_vote import RatingVoteCreateSchema
from rating_app.exception.vote_exceptions import (
    VoteOnOwnRatingException,
    VoteOnUnenrolledCourseException,
)
from rating_app.models import RatingVote
from rating_app.repositories import (
    EnrollmentRepository,
    RatingRepository,
    RatingVoteMapper,
    RatingVoteRepository,
)


class RatingFeedbackService(IObservable[RatingVote]):
    def __init__(
        self,
        vote_repository: RatingVoteRepository,
        enrollment_repository: EnrollmentRepository,
        rating_repository: RatingRepository,
        vote_mapper: RatingVoteMapper,
    ):
        self.vote_repository = vote_repository
        self.enrollment_repository = enrollment_repository
        self.rating_repository = rating_repository
        self.vote_mapper = vote_mapper
        self._listeners: list[IEventListener[RatingVote]] = []

    @implements
    def notify(self, event: RatingVote, *args, **kwargs) -> None:
        for listener in self._listeners:
            listener.on_event(event, *args, **kwargs)

    @implements
    def add_observer(self, listener: IEventListener[RatingVote]) -> None:
        self._listeners.append(listener)

    def upsert(self, params: RatingVoteCreateSchema) -> tuple[RatingVote, bool]:
        rating = self.rating_repository.get_by_id(params.rating_id)
        self._assert_student_can_vote_on_rating(rating, params.student_id)

        existing = self.vote_repository.get_vote_by_student_and_rating(
            student_id=params.student_id, rating_id=params.rating_id
        )

        db_vote_type = self.vote_mapper.to_db(params.vote_type)
        if existing and existing.type == db_vote_type:
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
            self.vote_repository.delete(vote)
            self.notify(vote)

    def get_votes_by_rating_id(self, rating_id: str) -> list[RatingVote]:
        return self.vote_repository.get_by_rating_id(rating_id)

    def get_vote_for_student(self, student_id: str, rating_id: str) -> RatingVote | None:
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
        if not self._is_enrolled_in_the_rating_course(rating, student_id):
            raise VoteOnUnenrolledCourseException(
                "A student must be enrolled in the course to vote on its rating"
            )

        if self._owns_rating(rating, student_id):
            raise VoteOnOwnRatingException("Students cannot vote on their own rating")
