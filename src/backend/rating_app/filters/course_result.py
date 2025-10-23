from __future__ import annotations

from collections.abc import Iterator
from dataclasses import dataclass
from typing import Any

from .course_filters import CourseFilters


@dataclass(frozen=True)
class CourseFilterPayload:
    items: list
    page: int
    page_size: int
    total: int
    total_pages: int
    filters: CourseFilters

    def _asdict(self) -> dict[str, Any]:
        return {
            "items": self.items,
            "page": self.page,
            "page_size": self.page_size,
            "total": self.total,
            "total_pages": self.total_pages,
            "filters": self.filters,
        }

    def __getitem__(self, key: str) -> Any:
        return self._asdict()[key]

    def __iter__(self) -> Iterator[str]:
        return iter(("items", "page", "page_size", "total", "total_pages", "filters"))

    def __len__(self) -> int:
        return 6
