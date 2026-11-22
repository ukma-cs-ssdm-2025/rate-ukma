from __future__ import annotations

from contextlib import contextmanager
from datetime import timedelta

from django.urls import reverse
from django.utils import timezone

import pytest

from rating_app.models import (
    MappingAnswer,
    SyncApprovalOutcome,
    SyncChangeState,
    SyncRunStatus,
    SyncSource,
)
from rating_app.sync import apply, decisions
from rating_app.sync.kinds import KIND_BY_NAME

ENDPOINTS = [
    ("get", "ukma-data-sync-summary", {}),
    ("get", "ukma-data-sync-questions", {}),
    ("get", "ukma-data-sync-run-approvals", {"run_id": 1}),
    ("get", "ukma-data-sync-run-export", {"run_id": 1}),
]


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
def make_offering(course_offering_factory, semester_factory):
    semester = semester_factory(year=2025, term="FALL")
    return lambda course: course_offering_factory(course=course, semester=semester)


def _card(title, *, saz_codes=(), department="Кафедра тестових даних"):
    return {
        "title": title,
        "department": department,
        "years": [2025],
        "saz_codes": list(saz_codes),
        "teachers": [],
    }


def _change(
    sync_change_factory,
    run,
    *,
    kind,
    key,
    target_id=None,
    after=None,
    before=None,
    ratings=0,
    waiting_on=None,
    ukma_data_id=None,
):
    registry = KIND_BY_NAME[kind]
    return sync_change_factory(
        run=run,
        source=registry.source,
        group=registry.group,
        kind=kind,
        key=key,
        target_id=target_id,
        ukma_data_id=ukma_data_id
        or ((after or {}).get("ukma_data_id") if isinstance(after, dict) else None),
        after=after or {},
        before=before or {},
        ratings=ratings,
        waiting_on=waiting_on or [],
    )


def _merge_change(sync_change_factory, run, key, courses, *, ratings):
    return _change(
        sync_change_factory,
        run,
        kind="merge_courses",
        key=key,
        ukma_data_id=key,
        after={
            "merge_source": None,
            "courses": [
                {
                    "id": str(course.pk),
                    "title": course.title,
                    "department": {
                        "id": str(course.department_id),
                        "ukma_data_id": None,
                        "name": course.department.name,
                    },
                    "years": [2025],
                    "ratings": value,
                }
                for course, value in courses
            ],
            "display": {
                "courses": [_card(course.title) for course, _ in courses],
                "ukma_course": {"title": courses[0][0].title},
            },
        },
        ratings=ratings,
    )


