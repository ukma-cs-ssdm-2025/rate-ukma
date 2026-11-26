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
    assert view.note == "Новий семестр наявної дисципліни"
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


def test_a_link_to_check_shows_the_site_title_next_to_the_one_in_saz():
    after = {
        "majority_share": 0.6,
        "display": {"course": COURSE, "ukma_course": {"title": "Інша дисципліна"}},
    }

    view = change_view(_change("link_course", "link", {}, after))

    assert [(row.label, row.before, row.after) for row in view.rows] == [
        ("Назва", COURSE["title"], "Інша дисципліна")
    ]


def test_credits_and_semesters_read_as_words():
    assert credits_text("6.0") == "6"
    assert credits_text("10.0") == "10"
    assert credits_text("4.5") == "4.5"
    assert semester_text({"term": "SUMMER", "year": 2027}) == "Літо 2027"
    assert semester_text(None) is None


def test_a_state_change_reads_as_words():
    change = _change(
        "change_course",
        "change",
        {"status": "FINISHED", "education_level": "BACHELOR"},
        {"status": "ACTIVE", "education_level": "MASTER", "display": {"course": COURSE}},
    )

    view = change_view(change)

    assert {(row.label, row.before, row.after) for row in view.rows} == {
        ("Стан", "завершена", "викладається"),
        ("Рівень освіти", "бакалаврат", "магістратура"),
    }


def test_a_semester_of_a_new_discipline_says_so():
    after = {"course_ukma_id": "ud-course", "display": {"course": COURSE}}

    view = change_view(_change("new_offering", "new", {}, after))

    assert view.note == "Семестр нової дисципліни"
    assert change_view(_change("new_course", "new", {}, after)).note == "Нова дисципліна"


def test_a_long_description_shows_the_part_that_changed():
    common = "Тестовий опис дисципліни. " * 10
    change = _change(
        "change_course",
        "change",
        {"description": common + "Стара кінцівка."},
        {"description": common + "Нова кінцівка.", "display": {"course": COURSE}},
    )

    [row] = change_view(change).rows

    assert row.before.startswith("…")
    assert "Стара кінцівка." in row.before
    assert "Нова кінцівка." in row.after
    assert row.before != row.after
