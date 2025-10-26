from __future__ import annotations

from dataclasses import dataclass

from .course_filters import CourseFilters


@dataclass(frozen=True)
class CourseFilterPayload:
    items: list
    page: int
    page_size: int
    total: int
    total_pages: int
    filters: CourseFilters
