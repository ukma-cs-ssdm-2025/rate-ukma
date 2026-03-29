import structlog

from rateukma.protocols import implements
from rateukma.protocols.generic import IEventListener
from rating_app.application_schemas.rating_vote import RatingVote as RatingVoteDTO
from rating_app.exception.student_exceptions import StudentNotFoundError
from rating_app.models.choices import NotificationEventType, RatingVoteType
from rating_app.models.rating_vote import RatingVote as RatingVoteModel
from rating_app.repositories import RatingRepository, StudentRepository
from rating_app.services.notification_service import NotificationService

logger = structlog.get_logger(__name__)


VOTE_TYPE_TO_EVENT: dict[int, NotificationEventType] = {
    RatingVoteType.UPVOTE: NotificationEventType.RATING_UPVOTED,
    RatingVoteType.DOWNVOTE: NotificationEventType.RATING_DOWNVOTED,
}


class VoteNotificationObserver(IEventListener[RatingVoteDTO]):
    def __init__(
        self,
        notification_service: NotificationService,
        rating_repository: RatingRepository,
        student_repository: StudentRepository,
    ) -> None:
        self.notification_service = notification_service
        self.rating_repository = rating_repository
        self.student_repository = student_repository

    @implements
    def on_event(self, event: RatingVoteDTO, *args, **kwargs) -> None:
        rating = self.rating_repository.get_by_id(str(event.rating_id))
        if rating.student_id is None:
            return

        if self._is_self_vote(event, rating.student_id):
            return

        event_type = VOTE_TYPE_TO_EVENT.get(event.vote_type)
        if event_type is None:
            logger.warning("unknown_type", vote_type=event.vote_type)
            return

        recipient_user_id = self._get_user_id(rating.student_id)
        if recipient_user_id is None:
            logger.warning("recipient_not_found", student_id=str(rating.student_id))
            return

        actor_user_id = self._get_user_id(event.student_id)

        # we remove prior notifications from this actor for this rating
        # so toggling upvote-downvote doesn't inflate the count
        if actor_user_id is not None:
            self.notification_service.delete_actor_notifications_for_rating(
                recipient_id=recipient_user_id,
                actor_id=actor_user_id,
                rating_id=str(event.rating_id),
            )

        self.notification_service.create_notification(
            recipient_id=recipient_user_id,
            event_type=event_type,
            group_key=self._build_group_key(event_type, event.rating_id),
            source_model=RatingVoteModel,
            source_id=str(event.id),
            actor_id=actor_user_id,
        )

    def _is_self_vote(self, event: RatingVoteDTO, rating_student_id) -> bool:
        return str(event.student_id) == str(rating_student_id)

    def _build_group_key(self, event_type: str, rating_id) -> str:
        return f"{event_type}:{rating_id}"

    def _get_user_id(self, student_id) -> int | None:
        try:
            return self.student_repository.get_by_id(str(student_id)).user_id
        except StudentNotFoundError:
            return None
