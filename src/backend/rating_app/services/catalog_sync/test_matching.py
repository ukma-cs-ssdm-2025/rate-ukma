from __future__ import annotations

import datetime

import pytest

from rating_app.application_schemas.ukma_data import (
    UkmaDataCourse,
    UkmaDataDepartment,
    UkmaDataFaculty,
    UkmaDataOffering,
    UkmaDataOfferingTerm,
    UkmaDataTerm,
)
from rating_app.services.catalog_sync import constants
from rating_app.services.catalog_sync.matching import (
    academic_year_of,
    course_majority,
    courses_by_ud,
    exam_type_of,
    match_departments,
    match_faculties,
    match_offerings,
    offering_skip_reason,
    resolve_course,
    semester_of,
)
from rating_app.services.catalog_sync.snapshot import (
    RateUkmaSnapshot,
    RuCourse,
    RuDepartment,
    RuFaculty,
    RuOffering,
    UkmaDataSnapshot,
)


def _term(*, academic_year: int = 2025, season: str = "FALL") -> UkmaDataTerm:
    return UkmaDataTerm.model_validate(
        {
            "id": f"term-{academic_year}-{season}",
            "code": f"{academic_year}-{season}",
            "academicYear": academic_year,
            "season": season,
            "changeNo": 1,
        }
    )


def _offering_term(
    *,
    credits: float = 3.0,
    control: str | None = "exam",
) -> UkmaDataOfferingTerm:
    return UkmaDataOfferingTerm.model_validate(
        {
            "termId": "term-2025-FALL",
            "semesters": [1],
            "credits": credits,
            "hoursPerWeek": 2,
            "lectureHours": 1,
            "seminarHours": 1,
            "practiceHours": 1,
            "control": control,
        }
    )


def _ud_course(
    course_id: str,
    *,
    merged_into: str | None = None,
    removed_at: datetime.datetime | None = None,
) -> UkmaDataCourse:
    return UkmaDataCourse.model_validate(
        {
            "id": course_id,
            "title": f"Course {course_id}",
            "departmentId": "ud-dept",
            "level": "bachelor",
            "mergedInto": merged_into,
            "mergeSource": None,
            "changeNo": 1,
            "removedAt": removed_at,
        }
    )


def _ud_offering(
    offering_id: str,
    *,
    course_id: str | None = "ud-course",
    saz_code: str = "123456",
    title: str = "Offering",
    department_id: str | None = "ud-dept",
    terms: list[UkmaDataOfferingTerm] | None = None,
    removed_at: datetime.datetime | None = None,
) -> UkmaDataOffering:
    return UkmaDataOffering.model_validate(
        {
            "id": offering_id,
            "courseId": course_id,
            "sazCode": saz_code,
            "academicYear": 2025,
            "title": title,
            "facultyId": "ud-fac",
            "departmentId": department_id,
            "level": "bachelor",
            "format": "full-time",
            "credits": 3.0,
            "hours": 90,
            "studyYear": 1,
            "status": "held",
            "isPractical": False,
            "annotation": None,
            "maxStudents": 30,
            "maxGroups": 1,
            "computedMaxStudents": 30,
            "groupSizeMin": 5,
            "groupSizeMax": 30,
            "enrolledActive": None,
            "terms": [_offering_term()] if terms is None else terms,
            "programmes": [],
            "changeNo": 1,
            "removedAt": removed_at,
        }
    )


def _ud_department(
    department_id: str,
    *,
    name: str,
    faculty_id: str | None = "ud-fac",
) -> UkmaDataDepartment:
    return UkmaDataDepartment.model_validate(
        {
            "id": department_id,
            "name": name,
            "sazFilterId": None,
            "facultyId": faculty_id,
            "changeNo": 1,
            "removedAt": None,
        }
    )


def _ud_faculty(faculty_id: str, *, name: str) -> UkmaDataFaculty:
    return UkmaDataFaculty.model_validate(
        {
            "id": faculty_id,
            "name": name,
            "sazFilterId": None,
            "changeNo": 1,
            "removedAt": None,
        }
    )


def _ru_course(course_id: str, *, department_id: str = "ru-dept") -> RuCourse:
    return RuCourse(
        id=course_id,
        title=f"Course {course_id}",
        department_id=department_id,
        education_level="BACHELOR",
        status="ACTIVE",
        description="",
        ukma_data_id=None,
        ratings=0,
    )


