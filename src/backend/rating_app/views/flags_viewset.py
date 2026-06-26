from django.conf import settings
from rest_framework import status, viewsets
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from drf_spectacular.utils import extend_schema
from waffle import flag_is_active

from rating_app.serializers import FeatureFlagsSerializer
from rating_app.views.responses import R_FLAGS


@extend_schema(tags=["flags"])
class FlagsViewSet(viewsets.ViewSet):
    permission_classes = [AllowAny]
    serializer_class = FeatureFlagsSerializer

    @extend_schema(
        summary="List public feature flags evaluated for the current user",
        responses=R_FLAGS,
    )
    def list(self, request) -> Response:
        flags = {
            name: flag_is_active(request, name) for name in settings.PUBLIC_FEATURE_FLAGS
        }
        serializer = FeatureFlagsSerializer({"flags": flags})
        return Response(serializer.data, status=status.HTTP_200_OK)
