from dataclasses import asdict, dataclass
from pathlib import Path

from django.conf import settings
from django.template.loader import render_to_string

from rating_app.application_schemas.course import Course as CourseDTO
from rating_app.services.course_service import CourseService

_DEFAULT_DESCRIPTION = (
    "Rate UKMA — платформа для студентів НаУКМА, де можна ділитися відгуками та оцінками курсів."
)


@dataclass(frozen=True)
class OgCardContext:
    title: str
    description: str
    url: str
    image_url: str


class OgService:
    """
    Generates course pages with OpenGraph metadata injected into the SPA shell.
    Can be extended for other entity types by adding similar build_*_page_html methods.
    """

    def __init__(self, course_service: CourseService) -> None:
        self._course_service = course_service

    def build_course_page_html(self, course_id: str, canonical_url: str, image_url: str) -> str:
        course = self._course_service.get_course(course_id, prefetch_related=False)

        context = OgCardContext(
            title=f"{course.title} | Rate UKMA",
            description=self._build_description(course),
            url=canonical_url,
            image_url=image_url,
        )

        template_file = "rating_app/og_tags.html"
        index_path = Path(settings.STATIC_ROOT) / "index.html"

        og_tags = render_to_string(template_file, asdict(context))
        index_html = index_path.read_text(encoding="utf-8")
        return index_html.replace("</head>", og_tags + "</head>", 1)

    def _build_description(self, course: CourseDTO) -> str:
        if course.description:
            return course.description

        parts = [
            course.department_name if course.department_name else None,
            f"{course.ratings_count} відгуків" if course.ratings_count else None,
            f"складність {float(course.avg_difficulty):.1f}/10" if course.avg_difficulty else None,
            f"корисність {float(course.avg_usefulness):.1f}/10" if course.avg_usefulness else None,
        ]

        return " · ".join(p for p in parts if p) or _DEFAULT_DESCRIPTION