@pytest.fixture
def review_fixture(
    catalog_run,
    sync_change_factory,
    course_factory,
    department_factory,
    faculty_factory,
    make_offering,
    planned_course_factory,
    rating_factory,
    student_factory,
):
    faculty = faculty_factory(name="Факультет тестових даних")
    department = department_factory(name="Кафедра тестових даних", faculty=faculty)
    other_department = department_factory(
        name="Кафедра інших даних", faculty=faculty_factory(name="Інший факультет")
    )
    exact = course_factory(title="Алгоритми", department=department)
    review = course_factory(title="Структури даних", department=department)
    rated = course_factory(title="Бази даних", department=department)
    other = course_factory(title="Мережі", department=other_department)
    place_course = course_factory(title="Практикум", department=department)
    removed = course_factory(title="Старі курси", department=department)
    course_factory(title="Основи програмування", department=department)
    exact_offering = make_offering(exact)
    other_offering = make_offering(other)
    planned_course_factory(offering=other_offering, student=student_factory())
    rating_factory(course_offering=exact_offering)
    rating_factory(course_offering=other_offering)

    exact_link = _change(
        sync_change_factory,
        catalog_run,
        kind="link_faculty",
        key=str(faculty.pk),
        target_id=str(faculty.pk),
        after={"ukma_data_id": "ud-faculty", "display": {"name": "Факультет тестових даних"}},
    )
    link_offering = _change(
        sync_change_factory,
        catalog_run,
        kind="link_offering",
        key=str(exact_offering.pk),
        target_id=str(exact_offering.pk),
        after={
            "ukma_data_id": "ud-offering",
            "display": {"course": _card("Алгоритми", saz_codes=["111111"])},
        },
        ratings=1,
    )
    exact_course_link = _change(
        sync_change_factory,
        catalog_run,
        kind="link_course",
        key=str(exact.pk),
        target_id=str(exact.pk),
        after={
            "ukma_data_id": "ud-exact",
            "majority_share": 1.0,
            "display": {
                "course": _card("Алгоритми", saz_codes=["111111"]),
                "ukma_course": {"title": "Алгоритми"},
            },
        },
        ratings=1,
    )
    review_course_link = _change(
        sync_change_factory,
        catalog_run,
        kind="link_course",
        key=str(review.pk),
        target_id=str(review.pk),
        after={
            "ukma_data_id": "ud-review",
            "majority_share": 0.5,
            "display": {
                "course": _card("Структури даних"),
                "ukma_course": {"title": "Структури даних і алгоритми"},
            },
        },
    )
    merge = _merge_change(
        sync_change_factory,
        catalog_run,
        "ud-merge",
        [(rated, 3), (other, 0)],
        ratings=3,
    )
    place = _change(
        sync_change_factory,
        catalog_run,
        kind="place_offering",
        key="ud-place",
        after={
            "saz_code": "222222",
            "candidates": [str(place_course.pk)],
            "display": {
                "courses": [_card("Практикум")],
                "ukma_course": {"title": "Практикум"},
            },
        },
    )
    new_similar = _change(
        sync_change_factory,
        catalog_run,
        kind="new_course",
        key="ud-new-similar",
        after={
            "title": "  Основи   ПРОГРАМУВАННЯ ",
            "level": "BACHELOR",
            "department_ukma_id": "ud-department",
            "status": "ACTIVE",
            "description": "",
            "display": {"course": _card("Основи програмування")},
        },
    )
    new_offering = _change(
        sync_change_factory,
        catalog_run,
        kind="new_offering",
        key="ud-new-offering",
        after={"course_id": str(other.pk), "saz_code": "333333", "display": {}},
        waiting_on=[new_similar.pk],
    )
    field_change = _change(
        sync_change_factory,
        catalog_run,
        kind="change_offering",
        key=str(other_offering.pk),
        target_id=str(other_offering.pk),
        after={"max_students": 45, "display": {}},
        before={"max_students": 60},
    )
    terms_change = _change(
        sync_change_factory,
        catalog_run,
        kind="change_offering",
        key=str(exact_offering.pk),
        target_id=str(exact_offering.pk),
        after={"terms": [{"year": 2025}], "display": {}},
        before={"terms": []},
    )
    removed_change = _change(
        sync_change_factory,
        catalog_run,
        kind="removed_course",
        key=str(removed.pk),
        target_id=str(removed.pk),
        after={"ukma_data_id": "ud-removed", "title": "Старі курси", "removed_at": None},
    )
    catalog_run.counts = {"skipped": {"title_too_long": 2}}
    catalog_run.skipped_rated = {"title_too_long": 1}
    catalog_run.save(update_fields=["counts", "skipped_rated"])
    return {
        "run": catalog_run,
        "faculty": faculty,
        "department": department,
        "exact": exact,
        "review": review,
        "rated": rated,
        "other": other,
        "place_course": place_course,
        "exact_offering": exact_offering,
        "other_offering": other_offering,
        "exact_link": exact_link,
        "link_offering": link_offering,
        "exact_course_link": exact_course_link,
        "review_course_link": review_course_link,
        "merge": merge,
        "place": place,
        "new_similar": new_similar,
        "new_offering": new_offering,
        "field_change": field_change,
        "terms_change": terms_change,
        "removed_change": removed_change,
    }


@pytest.mark.django_db
@pytest.mark.integration
@pytest.mark.parametrize(("method", "route", "kwargs"), ENDPOINTS)
def test_review_endpoints_return_403_when_not_superuser(token_client, method, route, kwargs):
    response = getattr(token_client, method)(reverse(route, kwargs=kwargs), {}, format="json")

    assert response.status_code == 403


@pytest.mark.parametrize(("method", "route", "kwargs"), ENDPOINTS)
def test_review_endpoints_return_403_when_anonymous(api_client, method, route, kwargs):
    response = getattr(api_client, method)(reverse(route, kwargs=kwargs), {}, format="json")

    assert response.status_code == 403


