from dataclasses import dataclass
from typing import Any

from .course_filters import CourseFilters


@dataclass
class CourseFilterPayload:
    items: list[Any]
    page: int
    page_size: int
    total: int
    total_pages: int
    filters: CourseFilters | None = None
