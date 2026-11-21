import pytest
from pydantic import ValidationError

from rating_app.sync.kinds import KINDS
from rating_app.sync.payloads import (
    BEFORE_PAYLOADS,
    PAYLOADS,
    CourseDisplay,
    Display,
    NewOfferingPayload,
    TeacherLinkRemovedPayload,
    TeacherYear,
    UkmaCourseDisplay,
)


def _offering_payload() -> dict[str, object]:
    return {
        "saz_code": "123456",
        "semester": {"year": 2025, "term": "FALL"},
        "exam_type": "EXAM",
        "study_year": 1,
        "max_students": 30,
        "max_groups": 2,
        "group_size_min": 5,
        "group_size_max": 30,
        "terms": [
            {
                "year": 2025,
                "term": "FALL",
                "credits": "3.0",
                "weekly_hours": 4,
                "lecture_count": 16,
                "practice_count": 16,
                "practice_type": "",
                "exam_type": "EXAM",
            }
        ],
        "specialities": [{"name": "Аналіз", "kind": "COMPULSORY"}],
    }


def test_every_registry_kind_has_a_payload():
    assert set(PAYLOADS) == {kind.name for kind in KINDS}


def test_every_payload_carries_a_display_snapshot():
    for kind, payload in PAYLOADS.items():
        assert "display" in payload.model_fields, kind


def test_teacher_created_payload_carries_the_names_and_email():
    payload = PAYLOADS["teacher_created"].model_validate(
        {
            "email": "teacher@example.test",
            "last_name": "Тестова",
            "first_name": "Олена",
            "middle_name": "Петрівна",
        }
    )

    assert payload.model_dump()["email"] == "teacher@example.test"
    assert payload.model_dump()["middle_name"] == "Петрівна"


def test_teacher_link_removed_after_is_empty_and_before_holds_the_link():
    after = TeacherLinkRemovedPayload()
    before = BEFORE_PAYLOADS["teacher_link_removed"].model_validate(
        {"instructor_id": "00000000-0000-0000-0000-000000000001", "role": "LECTURE_INSTRUCTOR"}
    )

    assert after.display == Display()
    assert before.instructor_id == "00000000-0000-0000-0000-000000000001"
    assert before.role == "LECTURE_INSTRUCTOR"


def test_course_display_carries_the_plan_snapshot():
    display = Display(
        course=CourseDisplay(
            title="Аналіз даних",
            department="Кафедра даних",
            years=[2025],
            saz_codes=["123456"],
            teachers=[TeacherYear(year=2025, teachers=["Олена Тестова"])],
        ),
        ukma_course=UkmaCourseDisplay(
            title="Data analysis",
            department="Data department",
            merge_source="rule",
        ),
    )
    payload = PAYLOADS["change_course"].model_validate(
        {"title": "Нова назва", "display": display.model_dump()}
    )

    assert payload.display.course is not None
    assert payload.display.course.teachers[0].teachers == ["Олена Тестова"]
    assert payload.display.ukma_course is not None
    assert payload.display.ukma_course.merge_source == "rule"


def test_new_offering_requires_exactly_one_course():
    with pytest.raises(ValidationError, match="exactly one of course_id"):
        NewOfferingPayload.model_validate(_offering_payload())


def test_new_offering_accepts_an_existing_course():
    payload = NewOfferingPayload.model_validate({**_offering_payload(), "course_id": "ru-course"})

    assert payload.course_id == "ru-course"
    assert payload.course_ukma_id is None


def test_move_offering_requires_exactly_one_target():
    with pytest.raises(ValidationError, match="exactly one of to_course_id"):
        PAYLOADS["move_offering"].model_validate({"from_course": "ru-course"})
