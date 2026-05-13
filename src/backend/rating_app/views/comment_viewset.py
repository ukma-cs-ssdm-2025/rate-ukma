from rest_framework import status, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

import structlog
from drf_spectacular.utils import OpenApiParameter, extend_schema
from pydantic import ValidationError as ModelValidationError

from rating_app.application_schemas.comment import (
    CommentCreateParams,
    CommentCreateRequest,
    CommentDTO,
    CommentFilterCriteria,
    CommentFilterParams,
    CommentListQueryParams,
    CommentPatchParams,
    CommentPathParams,
    CommentPutParams,
    CommentReplyFilterParams,
)
from rating_app.ioc_container.common import pydantic_to_openapi_request_mapper
from rating_app.serializers import CommentListSerializer, CommentReadSerializer
from rating_app.services.comment_service import CommentService
from rating_app.views.decorators import require_comment_ownership
from rating_app.views.responses import R_COMMENT, R_COMMENT_CREATE, R_COMMENT_LIST, R_NO_CONTENT

logger = structlog.get_logger(__name__)
to_openapi = pydantic_to_openapi_request_mapper().map


@extend_schema(tags=["comments"])
class CommentViewset(viewsets.ViewSet):
    comment_service: CommentService | None = None

    @extend_schema(
        summary="List comments for a rating",
        description="List comments for a specific rating with pagination.",
        parameters=[
            *to_openapi((CommentListQueryParams, OpenApiParameter.QUERY)),
            *to_openapi((CommentFilterParams, OpenApiParameter.PATH)),
        ],
        responses=R_COMMENT_LIST,
    )
    def list(self, request, rating_id: str) -> Response:
        assert self.comment_service is not None

        try:
            query_params = CommentListQueryParams(**request.query_params.dict())

            filter_data = {
                **query_params.model_dump(),
                "rating_id": rating_id,
            }

            filters = CommentFilterCriteria.model_validate(filter_data)

        except ModelValidationError as e:
            logger.error("validation_error", errors=e.errors())
            raise ValidationError(detail=e.errors()) from e

        result = self.comment_service.filter_comments(filters)

        payload = CommentListSerializer(
            {
                "items": result.items,
                "filters": result.applied_filters,
                **result.pagination.model_dump(),
            },
        )

        return Response(payload.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="List replies for a comment",
        description="List comments for a specific comment with pagination.",
        parameters=[
            *to_openapi((CommentListQueryParams, OpenApiParameter.QUERY)),
            *to_openapi((CommentReplyFilterParams, OpenApiParameter.PATH)),
        ],
        responses=R_COMMENT_LIST,
    )
    def list_replies(self, request, comment_id: str) -> Response:
        assert self.comment_service is not None

        try:
            query_params = CommentListQueryParams(**request.query_params.dict())

            filter_data = {
                **query_params.model_dump(),
                "comment_id": comment_id,
            }

            filters = CommentFilterCriteria.model_validate(filter_data)

        except ModelValidationError as e:
            logger.error("validation_error", errors=e.errors())
            raise ValidationError(detail=e.errors()) from e

        result = self.comment_service.filter_comments(filters)

        payload = CommentListSerializer(
            {
                "items": result.items,
                "filters": result.applied_filters,
                **result.pagination.model_dump(),
            },
        )

        return Response(payload.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Create a new comment",
        description=(
            "Create a new comment for either a rating or reply to another comment"
            "The user is automatically determined from the authenticated user."
        ),
        request=CommentCreateRequest,
        responses=R_COMMENT_CREATE,
    )
    def create(self, request, rating_id: str | None = None) -> Response:
        assert self.comment_service is not None

        try:
            request_params = CommentCreateRequest.model_validate(request.data)
            comment_params = CommentCreateParams.model_validate(
                {
                    **request_params.model_dump(),
                    "rating_id": rating_id,
                    "user_id": request.user.id,
                }
            )
        except ModelValidationError as e:
            logger.error("validation_error", errors=e.errors())
            raise ValidationError(detail=e.errors()) from e

        comment = self.comment_service.create_comment(comment_params)
        logger.info(
            "comment_created",
            comment_id=str(comment.id),
            parent_comment=str(comment.parent_id),
            user_id=str(comment.user_id),
        )
        response_serializer = CommentReadSerializer(comment)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    @extend_schema(
        summary="Update a comment",
        description="Update an existing comment. Only the owner can update their comment.",
        parameters=[*to_openapi((CommentPathParams, OpenApiParameter.PATH))],
        request=CommentPutParams,
        responses=R_COMMENT,
    )
    @require_comment_ownership
    def update(self, request, comment: CommentDTO, **kwargs) -> Response:
        assert self.comment_service is not None
        comment_service = self.comment_service

        try:
            update_params = CommentPutParams.model_validate(request.data)
        except ModelValidationError as e:
            raise ValidationError(detail=e.errors()) from e

        updated_comment = comment_service.update_comment(comment, update_params)
        response_serializer = CommentReadSerializer(updated_comment)
        return Response(response_serializer.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Partially update a comment",
        description="Partially update an existing comment. "
        "Only the owner can update their comment.",
        parameters=[*to_openapi((CommentPathParams, OpenApiParameter.PATH))],
        request=CommentPatchParams,
        responses=R_COMMENT,
    )
    @require_comment_ownership
    def partial_update(self, request, comment: CommentDTO, **kwargs) -> Response:
        assert self.comment_service is not None
        comment_service = self.comment_service

        try:
            update_params = CommentPatchParams.model_validate(request.data)
        except ModelValidationError as e:
            raise ValidationError(detail=e.errors()) from e

        updated_comment = comment_service.update_comment(comment, update_params)
        response_serializer = CommentReadSerializer(updated_comment)
        return Response(response_serializer.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Delete a comment",
        description="Delete a comment. "
        "Only the owner can delete a comment. Replies are deleted recursively.",
        parameters=[*to_openapi((CommentPathParams, OpenApiParameter.PATH))],
        responses=R_NO_CONTENT,
    )
    @require_comment_ownership
    def destroy(self, request, comment: CommentDTO, **kwargs) -> Response:
        assert self.comment_service is not None
        comment_service = self.comment_service

        comment_service.delete_comment(comment)

        return Response(status=status.HTTP_204_NO_CONTENT)
