from dataclasses import dataclass
from typing import Literal

from rating_app.constants import DEFAULT_COURSE_PAGE_SIZE, DEFAULT_PAGE_NUMBER


@dataclass
class CourseFilters:
    name: str | None = None
    type_kind: str | None = None
    instructor: str | None = None
    faculty: str | None = None
    department: str | None = None
    speciality: str | None = None
    semester_year: int | None = None
    semester_term: str | None = None
    avg_difficulty_min: float | None = None
    avg_difficulty_max: float | None = None
    avg_usefulness_min: float | None = None
    avg_usefulness_max: float | None = None
    avg_difficulty_order: Literal["asc", "desc"] | None = None
    avg_usefulness_order: Literal["asc", "desc"] | None = None
    page_size: int = DEFAULT_COURSE_PAGE_SIZE
    page: int = DEFAULT_PAGE_NUMBER

    @classmethod
    def of(cls, **kwargs) -> "CourseFilters":
        return cls(**kwargs)
