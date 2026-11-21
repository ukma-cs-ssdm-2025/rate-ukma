"""The JSON contract of every sync change kind's `before` and `after`.

Each model describes the `after` of one kind in `rating_app.sync.kinds`; kinds
whose `before` has a different shape get their own entry in `BEFORE_PAYLOADS`.
Every payload also carries a `display` snapshot, written at run time, so /data
shows what a change means without ids.
"""

from __future__ import annotations

import datetime
from typing import Self

from pydantic import BaseModel, ConfigDict, Field, model_validator


class SyncPayload(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")


class TeacherYear(SyncPayload):
    year: int
    teachers: list[str]


class CourseDisplay(SyncPayload):
    title: str
    department: str
    years: list[int]
    saz_codes: list[str]
    teachers: list[TeacherYear]


class UkmaCourseDisplay(SyncPayload):
    title: str
    department: str | None
    merge_source: str | None


class TeacherDisplay(SyncPayload):
    name: str


class Display(SyncPayload):
    """The side-by-side snapshot /data shows for a change's rows."""

    name: str | None = None
    course: CourseDisplay | None = None
    ukma_course: UkmaCourseDisplay | None = None
    courses: list[CourseDisplay] = Field(default_factory=list)
    teacher: TeacherDisplay | None = None


class Payload(SyncPayload):
    display: Display = Field(default_factory=Display)


class TermPayload(SyncPayload):
    year: int
    term: str
    credits: str
    weekly_hours: int
    lecture_count: int | None
    practice_count: int | None
    practice_type: str
    exam_type: str


class SpecialityPayload(SyncPayload):
    name: str
    kind: str


class SemesterPayload(SyncPayload):
    year: int
    term: str


class DepartmentRef(SyncPayload):
    id: str
    ukma_data_id: str | None
    name: str


class UkmaDataIdPayload(Payload):
    ukma_data_id: str


class NamePayload(Payload):
    name: str


class NewDepartmentPayload(Payload):
    name: str
    faculty_ukma_id: str


class NewCoursePayload(Payload):
    title: str
    level: str
    department_ukma_id: str
    status: str
    description: str


class OfferingPayload(Payload):
    saz_code: str
    semester: SemesterPayload
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


class ChangeCoursePayload(Payload):
    title: str | None = None
    department: DepartmentRef | None = None
    education_level: str | None = None
    status: str | None = None
    description: str | None = None


class ChangeOfferingPayload(Payload):
    semester: SemesterPayload | None = None
    exam_type: str | None = None
    study_year: int | None = None
    max_students: int | None = None
    max_groups: int | None = None
    group_size_min: int | None = None
    group_size_max: int | None = None
    terms: list[TermPayload] | None = None
    specialities_added: list[SpecialityPayload] | None = None


class MergeCourseEntry(SyncPayload):
    id: str
    title: str
    department: DepartmentRef
    years: list[int]
    ratings: int


class MergeCoursesPayload(Payload):
    merge_source: str | None
    courses: list[MergeCourseEntry]


class MoveOfferingPayload(Payload):
    from_course: str
    to_course_id: str | None = None
    to_course_ukma_id: str | None = None

    @model_validator(mode="after")
    def _exactly_one_target(self) -> Self:
        if (self.to_course_id is None) == (self.to_course_ukma_id is None):
            raise ValueError("exactly one of to_course_id or to_course_ukma_id is required")
        return self


class RemovedOfferingPayload(Payload):
    saz_code: str
    title: str
    removed_at: datetime.datetime | None


class RemovedCoursePayload(Payload):
    ukma_data_id: str
    title: str
    removed_at: datetime.datetime | None


class TeacherCreatedPayload(Payload):
    email: str
    last_name: str
    first_name: str
    middle_name: str


class TeacherLinkAddedPayload(Payload):
    teacher_email: str
    role: str


class TeacherLinkRemovedPayload(Payload):
    """The link to remove; `before` holds the offering's whole link set."""

    instructor_id: str
    role: str


class TeacherLinkRef(SyncPayload):
    instructor_id: str
    role: str


class TeacherLinksBefore(SyncPayload):
    """An offering's links sorted by (instructor_id, role), as `current_values` reads them."""

    links: list[TeacherLinkRef]


PAYLOADS: dict[str, type[BaseModel]] = {
    "new_faculty": NamePayload,
    "link_faculty": UkmaDataIdPayload,
    "change_faculty": NamePayload,
    "new_department": NewDepartmentPayload,
    "link_department": UkmaDataIdPayload,
    "change_department": NamePayload,
    "new_course": NewCoursePayload,
    "link_course": UkmaDataIdPayload,
    "change_course": ChangeCoursePayload,
    "new_offering": NewOfferingPayload,
    "link_offering": UkmaDataIdPayload,
    "change_offering": ChangeOfferingPayload,
    "teacher_created": TeacherCreatedPayload,
    "teacher_link_added": TeacherLinkAddedPayload,
    "teacher_link_removed": TeacherLinkRemovedPayload,
    "relink_course": UkmaDataIdPayload,
    "place_offering": PlaceOfferingPayload,
    "move_offering": MoveOfferingPayload,
    "merge_courses": MergeCoursesPayload,
    "removed_course": RemovedCoursePayload,
    "removed_offering": RemovedOfferingPayload,
}

BEFORE_PAYLOADS: dict[str, type[BaseModel]] = {
    "teacher_link_added": TeacherLinksBefore,
    "teacher_link_removed": TeacherLinksBefore,
}
