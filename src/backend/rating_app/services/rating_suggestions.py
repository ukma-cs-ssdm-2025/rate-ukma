from dataclasses import dataclass

from rating_app.models.choices import SemesterTerm


@dataclass(frozen=True)
class SuggestionSemester:
    year: int
    season: str


@dataclass(frozen=True)
class RatingSuggestion:
    course_id: str
    course_offering_id: str
    course_title: str
    semester: SuggestionSemester
    ratings_count: int


def rank_rating_suggestions(
    candidates: list[RatingSuggestion], exclude_course: str | None = None
) -> list[RatingSuggestion]:
    term_priority = {SemesterTerm.SPRING: 0, SemesterTerm.SUMMER: 1, SemesterTerm.FALL: 2}
    ordered = sorted(
        candidates,
        key=lambda item: (
            -item.semester.year,
            -term_priority[SemesterTerm(item.semester.season)],
            item.ratings_count,
            item.course_title,
            item.course_offering_id,
        ),
    )
    by_course: dict[str, RatingSuggestion] = {}
    for item in ordered:
        if item.course_id != exclude_course:
            by_course.setdefault(item.course_id, item)
    return list(by_course.values())[:3]
