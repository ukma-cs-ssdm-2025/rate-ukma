"""Cache invalidation patterns used across the project."""

COURSE_PATTERN = "*course*"
RATINGS_PATTERN = "*ratings*"
FILTER_OPTIONS_PATTERN = "*get_filter_options*"


def course_ratings_pattern(course_id: str) -> str:
    return f"*/courses/{course_id}/ratings*"


def student_pattern(student_id: str) -> str:
    return f"*{student_id}*"
