from __future__ import annotations

from django.urls import reverse
from django.utils import timezone

import pytest

from rating_app.models import SyncRunStatus, SyncSource
from rating_app.sync.kinds import KIND_BY_NAME


@pytest.fixture
def superuser_client(token_client):
    token_client.user.is_superuser = True
    token_client.user.save()
    return token_client


@pytest.fixture
def catalog_run(sync_run_factory):
    return sync_run_factory(
        source=SyncSource.CATALOG,
        status=SyncRunStatus.SUCCEEDED,
        finished_at=timezone.now(),
    )


@pytest.fixture
def make_change(sync_change_factory, catalog_run):
    def build(kind, key, *, after=None, before=None, target_id=None, ratings=0):
        registry = KIND_BY_NAME[kind]
        return sync_change_factory(
            run=catalog_run,
            source=registry.source,
            group=registry.group,
            kind=kind,
            key=key,
            target_id=target_id,
            ukma_data_id=key,
            after=after or {},
            before=before or {},
            ratings=ratings,
            waiting_on=[],
        )

    return build


def _term(practice_type, *, credits="3.0", year=2025, term="FALL"):
    return {
        "year": year,
        "term": term,
        "credits": credits,
        "weekly_hours": 2,
        "lecture_count": 14,
        "practice_count": 14,
        "practice_type": practice_type,
        "exam_type": "EXAM",
    }


@pytest.fixture
def offering_change(make_change, course_offering_factory):
    def build(key, old, new, *, credits="3.0"):
        return _offering_change(
            make_change, key, old, new, str(course_offering_factory().pk), credits=credits
        )

    return build


def _offering_change(make_change, key, old, new, target_id, *, credits="3.0"):
    return make_change(
        "change_offering",
        key,
        target_id=target_id,
        after={"terms": [_term(new, credits=credits)]},
        before={"terms": [_term(old)]},
    )


def _new_offering(make_change, key, year, term):
    return make_change(
        "new_offering",
        key,
        after={
            "saz_code": f"9{year}{len(key)}",
            "semester": {"year": year, "term": term},
            "study_year": 2,
            "terms": [],
        },
    )


@pytest.fixture
def field_changes(offering_change):
    return {
        "seminar": [
            offering_change(f"off-sem-{index}", "PRACTICE", "SEMINAR") for index in range(3)
        ],
        "blank": [offering_change(f"off-blank-{index}", "PRACTICE", "") for index in range(2)],
        "credits": [offering_change("off-credits", "PRACTICE", "PRACTICE", credits="4.0")],
    }


@pytest.mark.django_db
@pytest.mark.integration
def test_summary_groups_name_every_part_and_keep_blanking_pairs_apart(
    superuser_client, make_change, field_changes
):
    for kind, count in (
        ("link_course", 2),
        ("link_offering", 3),
        ("link_faculty", 1),
        ("link_department", 2),
        ("new_course", 1),
        ("new_department", 1),
    ):
        for index in range(count):
            make_change(kind, f"{kind}-{index}")
    make_change("place_offering", "place-1", after={"candidates": []})

    response = superuser_client.get(reverse("ukma-data-sync-summary"))

    assert response.status_code == 200
    groups = response.json()["groups"]
    assert groups["links"] == {
        "courses": 2,
        "offerings": 3,
        "faculties": 1,
        "departments": 2,
        "total": 8,
    }
    assert groups["new"]["courses"] == 1
    assert groups["new"]["departments"] == 1
    assert groups["new"]["total"] == 2
    assert groups["changes"]["total"] == 6
    assert groups["changes"]["offerings"] == 6
    assert groups["changes"]["by_field"] == [
        {
            "field": "practice_type",
            "count": 3,
            "pairs": [{"before": "PRACTICE", "after": "SEMINAR", "count": 3}],
        },
        {
            "field": "credits",
            "count": 1,
            "pairs": [{"before": "3.0", "after": "4.0", "count": 1}],
        },
    ]
    assert groups["changes"]["blanking"] == [
        {
            "field": "practice_type",
            "count": 2,
            "pairs": [{"before": "PRACTICE", "after": "", "count": 2}],
        }
    ]
    assert groups["placements"] == {"total": 1, "place": 1, "move": 0}


@pytest.mark.django_db
@pytest.mark.integration
def test_pending_filters_by_changed_field_and_blanking(superuser_client, field_changes):
    url = reverse("ukma-data-sync-pending")

    seminar = superuser_client.get(
        url, {"group": "change", "changed_field": "practice_type", "blanks": "false"}
    ).json()
    blank = superuser_client.get(
        url, {"group": "change", "changed_field": "practice_type", "blanks": "true"}
    ).json()

    assert {item["id"] for item in seminar["items"]} == {
        change.pk for change in field_changes["seminar"]
    }
    assert {item["id"] for item in blank["items"]} == {
        change.pk for change in field_changes["blank"]
    }


