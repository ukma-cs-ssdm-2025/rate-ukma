from typing import Any

from rateukma.caching.decorators import rcached
from rateukma.caching.patterns import comment_replies_namespace, rating_comments_namespace
from rateukma.protocols import implements
from rateukma.protocols.generic import IEventListener, IObservable
from rating_app.application_schemas.comment import (
    CommentCreateParams,
    CommentDTO,
    CommentFilterCriteria,
    CommentPatchParams,
    CommentPutParams,
    CommentSearchResult,
)
from rating_app.application_schemas.pagination import PaginationFilters, PaginationMetadata
from rating_app.exception.comment_exception import CommentParentRatingMismatchError
from rating_app.repositories.comment_repository import CommentRepository
from rating_app.services.comment_events import CommentAction, CommentEvent
from rating_app.services.comment_normalizer import CommentNormalizer


def _comments_namespace(
    _self,
    filters: CommentFilterCriteria,
    paginate: bool = True,
) -> str | None:
    if filters.rating_id is not None:
        return rating_comments_namespace(str(filters.rating_id))
    if filters.comment_id is not None:
        return comment_replies_namespace(str(filters.comment_id))
    return None


class CommentService(IObservable[CommentEvent]):
    def __init__(
        self,
        comment_repository: CommentRepository,
        comment_normalizer: CommentNormalizer,
    ) -> None:
        self.comment_repository = comment_repository
        self.comment_normalizer = comment_normalizer
        self._listeners: list[IEventListener[CommentEvent]] = []

    @implements
    def notify(self, event: CommentEvent, *args, **kwargs) -> None:
        for listener in self._listeners:
            listener.on_event(event, *args, **kwargs)

    @implements
    def add_observer(self, observer: IEventListener[CommentEvent]) -> None:
        self._listeners.append(observer)

    def create_comment(self, params: CommentCreateParams) -> CommentDTO:
        self._validate_parent_comment_matches_rating(params)
        params.content = self.comment_normalizer.normalize_comment(params.content)
        comment = self.comment_repository.create(params)
        self._notify_comment(comment, CommentAction.CREATED)
        return self._with_manage_permission(comment, params.user_id)

    def get_comment(self, comment_id: str) -> CommentDTO:
        return self.comment_repository.get_by_id(comment_id)

    def delete_comment(self, comment: CommentDTO) -> None:
        self.comment_repository.delete(str(comment.id))
        self._notify_comment(comment, CommentAction.DELETED)

    def update_comment(
        self,
        comment: CommentDTO,
        update_data: CommentPutParams | CommentPatchParams,
    ) -> CommentDTO:
        if update_data.content is not None:
            update_data.content = self.comment_normalizer.normalize_comment(update_data.content)

        updated_comment = self.comment_repository.update(comment, update_data)
        self._notify_comment(updated_comment, CommentAction.UPDATED)
        return self._with_manage_permission(updated_comment, updated_comment.user_id)

    def _notify_comment(self, comment: CommentDTO, action: CommentAction) -> None:
        self.notify(CommentEvent(comment=comment, action=action))

    def _validate_parent_comment_matches_rating(self, params: CommentCreateParams) -> None:
        if params.parent_comment is None:
            return

        parent = self.comment_repository.get_by_id(str(params.parent_comment))
        if parent.rating_id != params.rating_id:
            raise CommentParentRatingMismatchError()

    @rcached(ttl=300, versioned_by=_comments_namespace)
    def filter_comments(
        self,
        filters: CommentFilterCriteria,
        paginate: bool = True,
    ) -> CommentSearchResult:
        if paginate:
            pagination_filters = PaginationFilters(
                page=filters.page,
                page_size=filters.page_size,
            )
            pagination_result = self.comment_repository.filter(filters, pagination_filters)
            comments = pagination_result.page_objects
            metadata = pagination_result.metadata
        else:
            comments = self.comment_repository.filter(filters)
            metadata = self._create_single_page_metadata(len(comments))

        comments = [
            self._with_manage_permission(comment, filters.viewer_user_id) for comment in comments
        ]

        return CommentSearchResult(
            items=comments,
            pagination=metadata,
            applied_filters=self._format_applied_filters(filters),
        )

    def _create_single_page_metadata(self, total: int) -> PaginationMetadata:
        return PaginationMetadata(
            page=1,
            page_size=total,
            total=total,
            total_pages=1,
        )

    def _format_applied_filters(self, filters: CommentFilterCriteria) -> dict[str, Any]:
        return filters.model_dump(
            by_alias=True,
            exclude={"page", "page_size", "viewer_user_id"},
            exclude_none=True,
        )

    def _with_manage_permission(
        self,
        comment: CommentDTO,
        viewer_user_id: int | None,
    ) -> CommentDTO:
        return comment.model_copy(
            update={"can_manage": viewer_user_id is not None and comment.user_id == viewer_user_id}
        )
