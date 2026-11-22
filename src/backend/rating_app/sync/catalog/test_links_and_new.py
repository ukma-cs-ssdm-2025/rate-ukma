from __future__ import annotations

import pytest

from rating_app.application_schemas import ukma_data_api as ud
from rating_app.sync.catalog.links_and_new import propose_links_and_new
from rating_app.sync.constants import (
    BAD_SAZ_CODE,
    CREDITS_OUT_OF_RANGE,
    IDENTITY_COLLISION,
    NO_DEPARTMENT,
    NO_TERM,
    TITLE_TOO_LONG,
    UNKNOWN_PROGRAMME,
    ZERO_CREDITS,
)
from rating_app.sync.drafts import ChangeDraft, DecisionView
from rating_app.sync.kinds import KIND_BY_NAME
from rating_app.sync.payloads import PAYLOADS
from rating_app.sync.snapshot import (
    RateUkmaSnapshot,
    RuCourse,
    RuDepartment,
    RuFaculty,
    RuOffering,
    UkmaDataSnapshot,
)

LONG_NAME = "Я" * 256


def _ud_term(year: int = 2025, season: str = "FALL") -> ud.Term:
    return ud.Term.model_validate(
        {
            "id": f"term-{year}-{season}",
            "code": f"{year}-{season}",
            "academicYear": year,
            "season": season,
            "changeNo": 1,
        }
    )


