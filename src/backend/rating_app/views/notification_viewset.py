from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

import structlog
from drf_spectacular.utils import extend_schema

from rating_app.serializers.notification import (
    NotificationGroupSerializer,
    UnreadCountSerializer,
)
from rating_app.services.notification_service import (
    DEFAULT_NOTIFICATION_PAGE_SIZE,
    NotificationService,
)
from rating_app.views.responses import (
    R_NOTIFICATION_LIST,
    R_NOTIFICATION_MARK_READ,
    R_NOTIFICATION_UNREAD_COUNT,
)

logger = structlog.get_logger(__name__)


@extend_schema(tags=["notifications"])
class NotificationViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = NotificationGroupSerializer

    notification_service: NotificationService | None = None

    @extend_schema(
        summary="List notifications for the authenticated user",
        responses=R_NOTIFICATION_LIST,
    )
    def list(self, request) -> Response:
        assert self.notification_service is not None

        limit = self._parse_limit(request)
        offset = self._parse_offset(request)

        notifications = self.notification_service.get_notifications_for_user(
            user_id=request.user.id,
            limit=limit,
            offset=offset,
        )
        serializer = NotificationGroupSerializer(notifications, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Get unread notification count",
        responses=R_NOTIFICATION_UNREAD_COUNT,
    )
    @action(detail=False, methods=["get"], url_path="unread-count")
    def unread_count(self, request) -> Response:
        assert self.notification_service is not None

        count = self.notification_service.get_unread_count(request.user.id)
        serializer = UnreadCountSerializer({"count": count})
        return Response(serializer.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Mark all notifications as read",
        responses=R_NOTIFICATION_MARK_READ,
    )
    @action(detail=False, methods=["post"], url_path="mark-read")
    def mark_read(self, request) -> Response:
        assert self.notification_service is not None

        self.notification_service.mark_all_read(request.user.id)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def _parse_limit(self, request) -> int:
        try:
            return int(request.query_params.get("limit", DEFAULT_NOTIFICATION_PAGE_SIZE))
        except (ValueError, TypeError):
            return DEFAULT_NOTIFICATION_PAGE_SIZE

    def _parse_offset(self, request) -> int:
        try:
            return max(0, int(request.query_params.get("offset", 0)))
        except (ValueError, TypeError):
            return 0