@pytest.mark.django_db
@pytest.mark.integration
def test_summary_orders_the_seven_steps_and_counts_them(review_fixture, superuser_client):
    response = superuser_client.get(reverse("ukma-data-sync-summary"), {"source": "catalog"})

    assert response.status_code == 200
    body = response.json()
    assert [step["step"] for step in body["steps"]] == [
        "exact_links",
        "rated_questions",
        "other_questions",
        "review_links",
        "new_rows",
        "field_changes",
        "removed",
    ]
    steps = {step["step"]: step for step in body["steps"]}
    assert steps["exact_links"]["count"] == 3
    assert steps["exact_links"]["kinds"] == {
        "link_course": 1,
        "link_faculty": 1,
        "link_offering": 1,
    }
    assert steps["exact_links"]["ratings"] == 2
    assert steps["review_links"]["count"] == 1
    assert steps["review_links"]["facets"]["match"] == {"exact": 3, "review": 1}
    assert steps["rated_questions"]["count"] == 1
    assert steps["rated_questions"]["rated"] == 1
    assert steps["rated_questions"]["plans"] == 1
    assert steps["other_questions"]["count"] == 1
    assert steps["new_rows"]["count"] == 2
    assert steps["new_rows"]["facets"]["similar_existing"] == 1
    assert steps["new_rows"]["waiting"] == 1
    assert steps["field_changes"]["count"] == 2
    assert steps["removed"]["count"] == 1
    assert body["not_proposed"] == {"title_too_long": {"count": 2, "rated": 1}}


@pytest.mark.django_db
@pytest.mark.integration
def test_summary_fields_facet_keeps_scalar_pairs_and_skips_lists(review_fixture, superuser_client):
    body = superuser_client.get(reverse("ukma-data-sync-summary")).json()
    fields = body["steps"][5]["facets"]["fields"]

    assert fields["max_students"] == {
        "count": 1,
        "rated": 0,
        "top_pairs": [{"before": "60", "after": "45", "count": 1}],
    }
    assert fields["terms"]["count"] == 1
    assert fields["terms"]["top_pairs"] == []


@pytest.mark.django_db
@pytest.mark.integration
def test_summary_counts_live_answers_and_a_newer_run(
    review_fixture,
    superuser_client,
    catalog_run,
    sync_run_factory,
    catalog_mapping_decision_factory,
):
    catalog_mapping_decision_factory(
        kind="merge_courses",
        question_key="ud-merge",
        answer=MappingAnswer.KEEP_APART,
    )
    newer = sync_run_factory(
        source=SyncSource.CATALOG,
        status=SyncRunStatus.SUCCEEDED,
        finished_at=timezone.now() + timedelta(minutes=5),
    )

    body = superuser_client.get(
        reverse("ukma-data-sync-summary"), {"run": review_fixture["run"].pk}
    ).json()

    assert body["answers"] == {
        "merge": 0,
        "keep_apart": 1,
        "keep": 0,
        "place": 0,
        "move": 0,
    }
    assert body["newer_run_id"] == newer.pk


@pytest.mark.django_db
@pytest.mark.integration
def test_summary_returns_404_without_a_succeeded_run(superuser_client):
    response = superuser_client.get(reverse("ukma-data-sync-summary"))

    assert response.status_code == 404


@pytest.mark.django_db
@pytest.mark.integration
def test_summary_pins_a_run(review_fixture, superuser_client, sync_run_factory):
    other = sync_run_factory(
        source=SyncSource.CATALOG,
        status=SyncRunStatus.SUCCEEDED,
        finished_at=timezone.now() + timedelta(hours=1),
    )

    body = superuser_client.get(
        reverse("ukma-data-sync-summary"), {"run": review_fixture["run"].pk}
    ).json()

    assert body["run"]["id"] == review_fixture["run"].pk
    assert body["newer_run_id"] == other.pk


@pytest.mark.django_db
@pytest.mark.integration
def test_pending_filters_by_review_facets(review_fixture, superuser_client):
    def ids(query):
        body = superuser_client.get(reverse("ukma-data-sync-pending"), query).json()
        return {item["id"] for item in body["items"]}

    assert ids({"match": "review"}) == {review_fixture["review_course_link"].pk}
    assert ids({"similar_existing": "true"}) == {review_fixture["new_similar"].pk}
    assert ids({"field": "max_students"}) == {review_fixture["field_change"].pk}
    assert ids({"fields_subset": "max_students"}) == {review_fixture["field_change"].pk}
    assert ids({"q": "111111"}) == {
        review_fixture["exact_course_link"].pk,
        review_fixture["link_offering"].pk,
    }
    assert ids({"q": "алгоритми"}) == {
        review_fixture["exact_course_link"].pk,
        review_fixture["link_offering"].pk,
        review_fixture["review_course_link"].pk,
    }


