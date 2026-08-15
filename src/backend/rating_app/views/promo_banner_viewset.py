from dataclasses import replace

from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from rest_framework import status, viewsets
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from drf_spectacular.utils import extend_schema

from rating_app.serializers import PromoBannerResponseSerializer
from rating_app.services import PromoBannerService
from rating_app.views.responses import R_PROMO_BANNER


@extend_schema(tags=["promo-banner"])
class PromoBannerViewSet(viewsets.ViewSet):
    permission_classes = [AllowAny]
    serializer_class = PromoBannerResponseSerializer

    promo_banner_service: PromoBannerService | None = None

    @extend_schema(
        summary="Retrieve the active promo banner",
        description=(
            "Returns the active promo banner configured in Django admin, "
            "or `null` when none is active."
        ),
        responses=R_PROMO_BANNER,
    )
    @method_decorator(never_cache)
    def list(self, request) -> Response:
        assert self.promo_banner_service is not None

        banner = self.promo_banner_service.get_active_banner()
        if banner is not None and banner.logo_url:
            # Storage yields a root-relative path ("/media/..."). The SPA is
            # served from a different origin in dev, where that would resolve
            # against the frontend and 404, so hand back an absolute URL.
            banner = replace(
                banner,
                logo_url=request.build_absolute_uri(banner.logo_url),
            )

        serializer = PromoBannerResponseSerializer({"banner": banner})
        return Response(serializer.data, status=status.HTTP_200_OK)
