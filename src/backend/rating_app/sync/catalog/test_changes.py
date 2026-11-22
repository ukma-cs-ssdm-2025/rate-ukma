from __future__ import annotations

import time
from collections.abc import Sequence
from dataclasses import replace

from rating_app.application_schemas import ukma_data_api as ukma_data
from rating_app.sync.catalog.changes import propose_changes
from rating_app.sync.drafts import ChangeDraft, DecisionView
from rating_app.sync.kinds import KIND_BY_NAME
from rating_app.sync.payloads import PAYLOADS
from rating_app.sync.snapshot import (
    RateUkmaSnapshot,
    RuCourse,
    RuDepartment,
    RuFaculty,
    RuOffering,
    RuTerm,
    UkmaDataSnapshot,
)

PROPOSED_KINDS = {
    "change_faculty",
    "change_department",
    "change_course",
    "change_offering",
    "removed_course",
    "removed_offering",
}


def _ud_term(*, academic_year: int = 2025, season: str = "FALL") -> ukma_data.Term:
    return ukma_data.Term.model_validate(
        {
            "id": f"term-{academic_year}-{season}",
            "code": f"{academic_year}-{season}",
            "academicYear": academic_year,
            "season": season,
            "changeNo": 1,
        }
    )


def _ud_offering_term(
    term_id: str = "term-2025-FALL",
    *,
    credits: float = 3.0,
    hours_per_week: int | None = 2,
    lecture_hours: int | None = 10,
    seminar_hours: int | None = 10,
    practice_hours: int | None = None,
    control: str | None = "exam",
) -> ukma_data.OfferingTerm:
    return ukma_data.OfferingTerm.model_validate(
        {
            "termId": term_id,
            "semesters": [1],
            "credits": credits,
            "hoursPerWeek": hours_per_week,
            "lectureHours": lecture_hours,
            "seminarHours": seminar_hours,
            "practiceHours": practice_hours,
            "control": control,
        }
    )


def _ud_faculty(
    faculty_id: str = "ud-fac", *, name: str = "Факультет", removed_at: str | None = None
) -> ukma_data.Faculty:
    return ukma_data.Faculty.model_validate(
        {
            "id": faculty_id,
            "name": name,
            "sazFilterId": None,
            "changeNo": 1,
            "removedAt": removed_at,
        }
    )


def _ud_department(
    department_id: str = "ud-dept",
    *,
    name: str = "Кафедра",
    faculty_id: str | None = "ud-fac",
    removed_at: str | None = None,
) -> ukma_data.Department:
    return ukma_data.Department.model_validate(
        {
            "id": department_id,
            "name": name,
            "sazFilterId": None,
            "facultyId": faculty_id,
            "changeNo": 1,
            "removedAt": removed_at,
        }
    )


def _ud_course(
    course_id: str = "ud-course",
    *,
    title: str = "Курс",
    department_id: str | None = "ud-dept",
    level: str = "bachelor",
    merge_source: str | None = None,
    merged_into: str | None = None,
    removed_at: str | None = None,
) -> ukma_data.Course:
    return ukma_data.Course.model_validate(
        {
            "id": course_id,
            "title": title,
            "departmentId": department_id,
            "level": level,
            "mergedInto": merged_into,
            "mergeSource": merge_source,
            "changeNo": 1,
            "removedAt": removed_at,
        }
    )


def _ud_programme(
    programme_id: str, *, name: str, removed_at: str | None = None
) -> ukma_data.Programme:
    return ukma_data.Programme.model_validate(
        {
            "id": programme_id,
            "name": name,
            "level": "bachelor",
            "sazFilterId": None,
            "changeNo": 1,
            "removedAt": removed_at,
        }
    )