@pytest.mark.django_db
@pytest.mark.integration
def test_pending_rated_and_run_filters(
    review_fixture, superuser_client, catalog_run, sync_change_factory, sync_run_factory
):
    older = sync_run_factory(
        source=SyncSource.CATALOG, status=SyncRunStatus.SUCCEEDED, finished_at=timezone.now()
    )
    older_change = _change(sync_change_factory, older, kind="link_course", key="older", ratings=1)
    sync_change_factory(run=catalog_run, kind="link_course", ratings=0, key="quiet")

    body = superuser_client.get(reverse("ukma-data-sync-pending"), {"run": older.pk}).json()

    assert {item["id"] for item in body["items"]} == {older_change.pk}
    assert {
        item["id"]
        for item in superuser_client.get(
            reverse("ukma-data-sync-pending"), {"run": review_fixture["run"].pk, "rated": "true"}
        ).json()["items"]
    } == {
        review_fixture["link_offering"].pk,
        review_fixture["exact_course_link"].pk,
        review_fixture["merge"].pk,
    }


@pytest.mark.django_db
@pytest.mark.integration
def test_pending_sample_is_twenty_per_faculty_and_stable_by_seed(
    catalog_run,
    superuser_client,
    sync_change_factory,
    course_factory,
    department_factory,
    faculty_factory,
    make_offering,
):
    first = faculty_factory()
    second = faculty_factory()
    first_department = department_factory(faculty=first)
    second_department = department_factory(faculty=second)
    for index in range(25):
        course = course_factory(title=f"Курс {index}", department=first_department)
        _change(
            sync_change_factory,
            catalog_run,
            kind="link_course",
            key=f"first:{index}",
            target_id=str(course.pk),
            after={"ukma_data_id": f"ud-{index}", "majority_share": 1.0},
        )
    for index in range(2):
        course = course_factory(title=f"Інший {index}", department=second_department)
        _change(
            sync_change_factory,
            catalog_run,
            kind="link_course",
            key=f"second:{index}",
            target_id=str(course.pk),
            after={"ukma_data_id": f"ud-other-{index}", "majority_share": 1.0},
        )
    _change(
        sync_change_factory,
        catalog_run,
        kind="link_faculty",
        key="faculty-only",
        target_id=str(first.pk),
        after={"ukma_data_id": "ud-faculty"},
    )

    def sample(seed):
        body = superuser_client.get(
            reverse("ukma-data-sync-pending"),
            {"view": "sample", "seed": seed, "page_size": 100},
        ).json()
        return [item["id"] for item in body["items"]]

    same = sample(7)
    assert len(same) == 23
    assert same == sample(7)
    assert sample(8) != same
    body = superuser_client.get(
        reverse("ukma-data-sync-pending"), {"view": "sample", "seed": 7, "page_size": 100}
    ).json()
    assert body["total"] == 23


@pytest.mark.django_db
@pytest.mark.integration
def test_questions_return_course_state_and_a_suggested_target(
    catalog_run,
    superuser_client,
    sync_change_factory,
    course_factory,
    department_factory,
    make_offering,
    rating_factory,
    planned_course_factory,
    student_factory,
    review_fixture,
    catalog_mapping_decision_factory,
):
    department = department_factory(name="Кафедра мереж")
    matching = course_factory(title="Алгоритми і структури даних", department=department)
    other = course_factory(title="Алгоритми та структури даних", department=department)
    matching.ukma_data_id = "ud-merge-2"
    matching.save(update_fields=["ukma_data_id"])
    matching_offering = make_offering(matching)
    other_offering = make_offering(other)
    rating_factory(course_offering=matching_offering)
    rating_factory(course_offering=other_offering)
    rating_factory(course_offering=other_offering)
    planned_course_factory(offering=other_offering, student=student_factory())
    rated_question = _merge_change(
        sync_change_factory,
        catalog_run,
        "ud-merge-2",
        [(matching, 1), (other, 2)],
        ratings=3,
    )
    rated_question.after["display"]["ukma_course"]["title"] = "Алгоритми і структури даних"
    rated_question.save(update_fields=["after"])
    quiet = _merge_change(
        sync_change_factory,
        catalog_run,
        "ud-merge-3",
        [
            (course_factory(title="Тихий курс"), 0),
            (course_factory(title="Інший тихий курс"), 0),
        ],
        ratings=0,
    )
    catalog_mapping_decision_factory(
        kind="merge_courses",
        question_key=quiet.key,
        answer=MappingAnswer.KEEP_APART,
    )

    body = superuser_client.get(reverse("ukma-data-sync-questions")).json()

    assert body["items"][0]["id"] == rated_question.pk
    question = body["items"][0]
    assert question["ratings"] == 3
    assert question["plans"] == 1
    courses = {course["id"]: course for course in question["courses"]}
    matching_card = courses[str(matching.pk)]
    assert matching_card["title_matches_ukma"] is True
    assert matching_card["holds_ukma_id"] is True
    assert matching_card["url"] == f"/courses/{matching.pk}"
    assert matching_card["offerings"][0]["saz_code"] == matching_offering.code
    assert matching_card["offerings"][0]["year"] == 2025
    assert matching_card["offerings"][0]["term"] == "FALL"
    assert matching_card["offerings"][0]["ratings"] == 1
    assert question["suggested_into"] == str(other.pk)
    answered = next(item for item in body["items"] if item["id"] == quiet.pk)
    assert answered["answer"]["answer"] == "keep_apart"


