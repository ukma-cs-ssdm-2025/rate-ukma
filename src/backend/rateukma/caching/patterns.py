"""Cache invalidation patterns used across the project."""

COURSE_PATTERN = "*course*"
RATINGS_PATTERN = "*ratings*"
FILTER_OPTIONS_PATTERN = "*get_filter_options*"

COURSES_LIST_NAMESPACE = "courses:list"
ANALYTICS_LIST_NAMESPACE = "analytics:list"
FILTER_OPTIONS_NAMESPACE = "courses:filter-options"


def course_ratings_pattern(course_id: str) -> str:
    return f"*filter_ratings*{course_id}*"


def student_pattern(student_id: str) -> str:
    return f"*{student_id}*"


def course_detail_namespace(course_id: str) -> str:
    return f"course:{course_id}"


def course_analytics_namespace(course_id: str) -> str:
    return f"analytics:course:{course_id}"


def course_ratings_namespace(course_id: str) -> str:
    return f"ratings:course:{course_id}"


def student_ratings_namespace(student_id: str) -> str:
    return f"ratings:student:{student_id}"