def _ru_offering(
    offering_id: str,
    *,
    code: str = "123456",
    course_id: str = "ru-course",
    ukma_data_id: str | None = None,
) -> RuOffering:
    return RuOffering(
        id=offering_id,
        code=code,
        course_id=course_id,
        semester_year=2025,
        semester_term="FALL",
        exam_type="EXAM",
        study_year=1,
        max_students=30,
        max_groups=1,
        group_size_min=5,
        group_size_max=30,
        ukma_data_id=ukma_data_id,
        terms=(),
        specialities=(),
        ratings=0,
        planned=0,
    )


def _ru_department(
    department_id: str,
    *,
    name: str,
    ukma_data_id: str | None = None,
) -> RuDepartment:
    return RuDepartment(
        id=department_id,
        name=name,
        faculty_id="ru-fac",
        ukma_data_id=ukma_data_id,
    )


def _ru_faculty(
    faculty_id: str,
    *,
    name: str,
    ukma_data_id: str | None = None,
) -> RuFaculty:
    return RuFaculty(id=faculty_id, name=name, ukma_data_id=ukma_data_id)


def _ud_snapshot(
    *,
    faculties: list[UkmaDataFaculty] | None = None,
    departments: list[UkmaDataDepartment] | None = None,
    courses: list[UkmaDataCourse] | None = None,
    offerings: list[UkmaDataOffering] | None = None,
) -> UkmaDataSnapshot:
    return UkmaDataSnapshot(
        faculties={row.id: row for row in faculties or []},
        departments={row.id: row for row in departments or []},
        programmes={},
        terms={},
        courses={row.id: row for row in courses or []},
        offerings={row.id: row for row in offerings or []},
        data_updated_at=None,
    )


def _ru_snapshot(
    *,
    faculties: list[RuFaculty] | None = None,
    departments: list[RuDepartment] | None = None,
    courses: list[RuCourse] | None = None,
    offerings: list[RuOffering] | None = None,
) -> RateUkmaSnapshot:
    return RateUkmaSnapshot(
        faculties={row.id: row for row in faculties or []},
        departments={row.id: row for row in departments or []},
        courses={row.id: row for row in courses or []},
        offerings={row.id: row for row in offerings or []},
        speciality_names=frozenset(),
    )


@pytest.mark.parametrize(
    ("season", "expected"),
    [
        ("FALL", (2025, "FALL")),
        ("SPRING", (2026, "SPRING")),
        ("SUMMER", (2026, "SUMMER")),
    ],
)
def test_semester_of_uses_the_rate_ukma_academic_year(season, expected):
    term = _term(academic_year=2025, season=season)

    assert semester_of(term) == expected


@pytest.mark.parametrize(
    ("control", "expected"),
    [
        ("pass_fail", "CREDIT"),
        ("exam", "EXAM"),
        ("thesis", "EXAM"),
        ("thesis_defence", "EXAM"),
        ("none", "EXAM"),
        (None, "EXAM"),
    ],
)
def test_exam_type_of_maps_pass_fail_to_credit(control, expected):
    assert exam_type_of(control) == expected


@pytest.mark.parametrize(
    ("year", "term", "expected"),
    [
        (2026, "FALL", 2026),
        (2026, "SPRING", 2025),
        (2026, "SUMMER", 2025),
    ],
)
def test_academic_year_of_puts_spring_and_summer_in_the_previous_year(year, term, expected):
    assert academic_year_of(year, term) == expected


def test_match_offerings_prefers_the_stored_ukma_data_id():
    ud = _ud_snapshot(offerings=[_ud_offering("ud-offering", saz_code="111111")])
    ru = _ru_snapshot(
        offerings=[
            _ru_offering("ru-stored", code="999999", ukma_data_id="ud-offering"),
            _ru_offering("ru-code", code="111111"),
        ]
    )

    assert match_offerings(ud, ru) == {"ud-offering": "ru-stored"}


def test_match_offerings_falls_back_to_the_saz_code():
    ud = _ud_snapshot(offerings=[_ud_offering("ud-offering", saz_code="111111")])
    ru = _ru_snapshot(offerings=[_ru_offering("ru-code", code="111111")])

    assert match_offerings(ud, ru) == {"ud-offering": "ru-code"}