@pytest.mark.django_db
@pytest.mark.integration
def test_questions_order_unanswered_first_then_ratings_then_id(
    catalog_run,
    superuser_client,
    sync_change_factory,
    course_factory,
    make_offering,
    rating_factory,
    catalog_mapping_decision_factory,
):
    low_course = course_factory()
    high_course = course_factory()
    answered_course = course_factory()
    rating_factory(course_offering=make_offering(low_course))
    for _ in range(3):
        rating_factory(course_offering=make_offering(high_course))
    for _ in range(5):
        rating_factory(course_offering=make_offering(answered_course))
    low = _merge_change(
        sync_change_factory,
        catalog_run,
        "ud-low",
        [(low_course, 1), (course_factory(), 0)],
        ratings=1,
    )
    high = _merge_change(
        sync_change_factory,
        catalog_run,
        "ud-high",
        [(high_course, 3), (course_factory(), 0)],
        ratings=3,
    )
    answered = _merge_change(
        sync_change_factory,
        catalog_run,
        "ud-answered",
        [(answered_course, 5), (course_factory(), 0)],
        ratings=5,
    )
    catalog_mapping_decision_factory(
        kind="merge_courses",
        question_key=answered.key,
        answer=MappingAnswer.KEEP_APART,
    )

    body = superuser_client.get(reverse("ukma-data-sync-questions")).json()

    assert [item["id"] for item in body["items"]] == [high.pk, low.pk, answered.pk]
    assert body["next_after"] is None


@pytest.mark.django_db
@pytest.mark.integration
def test_questions_paginate_with_after(review_fixture, catalog_run, superuser_client):
    first = superuser_client.get(reverse("ukma-data-sync-questions"), {"limit": 1}).json()
    second = superuser_client.get(
        reverse("ukma-data-sync-questions"),
        {"limit": 1, "after": first["next_after"]},
    ).json()

    assert first["next_after"] is not None
    assert first["items"][0]["id"] != second["items"][0]["id"]
    assert second["next_after"] is None


@pytest.mark.django_db
@pytest.mark.integration
def test_questions_next_page_keeps_unanswered_after_an_answer(
    catalog_run,
    superuser_client,
    sync_change_factory,
    course_factory,
    catalog_mapping_decision_factory,
):
    changes = [
        _merge_change(
            sync_change_factory,
            catalog_run,
            f"ud-page-{index}",
            [(course_factory(), 0), (course_factory(), 0)],
            ratings=0,
        )
        for index in range(3)
    ]
    url = reverse("ukma-data-sync-questions")
    first = superuser_client.get(url, {"limit": 1}).json()
    catalog_mapping_decision_factory(
        kind="merge_courses",
        question_key=first["items"][0]["key"],
        answer=MappingAnswer.KEEP_APART,
    )

    second = superuser_client.get(url, {"limit": 1, "after": first["next_after"]}).json()
    third = superuser_client.get(url, {"limit": 1, "after": second["next_after"]}).json()

    assert [first["items"][0]["id"], second["items"][0]["id"], third["items"][0]["id"]] == [
        change.pk for change in changes
    ]


