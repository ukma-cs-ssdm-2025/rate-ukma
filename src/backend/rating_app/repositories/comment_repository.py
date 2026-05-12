from typing import Any, Literal, overload

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import DataError
from django.db.models import Count, Prefetch, QuerySet

import structlog

from rateukma.protocols import IProcessor
from rating_app.application_schemas.comment import (
    CommentCreateParams,
    CommentDTO,
    CommentFilterCriteria,
    CommentPatchParams,
    CommentPutParams,
)
from rating_app.application_schemas.pagination import PaginationFilters, PaginationResult
from rating_app.exception.comment_exception import (
    CommentNotFoundError,
    InvalidCommentIdentifierError,
)
from rating_app.models import Comment
from rating_app.pagination import GenericQuerysetPaginator
from rating_app.repositories.protocol import IPaginatedRepository

logger = structlog.get_logger(__name__)


class CommentRepository(
    IPaginatedRepository[CommentDTO, Comment, CommentFilterCriteria, CommentCreateParams]
):
    def __init__(
        self,
        mapper: IProcessor[[Comment], CommentDTO],
        paginator: GenericQuerysetPaginator[Comment],
    ):
        self.mapper = mapper
        self.paginator = paginator

    def get_all(self) -> list[CommentDTO]:
        comments = self._build_base_queryset().all()
        return self._map_to_domain_models(comments)

    def get_by_id(self, id: str) -> CommentDTO:
        try:
            comment = self._build_base_queryset().get(pk=id)
        except Comment.DoesNotExist as err:
            raise CommentNotFoundError() from err
        except (DjangoValidationError, ValueError, TypeError, DataError) as err:
            raise InvalidCommentIdentifierError(id) from err

        return self._map_to_domain_model(comment)

    @overload
    def get_or_create(
        self,
        data: CommentCreateParams,
        *,
        return_model: Literal[False] = ...,
    ) -> tuple[CommentDTO, bool]: ...

    @overload
    def get_or_create(
        self,
        data: CommentCreateParams,
        *,
        return_model: Literal[True],
    ) -> tuple[Comment, bool]: ...

    def get_or_create(
        self,
        data: CommentCreateParams,
        *,
        return_model: bool = False,
    ) -> tuple[CommentDTO, bool] | tuple[Comment, bool]:
        comment, created = self._save_or_create_comment(data, upsert=False)

        if return_model:
            return comment, created
        return self._map_to_domain_model(comment), created

    @overload
    def get_or_upsert(
        self,
        data: CommentCreateParams,
        *,
        return_model: Literal[False] = ...,
    ) -> tuple[CommentDTO, bool]: ...

    @overload
    def get_or_upsert(
        self,
        data: CommentCreateParams,
        *,
        return_model: Literal[True],
    ) -> tuple[Comment, bool]: ...

    def get_or_upsert(
        self,
        data: CommentCreateParams,
        *,
        return_model: bool = False,
    ) -> tuple[CommentDTO, bool] | tuple[Comment, bool]:
        comment, created = self._save_or_create_comment(data, upsert=True)

        if return_model:
            return comment, created
        return self._map_to_domain_model(comment), created

    def _build_comment_values(self, data: CommentCreateParams) -> dict[str, Any]:
        return {
            "user_id": data.user,
            "content": data.content,
            "rating_id": data.rating,
            "parent_comment_id": data.parent_comment,
            "is_anonymous": data.is_anonymous,
            "created_at": data.created_at,
        }

    def _refetch_comment(self, comment_id: str) -> Comment:
        return self._build_base_queryset().get(pk=comment_id)

    def _save_or_create_comment(
        self,
        data: CommentCreateParams,
        *,
        upsert: bool,
    ) -> tuple[Comment, bool]:
        values = self._build_comment_values(data)

        try:
            comment = Comment.objects.get(pk=data.id)
        except Comment.DoesNotExist:
            comment = Comment.objects.create(id=data.id, **values)
            return self._refetch_comment(str(comment.pk)), True

        if upsert:
            for field_name, field_value in values.items():
                if field_name == "created_at":
                    continue
                setattr(comment, field_name, field_value)
            comment.save()

        return self._refetch_comment(str(comment.pk)), False

    def create(
        self,
        create_params: CommentCreateParams,
    ) -> CommentDTO:
        comment = Comment.objects.create(
            user_id=create_params.user,
            content=create_params.content,
            rating_id=create_params.rating,
            parent_comment_id=create_params.parent_comment,
            is_anonymous=create_params.is_anonymous,
            created_at=create_params.created_at,
        )

        # Refetch with related fields for mapper
        comment = self._build_base_queryset().get(pk=comment.pk)
        return self._map_to_domain_model(comment)

    def delete(self, id: str) -> None:
        comment_model = self._get_by_id_shallow(id)
        comment_model.delete()
        logger.info("comment_deleted", comment_id=id)

    def update(
        self,
        comment: CommentDTO,
        update_data: CommentPutParams | CommentPatchParams,
    ) -> CommentDTO:
        comment_model = self._get_by_id_shallow(str(comment.id))
        values = update_data.model_dump(exclude_unset=True, exclude_none=True)
        if not values:
            return self._map_to_domain_model(self._refetch_comment(str(comment_model.pk)))

        for field_name, field_value in values.items():
            setattr(comment_model, field_name, field_value)

        comment_model.save(update_fields=list(values))
        return self._map_to_domain_model(self._refetch_comment(str(comment_model.pk)))

    @overload
    def filter(
        self,
        criteria: CommentFilterCriteria,
        pagination: PaginationFilters,
    ) -> PaginationResult[CommentDTO]: ...

    @overload
    def filter(
        self,
        criteria: CommentFilterCriteria,
        pagination: None = ...,
    ) -> list[CommentDTO]: ...

    def filter(
        self,
        criteria: CommentFilterCriteria,
        pagination: PaginationFilters | None = None,
    ) -> PaginationResult[CommentDTO] | list[CommentDTO]:
        qs = self._filter(criteria)

        if pagination is not None:
            result = self.paginator.process(qs, pagination)
            dtos = [self.mapper.process(model) for model in result.page_objects]
            return PaginationResult(
                page_objects=dtos,
                metadata=result.metadata,
            )

        return self._map_to_domain_models(qs)

    def _filter(
        self,
        criteria: CommentFilterCriteria,
    ) -> QuerySet[Comment]:
        comments = self._build_base_queryset()
        comments = self._apply_filters(comments, criteria)
        return comments

    def _build_base_queryset(self) -> QuerySet[Comment]:
        return (
            Comment.objects.select_related(
                "user",
                "user__student_profile",
            )
            .prefetch_related(
                Prefetch(
                    "comments",
                    queryset=Comment.objects.select_related(
                        "user", "user__student_profile"
                    ).order_by("created_at", "id"),
                    to_attr="reply_preview_comments",
                )
            )
            .annotate(replies_count=Count("comments", distinct=True))
        )

    def _apply_filters(
        self,
        queryset: QuerySet[Comment],
        filters: CommentFilterCriteria,
    ) -> QuerySet[Comment]:
        query_filters = self._build_query_filters(filters)
        return queryset.filter(**query_filters).order_by("created_at", "id")

    def _build_query_filters(self, criteria: CommentFilterCriteria) -> dict[str, Any]:
        criteria_dict = criteria.model_dump(
            exclude_none=True,
            exclude={
                "page",
                "page_size",
            },
        )

        query_filters: dict[str, Any] = {}

        if "rating_id" in criteria_dict:
            query_filters["rating_id"] = criteria_dict["rating_id"]
            query_filters["parent_comment__isnull"] = True
        elif "comment_id" in criteria_dict:
            query_filters["parent_comment"] = criteria_dict["comment_id"]

        return query_filters

    def _map_to_domain_models(self, models: QuerySet[Comment]) -> list[CommentDTO]:
        return [self._map_to_domain_model(model) for model in models]

    def _map_to_domain_model(self, model: Comment) -> CommentDTO:
        return self.mapper.process(model)

    def _get_by_id_shallow(self, comment_id: str) -> Comment:
        try:
            return Comment.objects.get(pk=comment_id)
        except Comment.DoesNotExist as exc:
            logger.warning("comment_not_found", comment_id=comment_id, error=str(exc))
            raise CommentNotFoundError(comment_id) from exc
        except (ValueError, TypeError, DataError) as exc:
            logger.warning("invalid_comment_identifier", comment_id=comment_id, error=str(exc))
            raise InvalidCommentIdentifierError(comment_id) from exc