def test_match_offerings_ignores_removed_ukma_data_offerings():
    ud = _ud_snapshot(
        offerings=[
            _ud_offering(
                "ud-offering",
                saz_code="111111",
                removed_at=datetime.datetime(2026, 1, 1, tzinfo=datetime.UTC),
            )
        ]
    )
    ru = _ru_snapshot(offerings=[_ru_offering("ru-code", code="111111")])

    assert match_offerings(ud, ru) == {}


def test_resolve_course_returns_the_course_without_a_merge():
    ud = _ud_snapshot(courses=[_ud_course("ud-kept")])

    assert resolve_course(ud, "ud-kept") == "ud-kept"


def test_resolve_course_follows_a_merged_into_chain():
    ud = _ud_snapshot(
        courses=[
            _ud_course("ud-old", merged_into="ud-middle"),
            _ud_course("ud-middle", merged_into="ud-kept"),
            _ud_course("ud-kept"),
        ]
    )

    assert resolve_course(ud, "ud-old") == "ud-kept"


def test_resolve_course_returns_none_for_a_missing_course():
    ud = _ud_snapshot(courses=[_ud_course("ud-kept")])

    assert resolve_course(ud, "ud-missing") is None


def test_resolve_course_returns_none_for_a_cycle():
    ud = _ud_snapshot(
        courses=[
            _ud_course("ud-a", merged_into="ud-b"),
            _ud_course("ud-b", merged_into="ud-a"),
        ]
    )

    assert resolve_course(ud, "ud-a") is None


def test_course_majority_picks_the_course_with_most_matched_offerings():
    ud = _ud_snapshot(
        courses=[_ud_course("ud-a"), _ud_course("ud-b")],
        offerings=[
            _ud_offering("ud-1", course_id="ud-a"),
            _ud_offering("ud-2", course_id="ud-a"),
            _ud_offering("ud-3", course_id="ud-b"),
        ],
    )
    ru = _ru_snapshot(
        courses=[_ru_course("ru-course")],
        offerings=[
            _ru_offering("ru-1", course_id="ru-course"),
            _ru_offering("ru-2", course_id="ru-course"),
            _ru_offering("ru-3", course_id="ru-course"),
        ],
    )
    offering_match = {"ud-1": "ru-1", "ud-2": "ru-2", "ud-3": "ru-3"}

    assert course_majority(ud, ru, offering_match) == {"ru-course": "ud-a"}


def test_course_majority_breaks_ties_by_smallest_ukma_data_id():
    ud = _ud_snapshot(
        courses=[_ud_course("ud-b"), _ud_course("ud-a")],
        offerings=[
            _ud_offering("ud-1", course_id="ud-b"),
            _ud_offering("ud-2", course_id="ud-a"),
        ],
    )
    ru = _ru_snapshot(
        courses=[_ru_course("ru-course")],
        offerings=[
            _ru_offering("ru-1", course_id="ru-course"),
            _ru_offering("ru-2", course_id="ru-course"),
        ],
    )

    assert course_majority(ud, ru, {"ud-1": "ru-1", "ud-2": "ru-2"}) == {"ru-course": "ud-a"}


def test_course_majority_counts_merged_offerings_under_the_surviving_course():
    ud = _ud_snapshot(
        courses=[
            _ud_course("ud-old-1", merged_into="ud-kept"),
            _ud_course("ud-old-2", merged_into="ud-kept"),
            _ud_course("ud-kept"),
            _ud_course("ud-other"),
        ],
        offerings=[
            _ud_offering("ud-1", course_id="ud-old-1"),
            _ud_offering("ud-2", course_id="ud-old-2"),
            _ud_offering("ud-3", course_id="ud-other"),
        ],
    )
    ru = _ru_snapshot(
        courses=[_ru_course("ru-course")],
        offerings=[
            _ru_offering("ru-1", course_id="ru-course"),
            _ru_offering("ru-2", course_id="ru-course"),
            _ru_offering("ru-3", course_id="ru-course"),
        ],
    )

    majority = course_majority(ud, ru, {"ud-1": "ru-1", "ud-2": "ru-2", "ud-3": "ru-3"})

    assert majority == {"ru-course": "ud-kept"}


