from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class CourseFilterOptions:
    instructors: list[dict[str, Any]]
    faculties: list[dict[str, Any]]
    departments: list[dict[str, Any]]
    semester_terms: list[dict[str, Any]]
    semester_years: list[dict[str, Any]]
    course_types: list[dict[str, Any]]
    specialities: list[dict[str, Any]]