@pytest.mark.django_db
@pytest.mark.integration
def test_pending_filters_semesters_by_academic_year(superuser_client, make_change):
    fall = _new_offering(make_change, "off-fall-2025", 2025, "FALL")
    spring = _new_offering(make_change, "off-spring-2026", 2026, "SPRING")
    early = _new_offering(make_change, "off-spring-2025", 2025, "SPRING")
    make_change("new_course", "course-without-semester")
    url = reverse("ukma-data-sync-pending")

    current = superuser_client.get(url, {"group": "new", "year_from": 2025, "year_to": 2025})
    earlier = superuser_client.get(url, {"group": "new", "year_to": 2024})

    assert current.status_code == 200
    assert {item["id"] for item in current.json()["items"]} == {fall.pk, spring.pk}
    assert [item["id"] for item in earlier.json()["items"]] == [early.pk]


@pytest.mark.django_db
@pytest.mark.integration
def test_pending_returns_400_for_a_year_before_2000(superuser_client):
    response = superuser_client.get(reverse("ukma-data-sync-pending"), {"year_from": 1999})

    assert response.status_code == 400
    assert list(response.json()["fields"]) == ["year_from"]


def _place(make_change, key, candidates, *, title, department):
    return make_change(
        "place_offering",
        key,
        after={
            "saz_code": "234493",
            "semester": {"year": 2019, "term": "FALL"},
            "candidates": [str(course.pk) for course in candidates],
            "display": {"ukma_course": {"title": title, "department": department}},
        },
    )


def _merge(make_change, key, courses, *, department):
    return make_change(
        "merge_courses",
        key,
        after={
            "merge_source": None,
            "courses": [{"id": str(course.pk), "title": course.title} for course in courses],
            "display": {
                "courses": [],
                "ukma_course": {"title": courses[0].title, "department": department},
            },
        },
    )


@pytest.mark.django_db
@pytest.mark.integration
def test_questions_filter_by_kind_and_title_and_name_the_semester(
    superuser_client, make_change, course_factory, department_factory
):
    department = department_factory(name="Кафедра вигаданих наук")
    first = course_factory(title="Вигаданий менеджмент", department=department)
    second = course_factory(
        title="Вигаданий менеджмент", department=department_factory(name="Школа вигадок")
    )
    place = _place(
        make_change,
        "place-a",
        [first, second],
        title="Вигаданий менеджмент",
        department="Кафедра вигаданих наук",
    )
    _merge(make_change, "merge-a", [first, second], department="Кафедра вигаданих наук")
    url = reverse("ukma-data-sync-questions")

    places = superuser_client.get(url, {"kinds": "place_offering,move_offering"}).json()
    nothing = superuser_client.get(url, {"kinds": "place_offering", "q": "інша назва"}).json()

    assert [item["id"] for item in places["items"]] == [place.pk]
    item = places["items"][0]
    assert item["offering"] == {"saz_code": "234493", "year": 2019, "term": "FALL"}
    assert item["ukma_title"] == "Вигаданий менеджмент"
    assert item["ukma_department"] == "Кафедра вигаданих наук"
    assert item["move_into"] is None
    assert nothing["items"] == []


@pytest.mark.django_db
@pytest.mark.integration
def test_questions_reject_an_unknown_kinds_format(superuser_client):
    response = superuser_client.get(reverse("ukma-data-sync-questions"), {"kinds": "Merge!"})

    assert response.status_code == 400
    assert list(response.json()["fields"]) == ["kinds"]


@pytest.mark.django_db
@pytest.mark.integration
def test_questions_suggest_the_page_whose_department_is_as_in_saz_when_neither_is_rated(
    superuser_client, make_change, course_factory, department_factory
):
    saz_department = department_factory(name="Кафедра мережних вигадок")
    other_department = department_factory(name="Кафедра інших вигадок")
    in_saz = course_factory(title="Мережні вигадки", department=saz_department)
    other = course_factory(title="Мережні вигадки", department=other_department)
    _merge(make_change, "merge-b", [other, in_saz], department="Кафедра мережних вигадок")

    body = superuser_client.get(reverse("ukma-data-sync-questions")).json()

    assert body["items"][0]["suggested_into"] == str(in_saz.pk)


@pytest.mark.django_db
@pytest.mark.integration
def test_questions_suggest_the_rated_page_over_the_department_as_in_saz(
    superuser_client,
    make_change,
    course_factory,
    department_factory,
    course_offering_factory,
    rating_factory,
):
    saz_department = department_factory(name="Кафедра мережних вигадок")
    in_saz = course_factory(title="Мережні вигадки", department=saz_department)
    rated = course_factory(title="Мережні вигадки")
    rating_factory(course_offering=course_offering_factory(course=rated))
    _merge(make_change, "merge-c", [in_saz, rated], department="Кафедра мережних вигадок")

    body = superuser_client.get(reverse("ukma-data-sync-questions")).json()

    assert body["items"][0]["suggested_into"] == str(rated.pk)