def test_courses_by_ud_groups_and_sorts_rate_ukma_ids():
    majority = {"ru-b": "ud-1", "ru-a": "ud-1", "ru-c": "ud-2"}

    assert courses_by_ud(majority) == {"ud-1": ["ru-a", "ru-b"], "ud-2": ["ru-c"]}


def test_match_departments_prefers_the_stored_ukma_data_id():
    ud = _ud_snapshot(departments=[_ud_department("ud-dept", name="Нова кафедра")])
    ru = _ru_snapshot(
        departments=[_ru_department("ru-dept", name="Стара кафедра", ukma_data_id="ud-dept")]
    )

    assert match_departments(ud, ru) == {"ud-dept": "ru-dept"}


def test_match_departments_falls_back_to_a_unique_name():
    ud = _ud_snapshot(departments=[_ud_department("ud-dept", name="Кафедра даних")])
    ru = _ru_snapshot(departments=[_ru_department("ru-dept", name="Кафедра даних")])

    assert match_departments(ud, ru) == {"ud-dept": "ru-dept"}


def test_match_departments_skips_a_name_two_rate_ukma_rows_share():
    ud = _ud_snapshot(departments=[_ud_department("ud-dept", name="Кафедра даних")])
    ru = _ru_snapshot(
        departments=[
            _ru_department("ru-1", name="Кафедра даних"),
            _ru_department("ru-2", name="Кафедра даних"),
        ]
    )

    assert match_departments(ud, ru) == {}


def test_match_faculties_prefers_the_stored_ukma_data_id():
    ud = _ud_snapshot(faculties=[_ud_faculty("ud-fac", name="Новий факультет")])
    ru = _ru_snapshot(
        faculties=[_ru_faculty("ru-fac", name="Старий факультет", ukma_data_id="ud-fac")]
    )

    assert match_faculties(ud, ru) == {"ud-fac": "ru-fac"}


def test_match_faculties_falls_back_to_a_unique_name():
    ud = _ud_snapshot(faculties=[_ud_faculty("ud-fac", name="Факультет даних")])
    ru = _ru_snapshot(faculties=[_ru_faculty("ru-fac", name="Факультет даних")])

    assert match_faculties(ud, ru) == {"ud-fac": "ru-fac"}


@pytest.mark.parametrize(
    ("offering", "reason"),
    [
        pytest.param(_ud_offering("ud-o", terms=[]), constants.NO_TERM, id="no_term"),
        pytest.param(
            _ud_offering("ud-o", terms=[_offering_term(credits=0.0)]),
            constants.ZERO_CREDITS,
            id="zero_credits",
        ),
        pytest.param(
            _ud_offering("ud-o", terms=[_offering_term(credits=-1.0)]),
            constants.ZERO_CREDITS,
            id="negative_credits",
        ),
        pytest.param(
            _ud_offering("ud-o", terms=[_offering_term(credits=3.25)]),
            constants.CREDITS_OUT_OF_RANGE,
            id="two_decimal_credits",
        ),
        pytest.param(
            _ud_offering("ud-o", terms=[_offering_term(credits=100.0)]),
            constants.CREDITS_OUT_OF_RANGE,
            id="too_many_credits",
        ),
        pytest.param(
            _ud_offering("ud-o", title="x" * 256),
            constants.TITLE_TOO_LONG,
            id="title_too_long",
        ),
        pytest.param(
            _ud_offering("ud-o", saz_code="12345"),
            constants.BAD_SAZ_CODE,
            id="bad_saz_code",
        ),
        pytest.param(
            _ud_offering("ud-o", department_id=None),
            constants.NO_DEPARTMENT,
            id="no_department",
        ),
        pytest.param(
            _ud_offering("ud-o", terms=[], saz_code="12345"),
            constants.NO_TERM,
            id="no_term_before_bad_saz_code",
        ),
        pytest.param(_ud_offering("ud-o"), None, id="storable"),
        pytest.param(
            _ud_offering("ud-o", terms=[_offering_term(credits=99.9)]),
            None,
            id="max_credits_is_storable",
        ),
    ],
)
def test_offering_skip_reason_reports_the_first_unstoreable_value(offering, reason):
    assert offering_skip_reason(offering) == reason
