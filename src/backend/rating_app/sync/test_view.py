from __future__ import annotations

from rating_app.models import SyncChange
from rating_app.sync.view import change_view, credits_text, semester_text

COURSE = {
    "title": "Тестова дисципліна А",
    "department": "Кафедра прикладів",
    "years": [2025, 2026],
    "saz_codes": ["100001", "100002"],
    "teachers": [],
}


def _change(kind: str, group: str, before: dict, after: dict) -> SyncChange:
    return SyncChange(kind=kind, group=group, key="k", before=before, after=after)


def test_a_new_semester_shows_its_course_department_semester_credits_and_exam():
    change = _change(
        "new_offering",
        "new",
        {},
        {
            "saz_code": "369184",
            "semester": {"term": "FALL", "year": 2026},
            "exam_type": "EXAM",
            "terms": [{"term": "FALL", "year": 2026, "credits": "6.0", "exam_type": "EXAM"}],
            "course_id": "00000000-0000-0000-0000-000000000001",
            "display": {"course": COURSE},
        },
    )

    view = change_view(change)

    assert view.title == "Тестова дисципліна А"
    assert view.place == "Кафедра прикладів"
    assert view.semester == "Осінь 2026"
    assert [(row.label, row.before, row.after) for row in view.rows] == [
        ("Кредити", "", "6"),
        ("Форма контролю", "", "іспит"),
    ]


def test_a_changed_semester_shows_only_fields_a_student_sees_in_words():
    term = {"term": "SPRING", "year": 2026, "credits": "5.0", "exam_type": "CREDIT"}
    change = _change(
        "change_offering",
        "change",
        {"semester": {"term": "SPRING", "year": 2026}, "terms": [term]},
        {
            "terms": [{**term, "credits": "6.0", "exam_type": "EXAM"}],
            "max_groups": 4,
            "display": {"course": COURSE},
        },
    )

    view = change_view(change)

    assert view.semester == "Весна 2026"
    assert {(row.field, row.before, row.after) for row in view.rows} == {
        ("credits", "5", "6"),
        ("exam_type", "залік", "іспит"),
        ("max_groups", "", "4"),
    }


def test_an_exact_link_shows_no_fields():
    after = {
        "majority_share": 1.0,
        "display": {"course": COURSE, "ukma_course": {"title": COURSE["title"]}},
    }

    view = change_view(_change("link_course", "link", {}, after))

    assert view.rows == []


def test_a_link_to_check_shows_the_title_in_saz():
    after = {
        "majority_share": 0.6,
        "display": {"course": COURSE, "ukma_course": {"title": "Інша дисципліна"}},
    }

    view = change_view(_change("link_course", "link", {}, after))

    assert [(row.label, row.after) for row in view.rows] == [("Назва в САЗ", "Інша дисципліна")]


def test_credits_and_semesters_read_as_words():
    assert credits_text("6.0") == "6"
    assert credits_text("10.0") == "10"
    assert credits_text("4.5") == "4.5"
    assert semester_text({"term": "SUMMER", "year": 2027}) == "Літо 2027"
    assert semester_text(None) is None