def _ud_offering(
    offering_id: str = "ud-offering",
    *,
    course_id: str | None = "ud-course",
    saz_code: str = "100001",
    title: str = "Курс",
    department_id: str | None = "ud-dept",
    terms: list[ukma_data.OfferingTerm] | None = None,
    programmes: list[dict[str, str]] | None = None,
    annotation: str | None = None,
    study_year: int = 1,
    max_students: int | None = 30,
    max_groups: int | None = 1,
    group_size_min: int = 5,
    group_size_max: int = 30,
    removed_at: str | None = None,
) -> ukma_data.Offering:
    return ukma_data.Offering.model_validate(
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
            "studyYear": study_year,
            "status": "held",
            "isPractical": False,
            "annotation": annotation,
            "maxStudents": max_students,
            "maxGroups": max_groups,
            "computedMaxStudents": max_students,
            "groupSizeMin": group_size_min,
            "groupSizeMax": group_size_max,
            "enrolledActive": None,
            "terms": [_ud_offering_term()] if terms is None else terms,
            "programmes": programmes or [],
            "changeNo": 1,
            "removedAt": removed_at,
        }
    )


def _ud_snapshot(
    *,
    faculties: Sequence[ukma_data.Faculty] = (),
    departments: Sequence[ukma_data.Department] = (),
    programmes: Sequence[ukma_data.Programme] = (),
    terms: Sequence[ukma_data.Term] = (),
    courses: Sequence[ukma_data.Course] = (),
    offerings: Sequence[ukma_data.Offering] = (),
) -> UkmaDataSnapshot:
    return UkmaDataSnapshot(
        faculties={row.id: row for row in faculties},
        departments={row.id: row for row in departments},
        programmes={row.id: row for row in programmes},
        terms={row.id: row for row in terms},
        courses={row.id: row for row in courses},
        offerings={row.id: row for row in offerings},
        data_updated_at=None,
    )


def _ru_faculty(
    faculty_id: str = "ru-fac", *, name: str = "Факультет", ukma_data_id: str | None = "ud-fac"
) -> RuFaculty:
    return RuFaculty(id=faculty_id, name=name, ukma_data_id=ukma_data_id)


def _ru_department(
    department_id: str = "ru-dept",
    *,
    name: str = "Кафедра",
    faculty_id: str = "ru-fac",
    ukma_data_id: str | None = "ud-dept",
) -> RuDepartment:
    return RuDepartment(
        id=department_id,
        name=name,
        faculty_id=faculty_id,
        ukma_data_id=ukma_data_id,
    )


def _ru_course(
    course_id: str = "ru-course",
    *,
    title: str = "Курс",
    department_id: str = "ru-dept",
    education_level: str = "BACHELOR",
    status: str = "ACTIVE",
    description: str = "",
    ukma_data_id: str | None = "ud-course",
    ratings: int = 0,
) -> RuCourse:
    return RuCourse(
        id=course_id,
        title=title,
        department_id=department_id,
        education_level=education_level,
        status=status,
        description=description,
        ukma_data_id=ukma_data_id,
        ratings=ratings,
    )


def _ru_term(
    *,
    year: int = 2025,
    term: str = "FALL",
    credits: str = "3.0",
    weekly_hours: int = 2,
    lecture_count: int | None = 10,
    practice_count: int | None = 10,
    practice_type: str = "SEMINAR",
    exam_type: str = "EXAM",
) -> RuTerm:
    return RuTerm(
        year=year,
        term=term,
        credits=credits,
        weekly_hours=weekly_hours,
        lecture_count=lecture_count,
        practice_count=practice_count,
        practice_type=practice_type,
        exam_type=exam_type,
    )


