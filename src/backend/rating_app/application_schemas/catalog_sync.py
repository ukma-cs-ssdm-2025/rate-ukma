import datetime
from typing import Self

from pydantic import BaseModel, ConfigDict, model_validator

from rating_app.application_schemas.ukma_data import Level


class CatalogPayload(BaseModel):
    model_config = ConfigDict(frozen=True)


class TermPayload(CatalogPayload):
    year: int
    term: str
    credits: str
    weekly_hours: int
    lecture_count: int | None
    practice_count: int | None
    practice_type: str
    exam_type: str


class SpecialityPayload(CatalogPayload):
    name: str
    kind: str


class DepartmentRef(CatalogPayload):
    id: str
    ukma_data_id: str | None
    name: str


class SemesterRef(CatalogPayload):
    year: int
    term: str


class MergeCourseEntry(CatalogPayload):
    id: str
    title: str
    department: DepartmentRef
    years: list[int]
    ratings: int


class UkmaDataIdPayload(CatalogPayload):
    ukma_data_id: str


class NamePayload(CatalogPayload):
    name: str


class NewDepartmentPayload(CatalogPayload):
    name: str
    faculty_ukma_id: str


class NewCoursePayload(CatalogPayload):
    title: str
    level: Level
    department_ukma_id: str
    status: str
    description: str


class OfferingPayload(CatalogPayload):
    saz_code: str
    semester: SemesterRef
    exam_type: str
    study_year: int | None
    max_students: int | None
    max_groups: int | None
    group_size_min: int | None
    group_size_max: int | None
    terms: list[TermPayload]
    specialities: list[SpecialityPayload]


class NewOfferingPayload(OfferingPayload):
    course_id: str | None = None
    course_ukma_id: str | None = None

    @model_validator(mode="after")
    def _exactly_one_course(self) -> Self:
        if (self.course_id is None) == (self.course_ukma_id is None):
            raise ValueError("exactly one of course_id or course_ukma_id is required")
        return self


class PlaceOfferingPayload(OfferingPayload):
    candidates: list[str]


class ChangeCoursePayload(CatalogPayload):
    title: str | None = None
    department: DepartmentRef | None = None
    education_level: str | None = None
    status: str | None = None
    description: str | None = None


class ChangeOfferingPayload(CatalogPayload):
    semester: SemesterRef | None = None
    exam_type: str | None = None
    study_year: int | None = None
    max_students: int | None = None
    max_groups: int | None = None
    group_size_min: int | None = None
    group_size_max: int | None = None
    terms: list[TermPayload] | None = None
    specialities_added: list[SpecialityPayload] | None = None


class MergeCoursesPayload(CatalogPayload):
    merge_source: str | None
    courses: list[MergeCourseEntry]


class MoveOfferingPayload(CatalogPayload):
    from_course: str
    to_course_id: str | None = None
    to_course_ukma_id: str | None = None

    @model_validator(mode="after")
    def _exactly_one_target(self) -> Self:
        if (self.to_course_id is None) == (self.to_course_ukma_id is None):
            raise ValueError("exactly one of to_course_id or to_course_ukma_id is required")
        return self


class RemovedOfferingPayload(CatalogPayload):
    saz_code: str
    title: str
    removed_at: datetime.datetime | None


PAYLOADS: dict[str, type[BaseModel]] = {
    "link_faculty": UkmaDataIdPayload,
    "link_department": UkmaDataIdPayload,
    "link_course": UkmaDataIdPayload,
    "link_offering": UkmaDataIdPayload,
    "new_faculty": NamePayload,
    "new_department": NewDepartmentPayload,
    "new_course": NewCoursePayload,
    "new_offering": NewOfferingPayload,
    "change_faculty": NamePayload,
    "change_department": NamePayload,
    "change_course": ChangeCoursePayload,
    "change_offering": ChangeOfferingPayload,
    "merge_courses": MergeCoursesPayload,
    "move_offering": MoveOfferingPayload,
    "place_offering": PlaceOfferingPayload,
    "relink_course": UkmaDataIdPayload,
    "removed_offering": RemovedOfferingPayload,
}