@pytest.mark.django_db
@pytest.mark.integration
def test_questions_reject_a_malformed_cursor(catalog_run, superuser_client):
    response = superuser_client.get(reverse("ukma-data-sync-questions"), {"after": "12"})

    assert response.status_code == 400


@pytest.mark.django_db
@pytest.mark.integration
def test_questions_rated_filter(review_fixture, superuser_client):
    rated = superuser_client.get(reverse("ukma-data-sync-questions"), {"rated": "true"}).json()
    unrated = superuser_client.get(reverse("ukma-data-sync-questions"), {"rated": "false"}).json()

    assert [item["id"] for item in rated["items"]] == [review_fixture["merge"].pk]
    assert all(item["id"] != review_fixture["merge"].pk for item in unrated["items"])


@pytest.mark.django_db
@pytest.mark.integration
def test_summary_treats_a_link_course_without_a_majority_share_as_review(
    catalog_run, superuser_client, sync_change_factory, course_factory
):
    course = course_factory(title="Старий курс")
    _change(
        sync_change_factory,
        catalog_run,
        kind="link_course",
        key=str(course.pk),
        target_id=str(course.pk),
        after={
            "ukma_data_id": "ud-old",
            "display": {
                "course": _card("Старий курс"),
                "ukma_course": {"title": "Старий курс"},
            },
        },
    )

    body = superuser_client.get(reverse("ukma-data-sync-summary")).json()

    steps = {step["step"]: step for step in body["steps"]}
    assert steps["exact_links"]["count"] == 0
    assert steps["review_links"]["count"] == 1


@pytest.mark.django_db
@pytest.mark.integration
def test_summary_counts_a_relink_with_plans_as_a_rated_question(
    catalog_run,
    superuser_client,
    sync_change_factory,
    course_factory,
    make_offering,
    planned_course_factory,
    student_factory,
):
    course = course_factory(title="Запланований курс")
    planned_course_factory(offering=make_offering(course), student=student_factory())
    _change(
        sync_change_factory,
        catalog_run,
        kind="relink_course",
        key=str(course.pk),
        target_id=str(course.pk),
        ukma_data_id="ud-relink",
        after={"ukma_data_id": "ud-relink", "display": {"course": _card(course.title)}},
    )

    body = superuser_client.get(reverse("ukma-data-sync-summary")).json()

    steps = {step["step"]: step for step in body["steps"]}
    assert steps["rated_questions"]["count"] == 1
    assert steps["rated_questions"]["plans"] == 1
    assert steps["other_questions"]["count"] == 0


@contextmanager
def _lock_free(_key: int):
    yield True


def _teacher_unit(sync_change_factory, run, offering, email="sync.teacher@example.com"):
    created = sync_change_factory(
        run=run,
        source=SyncSource.TEACHERS,
        group="new",
        kind="teacher_created",
        key=email,
        after={
            "email": email,
            "last_name": "Тестенко",
            "first_name": "Тест",
            "middle_name": "",
        },
    )
    added = sync_change_factory(
        run=run,
        source=SyncSource.TEACHERS,
        group="change",
        kind="teacher_link_added",
        key=f"offering:{offering.pk}|teacher:{email}",
        target_id=str(offering.pk),
        before={"links": []},
        after={"teacher_email": email, "role": "LECTURE_INSTRUCTOR"},
        requires=[{"kind": "teacher_created", "key": email}],
    )
    return created, added


