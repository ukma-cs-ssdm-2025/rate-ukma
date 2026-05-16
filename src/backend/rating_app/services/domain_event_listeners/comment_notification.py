import structlog

from rateukma.protocols import implements
from rateukma.protocols.generic import IEventListener
from rating_app.exception.student_exceptions import StudentNotFoundError
from rating_app.models.choices import NotificationEventType
from rating_app.models.comment import Comment as CommentModel
from rating_app.repositories import RatingRepository, StudentRepository
from rating_app.services.comment_events import CommentAction, CommentEvent
from rating_app.services.notification_service import NotificationService

logger = structlog.get_logger(__name__)


class CommentNotificationObserver(IEventListener[CommentEvent]):
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
    def on_event(self, event: CommentEvent, *args, **kwargs) -> None:
        if event.action not in (CommentAction.CREATED, CommentAction.DELETED):
            return

        comment = event.comment
        rating = self.rating_repository.get_by_id(str(comment.rating_id))
        if rating.student_id is None:
            return

        recipient_user_id = self._get_user_id(rating.student_id)
        if recipient_user_id is None:
            logger.warning("recipient_not_found", student_id=str(rating.student_id))
            return

        event_type = NotificationEventType.RATING_COMMENT_CREATED

        if event.action == CommentAction.DELETED:
            self.notification_service.delete_notification_for_event_source(
                recipient_id=recipient_user_id,
                event_type=event_type,
                source_model=CommentModel,
                source_id=str(comment.id),
            )
            return

        if comment.user_id == recipient_user_id:
            return

        # ensure only one notification exists per comment (dedupe duplicate events)
        self.notification_service.delete_notification_for_event_source(
            recipient_id=recipient_user_id,
            event_type=event_type,
            source_model=CommentModel,
            source_id=str(comment.id),
        )

        self.notification_service.create_notification(
            recipient_id=recipient_user_id,
            event_type=event_type,
            group_key=self._build_group_key(event_type, comment.rating_id, comment.id),
            source_model=CommentModel,
            source_id=str(comment.id),
            actor_id=comment.user_id,
        )

    def _build_group_key(self, event_type: NotificationEventType, rating_id, comment_id) -> str:
        return f"{event_type.value}:{rating_id}:{comment_id}"

    def _get_user_id(self, student_id) -> int | None:
        try:
            return self.student_repository.get_by_id(str(student_id)).user_id
        except StudentNotFoundError:
            return None