def _ru_offering(
    offering_id: str = "ru-offering",
    *,
    code: str = "100001",
    course_id: str = "ru-course",
    year: int = 2025,
    term: str = "FALL",
    exam_type: str = "EXAM",
    ukma_data_id: str | None = None,
    terms: tuple[RuTerm, ...] = (),
    specialities: tuple[tuple[str, str], ...] = (),
    ratings: int = 0,
    planned: int = 0,
) -> RuOffering:
    return RuOffering(
        id=offering_id,
        code=code,
        course_id=course_id,
        semester_year=year,
        semester_term=term,
        exam_type=exam_type,
        study_year=1,
        max_students=30,
        max_groups=1,
        group_size_min=5,
        group_size_max=30,
        ukma_data_id=ukma_data_id,
        terms=terms,
        specialities=specialities,
        instructor_links=(),
        ratings=ratings,
        planned=planned,
    )


def _ru_snapshot(
    *,
    faculties: Sequence[RuFaculty] = (),
    departments: Sequence[RuDepartment] = (),
    courses: Sequence[RuCourse] = (),
    offerings: Sequence[RuOffering] = (),
    speciality_names: Sequence[str] = (),
) -> RateUkmaSnapshot:
    return RateUkmaSnapshot(
        faculties={row.id: row for row in faculties},
        departments={row.id: row for row in departments},
        courses={row.id: row for row in courses},
        offerings={row.id: row for row in offerings},
        instructors={},
        speciality_names=frozenset(speciality_names),
    )


def _propose(
    ud: UkmaDataSnapshot,
    ru: RateUkmaSnapshot,
    decisions: Sequence[DecisionView] = (),
    *,
    academic_year: int = 2025,
) -> tuple[list[ChangeDraft], dict[str, list[str]]]:
    return propose_changes(ud, ru, decisions, academic_year=academic_year)


def _by_kind(drafts: Sequence[ChangeDraft], kind: str) -> list[ChangeDraft]:
    return [draft for draft in drafts if draft.kind == kind]


def _only(drafts: Sequence[ChangeDraft], kind: str) -> ChangeDraft:
    matches = _by_kind(drafts, kind)
    assert len(matches) == 1
    return matches[0]


class _CountingOfferings(dict[str, RuOffering]):
    """Counts whole-catalog scans; the builders must read the index instead."""

    def __init__(self, rows: dict[str, RuOffering]) -> None:
        super().__init__(rows)
        self.values_calls = 0

    def values(self):
        self.values_calls += 1
        return super().values()


def test_faculty_and_department_renames_are_change_drafts():
    ud = _ud_snapshot(
        faculties=[_ud_faculty(name="Новий факультет")],
        departments=[_ud_department(name="Нова кафедра")],
    )
    ru = _ru_snapshot(
        faculties=[_ru_faculty(name="Старий факультет")],
        departments=[_ru_department(name="Стара кафедра")],
    )

    drafts, skipped = _propose(ud, ru)

    faculty = _only(drafts, "change_faculty")
    assert (faculty.key, faculty.target_id, faculty.ukma_data_id) == ("ru-fac", "ru-fac", "ud-fac")
    assert faculty.before == {"name": "Старий факультет"}
    assert faculty.after == {"name": "Новий факультет"}
    assert faculty.display == {"name": "Новий факультет"}
    department = _only(drafts, "change_department")
    assert department.key == "ru-dept"
    assert department.before == {"name": "Стара кафедра"}
    assert department.after == {"name": "Нова кафедра"}
    assert skipped == {}


def test_a_course_change_proposes_only_the_fields_that_differ():
    ud = _ud_snapshot(departments=[_ud_department()], courses=[_ud_course(title="Нова назва")])
    ru = _ru_snapshot(
        departments=[_ru_department()],
        courses=[_ru_course(title="Стара назва", description="Старий опис", status="FINISHED")],
    )

    draft = _only(_propose(ud, ru)[0], "change_course")

    assert draft.key == "ru-course"
    assert draft.before == {"title": "Стара назва"}
    assert draft.after == {"title": "Нова назва"}


