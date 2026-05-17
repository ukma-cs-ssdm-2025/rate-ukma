from rateukma.caching.cache_manager import ICacheManager
from rateukma.caching.patterns import (
    comment_replies_namespace,
    course_analytics_namespace,
    course_detail_namespace,
    course_ratings_namespace,
    rating_comments_namespace,
    student_ratings_namespace,
)
from rateukma.protocols import implements
from rateukma.protocols.generic import IEventListener
from rating_app.application_schemas.rating import Rating as RatingDTO
from rating_app.application_schemas.rating_vote import RatingVote as RatingVoteDTO
from rating_app.exception.comment_exception import (
    CommentNotFoundError,
    InvalidCommentIdentifierError,
)
from rating_app.repositories import CommentRepository, RatingRepository
from rating_app.services.comment_events import CommentAction, CommentEvent

# TODO: implement a generic cache invalidator with patterns


class RatingCacheInvalidator(IEventListener[RatingDTO]):
    def __init__(self, cache_manager: ICacheManager):
        self.cache_manager = cache_manager

    @implements
    def on_event(self, event: RatingDTO, *args, **kwargs) -> None:
        course_id = str(event.course)
        self.cache_manager.bump_version(course_detail_namespace(course_id))
        self.cache_manager.bump_version(course_analytics_namespace(course_id))
        self.cache_manager.bump_version(course_ratings_namespace(course_id))
        if event.student_id is not None:
            self.cache_manager.bump_version(student_ratings_namespace(str(event.student_id)))


class RatingVoteCacheInvalidator(IEventListener[RatingVoteDTO]):
    def __init__(self, cache_manager: ICacheManager, rating_repository: RatingRepository):
        self.cache_manager = cache_manager
        self.rating_repository = rating_repository

    @implements
    def on_event(self, event: RatingVoteDTO, *args, **kwargs) -> None:
        rating = self.rating_repository.get_by_id(str(event.rating_id))
        course_id = str(rating.course)
        self.cache_manager.bump_version(course_ratings_namespace(course_id))


class CommentCacheInvalidator(IEventListener[CommentEvent]):
    def __init__(
        self,
        cache_manager: ICacheManager,
        comment_repository: CommentRepository,
    ):
        self.cache_manager = cache_manager
        self.comment_repository = comment_repository

    @implements
    def on_event(self, event: CommentEvent, *args, **kwargs) -> None:
        comment = event.comment
        self.cache_manager.bump_version(rating_comments_namespace(str(comment.rating_id)))
        self.cache_manager.bump_version(comment_replies_namespace(str(comment.id)))
        if comment.parent_id is not None:
            self.cache_manager.bump_version(comment_replies_namespace(str(comment.parent_id)))
            if event.action in (CommentAction.CREATED, CommentAction.DELETED):
                self._bump_parent_container_replies_namespace(str(comment.parent_id))

        self.cache_manager.bump_version(course_ratings_namespace(str(comment.course_id)))

    def _bump_parent_container_replies_namespace(self, parent_id: str) -> None:
        try:
            parent = self.comment_repository.get_by_id(parent_id)
        except (CommentNotFoundError):
            return

        if parent.parent_id is not None:
            self.cache_manager.bump_version(comment_replies_namespace(str(parent.parent_id)))
