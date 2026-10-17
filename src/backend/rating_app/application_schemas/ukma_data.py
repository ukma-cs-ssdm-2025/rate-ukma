import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, JsonValue
from pydantic.alias_generators import to_camel, to_snake

UKMA_DATA_MAX_PAGE_SIZE = 1000

Level = Literal["bachelor", "master"]
Season = Literal["FALL", "SPRING", "SUMMER"]
Control = Literal["pass_fail", "exam", "thesis", "none", "thesis_defence"]
ProgrammeKind = Literal["compulsory", "prof_oriented", "elective"]
OfferingStatus = Literal["held", "not_held", "may_hold", "unknown"]
ReviewCaseKind = Literal["course_match", "instructor_match", "removals_held"]
ReviewCaseStatus = Literal["open", "decided", "obsolete"]


class UkmaDataPageParams(BaseModel):
    model_config = {
        "alias_generator": to_snake,
        "populate_by_name": True,
    }

    after: int | None = Field(
        default=None,
        ge=0,
        description="Change number saved after the last sync; omit or 0 for all rows",
    )
    limit: int | None = Field(
        default=None,
        ge=1,
        description=(
            f"Rows per page; UKMA Data's default is 500, "
            f"values above {UKMA_DATA_MAX_PAGE_SIZE} are capped"
        ),
    )


class UkmaDataModel(BaseModel):
    """A row of UKMA Data's read API, which speaks camelCase."""

    model_config = ConfigDict(alias_generator=to_camel, frozen=True)


class UkmaDataTerm(UkmaDataModel):
    id: str
    code: str
    academic_year: int
    season: Season
    change_no: int


class UkmaDataFaculty(UkmaDataModel):
    id: str
    name: str
    saz_filter_id: str | None
    change_no: int
    removed_at: datetime.datetime | None


class UkmaDataDepartment(UkmaDataModel):
    id: str
    name: str
    saz_filter_id: str | None
    faculty_id: str | None
    change_no: int
    removed_at: datetime.datetime | None


class UkmaDataProgramme(UkmaDataModel):
    id: str
    name: str
    level: Level | None
    saz_filter_id: str | None
    change_no: int
    removed_at: datetime.datetime | None


class UkmaDataOfferingTerm(UkmaDataModel):
    term_id: str
    semesters: list[int]
    credits: float
    hours_per_week: int | None
    lecture_hours: int | None
    seminar_hours: int | None
    practice_hours: int | None
    control: Control | None


class UkmaDataOfferingProgramme(UkmaDataModel):
    programme_id: str
    kind: ProgrammeKind


class UkmaDataOffering(UkmaDataModel):
    id: str
    saz_code: str
    academic_year: int
    title: str
    faculty_id: str | None
    department_id: str | None
    level: Level
    format: str
    credits: float
    hours: int
    study_year: int
    status: OfferingStatus
    is_practical: bool
    annotation: str | None
    max_students: int | None
    max_groups: int | None
    computed_max_students: int | None
    group_size_min: int
    group_size_max: int
    enrolled_active: int | None
    terms: list[UkmaDataOfferingTerm]
    programmes: list[UkmaDataOfferingProgramme]
    change_no: int
    removed_at: datetime.datetime | None


class UkmaDataReviewCase(UkmaDataModel):
    id: str
    kind: ReviewCaseKind
    subject_id: str
    candidates: JsonValue
    safe_answer: JsonValue
    status: ReviewCaseStatus
    run_id: str | None
    decision_id: str | None
    opened_at: datetime.datetime
    change_no: int


class UkmaDataPage[T](UkmaDataModel):
    items: list[T]
    cursor: int
    has_more: bool
    data_updated_at: datetime.datetime | None


class UkmaDataKey(UkmaDataModel):
    id: str
    scopes: list[str]
    expires_at: datetime.datetime


class UkmaDataStatus(BaseModel):
    key_id: str
    scopes: list[str]
    key_expires_at: datetime.datetime
    data_updated_at: datetime.datetime | None