def test_course_status_is_recomputed_from_the_latest_offering():
    ud = _ud_snapshot(departments=[_ud_department()], courses=[_ud_course()])
    ru = _ru_snapshot(
        departments=[_ru_department()],
        courses=[_ru_course(status="FINISHED")],
        offerings=[_ru_offering(year=2025, term="FALL")],
    )

    draft = _only(_propose(ud, ru, academic_year=2025)[0], "change_course")

    assert draft.after == {"status": "ACTIVE"}


def test_course_status_finishes_when_the_latest_offering_is_older_than_the_year():
    ud = _ud_snapshot(departments=[_ud_department()], courses=[_ud_course()])
    ru = _ru_snapshot(
        departments=[_ru_department()],
        courses=[_ru_course(status="ACTIVE")],
        offerings=[_ru_offering(year=2024, term="FALL")],
    )

    draft = _only(_propose(ud, ru, academic_year=2025)[0], "change_course")

    assert draft.after == {"status": "FINISHED"}


def test_course_description_is_filled_only_when_empty():
    ud = _ud_snapshot(
        departments=[_ud_department()],
        courses=[_ud_course()],
        offerings=[_ud_offering(annotation="Новий опис")],
    )
    empty = _ru_snapshot(
        departments=[_ru_department()],
        courses=[_ru_course(description="")],
        offerings=[_ru_offering(ukma_data_id="ud-offering")],
    )
    filled = _ru_snapshot(
        departments=[_ru_department()],
        courses=[_ru_course(description="Старий опис")],
        offerings=[_ru_offering(ukma_data_id="ud-offering")],
    )

    assert _only(_propose(ud, empty)[0], "change_course").after == {"description": "Новий опис"}
    assert _by_kind(_propose(ud, filled)[0], "change_course") == []


def test_course_moves_to_the_matched_department_of_its_ukma_data_course():
    ud = _ud_snapshot(
        departments=[
            _ud_department(),
            _ud_department("ud-other", name="Інша кафедра"),
        ],
        courses=[_ud_course(department_id="ud-other")],
    )
    ru = _ru_snapshot(
        departments=[
            _ru_department(),
            _ru_department("ru-other", name="Інша кафедра", ukma_data_id="ud-other"),
        ],
        courses=[_ru_course(status="FINISHED")],
    )

    draft = _only(_propose(ud, ru)[0], "change_course")

    assert draft.after == {
        "department": {"id": "ru-other", "ukma_data_id": "ud-other", "name": "Інша кафедра"}
    }


def test_course_moving_to_a_new_department_waits_on_it():
    ud = _ud_snapshot(
        departments=[_ud_department(), _ud_department("ud-new", name="Нова кафедра")],
        courses=[_ud_course(department_id="ud-new")],
    )
    ru = _ru_snapshot(departments=[_ru_department()], courses=[_ru_course(status="FINISHED")])

    draft = _only(_propose(ud, ru)[0], "change_course")

    assert draft.after == {
        "department": {"id": "", "ukma_data_id": "ud-new", "name": "Нова кафедра"}
    }
    assert draft.requires == [{"kind": "new_department", "key": "ud-new"}]


def test_a_colliding_course_identity_is_skipped_and_listed():
    ud = _ud_snapshot(
        departments=[_ud_department()],
        courses=[_ud_course("ud-a", title="Спільна назва")],
    )
    ru = _ru_snapshot(
        departments=[_ru_department()],
        courses=[
            _ru_course("ru-a", title="Стара назва", ukma_data_id="ud-a"),
            _ru_course("ru-b", title="Спільна назва"),
        ],
    )

    drafts, skipped = _propose(ud, ru)

    assert _by_kind(drafts, "change_course") == []
    assert skipped == {"identity_collision": ["ru-a"]}


