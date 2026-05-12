from dataclasses import asdict, dataclass

from django.template.loader import render_to_string

from rateukma.app_metadata.bot_detection import is_social_bot
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
    Generates OpenGraph metadata for course pages
    and detects social bots based on user agent strings.

    Currently configured only for course pages,
    but can be extended in the future for other types of pages if needed.
    """

    def __init__(self, course_service: CourseService) -> None:
        self._course_service = course_service

    def is_social_bot(self, user_agent: str) -> bool:
        return is_social_bot(user_agent)

    def build_course_og_html(self, course_id: str, canonical_url: str, image_url: str) -> str:
        course = self._course_service.get_course(course_id, prefetch_related=False)
        context = OgCardContext(
            title=f"{course.title} | Rate UKMA",
            description=self._build_description(course),
            url=canonical_url,
            image_url=image_url,
        )
        return render_to_string("rating_app/og_card.html", asdict(context))

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