@pytest.mark.django_db
@pytest.mark.integration
def test_run_approvals_list_selection_and_moved_rows(
    superuser_client,
    catalog_run,
    sync_change_factory,
    sync_approval_factory,
    catalog_mapping_decision_factory,
    course_factory,
    course_offering_factory,
    planned_course_factory,
    student_factory,
):
    from_course = course_factory(title="Тестова дисципліна А")
    into_course = course_factory(title="Тестова дисципліна Б")
    source_offering = course_offering_factory(course=from_course)
    planned_course_factory(offering=source_offering, student=student_factory())
    approval = sync_approval_factory(
        run=catalog_run,
        user=superuser_client.user,
        outcome=SyncApprovalOutcome.APPLIED,
        group="mapping",
        change_ids=[1],
        counts={"applied": 1},
    )
    sync_change_factory(
        run=catalog_run,
        group="mapping",
        kind="merge_courses",
        key="ud-merge",
        ukma_data_id="ud-merge",
        state=SyncChangeState.APPLIED,
        approval=approval,
        decided_at=timezone.now(),
        ratings=5,
        after={
            "merge_source": None,
            "courses": [
                {"id": str(from_course.pk), "title": from_course.title, "ratings": 5},
                {"id": str(into_course.pk), "title": into_course.title, "ratings": 0},
            ],
        },
    )
    catalog_mapping_decision_factory(
        kind="merge_courses",
        question_key="ud-merge",
        answer=MappingAnswer.MERGE,
        into=into_course,
        into_ref=str(into_course.pk),
    )

    response = superuser_client.get(
        reverse("ukma-data-sync-run-approvals", kwargs={"run_id": catalog_run.pk})
    )

    assert response.status_code == 200
    item = response.json()["items"][0]
    assert item["selection"] == "Питання, 1 зміна"
    assert item["user_email"] == superuser_client.user.email
    assert item["ratings_moved"] == 5
    assert item["plans_moved"] == 1
    assert item["merged"] == [
        {
            "from_id": str(from_course.pk),
            "into_id": str(into_course.pk),
            "title": from_course.title,
        }
    ]


@pytest.mark.django_db
@pytest.mark.integration
def test_run_export_has_a_bom_and_the_header(
    superuser_client,
    catalog_run,
    sync_change_factory,
    sync_approval_factory,
):
    approval = sync_approval_factory(
        run=catalog_run,
        user=superuser_client.user,
        outcome=SyncApprovalOutcome.APPLIED,
        group="link",
        change_ids=[1],
    )
    sync_change_factory(
        run=catalog_run,
        kind="link_course",
        key="course-key",
        target_id="target-1",
        state=SyncChangeState.APPLIED,
        approval=approval,
        decided_at=timezone.now(),
    )

    response = superuser_client.get(
        reverse("ukma-data-sync-run-export", kwargs={"run_id": catalog_run.pk})
    )

    assert response.status_code == 200
    assert response["Content-Type"] == "text/csv; charset=utf-8"
    assert response.content.startswith(b"\xef\xbb\xbf")
    text = response.content.decode("utf-8-sig")
    lines = text.splitlines()
    assert lines[0] == "type,kind,key,target_id,approval_id,user_email,time"
    assert any(line.startswith(f"approval,link,,,{approval.pk},") for line in lines)
    assert any(
        line.startswith(f"change,link_course,course-key,target-1,{approval.pk},") for line in lines
    )
    assert superuser_client.user.email in text


@pytest.mark.django_db
@pytest.mark.integration
def test_run_export_opens_a_formula_like_key_as_text(
    superuser_client, catalog_run, sync_change_factory
):
    sync_change_factory(
        run=catalog_run,
        kind="link_course",
        key="=HYPERLINK(1)",
        state=SyncChangeState.APPLIED,
        decided_at=timezone.now(),
    )

    response = superuser_client.get(
        reverse("ukma-data-sync-run-export", kwargs={"run_id": catalog_run.pk})
    )

    assert "change,link_course,'=HYPERLINK(1)," in response.content.decode("utf-8-sig")


@pytest.mark.django_db
@pytest.mark.integration
def test_run_approvals_and_export_return_404_for_an_unknown_run(superuser_client):
    assert (
        superuser_client.get(
            reverse("ukma-data-sync-run-approvals", kwargs={"run_id": 999_999})
        ).status_code
        == 404
    )
    assert (
        superuser_client.get(
            reverse("ukma-data-sync-run-export", kwargs={"run_id": 999_999})
        ).status_code
        == 404
    )


@pytest.mark.django_db
@pytest.mark.integration
def test_history_names_a_real_approval_by_the_group_it_applied(
    superuser_client,
    monkeypatch,
    sync_run_factory,
    sync_change_factory,
    course_offering_factory,
):
    monkeypatch.setattr(apply, "advisory_lock", _lock_free)
    teacher_run = sync_run_factory(
        source=SyncSource.TEACHERS,
        status=SyncRunStatus.SUCCEEDED,
        finished_at=timezone.now(),
    )
    created, added = _teacher_unit(sync_change_factory, teacher_run, course_offering_factory())
    decisions.approve([created.pk, added.pk], superuser_client.user, dry_run=False, group="new")

    response = superuser_client.get(
        reverse("ukma-data-sync-run-approvals", kwargs={"run_id": teacher_run.pk})
    )

    assert response.json()["items"][0]["selection"] == "Нові записи, 2 зміни"
