from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class CourseFilteredPayload:
    items: list
    page: int
    page_size: int
    total: int
    total_pages: int
    filters: dict[str, Any]  # TODO: specify that here should be CourseQueryParams.model_dump()
