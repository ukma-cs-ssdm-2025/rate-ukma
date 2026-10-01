from rateukma.protocols import implements
from rateukma.protocols.generic import IEventListener
from rating_app.services.comment_events import CommentAction, CommentEvent
from rating_app.services.feed_update_service import FeedUpdateService
from rating_app.services.rating_events import RatingAction, RatingEvent


class RatingFeedUpdateObserver(IEventListener[RatingEvent]):
    def __init__(self, feed_update_service: FeedUpdateService) -> None:
        self.feed_update_service = feed_update_service

    @implements
    def on_event(self, event: RatingEvent, *args, **kwargs) -> None:
        # Deletion cascades through `Rating.feed_events`; nothing to do here.
        if event.action == RatingAction.DELETED:
            return

        self.feed_update_service.sync_rating(event.rating)


class CommentFeedUpdateObserver(IEventListener[CommentEvent]):
    def __init__(self, feed_update_service: FeedUpdateService) -> None:
        self.feed_update_service = feed_update_service

    @implements
    def on_event(self, event: CommentEvent, *args, **kwargs) -> None:
        # Deletion cascades through `Comment.feed_events`; nothing to do here.
        if event.action == CommentAction.DELETED:
            return

        self.feed_update_service.sync_comment(event.comment)
