from rating_app.application_schemas.rating_vote import RatingVoteCreateSchema
from rating_app.exception.vote_exceptions import (
    DeleteVoteOnUnenrolledCourseException,
    VoteOnUnenrolledCourseException,
)
from rating_app.models import RatingVote
from rating_app.repositories import (
    CourseOfferingRepository,
    EnrollmentRepository,
    RatingRepository,
    RatingVoteRepository,
    StudentRepository,
)


class RatingFeedbackService:
    def __init__(
        self,
        vote_repository: RatingVoteRepository,
        student_repository: StudentRepository,
        enrollment_repository: EnrollmentRepository,
        course_offering_repository: CourseOfferingRepository,
        rating_repository: RatingRepository,
    ):
        self.vote_repository = vote_repository
        self.student_repository = student_repository
        self.enrollment_repository = enrollment_repository
        self.course_offering_repository = course_offering_repository
        self.rating_repository = rating_repository

    def create(self, params: RatingVoteCreateSchema) -> RatingVote:
        if not self._can_vote(params.rating_id, params.student_id):
            raise VoteOnUnenrolledCourseException(
                "A student must be enrolled in the course to vote on its rating"
            )

        existing = self.vote_repository.get_vote_by_student_and_rating(
            student_id=params.student_id, rating_id=params.rating_id
        )

        if existing:
            if existing.type == params.vote_type:
                return existing
            return self.vote_repository.update(existing, type=params.vote_type)

        return self.vote_repository.create_vote(params)

    def delete_vote_by_student(self, student_id: str, rating_id: str) -> None:
        if not self._can_vote(rating_id, student_id):
            raise DeleteVoteOnUnenrolledCourseException(
                "A student must be enrolled in the course to delete a vote on its rating"
            )

        vote = self.vote_repository.get_vote_by_student_and_rating(
            student_id=student_id, rating_id=rating_id
        )
        if vote:
            self.vote_repository.delete(vote)

    def get_votes_by_rating_id(self, rating_id: str) -> list[RatingVote]:
        return self.vote_repository.get_by_rating_id(rating_id)

    def get_vote_for_student(self, student_id: str, rating_id: str) -> RatingVote | None:
        return self.vote_repository.get_vote_by_student_and_rating(
            student_id=student_id, rating_id=rating_id
        )

    def update_vote(self, vote: RatingVote, **kwargs) -> RatingVote:
        return self.vote_repository.update(vote, **kwargs)

    def _can_vote(self, rating_id: str, student_id: str) -> bool:
        rating = self.rating_repository.get_by_id(rating_id)
        return self.enrollment_repository.is_student_enrolled(
            offering_id=str(rating.course_offering.id), student_id=student_id
        )
