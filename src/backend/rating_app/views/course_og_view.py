from django.http import HttpRequest
from rest_framework.permissions import AllowAny
from rest_framework.renderers import StaticHTMLRenderer
from rest_framework.response import Response
from rest_framework.views import APIView

from rating_app.services.og_service import OgService


class CourseOgView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    renderer_classes = [StaticHTMLRenderer]

    # IoC args
    og_service: OgService | None = None

    def get(self, request: HttpRequest, course_id: str) -> Response:
        assert self.og_service is not None

        html = self.og_service.build_course_page_html(
            course_id,
            canonical_url=request.build_absolute_uri(),
            image_url=request.build_absolute_uri("/android-chrome-512x512.png"),
        )

        return Response(html)
