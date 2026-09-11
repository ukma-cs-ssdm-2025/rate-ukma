from rateukma.protocols import implements
from rateukma.protocols.generic import IEventListener
from rating_app.models import Rating
from rating_app.services.feed_update_service import FeedUpdateService
from rating_app.services.rating_events import RatingAction, RatingEvent


class RatingFeedUpdateObserver(IEventListener[RatingEvent]):
    def __init__(self, feed_update_service: FeedUpdateService) -> None:
        self.feed_update_service = feed_update_service

    @implements
    def on_event(self, event: RatingEvent, *args, **kwargs) -> None:
        if event.action == RatingAction.DELETED:
            self.feed_update_service.remove(Rating, event.rating.id)
            return

        self.feed_update_service.sync_rating(event.rating)