def _offering_scenario(
    *,
    ud_terms: list[ukma_data.OfferingTerm] | None = None,
    ru_terms: tuple[RuTerm, ...] = (),
    programmes: list[dict[str, str]] | None = None,
    ru_specialities: tuple[tuple[str, str], ...] = (),
    max_students: int | None = 30,
) -> tuple[UkmaDataSnapshot, RateUkmaSnapshot]:
    ud = _ud_snapshot(
        departments=[_ud_department()],
        terms=[_ud_term(), _ud_term(academic_year=2025, season="SPRING")],
        courses=[_ud_course()],
        offerings=[
            _ud_offering(
                terms=ud_terms,
                programmes=programmes,
                max_students=max_students,
            )
        ],
    )
    ru = _ru_snapshot(
        departments=[_ru_department()],
        courses=[_ru_course()],
        offerings=[
            _ru_offering(
                ukma_data_id="ud-offering",
                terms=ru_terms,
                specialities=ru_specialities,
            )
        ],
    )
    return ud, ru


def test_offering_terms_are_replaced_and_the_last_term_becomes_the_semester():
    fall = _ud_offering_term()
    spring = _ud_offering_term("term-2025-SPRING", control="pass_fail", credits=4.0)
    ud, ru = _offering_scenario(ud_terms=[fall, spring], ru_terms=(_ru_term(),))

    draft = _only(_propose(ud, ru)[0], "change_offering")

    assert draft.after["semester"] == {"year": 2026, "term": "SPRING"}
    assert draft.after["exam_type"] == "CREDIT"
    assert draft.after["terms"] == [
        {
            "year": 2025,
            "term": "FALL",
            "credits": "3.0",
            "weekly_hours": 2,
            "lecture_count": 10,
            "practice_count": 10,
            "practice_type": "SEMINAR",
            "exam_type": "EXAM",
        },
        {
            "year": 2026,
            "term": "SPRING",
            "credits": "4.0",
            "weekly_hours": 2,
            "lecture_count": 10,
            "practice_count": 10,
            "practice_type": "SEMINAR",
            "exam_type": "CREDIT",
        },
    ]


def test_offering_change_proposes_only_the_fields_that_differ():
    ud, ru = _offering_scenario(
        ud_terms=[_ud_offering_term()],
        ru_terms=(_ru_term(),),
        max_students=40,
    )

    draft = _only(_propose(ud, ru)[0], "change_offering")

    assert draft.after == {"max_students": 40}
    assert draft.before == {"max_students": 30}


def test_a_practice_term_is_labelled_practice():
    ud, ru = _offering_scenario(
        ud_terms=[_ud_offering_term(seminar_hours=None, practice_hours=12)],
        ru_terms=(_ru_term(practice_count=12, practice_type="SEMINAR"),),
    )

    draft = _only(_propose(ud, ru)[0], "change_offering")

    assert draft.after["terms"][0]["practice_type"] == "PRACTICE"
    assert draft.after["terms"][0]["practice_count"] == 12


def test_offering_specialities_are_only_added_when_the_name_exists_in_rate_ukma():
    ud, ru = _offering_scenario(
        ud_terms=[_ud_offering_term()],
        ru_terms=(_ru_term(),),
        ru_specialities=(("Вже є", "COMPULSORY"),),
        programmes=[
            {"programmeId": "ud-p1", "kind": "compulsory"},
            {"programmeId": "ud-p2", "kind": "elective"},
            {"programmeId": "ud-p3", "kind": "prof_oriented"},
        ],
    )
    ud = _ud_snapshot(
        faculties=list(ud.faculties.values()),
        departments=list(ud.departments.values()),
        programmes=[
            _ud_programme("ud-p1", name="Програмна інженерія"),
            _ud_programme("ud-p2", name="Невідома програма"),
            _ud_programme("ud-p3", name="Вже є"),
        ],
        terms=list(ud.terms.values()),
        courses=list(ud.courses.values()),
        offerings=list(ud.offerings.values()),
    )
    ru = _ru_snapshot(
        faculties=list(ru.faculties.values()),
        departments=list(ru.departments.values()),
        courses=list(ru.courses.values()),
        offerings=list(ru.offerings.values()),
        speciality_names=["Програмна інженерія", "Вже є"],
    )

    draft = _only(_propose(ud, ru)[0], "change_offering")

    assert draft.after["specialities_added"] == [
        {"name": "Програмна інженерія", "kind": "COMPULSORY"}
    ]


