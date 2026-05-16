from dataclasses import asdict, dataclass
from pathlib import Path
from typing import ClassVar

from django.conf import settings
from django.template.loader import render_to_string

from rating_app.services.course_service import CourseService


@dataclass(frozen=True)
class PageMetaContext:
    title: str
    description: str
    url: str
    image_url: str


class CoursePageService:
    """
    Builds course pages with meta tags injected into the SPA shell.
    Can be extended for other entity types by adding similar build_*_page_html methods.
    """

    _index_html: ClassVar[str | None] = None

    def __init__(self, course_service: CourseService) -> None:
        self._course_service = course_service

    def build_course_page_html(self, course_id: str, canonical_url: str, image_url: str) -> str:
        course = self._course_service.get_course(course_id, prefetch_related=False)

        context = PageMetaContext(
            title=f"{course.title} | Rate UKMA",
            description=course.short_description,
            url=canonical_url,
            image_url=image_url,
        )

        meta_tags = render_to_string("rating_app/page_meta_tags.html", asdict(context))
        return self._get_index_html().replace("</head>", meta_tags + "</head>", 1)

    def _get_index_html(self) -> str:
        if CoursePageService._index_html is None:
            CoursePageService._index_html = (Path(settings.STATIC_ROOT) / "index.html").read_text(
                encoding="utf-8"
            )
        return CoursePageService._index_html
