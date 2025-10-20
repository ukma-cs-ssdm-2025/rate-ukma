from typing import Any

from pydantic import BaseModel


class SpecialtyEntry(BaseModel):
    specialty: str
    type: str


class Limits(BaseModel):
    max_students: int | None = None
    max_groups: int | None = None
    group_size_min: int | None = None
    group_size_max: int | None = None
    computed_max_students: int | None = None


class Enrollment(BaseModel):
    free_places: str = ""
    enrolled_active: int | None = None
    approved_enrolled: int | None = None
    approved_groups: int | None = None
    can_add_students_to_groups: int | None = None


class StudentRow(BaseModel):
    index: str = ""
    name: str = ""
    course: str = ""
    specialty: str = ""
    type: str = ""
    time: str = ""
    status: str = ""
    group: str = ""
    email: str = ""


class ParsedCourseDetails(BaseModel):
    id: str | None = None
    url: str | None = None
    title: str | None = None
    credits: float | None = None
    hours: int | None = None
    year: int | None = None
    format: str | None = None
    status: str | None = None
    faculty: str | None = None
    department: str | None = None
    education_level: str | None = None
    academic_year: str | None = None
    teachers: str | None = None
    annotation: str | None = None
    specialties: list[SpecialtyEntry] | None = None
    semesters: list[str] | None = None
    season_details: dict[str, list[str]] | None = None
    limits: Limits | None = None
    enrollment: Enrollment | None = None
    students: list[StudentRow] | None = None

    def model_dump_json_compat(self) -> dict[str, Any]:
        return self.model_dump(exclude_none=True, by_alias=False)