def test_a_course_ukma_data_lacks_is_a_removed_course():
    ud = _ud_snapshot(departments=[_ud_department()])
    ru = _ru_snapshot(
        departments=[_ru_department()],
        courses=[_ru_course(title="Зниклий курс", ukma_data_id="ud-gone", ratings=3)],
    )

    draft = _only(_propose(ud, ru)[0], "removed_course")

    assert draft.key == "ru-course"
    assert draft.after == {
        "ukma_data_id": "ud-gone",
        "title": "Зниклий курс",
        "removed_at": None,
    }
    assert draft.ratings == 3
    assert draft.display["course"]["title"] == "Зниклий курс"


def test_a_removed_ukma_data_course_carries_its_removal_time():
    removed_at = "2026-01-01T00:00:00Z"
    ud = _ud_snapshot(
        departments=[_ud_department()],
        courses=[_ud_course(removed_at=removed_at)],
    )
    ru = _ru_snapshot(departments=[_ru_department()], courses=[_ru_course()])

    draft = _only(_propose(ud, ru)[0], "removed_course")

    assert draft.after["removed_at"] == removed_at


def test_a_merged_ukma_data_course_is_not_removed():
    ud = _ud_snapshot(
        departments=[_ud_department()],
        courses=[
            _ud_course("ud-old", merged_into="ud-new"),
            _ud_course("ud-new"),
        ],
    )
    ru = _ru_snapshot(
        departments=[_ru_department()],
        courses=[_ru_course(ukma_data_id="ud-old")],
    )

    drafts, _ = _propose(ud, ru)

    assert _by_kind(drafts, "removed_course") == []


def test_offerings_ukma_data_lacks_or_marks_removed_are_removed_offerings():
    ud = _ud_snapshot(
        departments=[_ud_department()],
        courses=[_ud_course()],
        offerings=[
            _ud_offering("ud-live", saz_code="100001"),
            _ud_offering("ud-gone", saz_code="100002", removed_at="2026-02-02T00:00:00Z"),
        ],
    )
    ru = _ru_snapshot(
        departments=[_ru_department()],
        courses=[_ru_course()],
        offerings=[
            _ru_offering("ru-live", code="100001", ukma_data_id="ud-live"),
            _ru_offering("ru-gone", code="100002", ukma_data_id="ud-gone"),
            _ru_offering("ru-missing", code="100003"),
        ],
    )

    drafts = _by_kind(_propose(ud, ru)[0], "removed_offering")

    assert [draft.key for draft in drafts] == ["ru-gone", "ru-missing"]
    assert [draft.after["saz_code"] for draft in drafts] == ["100002", "100003"]
    assert [draft.after["removed_at"] for draft in drafts] == ["2026-02-02T00:00:00Z", None]