def _term(
    term_id: str = "term-2025-FALL",
    *,
    credits: float = 3.0,
    control: str | None = "exam",
    hours_per_week: int | None = 2,
    lecture_hours: int | None = 16,
    seminar_hours: int | None = None,
    practice_hours: int | None = None,
) -> ud.OfferingTerm:
    return ud.OfferingTerm.model_validate(
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


def _programme_link(programme_id: str, kind: str = "compulsory") -> ud.OfferingProgramme:
    return ud.OfferingProgramme.model_validate({"programmeId": programme_id, "kind": kind})


def _ud_programme(programme_id: str, *, name: str, removed_at: str | None = None) -> ud.Programme:
    return ud.Programme.model_validate(
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
    academic_year: int = 2025,
    annotation: str | None = None,
    terms: list[ud.OfferingTerm] | None = None,
    programmes: list[ud.OfferingProgramme] | None = None,
    removed_at: str | None = None,
) -> ud.Offering:
    return ud.Offering.model_validate(
        {
            "id": offering_id,
            "sazCode": saz_code,
            "academicYear": academic_year,
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
            "annotation": annotation,
            "maxStudents": 30,
            "maxGroups": 1,
            "computedMaxStudents": 30,
            "groupSizeMin": 5,
            "groupSizeMax": 30,
            "enrolledActive": None,
            "courseId": course_id,
            "terms": [_term()] if terms is None else terms,
            "programmes": programmes or [],
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
    merged_into: str | None = None,
    removed_at: str | None = None,
    merge_source: str | None = None,
) -> ud.Course:
    return ud.Course.model_validate(
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


def _ud_department(
    department_id: str = "ud-dept",
    *,
    name: str = "Кафедра даних",
    faculty_id: str | None = "ud-fac",
    removed_at: str | None = None,
) -> ud.Department:
    return ud.Department.model_validate(
        {
            "id": department_id,
            "name": name,
            "sazFilterId": None,
            "facultyId": faculty_id,
            "changeNo": 1,
            "removedAt": removed_at,
        }
    )


def _ud_faculty(
    faculty_id: str = "ud-fac", *, name: str = "Факультет даних", removed_at: str | None = None
) -> ud.Faculty:
    return ud.Faculty.model_validate(
        {
            "id": faculty_id,
            "name": name,
            "sazFilterId": None,
            "changeNo": 1,
            "removedAt": removed_at,
        }
    )


def _ud_snapshot(
    *,
    faculties: list[ud.Faculty] | None = None,
    departments: list[ud.Department] | None = None,
    programmes: list[ud.Programme] | None = None,
    terms: list[ud.Term] | None = None,
    courses: list[ud.Course] | None = None,
    offerings: list[ud.Offering] | None = None,
) -> UkmaDataSnapshot:
    return UkmaDataSnapshot(
        faculties={row.id: row for row in faculties or []},
        departments={row.id: row for row in departments or []},
        programmes={row.id: row for row in programmes or []},
        terms={row.id: row for row in terms or []},
        courses={row.id: row for row in courses or []},
        offerings={row.id: row for row in offerings or []},
        data_updated_at=None,
    )


def _ru_faculty(
    faculty_id: str = "ru-fac", *, name: str = "Факультет даних", ukma_data_id: str | None = None
) -> RuFaculty:
    return RuFaculty(id=faculty_id, name=name, ukma_data_id=ukma_data_id)


def _ru_department(
    department_id: str = "ru-dept",
    *,
    name: str = "Кафедра даних",
    faculty_id: str = "ru-fac",
    ukma_data_id: str | None = None,
) -> RuDepartment:
    return RuDepartment(
        id=department_id, name=name, faculty_id=faculty_id, ukma_data_id=ukma_data_id
    )


def _ru_course(
    course_id: str = "ru-course",
    *,
    title: str = "Курс",
    department_id: str = "ru-dept",
    education_level: str = "BACHELOR",
    ukma_data_id: str | None = None,
    ratings: int = 0,
) -> RuCourse:
    return RuCourse(
        id=course_id,
        title=title,
        department_id=department_id,
        education_level=education_level,
        status="ACTIVE",
        description="",
        ukma_data_id=ukma_data_id,
        ratings=ratings,
    )


def _ru_offering(
    offering_id: str = "ru-offering",
    *,
    code: str = "100001",
    course_id: str = "ru-course",
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
        ukma_data_id=None,
        terms=(),
        specialities=(),
        instructor_links=(),
        ratings=0,
        planned=0,
    )


def _ru_snapshot(
    *,
    faculties: list[RuFaculty] | None = None,
    departments: list[RuDepartment] | None = None,
    courses: list[RuCourse] | None = None,
    offerings: list[RuOffering] | None = None,
    speciality_names: frozenset[str] = frozenset(),
) -> RateUkmaSnapshot:
    return RateUkmaSnapshot(
        faculties={row.id: row for row in faculties or []},
        departments={row.id: row for row in departments or []},
        courses={row.id: row for row in courses or []},
        offerings={row.id: row for row in offerings or []},
        instructors={},
        speciality_names=speciality_names,
    )


def _linked_base(
    *,
    courses: list[RuCourse] | None = None,
    offerings: list[RuOffering] | None = None,
    speciality_names: frozenset[str] = frozenset(),
) -> RateUkmaSnapshot:
    return _ru_snapshot(
        faculties=[_ru_faculty(name="Факультет даних", ukma_data_id="ud-fac")],
        departments=[_ru_department(name="Кафедра даних", ukma_data_id="ud-dept")],
        courses=courses,
        offerings=offerings,
        speciality_names=speciality_names,
    )


def _shared_course(
    *,
    decisions: list[DecisionView] | None = None,
    offering_department: str = "ud-dept-a",
) -> tuple[UkmaDataSnapshot, RateUkmaSnapshot]:
    terms = [_ud_term()]
    snapshot = _ud_snapshot(
        faculties=[_ud_faculty()],
        departments=[
            _ud_department("ud-dept-a", name="Кафедра А"),
            _ud_department("ud-dept-b", name="Кафедра Б"),
            _ud_department("ud-dept-c", name="Кафедра В"),
        ],
        terms=terms,
        courses=[_ud_course(title="Спільний курс")],
        offerings=[
            _ud_offering("ud-a", saz_code="100001", department_id="ud-dept-a"),
            _ud_offering("ud-b", saz_code="100002", department_id="ud-dept-b"),
            _ud_offering(
                "ud-new", saz_code="100003", department_id=offering_department, title="Новий"
            ),
        ],
    )
    ru = _ru_snapshot(
        faculties=[_ru_faculty(name="Факультет даних", ukma_data_id="ud-fac")],
        departments=[
            _ru_department("ru-dept-a", name="Кафедра А", ukma_data_id="ud-dept-a"),
            _ru_department("ru-dept-b", name="Кафедра Б", ukma_data_id="ud-dept-b"),
            _ru_department("ru-dept-c", name="Кафедра В", ukma_data_id="ud-dept-c"),
        ],
        courses=[
            _ru_course("ru-a", title="Курс А", department_id="ru-dept-a"),
            _ru_course("ru-b", title="Курс Б", department_id="ru-dept-b"),
        ],
        offerings=[
            _ru_offering("ru-off-a", code="100001", course_id="ru-a"),
            _ru_offering("ru-off-b", code="100002", course_id="ru-b"),
        ],
    )
    return snapshot, ru


def _of_kind(drafts: list[ChangeDraft], kind: str) -> list[ChangeDraft]:
    return [draft for draft in drafts if draft.kind == kind]


def _one(drafts: list[ChangeDraft], kind: str) -> ChangeDraft:
    matches = _of_kind(drafts, kind)
    assert len(matches) == 1, matches
    return matches[0]


def _keep_apart(*, answer: str = "keep_apart", into_id: str | None = None) -> DecisionView:
    return DecisionView(
        kind="merge_courses",
        question_key="ud-course",
        ukma_course_id="ud-course",
        saz_code="",
        course_id=None,
        offering_id=None,
        answer=answer,
        into_id=into_id,
        premise={
            "course_ids": ["ru-a", "ru-b"],
            "ukma_course_id": "ud-course",
            "merge_source": None,
            "ratings": {"ru-a": 0, "ru-b": 0},
        },
    )


def test_links_matched_rows_and_puts_a_new_offering_on_the_majority_course():
    terms = [_ud_term()]
    snapshot = _ud_snapshot(
        faculties=[_ud_faculty()],
        departments=[_ud_department()],
        terms=terms,
        courses=[_ud_course(title="Аналіз даних")],
        offerings=[
            _ud_offering("ud-1", saz_code="111111"),
            _ud_offering("ud-2", saz_code="222222"),
            _ud_offering("ud-3", saz_code="333333", title="Нове"),
        ],
    )
    ru = _ru_snapshot(
        faculties=[_ru_faculty()],
        departments=[_ru_department()],
        courses=[_ru_course(title="Аналіз даних", ratings=2)],
        offerings=[
            _ru_offering("ru-1", code="111111"),
            _ru_offering("ru-2", code="222222"),
        ],
    )

    drafts, skipped = propose_links_and_new(snapshot, ru, [], academic_year=2025)

    assert skipped == {}
    assert [draft.kind for draft in drafts] == [
        "link_faculty",
        "link_department",
        "link_course",
        "new_offering",
        "link_offering",
        "link_offering",
    ]
    course = _one(drafts, "link_course")
    assert (course.key, course.target_id, course.ukma_data_id) == (
        "ru-course",
        "ru-course",
        "ud-course",
    )
    assert course.before == {"ukma_data_id": None}
    assert course.ratings == 2
    offering = _one(drafts, "new_offering")
    assert offering.key == "ud-3"
    assert offering.after["course_id"] == "ru-course"
    assert offering.after.get("course_ukma_id") is None
    assert offering.requires == []
    assert offering.before == {}
    assert offering.ratings == 2
    links = _of_kind(drafts, "link_offering")
    assert [link.key for link in links] == ["ru-1", "ru-2"]
    assert links[0].before == {"ukma_data_id": None}
    assert links[0].after == {"ukma_data_id": "ud-1"}


def test_a_course_links_to_the_ukma_data_course_with_most_matches():
    terms = [_ud_term()]
    snapshot = _ud_snapshot(
        faculties=[_ud_faculty()],
        departments=[_ud_department()],
        terms=terms,
        courses=[
            _ud_course("ud-a", title="Курс А"),
            _ud_course("ud-b", title="Курс Б"),
        ],
        offerings=[
            _ud_offering("ud-1", course_id="ud-a", saz_code="111111"),
            _ud_offering("ud-2", course_id="ud-a", saz_code="222222"),
            _ud_offering("ud-3", course_id="ud-b", saz_code="333333"),
        ],
    )
    ru = _linked_base(
        courses=[_ru_course()],
        offerings=[
            _ru_offering("ru-1", code="111111"),
            _ru_offering("ru-2", code="222222"),
            _ru_offering("ru-3", code="333333"),
        ],
    )

    drafts, _ = propose_links_and_new(snapshot, ru, [], academic_year=2025)

    assert [_one(drafts, "link_course").after] == [{"ukma_data_id": "ud-a"}]


def test_new_rows_require_the_parent_created_in_the_same_run():
    snapshot = _ud_snapshot(
        faculties=[_ud_faculty()],
        departments=[_ud_department()],
        terms=[_ud_term()],
        courses=[_ud_course()],
        offerings=[_ud_offering()],
    )

    drafts, skipped = propose_links_and_new(snapshot, _ru_snapshot(), [], academic_year=2025)

    assert skipped == {}
    assert [draft.kind for draft in drafts] == [
        "new_faculty",
        "new_department",
        "new_course",
        "new_offering",
    ]
    assert _one(drafts, "new_department").requires == [{"kind": "new_faculty", "key": "ud-fac"}]
    assert _one(drafts, "new_course").requires == [{"kind": "new_department", "key": "ud-dept"}]
    offering = _one(drafts, "new_offering")
    assert offering.requires == [{"kind": "new_course", "key": "ud-course"}]
    assert offering.after["course_ukma_id"] == "ud-course"
    assert offering.after.get("course_id") is None


def test_a_new_course_links_to_an_existing_course_with_the_same_identity():
    snapshot = _ud_snapshot(
        faculties=[_ud_faculty()],
        departments=[_ud_department()],
        terms=[_ud_term()],
        courses=[_ud_course(title="Аналіз даних")],
        offerings=[_ud_offering()],
    )
    ru = _linked_base(courses=[_ru_course(title="Аналіз даних", ratings=3)])

    drafts, skipped = propose_links_and_new(snapshot, ru, [], academic_year=2025)

    assert skipped == {}
    assert _of_kind(drafts, "new_course") == []
    assert _one(drafts, "link_course").after == {"ukma_data_id": "ud-course"}
    offering = _one(drafts, "new_offering")
    assert offering.after["course_id"] == "ru-course"
    assert offering.ratings == 3


def test_an_identity_held_by_another_course_is_a_skip():
    snapshot = _ud_snapshot(
        faculties=[_ud_faculty()],
        departments=[_ud_department()],
        terms=[_ud_term()],
        courses=[_ud_course(title="Аналіз даних")],
        offerings=[_ud_offering("ud-off")],
    )
    ru = _linked_base(courses=[_ru_course(title="Аналіз даних", ukma_data_id="ud-other")])

    drafts, skipped = propose_links_and_new(snapshot, ru, [], academic_year=2025)

    assert drafts == []
    assert skipped == {IDENTITY_COLLISION: ["ud-course", "ud-off"]}


@pytest.mark.parametrize(
    ("academic_year", "status"),
    [(2025, "ACTIVE"), (2026, "FINISHED")],
)
def test_a_new_course_derives_status_and_description_from_its_latest_offering(
    academic_year, status
):
    terms = [_ud_term(2023), _ud_term(2025)]
    snapshot = _ud_snapshot(
        faculties=[_ud_faculty()],
        departments=[_ud_department()],
        terms=terms,
        courses=[_ud_course()],
        offerings=[
            _ud_offering(
                "ud-old",
                saz_code="111111",
                academic_year=2023,
                annotation="Старий опис",
                terms=[_term("term-2023-FALL")],
            ),
            _ud_offering(
                "ud-new",
                saz_code="222222",
                academic_year=2025,
                annotation="Новий опис",
                terms=[_term("term-2025-FALL")],
            ),
        ],
    )

    drafts, _ = propose_links_and_new(snapshot, _linked_base(), [], academic_year=academic_year)

    course = _one(drafts, "new_course")
    assert course.after["title"] == "Курс"
    assert course.after["level"] == "BACHELOR"
    assert course.after["department_ukma_id"] == "ud-dept"
    assert course.after["status"] == status
    assert course.after["description"] == "Новий опис"


def test_skips_rows_rate_ukma_cannot_store():
    terms = [_ud_term()]
    snapshot = _ud_snapshot(
        faculties=[_ud_faculty()],
        departments=[_ud_department()],
        programmes=[_ud_programme("ud-programme", name="Невідома програма")],
        terms=terms,
        courses=[_ud_course()],
        offerings=[
            _ud_offering("ud-no-term", terms=[]),
            _ud_offering("ud-zero", terms=[_term(credits=0.0)]),
            _ud_offering("ud-big", terms=[_term(credits=100.0)]),
            _ud_offering("ud-decimals", terms=[_term(credits=3.25)]),
            _ud_offering("ud-long-title", title=LONG_NAME),
            _ud_offering("ud-bad-saz", saz_code="12345"),
            _ud_offering("ud-no-department", department_id=None),
            _ud_offering("ud-programme", programmes=[_programme_link("ud-programme")]),
        ],
    )

    drafts, skipped = propose_links_and_new(snapshot, _linked_base(), [], academic_year=2025)

    assert drafts == []
    assert skipped == {
        NO_TERM: ["ud-no-term"],
        ZERO_CREDITS: ["ud-zero"],
        CREDITS_OUT_OF_RANGE: ["ud-big", "ud-decimals"],
        TITLE_TOO_LONG: ["ud-long-title"],
        BAD_SAZ_CODE: ["ud-bad-saz"],
        NO_DEPARTMENT: ["ud-no-department"],
        UNKNOWN_PROGRAMME: ["ud-programme"],
    }


def test_skips_a_name_over_the_model_limit_and_its_offerings():
    snapshot = _ud_snapshot(
        faculties=[_ud_faculty(name=LONG_NAME)],
        departments=[_ud_department(name=LONG_NAME)],
        terms=[_ud_term()],
        courses=[_ud_course()],
        offerings=[_ud_offering("ud-off")],
    )

    drafts, skipped = propose_links_and_new(snapshot, _ru_snapshot(), [], academic_year=2025)

    assert drafts == []
    assert skipped == {
        TITLE_TOO_LONG: ["ud-dept", "ud-fac"],
        NO_DEPARTMENT: ["ud-course", "ud-off"],
    }


def test_terms_are_sorted_and_the_semester_is_the_last_one():
    terms = [_ud_term(2025, "FALL"), _ud_term(2025, "SPRING")]
    snapshot = _ud_snapshot(
        faculties=[_ud_faculty()],
        departments=[_ud_department()],
        programmes=[
            _ud_programme("ud-p1", name="Медіа"),
            _ud_programme("ud-p2", name="Аналіз"),
        ],
        terms=terms,
        courses=[_ud_course()],
        offerings=[
            _ud_offering(
                "ud-off",
                terms=[
                    _term("term-2025-FALL", control="pass_fail", hours_per_week=None),
                    _term(
                        "term-2025-SPRING",
                        credits=4.5,
                        control="exam",
                        hours_per_week=3,
                        seminar_hours=2,
                    ),
                ],
                programmes=[
                    _programme_link("ud-p1", "prof_oriented"),
                    _programme_link("ud-p2", "compulsory"),
                ],
            )
        ],
    )
    ru = _linked_base(speciality_names=frozenset({"Медіа", "Аналіз"}))

    drafts, _ = propose_links_and_new(snapshot, ru, [], academic_year=2025)

    after = _one(drafts, "new_offering").after
    assert after["semester"] == {"year": 2026, "term": "SPRING"}
    assert [term["term"] for term in after["terms"]] == ["FALL", "SPRING"]
    assert [term["exam_type"] for term in after["terms"]] == ["CREDIT", "EXAM"]
    assert after["terms"][0]["weekly_hours"] == 0
    assert after["terms"][0]["practice_count"] is None
    assert after["terms"][0]["practice_type"] == ""
    assert after["terms"][1]["practice_count"] == 2
    assert after["terms"][1]["practice_type"] == "SEMINAR"
    assert after["specialities"] == [
        {"name": "Аналіз", "kind": "COMPULSORY"},
        {"name": "Медіа", "kind": "PROF_ORIENTED"},
    ]


def test_several_courses_for_one_ukma_data_course_ask_where_an_offering_goes():
    snapshot, ru = _shared_course()

    drafts, _ = propose_links_and_new(snapshot, ru, [], academic_year=2025)

    assert _of_kind(drafts, "link_course") == []
    question = _one(drafts, "place_offering")
    assert question.key == "ud-new"
    assert question.after["candidates"] == ["ru-a", "ru-b"]
    assert question.display["courses"][0]["title"] == "Курс А"


def test_keep_apart_places_an_offering_on_the_one_department_course():
    snapshot, ru = _shared_course()

    drafts, _ = propose_links_and_new(snapshot, ru, [_keep_apart()], academic_year=2025)

    assert _of_kind(drafts, "place_offering") == []
    assert _one(drafts, "new_offering").after["course_id"] == "ru-a"


def test_keep_apart_asks_when_the_department_does_not_pick_one_course():
    snapshot, ru = _shared_course(offering_department="ud-dept-c")

    drafts, _ = propose_links_and_new(snapshot, ru, [_keep_apart()], academic_year=2025)

    assert _one(drafts, "place_offering").after["candidates"] == ["ru-a", "ru-b"]


def test_keep_apart_can_merge_the_offering_into_the_chosen_course():
    snapshot, ru = _shared_course()

    drafts, _ = propose_links_and_new(
        snapshot, ru, [_keep_apart(answer="merge", into_id="ru-b")], academic_year=2025
    )

    assert _one(drafts, "new_offering").after["course_id"] == "ru-b"


def test_a_live_place_decision_answers_the_question():
    snapshot, ru = _shared_course()
    decision = DecisionView(
        kind="place_offering",
        question_key="ud-new",
        ukma_course_id="ud-course",
        saz_code="100003",
        course_id=None,
        offering_id=None,
        answer="place",
        into_id="ru-b",
        premise={
            "course_ids": ["ru-a", "ru-b"],
            "ukma_course_id": "ud-course",
            "merge_source": None,
            "ratings": {"ru-a": 0, "ru-b": 0},
        },
    )

    drafts, _ = propose_links_and_new(snapshot, ru, [decision], academic_year=2025)

    assert _of_kind(drafts, "place_offering") == []
    assert _one(drafts, "new_offering").after["course_id"] == "ru-b"


def test_a_place_decision_whose_premise_changed_is_ignored_and_asked_again():
    snapshot, ru = _shared_course()
    decision = DecisionView(
        kind="place_offering",
        question_key="ud-new",
        ukma_course_id="ud-course",
        saz_code="100003",
        course_id=None,
        offering_id=None,
        answer="place",
        into_id="ru-b",
        premise={"course_ids": ["ru-a"], "ukma_course_id": "ud-course"},
    )

    drafts, _ = propose_links_and_new(snapshot, ru, [decision], academic_year=2025)

    assert _of_kind(drafts, "new_offering") == []
    assert _one(drafts, "place_offering").after["candidates"] == ["ru-a", "ru-b"]


def test_removed_rows_are_ignored_and_a_merged_course_stays_ignored():
    snapshot = _ud_snapshot(
        faculties=[_ud_faculty(removed_at="2026-01-01")],
        departments=[_ud_department(removed_at="2026-01-01")],
        terms=[_ud_term()],
        courses=[_ud_course(removed_at="2026-01-01")],
        offerings=[_ud_offering("ud-removed", removed_at="2026-01-01")],
    )

    drafts, skipped = propose_links_and_new(snapshot, _ru_snapshot(), [], academic_year=2025)

    assert drafts == []
    assert skipped == {}


def test_a_merged_ukma_data_course_uses_the_surviving_course():
    snapshot = _ud_snapshot(
        faculties=[_ud_faculty()],
        departments=[_ud_department()],
        terms=[_ud_term()],
        courses=[
            _ud_course("ud-old", merged_into="ud-kept"),
            _ud_course("ud-kept", title="Живий курс"),
        ],
        offerings=[_ud_offering("ud-off", course_id="ud-old")],
    )

    drafts, _ = propose_links_and_new(snapshot, _linked_base(), [], academic_year=2025)

    assert _one(drafts, "new_course").key == "ud-kept"
    assert _one(drafts, "new_offering").after["course_ukma_id"] == "ud-kept"


def test_drafts_are_sorted_and_every_after_validates_against_its_payload():
    snapshot = _ud_snapshot(
        faculties=[_ud_faculty()],
        departments=[_ud_department()],
        terms=[_ud_term()],
        courses=[_ud_course()],
        offerings=[
            _ud_offering("ud-a", saz_code="111111"),
            _ud_offering("ud-b", saz_code="222222"),
            _ud_offering("ud-c", saz_code="333333"),
        ],
    )
    ru = _linked_base(
        courses=[_ru_course(ratings=1)],
        offerings=[_ru_offering("ru-off", code="111111")],
    )

    drafts, _ = propose_links_and_new(snapshot, ru, [], academic_year=2025)

    assert drafts == sorted(drafts, key=lambda draft: (KIND_BY_NAME[draft.kind].order, draft.key))
    for draft in drafts:
        PAYLOADS[draft.kind].model_validate({**draft.after, "display": draft.display})
