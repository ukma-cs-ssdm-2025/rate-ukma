from dataclasses import replace

from rest_framework import status, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

import structlog
from drf_spectacular.utils import OpenApiParameter, extend_schema
from pydantic import ValidationError as ModelValidationError

from rating_app.application_schemas.feed import FeedListQueryParams, FeedPage, FeedPromoItem
from rating_app.ioc_container.common import pydantic_to_openapi_request_mapper
from rating_app.serializers import FeedPageSerializer
from rating_app.services.feed_service import FeedService
from rating_app.views.responses import R_FEED

logger = structlog.get_logger(__name__)
to_openapi = pydantic_to_openapi_request_mapper().map


@extend_schema(tags=["feed"])
class FeedViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = FeedPageSerializer

    feed_service: FeedService | None = None

    @extend_schema(
        summary="List the activity feed",
        description=(
            "Recent course reviews and admin-authored posts merged into one "
            "timeline, newest first. Pass `next_cursor` from the previous "
            "response as `cursor` to page; a null `next_cursor` means the end. "
            "Pinned posts lead the first page only."
        ),
        parameters=[*to_openapi((FeedListQueryParams, OpenApiParameter.QUERY))],
        responses=R_FEED,
    )
    def list(self, request) -> Response:
        assert self.feed_service is not None

        try:
            query_params = FeedListQueryParams(**request.query_params.dict())
        except ModelValidationError as e:
            logger.error("validation_error", errors=e.errors())
            raise ValidationError(detail=e.errors()) from e

        page = self.feed_service.get_feed_page(
            cursor=query_params.cursor,
            limit=query_params.limit,
        )

        serializer = FeedPageSerializer(self._absolutize_images(page, request))
        return Response(serializer.data, status=status.HTTP_200_OK)

    def _absolutize_images(self, page: FeedPage, request) -> FeedPage:
        # Storage yields a root-relative path ("/media/..."). The SPA is served
        # from a different origin in dev, where that would resolve against the
        # frontend and 404, so hand back an absolute URL.
        items = [
            replace(item, image_url=request.build_absolute_uri(item.image_url))
            if isinstance(item, FeedPromoItem) and item.image_url
            else item
            for item in page.items
        ]
        return replace(page, items=items)
