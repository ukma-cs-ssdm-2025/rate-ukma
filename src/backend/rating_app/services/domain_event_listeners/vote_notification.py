import structlog

from rateukma.protocols import implements
from rateukma.protocols.generic import IEventListener
from rating_app.application_schemas.rating_vote import RatingVote as RatingVoteDTO
from rating_app.models.choices import NotificationEventType, RatingVoteType
from rating_app.models.rating_vote import RatingVote as RatingVoteModel
from rating_app.repositories import RatingRepository
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
    ) -> None:
        self._notification_service = notification_service
        self._rating_repository = rating_repository

    @implements
    def on_event(self, event: RatingVoteDTO, *args, **kwargs) -> None:
        rating = self._rating_repository.get_by_id(str(event.rating_id))

        if rating.student_id is None:
            return

        if self._is_self_vote(event, rating.student_id):
            return

        event_type = VOTE_TYPE_TO_EVENT.get(event.vote_type)
        if event_type is None:
            logger.warning(
                "unknown_vote_type_for_notification",
                vote_type=event.vote_type,
            )
            return

        recipient_user_id = self._resolve_recipient_user_id(rating.student_id)
        if recipient_user_id is None:
            return

        actor_user_id = self._resolve_actor_user_id(event.student_id)

        self._notification_service.create_notification(
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

    def _resolve_recipient_user_id(self, student_id) -> int | None:
        from rating_app.models import Student

        try:
            student = Student.objects.get(pk=student_id)
            return student.user_id
        except Student.DoesNotExist:
            logger.warning(
                "notification_recipient_student_not_found",
                student_id=str(student_id),
            )
            return None

    def _resolve_actor_user_id(self, student_id) -> int | None:
        from rating_app.models import Student

        try:
            student = Student.objects.get(pk=student_id)
            return student.user_id
        except Student.DoesNotExist:
            return None
