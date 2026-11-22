from __future__ import annotations

import json

from django.core.management.base import CommandError

import pytest

from rating_app.models import SyncChangeGroup, SyncRunStatus, SyncSource

NEW_TITLE = "Тестова дисципліна Б"


@pytest.mark.django_db
@pytest.mark.integration
def test_status_counts_what_waits_per_group(run_catalog_sync, make_catalog_run, make_title_change):
    run = make_catalog_run(age_hours=3)
    make_title_change(run)
    make_title_change(run)

    out = run_catalog_sync("status")

    assert f"Каталог: читання САЗ #{run.pk} завершилось 3 год тому" in out
    assert "тривало 4 хв" in out
    assert "Чекають рішення: 2 зміни" in out
    assert "(зміни курсів 2)" in out
    assert "перемикач catalog_sync_proposals): вимкнено" in out
    assert all(len(line) <= 100 for line in out.splitlines())


@pytest.mark.django_db
@pytest.mark.integration
def test_status_reports_a_failed_latest_run(run_catalog_sync, make_catalog_run, sync_run_factory):
    make_catalog_run()
    failed = sync_run_factory(
        source=SyncSource.CATALOG, status=SyncRunStatus.FAILED, error="short_read"
    )

    out = run_catalog_sync("status")

    assert f"останнє читання #{failed.pk} НЕ вдалося (short_read)" in out
    assert "Діють зміни попереднього" in out


@pytest.mark.django_db
@pytest.mark.integration
def test_status_json_is_machine_readable(run_catalog_sync, make_catalog_run, make_title_change):
    run = make_catalog_run()
    make_title_change(run)

    payload = json.loads(run_catalog_sync("status", "--json"))

    catalog = payload["sources"]["catalog"]
    assert catalog["run_id"] == run.pk
    assert catalog["waiting"] == 1
    assert catalog["waiting_by_group"] == {"change": {"change_course": 1}}
    assert payload["catalog_switch_on"] is False


@pytest.mark.django_db
@pytest.mark.integration
def test_status_says_when_nothing_was_read(run_catalog_sync):
    out = run_catalog_sync("status")

    assert "Каталог: успішних читань САЗ ще не було." in out


@pytest.mark.django_db
@pytest.mark.integration
def test_show_lists_one_change_with_old_and_new_value(
    run_catalog_sync, make_catalog_run, make_title_change
):
    run = make_catalog_run()
    _, rated = make_title_change(run, ratings=12)
    _, quiet = make_title_change(run)

    out = run_catalog_sync("show", "--group", "change", "--limit", "1")

    assert "Зміни, 2 (чекає рішення), показано 1:" in out
    assert f"#{rated.pk}" in out
    assert "12 оцінок" in out
    assert f"→ «{NEW_TITLE}»" in out
    assert f"#{quiet.pk}" not in out
    assert "Ще 1. Далі: --limit 50" in out


@pytest.mark.django_db
@pytest.mark.integration
def test_show_mapping_question_lists_courses_and_answers(
    run_catalog_sync, make_catalog_run, sync_change_factory, course_factory
):
    run = make_catalog_run()
    courses = [course_factory(), course_factory()]
    change = sync_change_factory(
        run=run,
        source=SyncSource.CATALOG,
        group=SyncChangeGroup.MAPPING,
        kind="merge_courses",
        key="ud-course-test",
        ukma_data_id="ud-course-test",
        after={
            "merge_source": None,
            "courses": [{"id": str(course.pk), "ratings": 0} for course in courses],
        },
    )

    out = run_catalog_sync("show", "--group", "mapping")

    assert f"#{change.pk}  Об'єднати курси? · без оцінок" in out
    assert f"id {courses[0].pk}" in out
    assert "відповіді: keep_apart | merge --into <id курсу>" in out


@pytest.mark.django_db
@pytest.mark.integration
def test_show_json_lists_fields(run_catalog_sync, make_catalog_run, make_title_change):
    run = make_catalog_run()
    _, change = make_title_change(run)

    payload = json.loads(run_catalog_sync("show", "--json"))

    assert payload["total"] == 1
    item = payload["items"][0]
    assert item["id"] == change.pk
    assert item["fields"] == [
        {"field": "title", "before": "Тестова дисципліна А", "after": NEW_TITLE}
    ]


@pytest.mark.django_db
@pytest.mark.integration
def test_show_explains_when_there_is_no_run(run_catalog_sync):
    with pytest.raises(CommandError, match="Успішних читань САЗ ще не було"):
        run_catalog_sync("show")