def _complete_scenario() -> tuple[UkmaDataSnapshot, RateUkmaSnapshot]:
    ud = _ud_snapshot(
        faculties=[_ud_faculty(name="Новий факультет")],
        departments=[
            _ud_department(name="Нова кафедра"),
            _ud_department("ud-other", name="Інша кафедра"),
        ],
        terms=[_ud_term()],
        courses=[
            _ud_course("ud-a"),
            _ud_course("ud-c"),
            _ud_course("ud-moved", title="Нова назва", department_id="ud-other"),
            _ud_course("ud-removed", title="Зниклий", removed_at="2026-01-01T00:00:00Z"),
        ],
        offerings=[
            _ud_offering("ud-1", course_id="ud-a", saz_code="100001"),
            _ud_offering("ud-2", course_id="ud-c", saz_code="100002", max_students=40),
            _ud_offering(
                "ud-3",
                course_id="ud-a",
                saz_code="100003",
                removed_at="2026-02-02T00:00:00Z",
            ),
        ],
    )
    ru = _ru_snapshot(
        faculties=[_ru_faculty(name="Старий факультет")],
        departments=[
            _ru_department(name="Стара кафедра"),
            _ru_department("ru-other", name="Інша кафедра", ukma_data_id="ud-other"),
        ],
        courses=[
            _ru_course("ru-a", ukma_data_id="ud-a", status="FINISHED", description="Опис"),
            _ru_course("ru-c", ukma_data_id="ud-c"),
            _ru_course("ru-moved", title="Стара назва", ukma_data_id="ud-moved"),
            _ru_course("ru-removed", title="Зниклий", ukma_data_id="ud-removed"),
        ],
        offerings=[
            _ru_offering(
                "ru-1", code="100001", course_id="ru-a", ukma_data_id="ud-1", terms=(_ru_term(),)
            ),
            _ru_offering(
                "ru-2", code="100002", course_id="ru-c", ukma_data_id="ud-2", terms=(_ru_term(),)
            ),
            _ru_offering("ru-3", code="100003", course_id="ru-a", ukma_data_id="ud-3"),
            _ru_offering("ru-4", code="100004", course_id="ru-a"),
        ],
    )
    return ud, ru


def test_every_change_draft_after_validates_against_its_payload():
    ud, ru = _complete_scenario()

    drafts, _ = _propose(ud, ru)

    assert {draft.kind for draft in drafts} == PROPOSED_KINDS
    for draft in drafts:
        PAYLOADS[draft.kind].model_validate({**draft.after, "display": draft.display})


def test_drafts_are_sorted_by_kind_order_then_key():
    ud, ru = _complete_scenario()

    drafts, _ = _propose(ud, ru)

    assert [(draft.kind, draft.key) for draft in drafts] == sorted(
        ((draft.kind, draft.key) for draft in drafts),
        key=lambda item: (KIND_BY_NAME[item[0]].order, item[1]),
    )


def test_the_builder_stays_linear_in_the_catalog_size():
    courses = 2_000
    offerings_per_course = 5
    ud_courses = []
    ud_offerings = []
    ru_courses = []
    ru_offerings = []
    for i in range(courses):
        ud_course_id = f"ud-{i:05d}"
        ru_course_id = f"ru-{i:05d}"
        ud_courses.append(_ud_course(ud_course_id))
        ru_courses.append(_ru_course(ru_course_id, ukma_data_id=ud_course_id, status="FINISHED"))
        for j in range(offerings_per_course):
            saz_code = f"{i * offerings_per_course + j:06d}"
            ud_offering_id = f"ud-offering-{i}-{j}"
            ud_offerings.append(
                _ud_offering(ud_offering_id, course_id=ud_course_id, saz_code=saz_code)
            )
            ru_offerings.append(
                _ru_offering(
                    f"ru-offering-{i}-{j}",
                    code=saz_code,
                    course_id=ru_course_id,
                    ukma_data_id=ud_offering_id,
                    terms=(_ru_term(),),
                )
            )

    ud = _ud_snapshot(
        departments=[_ud_department()],
        terms=[_ud_term()],
        courses=ud_courses,
        offerings=ud_offerings,
    )
    ru = _ru_snapshot(
        departments=[_ru_department()],
        courses=ru_courses,
        offerings=ru_offerings,
    )
    offerings = _CountingOfferings(dict(ru.offerings))
    ru = replace(ru, offerings=offerings)

    started = time.perf_counter()
    drafts, _ = _propose(ud, ru)
    elapsed = time.perf_counter() - started

    assert len(_by_kind(drafts, "change_course")) == courses
    assert offerings.values_calls <= 2
    assert elapsed < 5.0
