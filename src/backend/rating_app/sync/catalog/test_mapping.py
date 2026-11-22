from __future__ import annotations

import time
from collections.abc import Sequence
from dataclasses import replace

from rating_app.application_schemas import ukma_data_api as ukma_data
from rating_app.sync.catalog.mapping import propose_mapping_questions
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

MAPPING_KINDS = {"relink_course", "move_offering", "merge_courses"}


def _ud_faculty(faculty_id: str = "ud-fac", *, name: str = "Факультет") -> ukma_data.Faculty:
    return ukma_data.Faculty.model_validate(
        {
            "id": faculty_id,
            "name": name,
            "sazFilterId": None,
            "changeNo": 1,
            "removedAt": None,
        }
    )


def _ud_department(
    department_id: str = "ud-dept", *, name: str = "Кафедра"
) -> ukma_data.Department:
    return ukma_data.Department.model_validate(
        {
            "id": department_id,
            "name": name,
            "sazFilterId": None,
            "facultyId": "ud-fac",
            "changeNo": 1,
            "removedAt": None,
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


def _ud_offering(
    offering_id: str = "ud-offering",
    *,
    course_id: str | None = "ud-course",
    saz_code: str = "100001",
    title: str = "Курс",
    department_id: str | None = "ud-dept",
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
            "terms": [
                ukma_data.OfferingTerm.model_validate(
                    {
                        "termId": "term-2025-FALL",
                        "semesters": [1],
                        "credits": 3.0,
                        "hoursPerWeek": 2,
                        "lectureHours": 10,
                        "seminarHours": 10,
                        "practiceHours": None,
                        "control": "exam",
                    }
                )
            ],
            "programmes": [],
            "changeNo": 1,
            "removedAt": removed_at,
        }
    )


def _ud_snapshot(
    *,
    faculties: Sequence[ukma_data.Faculty] = (),
    departments: Sequence[ukma_data.Department] = (),
    courses: Sequence[ukma_data.Course] = (),
    offerings: Sequence[ukma_data.Offering] = (),
) -> UkmaDataSnapshot:
    return UkmaDataSnapshot(
        faculties={row.id: row for row in faculties},
        departments={row.id: row for row in departments},
        programmes={},
        terms={},
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


def _ru_offering(
    offering_id: str = "ru-offering",
    *,
    code: str = "100001",
    course_id: str = "ru-course",
    year: int = 2025,
    term: str = "FALL",
    exam_type: str = "EXAM",
    ukma_data_id: str | None = None,
    ratings: int = 0,
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
        terms=(),
        specialities=(),
        instructor_links=(),
        ratings=ratings,
        planned=0,
    )


def _ru_snapshot(
    *,
    faculties: Sequence[RuFaculty] = (),
    departments: Sequence[RuDepartment] = (),
    courses: Sequence[RuCourse] = (),
    offerings: Sequence[RuOffering] = (),
) -> RateUkmaSnapshot:
    return RateUkmaSnapshot(
        faculties={row.id: row for row in faculties},
        departments={row.id: row for row in departments},
        courses={row.id: row for row in courses},
        offerings={row.id: row for row in offerings},
        instructors={},
        speciality_names=frozenset(),
    )


def _propose(
    ud: UkmaDataSnapshot,
    ru: RateUkmaSnapshot,
    decisions: Sequence[DecisionView] = (),
) -> list[ChangeDraft]:
    return propose_mapping_questions(ud, ru, decisions)


def _decision(
    kind: str,
    key: str,
    answer: str,
    premise: dict[str, object],
    *,
    ukma_course_id: str = "ud-course",
    saz_code: str = "",
    into_id: str | None = None,
) -> DecisionView:
    return DecisionView(
        kind=kind,
        question_key=key,
        ukma_course_id=ukma_course_id,
        saz_code=saz_code,
        course_id=None,
        offering_id=None,
        answer=answer,
        into_id=into_id,
        premise=premise,
    )


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


def _merge_scenario(
    *, merge_source: str | None = None
) -> tuple[UkmaDataSnapshot, RateUkmaSnapshot]:
    ud = _ud_snapshot(
        courses=[_ud_course("ud-a", merge_source=merge_source)],
        offerings=[
            _ud_offering("ud-1", course_id="ud-a", saz_code="100001"),
            _ud_offering("ud-2", course_id="ud-a", saz_code="100002"),
        ],
    )
    ru = _ru_snapshot(
        departments=[_ru_department()],
        courses=[
            _ru_course("ru-a", ukma_data_id="ud-a", ratings=2),
            _ru_course("ru-b", ukma_data_id="ud-a", ratings=3),
        ],
        offerings=[
            _ru_offering("ru-1", code="100001", course_id="ru-a", ukma_data_id="ud-1"),
            _ru_offering("ru-2", code="100002", course_id="ru-b", ukma_data_id="ud-2"),
        ],
    )
    return ud, ru


MERGE_PREMISE = {
    "course_ids": ["ru-a", "ru-b"],
    "ukma_course_id": "ud-a",
    "merge_source": None,
    "ratings": 5,
}


def test_merge_question_lists_the_courses_and_the_ratings_that_would_move():
    ud, ru = _merge_scenario()

    draft = _only(_propose(ud, ru), "merge_courses")

    assert (draft.key, draft.ukma_data_id, draft.target_id) == ("ud-a", "ud-a", None)
    assert draft.ratings == 5
    assert draft.after["merge_source"] is None
    assert [course["id"] for course in draft.after["courses"]] == ["ru-a", "ru-b"]
    assert [course["ratings"] for course in draft.after["courses"]] == [2, 3]
    assert len(draft.display["courses"]) == 2
    assert draft.display["ukma_course"]["title"] == "Курс"


def test_a_live_decision_with_the_same_premise_answers_the_merge_question():
    ud, ru = _merge_scenario()

    keep_apart = _decision(
        "merge_courses", "ud-a", "keep_apart", MERGE_PREMISE, ukma_course_id="ud-a"
    )
    merge = _decision(
        "merge_courses",
        "ud-a",
        "merge",
        MERGE_PREMISE,
        ukma_course_id="ud-a",
        into_id="ru-a",
    )

    assert _by_kind(_propose(ud, ru, [keep_apart]), "merge_courses") == []
    assert _by_kind(_propose(ud, ru, [merge]), "merge_courses") == []


def test_a_rule_merge_keeps_its_merge_source_in_the_question_and_the_premise():
    ud, ru = _merge_scenario(merge_source="rule")
    premise = {**MERGE_PREMISE, "merge_source": "rule"}

    draft = _only(_propose(ud, ru), "merge_courses")
    answered = _decision("merge_courses", "ud-a", "keep_apart", premise, ukma_course_id="ud-a")
    changed = _decision(
        "merge_courses",
        "ud-a",
        "keep_apart",
        {**premise, "merge_source": "decision"},
        ukma_course_id="ud-a",
    )

    assert draft.after["merge_source"] == "rule"
    assert _by_kind(_propose(ud, ru, [answered]), "merge_courses") == []
    assert len(_by_kind(_propose(ud, ru, [changed]), "merge_courses")) == 1


def test_a_merge_decision_with_a_changed_premise_asks_the_question_again():
    ud, ru = _merge_scenario()
    changed = _decision(
        "merge_courses",
        "ud-a",
        "keep_apart",
        {**MERGE_PREMISE, "course_ids": ["ru-a"], "ratings": 2},
        ukma_course_id="ud-a",
    )

    assert len(_by_kind(_propose(ud, ru, [changed]), "merge_courses")) == 1


def _move_scenario(
    *,
    target_linked: bool = True,
    target_has_offering: bool = False,
) -> tuple[UkmaDataSnapshot, RateUkmaSnapshot]:
    ud_offerings = [
        _ud_offering("ud-1", course_id="ud-a", saz_code="100001"),
        _ud_offering("ud-2", course_id="ud-b", saz_code="100002"),
    ]
    ru_offerings = [
        _ru_offering("ru-1", code="100001", course_id="ru-a", ukma_data_id="ud-1"),
        _ru_offering("ru-2", code="100002", course_id="ru-a", ukma_data_id="ud-2", ratings=4),
    ]
    if target_has_offering:
        ud_offerings.append(_ud_offering("ud-3", course_id="ud-b", saz_code="100003"))
        ru_offerings.append(
            _ru_offering("ru-3", code="100003", course_id="ru-b", ukma_data_id="ud-3")
        )
    ud = _ud_snapshot(
        departments=[_ud_department()],
        courses=[_ud_course("ud-a"), _ud_course("ud-b")],
        offerings=ud_offerings,
    )
    ru = _ru_snapshot(
        departments=[_ru_department()],
        courses=[
            _ru_course("ru-a", ukma_data_id="ud-a"),
            _ru_course(
                "ru-b",
                ukma_data_id="ud-b" if target_linked else None,
                status="FINISHED",
            ),
        ],
        offerings=ru_offerings,
    )
    return ud, ru


MOVE_PREMISE = {
    "course_ids": ["ru-a", "ru-b"],
    "ukma_course_id": "ud-b",
    "merge_source": None,
    "saz_code": "100002",
    "ratings": 4,
}


def test_a_stray_offering_asks_where_to_move_and_lists_both_courses():
    ud, ru = _move_scenario()

    draft = _only(_propose(ud, ru), "move_offering")

    assert (draft.key, draft.target_id, draft.ukma_data_id) == ("ru-2", "ru-2", "ud-b")
    assert draft.after == {
        "from_course": "ru-a",
        "ukma_course_id": "ud-b",
        "to_course_id": "ru-b",
    }
    assert draft.before == {"from_course": "ru-a"}
    assert draft.ratings == 4
    assert draft.requires == []
    assert [course["title"] for course in draft.display["courses"]] == ["Курс", "Курс"]


def test_a_move_to_a_course_linked_in_the_same_run_waits_on_its_link():
    ud, ru = _move_scenario(target_linked=False, target_has_offering=True)

    draft = _only(_propose(ud, ru), "move_offering")

    assert draft.after == {
        "from_course": "ru-a",
        "ukma_course_id": "ud-b",
        "to_course_id": "ru-b",
    }
    assert draft.requires == [{"kind": "link_course", "key": "ru-b"}]


def test_a_move_to_a_same_identity_course_waits_on_its_link():
    ud, ru = _move_scenario(target_linked=False)

    draft = _only(_propose(ud, ru), "move_offering")

    assert draft.after == {
        "from_course": "ru-a",
        "ukma_course_id": "ud-b",
        "to_course_id": "ru-b",
    }
    assert draft.requires == [{"kind": "link_course", "key": "ru-b"}]


def test_a_live_keep_decision_answers_the_move_question():
    ud, ru = _move_scenario()
    keep = _decision(
        "move_offering",
        "ru-2",
        "keep",
        MOVE_PREMISE,
        ukma_course_id="ud-b",
        saz_code="100002",
    )

    assert _by_kind(_propose(ud, ru, [keep]), "move_offering") == []


def test_a_move_decision_with_changed_ratings_asks_the_question_again():
    ud, ru = _move_scenario()
    changed = _decision(
        "move_offering",
        "ru-2",
        "keep",
        {**MOVE_PREMISE, "ratings": 0},
        ukma_course_id="ud-b",
        saz_code="100002",
    )

    assert len(_by_kind(_propose(ud, ru, [changed]), "move_offering")) == 1


def test_a_move_question_is_not_asked_when_two_courses_share_the_destination():
    ud = _ud_snapshot(
        courses=[_ud_course("ud-a"), _ud_course("ud-b")],
        offerings=[
            _ud_offering("ud-1", course_id="ud-a", saz_code="100001"),
            _ud_offering("ud-2", course_id="ud-b", saz_code="100002"),
        ],
    )
    ru = _ru_snapshot(
        departments=[_ru_department()],
        courses=[
            _ru_course("ru-a", ukma_data_id="ud-a"),
            _ru_course("ru-b", ukma_data_id="ud-b", status="FINISHED"),
            _ru_course("ru-c", ukma_data_id="ud-b", status="FINISHED"),
        ],
        offerings=[
            _ru_offering("ru-1", code="100001", course_id="ru-a", ukma_data_id="ud-1"),
            _ru_offering("ru-2", code="100002", course_id="ru-a", ukma_data_id="ud-2"),
        ],
    )

    assert _by_kind(_propose(ud, ru), "move_offering") == []


def test_a_stray_offering_moves_to_a_course_created_in_the_same_run():
    ud = _ud_snapshot(
        departments=[_ud_department()],
        courses=[_ud_course("ud-a"), _ud_course("ud-b", title="Інший курс")],
        offerings=[
            _ud_offering("ud-1", course_id="ud-a", saz_code="100001"),
            _ud_offering("ud-2", course_id="ud-b", saz_code="100002", title="Інший курс"),
        ],
    )
    ru = _ru_snapshot(
        departments=[_ru_department()],
        courses=[_ru_course("ru-a", ukma_data_id="ud-a")],
        offerings=[
            _ru_offering("ru-1", code="100001", course_id="ru-a", ukma_data_id="ud-1"),
            _ru_offering("ru-2", code="100002", course_id="ru-a", ukma_data_id="ud-2"),
        ],
    )

    draft = _only(_propose(ud, ru), "move_offering")

    assert draft.after == {
        "from_course": "ru-a",
        "ukma_course_id": "ud-b",
        "to_course_ukma_id": "ud-b",
    }
    assert draft.requires == [{"kind": "new_course", "key": "ud-b"}]


RELINK_PREMISE = {
    "course_ids": ["ru-course"],
    "ukma_course_id": "ud-new",
    "merge_source": None,
    "ratings": 6,
}


def _relink_scenario() -> tuple[UkmaDataSnapshot, RateUkmaSnapshot]:
    ud = _ud_snapshot(
        courses=[_ud_course("ud-old"), _ud_course("ud-new")],
        offerings=[
            _ud_offering("ud-1", course_id="ud-new", saz_code="100001"),
            _ud_offering("ud-2", course_id="ud-new", saz_code="100002"),
        ],
    )
    ru = _ru_snapshot(
        departments=[_ru_department()],
        courses=[_ru_course(ukma_data_id="ud-old", ratings=6, status="FINISHED")],
        offerings=[
            _ru_offering("ru-1", code="100001", ukma_data_id="ud-1"),
            _ru_offering("ru-2", code="100002", ukma_data_id="ud-2"),
        ],
    )
    return ud, ru


def test_a_majority_different_from_the_stored_link_asks_to_relink():
    ud, ru = _relink_scenario()

    draft = _only(_propose(ud, ru), "relink_course")

    assert (draft.key, draft.target_id, draft.ukma_data_id) == ("ru-course", "ru-course", "ud-new")
    assert draft.before == {"ukma_data_id": "ud-old"}
    assert draft.after == {"ukma_data_id": "ud-new"}
    assert draft.ratings == 6


def test_a_live_relink_decision_answers_the_question():
    ud, ru = _relink_scenario()
    relink = _decision(
        "relink_course", "ru-course", "relink", RELINK_PREMISE, ukma_course_id="ud-new"
    )

    assert _by_kind(_propose(ud, ru, [relink]), "relink_course") == []


def test_a_live_keep_decision_answers_the_relink_question():
    ud, ru = _relink_scenario()
    keep = _decision("relink_course", "ru-course", "keep", RELINK_PREMISE, ukma_course_id="ud-new")

    assert _by_kind(_propose(ud, ru, [keep]), "relink_course") == []


def test_a_relink_decision_with_a_changed_premise_asks_the_question_again():
    ud, ru = _relink_scenario()
    changed = _decision(
        "relink_course",
        "ru-course",
        "relink",
        {**RELINK_PREMISE, "ukma_course_id": "ud-old"},
        ukma_course_id="ud-new",
    )

    assert len(_by_kind(_propose(ud, ru, [changed]), "relink_course")) == 1


def _complete_mapping_scenario() -> tuple[UkmaDataSnapshot, RateUkmaSnapshot]:
    ud = _ud_snapshot(
        faculties=[_ud_faculty()],
        departments=[_ud_department()],
        courses=[
            _ud_course("ud-a"),
            _ud_course("ud-b"),
            _ud_course("ud-old"),
            _ud_course("ud-new"),
        ],
        offerings=[
            _ud_offering("m1", course_id="ud-a", saz_code="200001"),
            _ud_offering("m2", course_id="ud-a", saz_code="200002"),
            _ud_offering("mv", course_id="ud-b", saz_code="200003"),
            _ud_offering("r1", course_id="ud-new", saz_code="200004"),
            _ud_offering("r2", course_id="ud-new", saz_code="200005"),
        ],
    )
    ru = _ru_snapshot(
        faculties=[_ru_faculty()],
        departments=[_ru_department()],
        courses=[
            _ru_course("ru-a", ukma_data_id="ud-a", ratings=2),
            _ru_course("ru-b", ukma_data_id="ud-a", ratings=3),
            _ru_course("ru-target", ukma_data_id="ud-b"),
            _ru_course("ru-relink", ukma_data_id="ud-old", ratings=6),
        ],
        offerings=[
            _ru_offering("ru-m1", code="200001", course_id="ru-a", ukma_data_id="m1"),
            _ru_offering("ru-m2", code="200002", course_id="ru-b", ukma_data_id="m2"),
            _ru_offering("ru-mv", code="200003", course_id="ru-a", ukma_data_id="mv"),
            _ru_offering("ru-r1", code="200004", course_id="ru-relink", ukma_data_id="r1"),
            _ru_offering("ru-r2", code="200005", course_id="ru-relink", ukma_data_id="r2"),
        ],
    )
    return ud, ru


def test_every_mapping_draft_after_validates_against_its_payload():
    ud, ru = _complete_mapping_scenario()

    drafts = _propose(ud, ru)

    assert {draft.kind for draft in drafts} == MAPPING_KINDS
    for draft in drafts:
        PAYLOADS[draft.kind].model_validate({**draft.after, "display": draft.display})


def test_drafts_are_sorted_by_kind_order_then_key():
    ud, ru = _complete_mapping_scenario()

    drafts = _propose(ud, ru)

    assert [(draft.kind, draft.key) for draft in drafts] == sorted(
        ((draft.kind, draft.key) for draft in drafts),
        key=lambda item: (KIND_BY_NAME[item[0]].order, item[1]),
    )


def test_the_builder_stays_linear_in_the_catalog_size():
    groups = 1_000
    courses_per_group = 2
    offerings_per_course = 5
    ud_courses = []
    ud_offerings = []
    ru_courses = []
    ru_offerings = []
    for group in range(groups):
        ud_course_id = f"ud-{group:05d}"
        ud_courses.append(_ud_course(ud_course_id))
        for index in range(courses_per_group):
            ru_course_id = f"ru-{group:05d}-{index}"
            ru_courses.append(_ru_course(ru_course_id, ukma_data_id=ud_course_id))
            for offering_index in range(offerings_per_course):
                number = group * courses_per_group * offerings_per_course + (
                    index * offerings_per_course + offering_index
                )
                saz_code = f"{number:06d}"
                ud_offering_id = f"ud-offering-{group}-{index}-{offering_index}"
                ud_offerings.append(
                    _ud_offering(ud_offering_id, course_id=ud_course_id, saz_code=saz_code)
                )
                ru_offerings.append(
                    _ru_offering(
                        f"ru-offering-{group}-{index}-{offering_index}",
                        code=saz_code,
                        course_id=ru_course_id,
                        ukma_data_id=ud_offering_id,
                    )
                )

    ud = _ud_snapshot(
        departments=[_ud_department()],
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
    drafts = _propose(ud, ru)
    elapsed = time.perf_counter() - started

    assert len(_by_kind(drafts, "merge_courses")) == groups
    assert offerings.values_calls <= 2
    assert elapsed < 5.0
